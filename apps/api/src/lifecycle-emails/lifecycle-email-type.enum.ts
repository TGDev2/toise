// BACKLOG PLAT-2 : types d'e-mails de cycle de vie, valeurs stockées telles
// quelles dans lifecycle_email_sends.email_type (varchar, pas d'enum SQL —
// ajouter un type ne nécessite aucune migration).
export enum LifecycleEmailType {
  ONBOARDING_D1 = 'onboarding_d1',
  ONBOARDING_D3 = 'onboarding_d3',
  PROJECT_ABANDONED = 'project_abandoned',
  TRIAL_ENDING_SOON = 'trial_ending_soon',
  // DATA-5 : relance de clôture. Aucun recouvrement avec `project_abandoned`,
  // qui vise les projets `draft`/`active` — celui-ci ne regarde que les
  // projets `estimated`, c'est-à-dire ceux dont le chantier a pu avoir lieu.
  CLOSEOUT_DUE = 'closeout_due',
}
