import dataSource from '../config/data-source';

/**
 * Exécution des migrations au démarrage du conteneur, avec verrou et sortie
 * distincte.
 *
 * Ce que remplaçait ce script : `typeorm migration:run … && node dist/main.js`
 * directement dans le `CMD` du Dockerfile. Deux défauts.
 *
 * 1. **Aucune distinction entre « la migration a échoué » et « l'application a
 *    crashé ».** Sous `restart: unless-stopped`, les deux produisent la même
 *    boucle de redémarrage et le même bruit dans les logs, alors qu'ils
 *    appellent des gestes opposés — corriger une migration, ou regarder
 *    l'application. Ici l'échec de migration sort en {@link MIGRATION_FAILURE}
 *    avec un message qui le nomme.
 * 2. **Aucun verrou.** Sans objet en mono-instance, bloquant au premier passage
 *    à plusieurs réplicas : deux conteneurs qui démarrent ensemble lancent deux
 *    fois le même `ALTER TABLE`. Le verrou consultatif ci-dessous sérialise les
 *    démarrages — le second attend, constate qu'il n'y a plus rien à appliquer
 *    et rend la main.
 *
 * Le verrou est *session-level* (`pg_advisory_lock`), pas transactionnel : les
 * migrations ouvrent leurs propres transactions, un verrou de transaction serait
 * relâché à la première d'entre elles.
 */

/** Sortie réservée à l'échec de migration, pour la distinguer d'un crash applicatif. */
const MIGRATION_FAILURE = 3;

/**
 * Clé arbitraire mais stable — changer cette valeur, c'est perdre l'exclusion
 * mutuelle avec les instances qui tournent encore avec l'ancienne.
 */
const ADVISORY_LOCK_KEY = 4_071_205_001;

async function main(): Promise<void> {
  await dataSource.initialize();

  const runner = dataSource.createQueryRunner();
  await runner.connect();

  console.log(`[migrate] attente du verrou consultatif ${ADVISORY_LOCK_KEY}…`);
  await runner.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);

  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    if (applied.length === 0) {
      console.log('[migrate] schéma déjà à jour, aucune migration appliquée.');
    } else {
      console.log(
        `[migrate] ${applied.length} migration(s) appliquée(s) : ` +
          applied.map((m) => m.name).join(', '),
      );
    }
  } finally {
    await runner.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
    await runner.release();
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  // Le préfixe est ce que cherchera l'humain qui lit les logs d'un conteneur en
  // boucle de redémarrage : il dit lequel des deux problèmes il regarde.
  console.error(
    '[migrate] ÉCHEC DE MIGRATION — le schéma n’a pas été mis à jour, ' +
      "l'application n'a pas démarré.",
  );
  console.error(error);
  process.exit(MIGRATION_FAILURE);
});
