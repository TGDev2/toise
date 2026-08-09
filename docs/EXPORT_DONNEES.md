# Export des données personnelles (portabilité)

> BACKLOG V1 E6-2. Décrit ce que l'export RGPD (art. 20) contient, ce qu'il
> écarte et pourquoi, et comment il est produit. La version destinée aux
> utilisateurs est la section « Vos droits » de `/privacy`.

---

## 1. Le principe : toujours asynchrone, une seule voie de code

`POST /auth/me/export` ne génère jamais l'archive dans la requête HTTP : il
crée une ligne (`data_export_requests`, statut `pending`) et déclenche
`DataExportService.processExport` en tâche de fond, sans l'attendre — même
geste que la génération de vignette dans `PhotosService.uploadPhoto`. Le
client sonde `GET /auth/me/export/:id` jusqu'à `ready` ou `failed`, puis
télécharge via `GET /auth/me/export/:id/download`.

Une seule voie de code, quel que soit le volume du compte, pour deux raisons :

- **Jamais un fichier entier en mémoire.** L'archive est écrite en flux sur le
  volume au fur et à mesure (`archiver` → `StorageProvider.saveStream`), et
  chaque photo est lue depuis le disque une par une (`archive.file`), jamais
  bufferisée entière par ce service. Un compte à plusieurs centaines de photos
  ne coûte donc pas plus de mémoire qu'un compte vide.
- **Un seul chemin à maintenir.** Un seuil « petit compte = synchrone, gros
  compte = asynchrone » doublerait le code pour un gain nul : l'écriture en
  flux rend déjà la voie asynchrone bon marché quel que soit le volume.

## 2. Le périmètre : le compte, et rien d'autre

L'export reprend l'intégralité de la donnée dont le compte est propriétaire :
projets, clients, devis, factures, profil d'entreprise. Il ne contient jamais
la donnée d'un autre compte.

**Ce point a changé avec E4-1** (ADR 0002 §2, D3 étendue). Jusque-là le
périmètre était l'**organisation entière** : pour chaque organisation dont le
compte était membre — pas seulement propriétaire — l'export reprenait tout, y
compris ce qu'avaient créé les autres membres. C'était une décision délibérée
et non un oubli de filtrage : un membre voyait déjà cette donnée dans
l'application, l'export ne révélait donc rien de nouveau. Les organisations
supprimées, la question ne se pose plus — la propriété est revenue sur
`user_id` et la frontière du compte est étanche.

Le format du JSON change en conséquence : `format_version` passe de `1.0`
à `2.0`, et le tableau `organizations[]` disparaît au profit d'un contenu
remonté à la racine du manifeste.

**Ce qui reste borné à l'auteur :**
l'activité communautaire (`community_activity`) ne recense que les likes et
commentaires posés **par** ce compte. Les likes/commentaires posés par
d'autres comptes sur une publication de ce compte ne sont jamais énumérés
nominativement dans son export — seul le compteur agrégé déjà public
(`community_projects[].likes_count`) est repris. Un like ou un commentaire est
la donnée personnelle de son auteur, pas de la personne publiée.

## 3. Ce que l'archive contient

```
data.json                    — un seul fichier JSON, documenté (voir §4)
documents/
  quotes/<id>-<numero>.pdf   — devis, régénérés à l'identique de l'export direct
  invoices/<id>-<numero>.pdf — factures, idem
  photos/<projectId>/<id>-<nom original> — photos originales (pas les vignettes)
```

Les PDF ne sont **pas** stockés à l'avance sur le disque ailleurs dans
l'application (ils sont générés à la demande par `QuotePdfService`/
`InvoicePdfService`) : l'export les régénère au moment de la demande, avec les
mêmes services que le téléchargement direct d'un devis ou d'une facture.

Un devis dont le compte n'a pas encore renseigné de profil d'entreprise
n'a pas de PDF possible (`QuotePdfService.generatePdf` exige un
`CompanyProfile`) : `data.json` porte alors `pdf_file: null` et
`pdf_skip_reason: "no_company_profile"` pour ce devis précis — jamais un
mensonge silencieux sur le contenu de l'archive.

## 4. `data.json` : structuré et auto-documenté

Le fichier s'ouvre sur une clé `_documentation` (horodatage, version de
format, note par section, liste des entités exclues avec leur raison) plutôt
que sur un `README` séparé : une seule pièce à distribuer, qui se comprend
sans autre document.

Sections principales : `profile` (compte, abonnement, historique de
facturation Stripe), `company_profile`, `clients`,
`invoices_without_project`, et `projects[]` (pièces, dimensions,
exclusions, ouvertures, ouvrages, estimations, liste d'achat/déclarations
d'achat, jalons de chantier, devis, factures, photos, publication
communautaire éventuelle), `community_activity`, `referrals` (comme parrain et
comme filleul), `logbook_entries`, `lifecycle_emails`, `analytics_events`,
`subscription_refunds`.

### Historique de facturation Stripe

`profile.billing_history` interroge Stripe en direct
(`SubscriptionsService.listBillingHistory`, pagination automatique du SDK) —
les tables locales (`subscriptions`, `invoices`) ne portent que l'état
d'abonnement courant et les documents métier, jamais les transactions Stripe
elles-mêmes. Dégrade sans faire échouer le reste de l'export
(`{available: false, reason: "no_stripe_customer" | "stripe_unavailable"}`) si
le compte n'a pas de client Stripe ou si l'appel échoue : un incident Stripe
ne doit pas priver le compte du reste de ses données.

`subscription_refunds` est exportée **à part**, et pas fondue dans cet
historique : ces lignes-là sont les nôtres — elles portent le motif saisi par
la personne, la date de paiement qui a servi d'ancre et l'échéance qui lui a
été appliquée. Elles restent disponibles même quand Stripe ne répond pas.

## 5. Entités écartées, et pourquoi

| Entité | Raison |
| --- | --- |
| `work_types` | Catalogue de référence global des ouvrages, identique pour tous les comptes. |
| `complementary_materials` | Catalogue de référence global. |
| `materials_catalog`, `material_packaging`, `waste_factors`, `material_eco_equivalences`, `work_type_materials` | Catalogue produit/matériaux global ; `modified_by` de `materials_catalog` est une trace d'administration système, pas une donnée du compte exporté. |
| `learned_waste_factors` | Agrégat statistique inter-comptes, non attribuable à un compte individuel. |
| `cost_benchmarks` | Données de référence anonymisées par construction (k-anonymat), aucune donnée personnelle. |
| `feature_gates` | Configuration globale de fonctionnalités. |
| `supplier_material_match`, `supplier_price_cache` | Cache système de correspondance/prix fournisseurs, non lié à un compte. |
| `stripe_events` | Registre d'idempotence des webhooks Stripe, aucune référence utilisateur. |
| `email_captures` | Capture d'email pré-inscription, sans clé étrangère vers `users` — une correspondance par égalité d'adresse risquerait de rattacher au mauvais compte une capture faite avant la création du compte ou par un tiers ayant utilisé la même adresse. |
| `data_export_requests` | Trace opérationnelle du mécanisme d'export lui-même, pas une donnée métier du compte. |

Cette table **est** le code : `EXCLUDED_ENTITIES` dans
`apps/api/src/data-export/data-export.service.ts` est l'unique source, reprise
telle quelle dans `data.json` et vérifiée par
`apps/api/src/data-export/entity-coverage.spec.ts` — toute entité future du
dépôt non classée dans `EXPORTED_ENTITIES` ni `EXCLUDED_ENTITIES` fait échouer
ce test plutôt que de sortir silencieusement du périmètre.

## 6. Stockage et durée de vie

L'archive est écrite sous `exports/<user_id>/<request_id>.zip`, un préfixe du
même volume que les photos (`StorageProvider`) — pas un volume dédié.
`EXPORT_RETENTION_HOURS` (défaut **48 h**) borne sa durée de vie : elle porte
IBAN/BIC (`company_profiles`) et des coordonnées clients, elle ne doit pas
traîner sur le disque au-delà de la fenêtre de téléchargement. Une tâche
planifiée horaire (`DataExportService.purgeExpiredExports`) efface fichier et
ligne des archives expirées, et échoue proprement les demandes `processing`
bloquées trop longtemps (crash pendant la génération).

**Suppression de compte.** `exports/<user_id>/` est un second emplacement de
fichiers que la suppression de compte doit connaître — même mécanique de fuite
que celle trouvée pour `mergeGuestAccount` pendant E6-1. `AuthService.
deleteAccount` et `mergeGuestAccount` purgent ce préfixe au même moment que
l'effacement des fichiers du compte, avant la suppression des lignes.

## 7. Vérification

- `apps/api/test/integration/data-export.int-spec.ts` — PostgreSQL et volume
  réels : un compte peuplé et un second compte voisin, chaque identifiant
  seedé retrouvé dans le manifeste et aucun de ceux du voisin, l'archive
  réellement rouverte et son `data.json` reparsé, la frontière de scope
  communautaire vérifiée par contenu (pas d'identité de tiers), la
  dégradation du PDF sans profil d'entreprise, et la purge d'expiration.
- `apps/api/src/data-export/data-export.service.spec.ts` — déduplication de
  requête en cours, dégradation Stripe, cron d'expiration, échec propre.
- `apps/api/src/data-export/entity-coverage.spec.ts` — garde-fou anti-oubli
  décrit au §5.
