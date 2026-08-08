import { readFileSync } from 'fs';
import { resolve } from 'path';
import { seedWorkTypes } from './work-types.data';
import {
  seedLaborTimes,
  SeedLaborTime,
  LaborUnitBasis,
} from './labor-times.data';
import { POSES_BY_WORK_TYPE } from '../estimations/pose-types';

/**
 * E2-1 — le registre des temps de pose est sourcé, et le doc le prouve.
 *
 * Même contrat que `materials/sources-catalogue.spec.ts` : la section
 * « Temps de pose unitaires (E2-1) » de `docs/SOURCES_CATALOGUE.md` porte un
 * tableau dont le format (11 colonnes visibles, en-têtes exacts) est
 * contractuel — le renommer casse ce spec, c'est voulu. Le tableau est à
 * **13 cellules pipe** précisément pour ne pas être avalé par le parseur du
 * spec matériaux, qui balaie le même fichier et retient les lignes à
 * 10 cellules.
 *
 * Deux exigences que le registre matériaux n'a pas :
 * - pas d'échappatoire « définitionnel » : un temps de pose a toujours une
 *   source, les cinq champs sont obligatoires sur chaque ligne ;
 * - interdit commercial : Batiprix et BatiChiffrage vendent exactement cette
 *   donnée, aucune ligne ne doit les citer (BACKLOG_V1, E2-1).
 */

const DOC = resolve(__dirname, '../../../../docs/SOURCES_CATALOGUE.md');
const SECTION_HEADING = '## Temps de pose unitaires (E2-1)';

const SKILL_LEVELS = ['beginner', 'intermediate', 'expert'];
const UNIT_BASES: LaborUnitBasis[] = ['m2', 'ml', 'piece'];

/** Libellés du doc pour `unit_basis`, pendant de `DRIVER_LABELS` (matériaux). */
const UNIT_LABELS: Record<LaborUnitBasis, string> = {
  m2: 'm²',
  ml: 'ml',
  piece: 'pièce',
};

/** Cellule « — » = absent (niveau « tous », fourchette non publiée). */
const EMPTY_CELL = '—';

interface LaborRow {
  ouvrage: string;
  pose: string;
  niveau: string;
  unite: string;
  basse: string;
  haute: string;
  valeur: string;
  conditions: string;
  source: string;
  url: string;
  date: string;
}

const doc = readFileSync(DOC, 'utf8');

const sectionStart = doc.indexOf(SECTION_HEADING);
const sectionRest = doc.slice(sectionStart + SECTION_HEADING.length);
const nextHeading = sectionRest.search(/\n## /);
const section =
  sectionStart === -1
    ? ''
    : sectionRest.slice(0, nextHeading === -1 ? undefined : nextHeading);

const rows: LaborRow[] = section
  .split('\n')
  .filter((line) => line.startsWith('|'))
  .map((line) => line.split('|').map((cell) => cell.trim()))
  .filter(
    (cells) =>
      cells.length === 13 &&
      cells[1] !== 'Ouvrage' &&
      !/^[-\s]*$/.test(cells[1]),
  )
  .map((cells) => ({
    ouvrage: cells[1].replace(/`/g, ''),
    pose: cells[2].replace(/`/g, ''),
    niveau: cells[3].replace(/`/g, ''),
    unite: cells[4],
    basse: cells[5],
    haute: cells[6],
    valeur: cells[7],
    conditions: cells[8],
    source: cells[9],
    url: cells[10],
    date: cells[11],
  }));

const key = (ouvrage: string, pose: string, niveau: string) =>
  `${ouvrage}:${pose}:${niveau}`;

const rowByKey = new Map(
  rows.map((r) => [key(r.ouvrage, r.pose, r.niveau), r]),
);
const seedByKey = new Map(
  seedLaborTimes.map((t) => [
    key(t.work_type_code, t.pose_type, t.skill_level ?? EMPTY_CELL),
    t,
  ]),
);

const describeTime = (t: SeedLaborTime) =>
  `${t.work_type_code}/${t.pose_type}/${t.skill_level ?? 'tous niveaux'}`;

describe('SOURCES_CATALOGUE.md — temps de pose unitaires (E2-1)', () => {
  it('porte la section et un tableau non vide', () => {
    // Garde anti-vacuité : une section renommée ou un tableau mal parsé doit
    // échouer fort, pas faire passer les assertions suivantes sur zéro ligne.
    expect(sectionStart).toBeGreaterThan(-1);
    // 16 lignes : 7 lignes de base + diagonale sol + bâton rompu + 7 lignes
    // débutant (E2-1).
    expect(rows.length).toBeGreaterThanOrEqual(16);
    expect(seedLaborTimes.length).toBeGreaterThanOrEqual(16);
  });

  it('couvre chaque ouvrage seedé par une ligne de base sourcée', () => {
    // L'exigence du backlog : ce test échoue si un ouvrage n'a pas de temps
    // de pose sourcé. La ligne de base — pose par défaut, tous niveaux — est
    // aussi la garantie de terminaison du contrat de résolution d'E2-2.
    const missing = seedWorkTypes
      .filter(
        (wt) =>
          !seedLaborTimes.some(
            (t) =>
              t.work_type_code === wt.code &&
              t.pose_type === POSES_BY_WORK_TYPE[wt.code][0] &&
              t.skill_level === undefined,
          ),
      )
      .map((wt) => wt.code);
    expect(missing).toEqual([]);
  });

  it('ne déclare que des axes existants', () => {
    const codes = new Set(seedWorkTypes.map((wt) => wt.code));
    const invalid = seedLaborTimes
      .filter(
        (t) =>
          !codes.has(t.work_type_code) ||
          !POSES_BY_WORK_TYPE[t.work_type_code]?.includes(t.pose_type) ||
          (t.skill_level !== undefined &&
            !SKILL_LEVELS.includes(t.skill_level)) ||
          !UNIT_BASES.includes(t.unit_basis),
      )
      .map(describeTime);
    expect(invalid).toEqual([]);
  });

  it('affiche dans le doc exactement les valeurs seedées', () => {
    for (const t of seedLaborTimes) {
      const row = rowByKey.get(
        key(t.work_type_code, t.pose_type, t.skill_level ?? EMPTY_CELL),
      );
      // Toute divergence données ↔ doc — ligne absente, valeur retouchée à la
      // main, fourchette recopiée de travers — casse ici, dans les deux sens
      // avec le test suivant.
      expect({ ligne: describeTime(t), presente: row !== undefined }).toEqual({
        ligne: describeTime(t),
        presente: true,
      });
      expect(Number(row!.valeur)).toBe(t.hours_per_unit);
      expect(row!.unite).toBe(UNIT_LABELS[t.unit_basis]);
      if (t.hours_low === undefined) {
        expect(row!.basse).toBe(EMPTY_CELL);
        expect(row!.haute).toBe(EMPTY_CELL);
      } else {
        expect(Number(row!.basse)).toBe(t.hours_low);
        expect(Number(row!.haute)).toBe(t.hours_high);
      }
    }
  });

  it('ne documente que des temps qui existent au registre seedé', () => {
    const orphans = rows
      .filter((r) => !seedByKey.has(key(r.ouvrage, r.pose, r.niveau)))
      .map((r) => `${r.ouvrage}/${r.pose}/${r.niveau}`);
    expect(orphans).toEqual([]);
  });

  it('porte des fourchettes cohérentes', () => {
    // Doctrine des bornes de consommation : une fourchette vient de
    // l'étalement des chiffres publiés — les deux bornes ensemble, jamais une
    // seule, et la valeur retenue dedans.
    for (const t of seedLaborTimes) {
      expect((t.hours_low === undefined) === (t.hours_high === undefined)).toBe(
        true,
      );
      if (t.hours_low !== undefined && t.hours_high !== undefined) {
        expect(t.hours_low).toBeLessThan(t.hours_high);
        expect(t.hours_per_unit).toBeGreaterThanOrEqual(t.hours_low);
        expect(t.hours_per_unit).toBeLessThanOrEqual(t.hours_high);
      }
    }
  });

  it('reste dans un ordre de grandeur en heures, pas en minutes', () => {
    // Garde anti-erreur d'unité : aucun des sept ouvrages ne dépasse 8 h par
    // unité ; une valeur saisie en min/m² sauterait immédiatement.
    const outOfRange = seedLaborTimes
      .filter((t) => !(t.hours_per_unit > 0 && t.hours_per_unit <= 8))
      .map(describeTime);
    expect(outOfRange).toEqual([]);
  });

  it('porte une source complète sur chaque ligne', () => {
    // Pas d'échappatoire « définitionnel » ici : un temps de pose a toujours
    // une source, les cinq champs sont obligatoires.
    const incomplete = seedLaborTimes
      .filter(
        (t) =>
          !t.source_org ||
          !t.source_document ||
          !t.source_basis_fr ||
          !/^https?:\/\//.test(t.source_url) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(t.source_consulted_on),
      )
      .map(describeTime);
    expect(incomplete).toEqual([]);
    for (const r of rows) {
      expect(r.source).toBeTruthy();
      expect(r.url).toMatch(/^https?:\/\//);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('ne cite jamais une base commerciale', () => {
    // BACKLOG_V1, E2-1 : Batiprix et BatiChiffrage vendent cette donnée. La
    // note légale de la section peut les nommer ; les lignes du registre et
    // du tableau, jamais.
    const forbidden = /batiprix|batichiffrage/i;
    for (const t of seedLaborTimes) {
      expect(JSON.stringify(t)).not.toMatch(forbidden);
    }
    for (const r of rows) {
      expect(JSON.stringify(r)).not.toMatch(forbidden);
    }
  });

  it("annonce ce que les temps n'incluent pas", () => {
    // Les quatre postes exclus (BACKLOG_V1, E2-1) doivent être traités dans
    // la section elle-même — une mention ailleurs dans le doc ne suffit pas.
    for (const poste of [
      'préparation',
      'protection',
      'nettoyage',
      'déplacement',
    ]) {
      expect(section.toLowerCase()).toContain(poste);
    }
  });
});
