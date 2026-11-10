import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { CommunityProject } from '../community/entities/community-project.entity';
import type { StorageProvider } from '../photos/storage/storage.interface';
import { STORAGE_PROVIDER } from '../photos/storage/storage.interface';

/**
 * Empêche la passe nocturne et un lancement manuel de se marcher dessus. Le
 * travail est idempotent — ce verrou ne protège donc pas d'une corruption, il
 * protège le **journal** : un même projet rapporté « 4 fichiers effacés » par
 * une passe et « 0 fichier » par l'autre rendrait la preuve d'effacement
 * illisible. Même famille de clés que `migrate.ts` et `waste-learning`.
 */
const DATA_RETENTION_LOCK_KEY = 4_071_205_005;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ce qu'une passe a fait (ou ferait) d'un projet. */
export interface PurgedProject {
  project_id: string;
  user_id: string;
  deleted_at: Date | null;
  files: number;
  bytes: number;
  community_withdrawn: boolean;
}

export interface PurgeSummary {
  dry_run: boolean;
  /** Date de coupure appliquée ; `null` pour un effacement non lié à la rétention. */
  cutoff: Date | null;
  /** Vrai quand une autre passe tenait le verrou : rien n'a été examiné. */
  skipped: boolean;
  projects: PurgedProject[];
  files: number;
  bytes: number;
  /** Projets qu'une erreur a laissés en place ; la passe suivante les reprend. */
  failed: string[];
}

interface ExpiredProjectRow {
  id: string;
  user_id: string;
  deleted_at: Date | null;
}

/**
 * E6-1 — droit à l'effacement, côté fichiers.
 *
 * Trois chemins de suppression coexistaient, aucun n'effaçait de fichier :
 * `deletePhoto` traitait une photo à la fois, `softDeleteProject` ne posait
 * qu'un `deleted_at`, et `deleteAccount` supprimait les lignes `project_photos`
 * en cascade — donc les `storage_url` qui étaient le **seul** moyen de retrouver
 * les fichiers. Chaque suppression de compte transformait ainsi des photos
 * d'intérieurs de clients en déchets permanents du volume `uploads`, repris à
 * chaque sauvegarde nocturne chiffrée.
 *
 * Deux entrées ici, une seule mécanique :
 *
 * - `purgeExpiredProjects` — passe planifiée, efface les projets dont la
 *   rétention après suppression logique est expirée (lignes **et** fichiers) ;
 * - `eraseUserFiles` — effacement immédiat au moment où un compte part,
 *   pour les projets que la suppression emporte.
 *
 * **L'ordre est la décision structurante : fichiers d'abord, base ensuite.**
 * L'inverse est le seul ordre irréparable — la ligne partie, plus rien ne
 * désigne les fichiers et aucune passe future ne peut les retrouver. Dans cet
 * ordre, une panne laisse un projet encore marqué supprimé, que la passe
 * suivante reprend ; `deletePrefix` tolérant l'absence, la reprise est gratuite.
 * C'est ce qui rend l'opération rejouable.
 *
 * La durée de rétention et son argumentaire : `docs/RETENTION_DONNEES.md`.
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);
  private readonly retentionDays: number;
  private readonly configuredDryRun: boolean;

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(CommunityProject)
    private readonly communityRepo: Repository<CommunityProject>,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.retentionDays = config.get<number>('dataRetention.days', 30);
    this.configuredDryRun = config.get<boolean>('dataRetention.dryRun', false);
  }

  /**
   * 3 h du matin : la purge lit puis efface un volume de fichiers, et la
   * sauvegarde nocturne passe avant. Un rejet non capturé dans un `@Cron`
   * tuerait le process — d'où le `try/catch`, la passe suivante reprenant ce que
   * celle-ci n'a pas fini.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: 'Europe/Paris' })
  async runDailyPurge(): Promise<void> {
    try {
      await this.purgeExpiredProjects();
    } catch (err) {
      this.logger.error(
        `Échec de la purge de rétention : ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async purgeExpiredProjects(
    options: { dryRun?: boolean } = {},
  ): Promise<PurgeSummary> {
    const dryRun = options.dryRun ?? this.configuredDryRun;
    const cutoff = this.retentionCutoff();

    return this.withAdvisoryLock(cutoff, dryRun, async () => {
      const expired = await this.findExpiredProjects(cutoff);
      const summary = this.emptySummary(dryRun, cutoff);

      for (const row of expired) {
        try {
          const purged = await this.purgeProject(row, dryRun);
          summary.projects.push(purged);
          summary.files += purged.files;
          summary.bytes += purged.bytes;
          this.logProject(purged, dryRun);
        } catch (err) {
          // Un projet illisible ne doit pas retenir les autres : la passe est là
          // pour faire baisser le stock, et ce projet reste marqué supprimé donc
          // repris demain. L'échec est journalisé, jamais avalé.
          summary.failed.push(row.id);
          this.logger.error(
            `Purge impossible pour le projet ${row.id} : ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }

      this.logSummary(summary);
      return summary;
    });
  }

  /**
   * Effacement immédiat des fichiers des projets qu'une suppression de compte
   * emporte (`AuthService.deleteAccount`).
   *
   * Le périmètre est l'utilisateur : depuis E4-1 la propriété d'un projet est
   * de nouveau portée par `user_id`, et il n'existe plus de projet qui
   * survivrait à son propriétaire.
   *
   * Contrairement à la passe nocturne, **toute erreur remonte** : cet appel
   * précède la suppression des lignes, et continuer après un échec reviendrait à
   * annoncer un effacement qui n'a pas eu lieu, en supprimant du même coup ce qui
   * permettait de le rattraper.
   */
  async eraseUserFiles(userId: string): Promise<PurgeSummary> {
    const summary = this.emptySummary(false, null);

    const rows = await this.projectRepo
      .createQueryBuilder('p')
      .select('p.id', 'id')
      .addSelect('p.user_id', 'user_id')
      .addSelect('p.deleted_at', 'deleted_at')
      .where('p.user_id = :userId', { userId })
      // Les projets déjà supprimés logiquement gardent leurs fichiers jusqu'à la
      // fin de leur rétention. Le compte partant, cette rétention n'a plus
      // d'objet : ils partent avec les autres.
      .withDeleted()
      .getRawMany<ExpiredProjectRow>();

    for (const row of rows) {
      const purged = await this.purgeProject(row, false, { deleteRow: false });
      summary.projects.push(purged);
      summary.files += purged.files;
      summary.bytes += purged.bytes;
    }

    this.logger.log(
      `Suppression de compte : ${summary.files} fichier(s) effacé(s) (${formatBytes(
        summary.bytes,
      )}) sur ${rows.length} projet(s) du compte ${userId}`,
    );
    return summary;
  }

  /**
   * Retirer la publication, effacer les fichiers, puis supprimer la ligne.
   *
   * Le retrait communautaire vient **en premier** parce qu'il est le seul geste
   * observable de l'extérieur : entre l'effacement des fichiers et la suppression
   * de la ligne, une publication encore approuvée servirait des photos absentes
   * sur une page publique. `softDeleteProject` fait déjà ce retrait au moment de
   * la suppression ; le refaire ici couvre les publications écrites avant ce
   * correctif, et coûte un `UPDATE` sans effet dans tous les autres cas.
   */
  private async purgeProject(
    row: ExpiredProjectRow,
    dryRun: boolean,
    options: { deleteRow?: boolean } = {},
  ): Promise<PurgedProject> {
    const deleteRow = options.deleteRow ?? true;

    // `count` exclut nativement les lignes déjà retirées : ce compteur dit donc
    // « une publication est encore visible », pas « ce projet a été publié ».
    const publications = await this.communityRepo.count({
      where: { project_id: row.id },
    });

    if (!dryRun && publications > 0) {
      await this.communityRepo.softDelete({ project_id: row.id });
    }

    const files = dryRun
      ? await this.storage.listPrefix(row.id)
      : await this.storage.deletePrefix(row.id);

    if (!dryRun && deleteRow) {
      await this.projectRepo.delete(row.id);
    }

    return {
      project_id: row.id,
      user_id: row.user_id,
      deleted_at: row.deleted_at,
      files: files.length,
      bytes: files.reduce((total, file) => total + file.bytes, 0),
      community_withdrawn: publications > 0,
    };
  }

  /**
   * Sélection en colonnes brutes, sans hydrater l'entité : `Project.rooms` est en
   * `eager`, et charger la géométrie de chaque projet pour n'en lire que
   * l'identifiant ferait exploser la passe.
   */
  private async findExpiredProjects(
    cutoff: Date,
  ): Promise<ExpiredProjectRow[]> {
    return this.projectRepo
      .createQueryBuilder('p')
      .select('p.id', 'id')
      .addSelect('p.user_id', 'user_id')
      .addSelect('p.deleted_at', 'deleted_at')
      .where('p.deleted_at IS NOT NULL')
      .andWhere('p.deleted_at <= :cutoff', { cutoff })
      .withDeleted()
      .orderBy('p.deleted_at', 'ASC')
      .getRawMany<ExpiredProjectRow>();
  }

  /**
   * Une rétention nulle ou négative placerait la coupure à maintenant ou plus
   * tard : la passe emporterait **tout** le stock supprimé logiquement, y compris
   * le projet effacé par erreur il y a une minute. Une configuration absurde doit
   * arrêter une opération destructive, pas l'élargir.
   */
  private retentionCutoff(): Date {
    if (!Number.isFinite(this.retentionDays) || this.retentionDays <= 0) {
      throw new Error(
        `Rétention invalide (DATA_RETENTION_DAYS = ${this.retentionDays}) : la purge exige un nombre de jours strictement positif`,
      );
    }

    // Durée fixe, pas un recul en jours calendaires locaux : `setDate` ferait
    // dépendre la coupure du fuseau du serveur (une heure d'écart quand la
    // fenêtre traverse un changement d'heure).
    return new Date(Date.now() - this.retentionDays * DAY_MS);
  }

  private async withAdvisoryLock(
    cutoff: Date,
    dryRun: boolean,
    work: () => Promise<PurgeSummary>,
  ): Promise<PurgeSummary> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      const [{ locked }] = (await runner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [DATA_RETENTION_LOCK_KEY],
      )) as { locked: boolean }[];

      if (!locked) {
        this.logger.warn(
          'Purge de rétention ignorée : une autre passe est en cours',
        );
        return { ...this.emptySummary(dryRun, cutoff), skipped: true };
      }

      try {
        return await work();
      } finally {
        await runner.query('SELECT pg_advisory_unlock($1)', [
          DATA_RETENTION_LOCK_KEY,
        ]);
      }
    } finally {
      await runner.release();
    }
  }

  private emptySummary(dryRun: boolean, cutoff: Date | null): PurgeSummary {
    return {
      dry_run: dryRun,
      cutoff,
      skipped: false,
      projects: [],
      files: 0,
      bytes: 0,
      failed: [],
    };
  }

  private logProject(purged: PurgedProject, dryRun: boolean): void {
    const deletedAt = purged.deleted_at?.toISOString() ?? 'inconnu';
    this.logger.log(
      `${prefixOf(dryRun)}Projet ${purged.project_id} (compte ${
        purged.user_id
      }, supprimé le ${deletedAt}) : ${purged.files} fichier(s), ${formatBytes(
        purged.bytes,
      )}${purged.community_withdrawn ? ', publication communautaire retirée' : ''}`,
    );
  }

  private logSummary(summary: PurgeSummary): void {
    const cutoff = summary.cutoff?.toISOString() ?? 'sans coupure';
    this.logger.log(
      `${prefixOf(summary.dry_run)}Purge de rétention (${this.retentionDays} j, coupure ${cutoff}) : ` +
        `${summary.projects.length} projet(s), ${summary.files} fichier(s), ${formatBytes(summary.bytes)}` +
        (summary.failed.length > 0
          ? `, ${summary.failed.length} échec(s) : ${summary.failed.join(', ')}`
          : ''),
    );
  }
}

function prefixOf(dryRun: boolean): string {
  return dryRun ? '[SIMULATION] ' : '';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Kio`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mio`;
}
