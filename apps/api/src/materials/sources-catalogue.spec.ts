import { readFileSync } from 'fs';
import { resolve } from 'path';
import { seedMaterials } from './seed-catalog.data';
import { workTypeMaterialLinks } from './work-type-materials.data';

/**
 * E1-7 — la traçabilité est un contrat, pas une intention : chaque matériau
 * servi par un ouvrage V1 doit avoir sa ligne dans docs/SOURCES_CATALOGUE.md
 * (source + date), le rendement du registre doit être celui du seed, et un
 * matériau « retiré » ne doit plus être lié. Sans ce spec, la prochaine
 * liaison ajoutée sans source — ou le prochain rendement corrigé sans mise à
 * jour du registre — passerait en silence.
 *
 * Le format du tableau (8 colonnes, en-têtes exacts) est contractuel :
 * renommer une colonne casse ce spec, c'est voulu.
 *
 * E1-3 a ajouté la colonne **Assiette**. Un rendement ne veut rien dire sans
 * l'unité dans laquelle il est exprimé : 0,96 par m² de parement et 0,96 par m²
 * d'ouvrage décrivent deux cloisons dont l'une consomme le double de l'autre.
 * Le registre doit donc porter les deux, et le spec vérifie les deux — sans
 * quoi un `quantity_driver` changé dans le seed laisserait un registre exact au
 * chiffre et faux au sens.
 */

const DOC = resolve(__dirname, '../../../../docs/SOURCES_CATALOGUE.md');

/** Libellé de registre de chaque `quantity_driver` (E1-3, E1-10). */
const DRIVER_LABELS: Record<string, string> = {
  work_surface: "surface d'ouvrage",
  clad_faces: 'parement',
  frame_runner: 'lisses',
  frame_stud: 'montants',
  floor_perimeter: 'périmètre au sol',
  door_count: 'passages de porte',
};

interface SourceRow {
  name: string;
  category: string;
  yield_v1: string;
  basis: string;
  decision: string;
  source: string;
  date: string;
}

const rows: SourceRow[] = readFileSync(DOC, 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('|'))
  .map((line) => line.split('|').map((cell) => cell.trim()))
  .filter(
    (cells) =>
      cells.length === 10 &&
      cells[1] !== 'Matériau' &&
      !/^[-\s]*$/.test(cells[1]),
  )
  .map((cells) => ({
    name: cells[1],
    category: cells[2],
    yield_v1: cells[3],
    basis: cells[4],
    decision: cells[6],
    source: cells[7],
    date: cells[8],
  }));

const rowByKey = new Map(rows.map((r) => [`${r.category}:${r.name}`, r]));
const seedByKey = new Map(
  seedMaterials.map((m) => [`${m.category}:${m.name}`, m]),
);
const linkedKeys = [
  ...new Set(
    workTypeMaterialLinks.map(
      (l) => `${l.material_category}:${l.material_name}`,
    ),
  ),
];

describe('SOURCES_CATALOGUE.md — registre des rendements V1', () => {
  it('contient les 49 lignes de la curation E1-3, retraits compris', () => {
    // Garde anti-vacuité : un tableau vide ou mal parsé doit échouer fort,
    // pas faire passer les assertions suivantes sur zéro ligne.
    expect(rows.length).toBeGreaterThanOrEqual(49);
  });

  it('couvre chaque matériau lié par une décision sourcée', () => {
    for (const key of linkedKeys) {
      const row = rowByKey.get(key);
      expect(row).toBeDefined();
      // `ré-exprimer` (E1-3) : la valeur change parce que son **unité** change,
      // pas parce que la fiche disait autre chose. Le distinguer de `corriger`
      // évite de faire passer une conversion pour une révision de source.
      expect(row!.decision).toMatch(/^(conserver|corriger|ré-exprimer)/);
      expect(row!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Un rendement définitionnel (produit vendu au m², posé bord à bord)
      // n'a pas de chiffre de fiche à citer ; tout le reste porte son URL.
      if (!row!.decision.includes('définitionnel')) {
        expect(row!.source).toMatch(/^https?:\/\//);
      }
    }
  });

  it('affiche dans le registre le rendement réellement seedé', () => {
    for (const key of linkedKeys) {
      const row = rowByKey.get(key)!;
      const seed = seedByKey.get(key)!;
      expect(seed).toBeDefined();
      expect(Number(row.yield_v1)).toBe(seed.yield_per_unit);
    }
  });

  /**
   * E1-3 — l'assiette annoncée est celle du catalogue. C'est ce qui empêche le
   * registre de rester juste au chiffre et faux au sens : un montant passé de
   * `frame_stud` à `clad_faces` doublerait l'ossature d'une cloison deux faces
   * sans qu'aucun rendement ne bouge.
   */
  it("annonce l'assiette réellement déclarée par le catalogue", () => {
    for (const key of linkedKeys) {
      const row = rowByKey.get(key)!;
      const seed = seedByKey.get(key)!;
      expect(row.basis).toBe(
        DRIVER_LABELS[seed.quantity_driver ?? 'work_surface'],
      );
    }
  });

  it('ne laisse aucun matériau « retiré » lié à un ouvrage', () => {
    const retired = rows.filter((r) => r.decision.startsWith('retirer'));
    expect(retired.length).toBeGreaterThan(0);
    for (const row of retired) {
      expect(linkedKeys).not.toContain(`${row.category}:${row.name}`);
    }
  });

  it('ne documente que des matériaux qui existent au catalogue seedé', () => {
    for (const row of rows) {
      expect(seedByKey.has(`${row.category}:${row.name}`)).toBe(true);
    }
  });

  /**
   * E1-11 — la traçabilité n'est un argument que si elle est complète : ce
   * test échoue dès qu'un matériau lié à un ouvrage n'a pas de source
   * renseignée sur `materials_catalog` (colonnes `source_*`, portées par le
   * seed `seed-catalog.data.ts`, migration `…094`).
   *
   * `source_basis_fr` est requis pour TOUT matériau lié, y compris un
   * rendement définitionnel (vendu et posé au m²) : c'est lui qui porte le
   * repli sans marque à l'affichage. Les quatre champs identité
   * (fabricant, produit, URL, date) ne sont exigés qu'ensemble — un matériau
   * définitionnel n'en a aucun, un matériau sourcé les a tous. Un état
   * partiel (URL sans date, fabricant sans produit…) est justement le défaut
   * qu'un `??` silencieux laisserait passer, donc il fait échouer ce test.
   */
  it('porte une source complète pour chaque matériau lié', () => {
    for (const key of linkedKeys) {
      const seed = seedByKey.get(key);
      expect(seed).toBeDefined();

      expect(seed!.source_basis_fr).toBeTruthy();
      expect(seed!.source_basis_fr).not.toMatch(
        /\b(Cermix|PRB|Placo|Knauf|Sika|Quick-Step|Wineo|Bricoflor|Quelyd|Bostik|Dulux|Ripolin|Zolpan|V33)\b/,
      );

      const identityFields = [
        seed!.source_manufacturer,
        seed!.source_product,
        seed!.source_url,
        seed!.source_consulted_on,
      ];
      const filled = identityFields.filter((f) => f != null && f !== '');
      expect(
        filled.length === 0 || filled.length === identityFields.length,
      ).toBe(true);

      if (filled.length === identityFields.length) {
        expect(seed!.source_url).toMatch(/^https?:\/\//);
        expect(seed!.source_consulted_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  /**
   * E1-5 — le registre a cessé de ne documenter que des matériaux **liés** : la
   * famille colle et joint y figure en entier, y compris les mortiers qu'aucun
   * ouvrage V1 ne sert (C1, C2F, C2S1), parce que c'est leur comparaison qui
   * rend lisible la correction de l'inversion du « grand format ».
   *
   * Sans cette assertion, ces lignes-là seraient les seules du fichier que rien
   * ne rattacherait au seed : un rendement corrigé dans le code sans être
   * répercuté ici passerait en silence, exactement le trou que ce registre
   * existe pour boucher. Les lignes « retirer » n'annoncent aucun rendement
   * (`—`) et sont donc hors du contrôle.
   */
  it('affiche le rendement seedé pour toute ligne qui en annonce un', () => {
    const quantified = rows.filter((r) => /^[\d.]+$/.test(r.yield_v1));
    // Garde anti-vacuité : une colonne renommée viderait ce filtre en silence.
    expect(quantified.length).toBeGreaterThanOrEqual(35);

    for (const row of quantified) {
      const seed = seedByKey.get(`${row.category}:${row.name}`)!;
      expect({ name: row.name, yield: Number(row.yield_v1) }).toEqual({
        name: row.name,
        yield: seed.yield_per_unit,
      });
    }
  });
});
