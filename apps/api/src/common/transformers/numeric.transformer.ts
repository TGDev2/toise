import type { ValueTransformer } from 'typeorm';

/**
 * Rend un `numeric` PostgreSQL en `number`, comme son type déclaré le promet.
 *
 * **Le problème.** `numeric` a une précision arbitraire, que `double` ne peut
 * pas représenter sans perte. Le pilote `pg` refuse donc de choisir à notre
 * place et renvoie une **chaîne**. Une entité qui déclare `price!: number` sans
 * transformateur ment au compilateur : `typeof row.price === 'string'` à
 * l'exécution, et TypeScript ne peut rien signaler puisque le type annoncé est
 * celui qu'on a écrit, pas celui qu'on reçoit.
 *
 * **Pourquoi c'est silencieux.** Seul `+` trahit la supercherie —
 * `'12.50' + 3` vaut `'12.503'`. `-`, `*`, `/` et les comparaisons numériques
 * convertissent implicitement et donnent le bon résultat. Une colonne n'est donc
 * correcte que par la chance des opérateurs qu'on lui applique, et le jour où
 * quelqu'un écrit une somme, le bug apparaît loin d'ici, dans un total.
 *
 * **Le compromis assumé.** Au-delà de 2^53 - 1 ou d'une échelle très fine,
 * `Number` perd des chiffres. Aucune colonne de ce schéma n'en approche : les
 * précisions vont de 4 à 10, les montants sont en euros, les facteurs en
 * pourcentage. Le jour où une colonne aurait besoin de la précision arbitraire,
 * elle doit être déclarée `string` et manipulée comme telle, sans passer par ce
 * transformeur.
 */
export const numericTransformer: ValueTransformer = {
  /** Écriture : `pg` sérialise correctement un `number`, rien à faire. */
  to: (value: number | null | undefined) => value,
  from: (value: string | number | null): number | null => {
    if (value === null || value === undefined) return null;
    return typeof value === 'number' ? value : Number(value);
  },
};
