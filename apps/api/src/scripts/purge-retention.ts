import { ConfigService } from '@nestjs/config';
import dataSource from '../config/data-source';
import configuration from '../config/configuration';
import { Project } from '../projects/entities/project.entity';
import { CommunityProject } from '../community/entities/community-project.entity';
import { LocalStorageService } from '../photos/storage/local-storage.service';
import {
  DataRetentionService,
  formatBytes,
} from '../data-retention/data-retention.service';

/**
 * E6-1 : déclenchement manuel de la purge de rétention, avec un mode simulation
 * **par défaut**.
 *
 * ```bash
 * # depuis apps/api, avec DB_* dans le .env de la racine
 * pnpm purge:retention            # simulation : recense, n'efface rien
 * pnpm purge:retention --apply    # efface réellement
 * ```
 *
 * Le défaut est la simulation parce que c'est la seule valeur par défaut qu'une
 * faute de frappe rend inoffensive. La destruction se demande explicitement.
 *
 * Ce script n'utilise **pas** `AppModule` : la purge n'a besoin que de la base
 * et du volume de fichiers, quand `AppModule` exigerait des identifiants
 * Firebase, Stripe et Brevo — que ni une console d'exploitation ni une CI ne
 * devraient avoir à détenir pour effacer des photos. Le service est donc
 * instancié à la main, exactement comme le harnais d'intégration
 * (`test/README.md`).
 *
 * Le verrou consultatif interne au service reste actif : un lancement pendant la
 * passe nocturne rend la main plutôt que de dédoubler le journal.
 */

const FAILURE = 1;

function parseDryRun(argv: string[]): boolean {
  if (argv.includes('--apply')) return false;
  if (argv.includes('--dry-run')) return true;
  return true;
}

async function main(): Promise<void> {
  const dryRun = parseDryRun(process.argv.slice(2));

  const config = new ConfigService(configuration());
  await dataSource.initialize();

  try {
    const service = new DataRetentionService(
      dataSource.getRepository(Project),
      dataSource.getRepository(CommunityProject),
      new LocalStorageService(config),
      dataSource,
      config,
    );

    const summary = await service.purgeExpiredProjects({ dryRun });

    if (summary.skipped) {
      console.log(
        '[purge-retention] une autre passe tient le verrou : rien examiné.',
      );
      return;
    }

    const label = dryRun ? 'SIMULATION' : 'EFFACEMENT';
    console.log(
      `\n[purge-retention] ${label} — ${summary.projects.length} projet(s), ` +
        `${summary.files} fichier(s), ${formatBytes(summary.bytes)}` +
        `, coupure au ${summary.cutoff?.toISOString() ?? 'n/a'}`,
    );

    for (const project of summary.projects) {
      console.log(
        `  ${project.project_id}  ${String(project.files).padStart(3)} fichier(s)  ` +
          `${formatBytes(project.bytes).padStart(10)}  ` +
          `supprimé le ${project.deleted_at?.toISOString() ?? '?'}` +
          (project.community_withdrawn ? '  [publication retirée]' : ''),
      );
    }

    if (summary.failed.length > 0) {
      console.error(
        `[purge-retention] ${summary.failed.length} projet(s) en échec : ${summary.failed.join(', ')}`,
      );
      process.exitCode = FAILURE;
    }

    if (dryRun && summary.projects.length > 0) {
      console.log('\n[purge-retention] relancer avec --apply pour effacer.');
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('[purge-retention] échec :', error);
  process.exit(FAILURE);
});
