import type { GuestProjectDraft } from '../guest-drafts';

/**
 * Un brouillon invité **complet** : tout champ déclaré par `GuestProjectDraft`
 * y est renseigné.
 *
 * `guest-drafts.spec.ts` vérifie que ses clés sont exactement
 * `GUEST_DRAFT_FIELDS` — ajouter un champ au type sans le renseigner ici fait
 * échouer ce test, et le test de couverture de la migration
 * (`AuthContext.guest-migration.spec.tsx`) devient à son tour rouge tant que la
 * migration ne le rejoue pas. C'est la chaîne qui manquait quand `work_items`
 * s'est perdu à la conversion.
 */
export const COMPLETE_GUEST_DRAFT: GuestProjectDraft = {
  id: 'local-draft-1',
  name: 'Rénovation salon',
  room_name: 'Salon',
  work_type: 'painting',
  length_m: 4.2,
  width_m: 3.15,
  height_m: 2.5,
  openings: [
    { type: 'door', width_cm: 90, height_cm: 210, count: 1 },
    { type: 'window', width_cm: 120, height_cm: 110, count: 2 },
  ],
  // Pièce en L : le rectangle principal et son décroché.
  segments: [
    { x_cm: 0, y_cm: 0, length_cm: 420, width_cm: 315 },
    { x_cm: 420, y_cm: 0, length_cm: 80, width_cm: 150 },
  ],
  exclusions: [
    {
      surface_target: 'wall',
      type: 'credence',
      label: 'Crédence cuisine',
      area_m2: 1.8,
    },
  ],
  work_items: [
    {
      work_type_id: '3f1b6c2e-8a4d-4e5f-9c11-2b7d5a0e6f83',
      skill_level: 'intermediate',
      custom_params: { number_of_coats: 2 },
    },
  ],
  updated_at: '2026-08-04T09:30:00.000Z',
};
