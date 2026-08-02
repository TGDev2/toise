# Chiffréo — Backlog produit priorisé

> **Statut** : document de travail — juillet 2026
> **Stratégie associée** : [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md)

## Légende

- **Priorités** — **P0** : lancer ce qui existe (semaines 1-4) · **P1** : crédibiliser la promesse de précision · **P2** : monétiser et fidéliser · **P3** : étendre (conditionné aux données post-lancement).
- **Effort** — S : ≤ 1 jour · M : 2-5 jours · L : 1-3 semaines · XL : > 3 semaines.
- **Ladder** — étage de la value ladder servi : Lead magnet · Pro (9,99 €) · Contractor (19-49 €) · Continuité · Enterprise.
- Préfixes d'ID : GTM (go-to-market), OPS (infra/exploitation), ENG (moteur d'estimation), CV (vision par ordinateur), BUY (achat/prix), PRO (artisans), COM (communauté), PLAT (plateforme), DATA (données/flywheel), MOB (mobile), INTL (international).

---

## P0 — Lancer ce qui existe

*Objectif : premier utilisateur payant. Presque aucun développement produit — du provisioning, du légal et de la surface marketing. Tout le reste du backlog est spéculatif tant que P0 n'est pas fait.*

### Epic GTM-A : Surface commerciale

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| GTM-1 | Identité visuelle minimale | Logo, favicon, image OG (listés « reste à faire » dans [tasks/todo.md](../tasks/todo.md)). Condition de crédibilité de tout le reste. | S | — |
| GTM-2 | Landing page vendeuse | Remplacer la landing « Chiffréo MVP » ([apps/web/src/app/page.tsx](../apps/web/src/app/page.tsx)) par une page qui vend : promesse chiffrée (15-25 % d'économie), démo visuelle du parcours photo→liste, preuve (précision mesurée quand disponible), CTA « essayer sans compte » exploitant le mode invité existant. | M | GTM-1 |
| GTM-3 | Page /pricing publique | Les tarifs n'existent qu'en modales in-app ([components/paywall/](../apps/web/src/components/paywall/)). Page publique comparant Free/Pro/Contractor, indexable, liée au checkout. | M | GTM-1 |
| GTM-4 | Lead magnet : calculateurs publics sans compte | **Livré (juillet 2026).** Trois pages `/calculateurs/[type]` (peinture, carrelage, sol) prérendues en statique : formulaire dimensions → estimation immédiate via le moteur existant, sans inscription. CTA « sauvegarder mon projet » → conversion invité→compte. Positionnement revu par GTM-9. | L | — |
| GTM-5 | Capture e-mail sur le lead magnet | **Livré (juillet 2026).** `POST /public/calculators/estimate-email` (3/h, consentement obligatoire, résultat recalculé côté serveur) → `email_captures` + envoi Brevo. Consommé depuis par PRO-3 et PLAT-2. | M | GTM-4 |
| GTM-7 | Une audience par surface | **Livré (02/08/2026).** La proposition de valeur se lisait comme quatre produits concurrents, et `/` basculait du DIY à l'artisan en milieu de page. L'audience devient une donnée du catalogue d'offre ([lib/pricing.ts](../apps/web/src/lib/pricing.ts)) au lieu d'une intention réécrite page par page : `/` au particulier, `/artisans` (nouvelle) à l'artisan, `/pricing` groupée par audience avec bandeau Enterprise sur devis. Chaque ligne d'offre est adossée à sa `feature_key` réelle, gardée par [offer-catalogue.spec.ts](../apps/web/src/__tests__/offer-catalogue.spec.ts). Corrige au passage : 2 fonctionnalités vendues sans exister (palier Standard), 9 gates livrées jamais annoncées, palier `enterprise` appliqué mais injoignable. Cf. [PRODUCT_STRATEGY §4.2.1](PRODUCT_STRATEGY.md). | M | GTM-2, GTM-3 |
| GTM-8 | Réalignement de l'offre artisan | **Livré (02/08/2026).** Contractor demandait 50/100/200 €/mois face à un marché FR à 15-30 € (Boby 14,99 €, Tolteck 19 €, Obat 29 €, EBP 29,25 €, BatiChiffrage 30 €+ et 80 000 travaux unitaires), pour sept ouvrages de finition et un seul bloc de main-d'œuvre : ni plomberie, ni électricité, ni isolation, ni maçonnerie, ni menuiserie. Thèse « suite artisan généraliste » invalidée. Promesse rétrécie aux **métiers de finition** et grille ramenée à **19/29/49 €** ; périmètre couvert et hors périmètre nommés sur `/artisans`, `/pricing` et en FAQ. Paliers et gates inchangés — aucune migration. Gardé par [offer-catalogue.spec.ts](../apps/web/src/__tests__/offer-catalogue.spec.ts) §6-§7. Cf. [PRODUCT_STRATEGY §4.5](PRODUCT_STRATEGY.md). | M | GTM-7 |
| GTM-9 | Repositionnement du lead magnet | **Livré (02/08/2026).** Les calculateurs visaient « calculateur peinture » / « quantité au m² », le terrain des calculettes Leroy Merlin et Castorama — gratuites, indexées de longue date, avec du stock derrière le bouton — alors que nos trois atouts (photo→dimensions, prix, liste d'achats) sont derrière le compte et absents de la page libre. Récit recentré de « combien de m² » vers « combien acheter » : surface nette et marge de perte par niveau et par pose. Les promesses deviennent un ensemble fermé de clés adossées à leur mécanisme (`CALCULATOR_DIFFERENTIATORS`), gardé par [calculators-positioning.spec.ts](../apps/web/src/__tests__/calculators-positioning.spec.ts). Corrige au passage un défaut qui rendait la page moins précise que son propre écran : les surfaces à exclure étaient saisies, déduites dans l'aperçu, puis jetées avant l'appel — et de nouveau perdues à l'inscription d'un invité, avec les décrochés. Cf. [PRODUCT_STRATEGY §4.6](PRODUCT_STRATEGY.md). | M | GTM-4, GTM-7 |
| GTM-10 | Contrôle de devis sans compte | **Livré (02/08/2026).** Le moteur ne servait qu'à préparer un achat ; il sert désormais aussi à contrôler une affirmation. Page publique `/verifier-un-devis` : la pièce est décrite comme sur un calculateur, l'utilisateur saisit la quantité que porte son devis, et `POST /public/quote-check` rend le **taux de perte impliqué** face à la fourchette semée pour cette pose (carrelage droit 5-15 %, diagonale 10-20 %). Intention d'achat supérieure aux calculateurs, sans dépendre d'aucune donnée accumulée : ça marche au premier visiteur. **Conflit artisan tranché** — le verdict porte sur les quantités, jamais sur le prix ni sur l'entreprise ; on renonce en échange au mot-clé « devis trop cher », y compris si le benchmark se remplit. Le verdict de prix est de toute façon inconstructible : aucune colonne de prix au catalogue, et `cost_benchmarks` porte en base `CHECK (organization_count >= 5 AND sample_size >= 10)`. Gardé par [quote-check-wording.spec.ts](../apps/web/src/__tests__/quote-check-wording.spec.ts) (lexique interdit, réserve obligatoire sur tout verdict d'écart) et [quote-coherence.spec.ts](../apps/api/src/estimations/quote-coherence.spec.ts). Cf. [PRODUCT_STRATEGY §4.7](PRODUCT_STRATEGY.md). | M | GTM-4, GTM-9 |
| GTM-6 | CGU / CGV / mentions légales | La page confidentialité existe ([privacy/page.tsx](../apps/web/src/app/privacy/page.tsx)) ; il manque CGU, CGV (obligatoires pour vendre un abonnement en France) et mentions légales. | M | — |

### Epic OPS-A : Mise en production

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| OPS-1 | Provisionner le VPS + DNS + Caddy | Suivre [DEPLOY.md](DEPLOY.md) (Hetzner/OVH/Scaleway, 8 Go reco). Domaines `chiffreo.fr` / `api.chiffreo.fr`. | M | — |
| OPS-2 | Produits Stripe réels + webhook | Créer les 4 prix (Pro, Contractor ×3) en mode live, renseigner les `STRIPE_*_PRICE_ID`, configurer l'endpoint webhook. Tester un cycle complet abonnement/annulation. | S | OPS-1 |
| OPS-3 | Sauvegardes testées | Le cron pg_dump est documenté ; l'exécuter réellement + **tester une restauration** + sauvegarder le volume `uploads`. | S | OPS-1 |
| OPS-4 | CD automatisé | La CI existe sans déploiement. Job GitHub Actions : build images → registry → deploy VPS sur tag. Réduit le coût de chaque itération post-lancement. | M | OPS-1 |
| OPS-6 | L'API ne démarrait pas | **Corrigé (02/08/2026).** Défaut préexistant, découvert en tentant une vérification de bout en bout de GTM-10 : `node dist/main.js` échouait sur `UnknownDependenciesException`, sur `main` propre. Cause : un guard appliqué par `@UseGuards` est instancié dans l'injecteur du module **appelant**, donc chaque module devait réimporter les dépendances du guard — `OrgContextModule` pour `FeatureGateGuard` (12 modules le faisaient, `CommunityModule` non), `UsersModule` pour `AdminGuard` (3 sur 9). Les modules fournisseurs les ré-exportent désormais : l'oubli est devenu sans conséquence, au lieu d'ajouter la 13ᵉ copie de la parade. **1 025 tests unitaires et 186 e2e étaient verts** — aucune suite ne montait `AppModule`, ce que [test/README.md](../apps/api/test/README.md) documentait déjà comme un trou. Comblé par `module-graph.int-spec.ts`. | S | — |
| OPS-5 | Monitoring et alerting minimal | Uptime (healthchecks existants), erreurs (Sentry), alerte webhook Stripe en échec. On ne peut pas opérer un SaaS payant à l'aveugle. | M | OPS-1 |

### Epic DATA-A : Instrumentation du funnel

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| DATA-1 | Événements funnel complets | **Livré (commit `54c6aac`).** Module analytics étendu ([apps/api/src/analytics/](../apps/api/src/analytics/)) : visite calculateur → compte → 1ʳᵉ estimation → liste → checkout. | M | — |
| DATA-2 | Tableau de bord North Star | **Livré (commit `65f884b`).** `GET /admin/analytics/dashboard` : listes générées/semaine, conversion par marche du funnel, MRR par tier. | M | DATA-1 |

### Epic CV-A : Combler l'écart silencieux

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| CV-1 | Poids YOLO portes/fenêtres | **Scripts + versionnement livrés (19/07/2026), entraînement à exécuter.** Décision : fine-tuning YOLOv8n sur datasets publics CC BY 4.0 (pas de pré-entraîné viable). Toolkit [apps/cv-service/training/](../apps/cv-service/training/) (runbook + critères d'acceptation dans son README), poids versionnés en GitHub Release `cv-model-vN` via `scripts/release-model.sh` / `fetch-model.sh` (pas dans git). Reste : lancer l'entraînement GPU, valider l'éval, publier `cv-model-v1`. | L | — |
| CV-2 | Mesure de précision CV | **Livré (19/07/2026).** Endpoint admin `GET /admin/cv-accuracy/report` ([apps/api/src/analysis/cv-accuracy.service.ts](../apps/api/src/analysis/cv-accuracy.service.ts)) : écart médian `\|cv - user\|` par groupe `entity_type`+`field` depuis `cv_correction_logs`, filtre `days`, export `format=json\|csv`. Garde-fou `sufficient_data` (< 5 échantillons) pour éviter une communication trompeuse tant que le volume de corrections est faible. | M | — |

---

## P1 — Crédibiliser la promesse de précision

*Objectif : que « quantités exactes » soit défendable. C'est l'actif différenciant ; tout le marketing repose dessus.*

### Epic ENG-A : Lever les limites du moteur

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| ENG-1 | Pièces non rectangulaires | Le moteur ne gère que L×l×h. Supporter les formes en L/T par composition de rectangles (saisie guidée « votre pièce a-t-elle un décroché ? »). Écart le plus cité entre promesse et réalité. | L | — |
| ENG-2 | Multi-pièces par projet | **Livré (Phase 1 backend 19/07, Phase 2 UI 20/07/2026).** Entité `Room` (N par projet, chacune dimensions + ouvertures + work items ; compat mono-pièce via « pièce par défaut »). Mutualisation au moteur (`aggregatePurchases` : somme des quantités continues par matériau puis conditionnement choisi **une seule fois** — `ceil(Σ) ≤ Σ ceil`, gain strict), persistée dans `estimation_results.aggregated_json`, consommée par la liste d'achats (badge « N pièces »). Migration `…031` réversible testée (up/down + collapse). UI : `RoomSwitcher` inline (ajout/renommage/suppression, `?room=`) sur les étapes dimensions & travaux ; invité mono-pièce. Reste Phase 3 : photos/CV par pièce. Cf. [tasks/todo.md](../tasks/todo.md). | XL | ENG-1 |
| ENG-3 | Surfaces à exclure | Zones non traitées (crédence, demi-mur, plinthes) en déduction manuelle simple. | M | — |
| ENG-4 | Tests E2E du parcours critique | **Livré (20/07/2026).** Projet → dimensions → estimation → liste d'achats en E2E API (les E2E existants couvrent auth/projects). Protège le cœur avant d'itérer dessus. Cf. [tasks/todo.md](../tasks/todo.md). | M | — |
| ENG-5 | Étalonnage terrain du catalogue | **Livré (20/07/2026).** 24 rendements (`yield_per_unit`) recalibrés vs fiches fabricants (sous-achats critiques mortiers/plaques BA/ragréage/SEL, sur-achats colles papier peint) ; facteurs de perte conformes DTU, inchangés. Seed `...006` + migration idempotente `...033`. Cf. [tasks/todo.md](../tasks/todo.md). Le volet « retours réels (DATA) » reste porté par DATA-3. | M | DATA-1 |

### Epic CV-B : Fiabiliser l'analyse photo

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| CV-3 | Calibration par objet étalon universel | La calibration dépend d'une porte détectée (~204 cm). Ajouter un étalon utilisateur : feuille A4 ou carte bancaire posée au mur, guidée par l'UI. Débloque les photos sans porte visible. | L | — |
| CV-4 | Guidage de prise de vue | **Livré (22/07/2026).** Écran de conseils avant capture (angles, recul, lumière, porte visible) + rejet des photos inexploitables avec explication. Améliore la précision sans toucher au modèle. | M | — |
| CV-5 | Intervalles de confiance visibles | **Livré (22/07/2026).** Afficher « 4,2 m ± 15 cm » plutôt qu'une valeur sèche, avec répercussion sur les quantités (fourchette basse/haute). Honnêteté = confiance = conversion. | M | CV-2 |
| CV-6 | Boucle de ré-entraînement | **Livré (24/07/2026).** Pipeline périodique : corrections (`cv_correction_logs`) + photos associées → dataset → fine-tuning → éval → déploiement des poids. Première brique réelle du « learns from real projects ». Capture prod (bbox + corrections d'ouvertures) + boucle `training/retrain.py` (garde-fous anti-régression, release humaine). Premier cycle réel conditionné à la publication de `cv-model-v1` (reliquat CV-1). | XL | CV-1, CV-2 |
| CV-7 | Tests de non-régression CV | Jeu d'images de référence avec dimensions connues ; assertion d'écart max dans la CI du cv-service (aucun test aujourd'hui). | M | — |

---

## P2 — Monétiser et fidéliser

*Objectif : activer l'étage Achat, justifier les paliers Contractor, faire de la communauté un canal d'acquisition. À ré-arbitrer selon DATA-2.*

### Epic BUY-A : Prix réels et affiliation

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| BUY-1 | Adaptateur affiliation ManoMano | Premier adaptateur réel dans le registre existant ([adapters/supplier-registry.ts](../apps/api/src/price-comparison/adapters/supplier-registry.ts)) via le flux produits du programme d'affiliation. Matching catalogue→produits marchands. Supprimer les mocks CAD. | L | — |
| BUY-2 | Réactivation de la feature gate `price_comparison` | Une fois BUY-1 en place : réactiver la gate (désactivée en migration 027), QA du parcours comparaison→application à la liste. | S | BUY-1 |
| BUY-3 | Liens d'achat commissionnés sur la liste | **Livré (01/08/2026).** Chaque ligne de la liste d'achats → lien affilié « acheter chez X » via `GET .../shopping-list/buy-links`, sans feature gate. Revenu secondaire sans friction, y compris sur le tier Free. | M | BUY-1 |
| BUY-4 | Deuxième enseigne (Leroy Merlin) | **Livré (01/08/2026).** Deuxième adaptateur réel dans le registre, même patron que ManoMano (BUY-1). La comparaison n'a de valeur qu'à ≥ 2 sources réelles. | L | BUY-1 |

### Epic PRO-A : Justifier les paliers Contractor

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| PRO-1 | Différenciation des paliers 50/100/200 € | **Livré (01/08/2026).** Essentiel = devis+clients (gates existantes recalées) ; Standard/Premium = gates `site_tracking`/`quote_reminders`/`multi_user`/`public_api` seedées désactivées, prêtes pour PRO-2/PRO-3/PLAT-4/PLAT-5. Mécanique = feature gates existantes, étendues à 3 rangs Contractor. | M | — |
| PRO-2 | Suivi de chantier + timeline | **Livré (01/08/2026).** Entité `SiteMilestone` par projet (libellé, statut `pending`/`in_progress`/`done`, dates prévue/réelle, ordre) derrière la gate `site_tracking` (Contractor Standard+), désormais activée. Répond au « project timelines » de la vision ; différenciateur Standard. | L | PRO-1 |
| PRO-3 | Relances devis | **Livré (01/08/2026).** Sweep quotidien (`@nestjs/schedule`) sur les devis « envoyé » sans réponse à J+7/J+14 : e-mail au client (provider GTM-5) + notification e-mail à l'artisan, derrière la gate `quote_reminders` (Contractor Standard+), désormais activée. Augmente le taux d'acceptation = valeur mesurable de l'abonnement. | M | GTM-5 |
| PRO-4 | Devis → facture | **Livré (01/08/2026).** Table `invoices` immuable (identités et lignes figées en snapshot), numérotation continue sans trou (`F-AAAA-NNNN`, compteur verrouillé en transaction), mentions légales françaises complètes dont les 4 nouvelles de 2026, PDF conforme, derrière la gate `invoicing` (Contractor Essentiel). Évaluation e-invoicing préalable : la cible TPE relève de **septembre 2027**, l'émission exige une Plateforme Agréée — modèle aligné EN 16931 pour rendre Factur-X + PA purement additifs. Cf. [docs/CONFORMITE_FACTURATION.md](CONFORMITE_FACTURATION.md) et [tasks/todo.md](../tasks/todo.md). Restent hors périmètre : avoir, acompte, autoliquidation BTP, multi-taux de TVA. | L | — |
| PRO-5 | Parcours « devis-minute » mobile | **Livré (01/08/2026).** Fil conducteur sur les 6 étapes (`FlowProgress` « Étape N/6 »), CTA collants à portée de pouce (`StickyActionBar` + safe-area), total TTC en direct sur le devis, entrée 1-tap depuis le dashboard Contractor, envoi du PDF par la feuille de partage native. Corrige au passage la virgule décimale refusée par `type="number"` (mesures silencieusement fausses) et un paywall fantôme sur l'étape devis. Rendu vérifié à 390 px sur les 8 écrans. Cf. [tasks/todo.md](../tasks/todo.md). | M | CV-4 |

### Epic COM-A : Communauté comme canal d'acquisition

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| COM-1 | Coûts réels sur les projets partagés | **Livré (01/08/2026).** Instantané de la liste d'achats et du budget finalisé attaché au partage (`purchase_list_json`, `budget_summary_json`, `total_cost_cents`). L'angle « exact material costs » de la vision. | M | — |
| COM-2 | Pages communauté publiques et indexables | **Livré (01/08/2026).** Galerie approuvée accessible sans compte + SEO. | M | COM-1 |
| COM-3 | Parrainage | **Livré (01/08/2026).** Offre « 1 mois Pro offert par filleul abonné » sur la base Stripe existante. | M | OPS-2 |

### Epic PLAT-A : Rétention

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| PLAT-1 | Carnet du logement | **Livré (01/08/2026).** Historique persistant par pièce (dimensions validées, matériaux réellement achetés, dates), alimenté à la finalisation du budget. Antidote au churn structurel du DIY (cf. stratégie §7.5). | L | ENG-2 |
| PLAT-2 | E-mails de cycle de vie | **Livré (01/08/2026).** Sweep quotidien (`@nestjs/schedule`) : onboarding J+1/J+3, projet abandonné à mi-parcours, fin d'essai Pro (J-3), via le provider GTM-5. Aucune feature gate, tous paliers. | M | GTM-5, DATA-1 |
| PLAT-3 | Module éco-matériaux | **Livré (01/08/2026).** Badge + filtre + équivalences éco sur la liste de courses, gate `eco_materials` (Pro). | L | — |

---

## P3 — Étendre

*Objectif : étages hauts de la value ladder et nouveaux marchés. Ne lancer qu'avec une traction P0-P2 démontrée.*

### Epic PLAT-B : Fondations enterprise

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| PLAT-4 | Organisations, membres, rôles | **Livré (01/08/2026).** `organizations`/`organization_memberships`/`organization_invitations` + rôles `owner`/`admin`/`member` ; propriété de projets/clients/devis/factures/profil d'entreprise transférée à l'org (`organization_id` ajouté, `user_id` conservé comme auteur). Une org personnelle par compte, backfillée 1:1 → aucun changement observable pour un solo. Le palier des feature gates suit le propriétaire de l'org active : un salarié `free` hérite du Premium de son employeur. Numérotation devis/factures re-clé sur l'émetteur légal (`quote_sequences` créée, `invoice_sequences` re-clé). Gate `multi_user` activée. UI web de gestion des membres hors périmètre. Cf. [tasks/todo.md](../tasks/todo.md). | XL | PRO-1 |
| PLAT-5 | API publique + clés | **Livré (02/08/2026).** Surface `/partner` (estimation multi-pièces sans persistance, types de travaux, usage) authentifiée par clé portée par l'organisation, avec rotation à fenêtre de grâce, révocation immédiate, rafale par clé et quota mensuel. Gate `public_api` désormais activée. | L | PLAT-4 |
| PLAT-6 | Offre Enterprise (10 k€+/an) | **Livré (02/08/2026).** Palier `enterprise` porté par un contrat annuel rattaché à l'organisation (`enterprise_agreements`), et non par un abonnement Stripe rattaché à une personne — ce qui solde la dette inscrite en PLAT-4 §10. SSO SAML/OIDC via GCIP : le rattachement d'une session se fait par `provider_id` émis par nous, jamais par le domaine de l'adresse affirmée ; les domaines, prouvés par DNS, ne servent qu'à la découverte. Enforcement optionnel par organisation, vérifié dans `FirebaseAuthGuard`, avec exemption du propriétaire en bris de glace. Engagements de SLA chiffrés et mention d'environnement dédié portés par le contrat. Gate `enterprise_sso` seedée activée. Côté web : découverte par e-mail + `signInWithPopup` ; écrans d'administration différés. Cf. [tasks/todo.md](../tasks/todo.md). | XL | PLAT-4, PLAT-5 |
| PLAT-7 | Widget d'estimation marque blanche | **Livré (02/08/2026).** Script embarquable (`apps/widget`, sans dépendance framework, isolé en Shadow DOM) servi en asset statique par le web, brandé « Propulsé par Chiffréo ». Credential dédié non secret (`wgt_...`) restreint par liste blanche d'origines plutôt que par confidentialité — le `chf_` de PLAT-5 ne quitte jamais un serveur. CORS rendu dynamique pour ce seul préfixe de route, quota mensuel partagé avec l'API partenaire. Une pièce / un ouvrage par estimation en v1 ; pas d'écran de tableau de bord (même choix que PLAT-5). Canal B2B2C (stratégie §7.6). Cf. [tasks/todo.md](../tasks/todo.md). | L | PLAT-5 |

### Epic MOB-A : Mobile

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| MOB-1 | Service worker PWA | **Livré (02/08/2026).** Service worker écrit à la main (3 stratégies de cache, repli `offline.html`), bandeau d'installation, purge des caches à la déconnexion. **Volet mesure livré séparément le 02/08/2026** : 6 événements PWA (`pwa_session_start` avec plateforme et mode d'affichage, entonnoir d'installation, vues hors ligne) + `photo_quality_rejected`, agrégés dans un bloc `pwa` de `GET /admin/analytics/dashboard`. Les événements passent par un tampon `localStorage` ([lib/pwa-analytics.ts](../apps/web/src/lib/pwa-analytics.ts)) : émis en mode standalone ou hors ligne, ils seraient sinon perdus précisément pour la population mesurée. Cf. [tasks/todo.md](../tasks/todo.md). | M | — |
| MOB-2 | App native (React Native/Expo) | **Parké — en attente de données (arbitrage du 02/08/2026).** Uniquement si les métriques PWA montrent une limite réelle (caméra avancée, LiDAR, stores comme canal). Réutilise l'API telle quelle. Règle de décision ci-dessous. | XL | MOB-1, DATA-2 |

#### Règle de décision MOB-2

Écrite **avant** toute collecte, pour qu'un XL de plus de 3 semaines ne se justifie pas après coup. Lecture dans le bloc `pwa` de `GET /admin/analytics/dashboard`.

- **Volume minimum** : ≥ 200 sessions (`sufficient_data`) sur ≥ 30 jours **après mise en production**. En dessous, aucune décision — MOB-1 a été livré le jour même où MOB-2 a été proposé, sans un seul utilisateur réel.
- **Go — un seul signal suffit** :
  - `photo_quality.rejection_rate` ≥ 15 % → le plafond est la capture web ; une capture native guidée (retour flou/exposition en direct) est une réponse crédible ;
  - part de sessions mobiles ≥ 40 % **et** `sessions.standalone_share` < 10 % malgré une éligibilité au prompt → l'installation PWA ne prend pas, les stores sont le canal ;
  - iOS ≥ 50 % des sessions mobiles → jamais promptables (`beforeinstallprompt` n'existe pas sur iOS), le store est la seule voie d'installation.
- **No-go** : `standalone_share` ≥ 25 % **et** `rejection_rate` < 10 % → la PWA fait le travail, MOB-2 reste parké et le budget va à P0/P1.

Seuils révisables — ce qui ne l'est pas, c'est qu'ils soient figés avant de voir les chiffres.

### Epic INTL-A : International

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| INTL-1 | Fondation i18n | Extraction des chaînes en dur (~60 fichiers) vers next-intl + gestion devises. À ne faire qu'une fois l'expansion décidée — coût de portage massif. | XL | traction FR |
| INTL-2 | Marché nord-américain | Catalogue matériaux US/CA, unités impériales par défaut (base existante dans [lib/units.ts](../apps/web/src/lib/units.ts)), affiliation Home Depot/Lowe's réelle, fiscalité. La vision d'origine, repositionnée en phase 2 géographique. | XL | INTL-1 |

### Epic DATA-B : Flywheel complet

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| DATA-3 | Facteurs de perte appris | **Livré (02/08/2026).** Recalcul hebdomadaire des facteurs de perte sur les écarts estimé/acheté des chantiers finalisés, par matériau × pose × niveau : médiane robuste, crédibilité `n/(n+12)`, minimum 8 observations dont 5 max par organisation, écart borné à ±10 points du catalogue et à [0 %, 30 %]. Table `learned_waste_factors` **superposée** au catalogue DTU (jamais réécrit) ; source `learned` sur la ligne d'estimation ; inspection via `/admin/waste-learning`. Cf. [tasks/todo.md](../tasks/todo.md). | L | DATA-1, ENG-5 |
| DATA-4 | Benchmark de coûts anonymisé | **Livré (02/08/2026).** Médianes de coût matériaux au m², par type d'ouvrage × bande de surface (`<10` / `10–30` / `≥30` m²), recalculées chaque semaine sur les budgets finalisés. K-anonymat **écrit avant toute collecte** : ≥ 5 organisations distinctes, ≥ 10 chantiers, ≤ 3 par organisation, médiane seule publiée (un quartile est une dépense individuelle). Une cellule sous les seuils n'est pas masquée, elle n'est **pas écrite** — invariant verrouillé par une contrainte `CHECK` en base. Un projet supprimé sort de la cohorte au recalcul suivant. Gate `cost_benchmark` (Pro) seedée activée ; panneau sur la liste de courses. Cf. [tasks/todo.md](../tasks/todo.md). | L | COM-1, DATA-3 |
| DATA-5 | Clôture par les achats réels | **Livré (02/08/2026).** Écran de clôture de chantier : une ligne par article, pré-remplie de la quantité estimée, **une seule correction par ligne** (« j'en ai acheté combien »), aucun prix exigé. Réponse immédiate : ce qui reste sur les bras, ce qui est encore reprenable et à quelle échéance, l'écart estimé/réel expliqué (l'arrondi au conditionnement est isolé de la marge prise). Nouveau champ `purchased_units` : seule une déclaration explicite alimente DATA-3 et DATA-4 — une ligne intacte y entrait comme « estimation exacte » et confirmait le catalogue par le silence. La finalisation n'exige plus que tout soit tarifé : c'est ce qui rendait la boucle infermable. Gate `project_closeout` en **free** (le volant de données ne peut pas n'apprendre que des abonnés) ; délais de reprise dans un catalogue sourcé (`source_url` + `verified_on` obligatoires, test qui échoue sinon), enseigne inconnue → aucun délai affirmé. Relance `closeout_due`. Corrige au passage `GET /logbook`, qui renvoyait `[]` à tout le monde depuis PLAT-1. Cf. [tasks/todo.md](../tasks/todo.md). | L | DATA-3, DATA-4, COM-1, PLAT-1 |

---

## Vue d'ensemble des dépendances structurantes

```
P0  GTM-4 (lead magnet) ──► GTM-5 (e-mail) ──► PRO-3, PLAT-2
P0  CV-2 (mesure précision) ──► CV-5, CV-6
P0  DATA-1 ──► DATA-2 ──► arbitrage de tout P2/P3
P1  ENG-1 ──► ENG-2 ──► PLAT-1
P2  BUY-1 ──► BUY-2/3/4
P2  PRO-1 ──► PRO-2, PLAT-4 ──► PLAT-5/6/7
P3  INTL-1 ──► INTL-2
```

**Règle d'arbitrage** : après P0, chaque epic P1/P2 doit être confirmé ou rétrogradé par les données du funnel (DATA-2). Le backlog est un plan, pas un engagement.
