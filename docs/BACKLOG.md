# Chiffréo — Backlog produit priorisé

> **Statut** : document de travail — juillet 2026
> **Stratégie associée** : [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md)

## Légende

- **Priorités** — **P0** : lancer ce qui existe (semaines 1-4) · **P1** : crédibiliser la promesse de précision · **P2** : monétiser et fidéliser · **P3** : étendre (conditionné aux données post-lancement).
- **Effort** — S : ≤ 1 jour · M : 2-5 jours · L : 1-3 semaines · XL : > 3 semaines.
- **Ladder** — étage de la value ladder servi : Lead magnet · Pro (9,99 €) · Contractor (50-200 €) · Continuité · Enterprise.
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
| GTM-4 | Lead magnet : calculateurs publics sans compte | 3-5 pages `/calculateurs/[type]` (peinture, carrelage, sol) : formulaire dimensions → estimation immédiate via le moteur existant, sans inscription. CTA « sauvegarder mon projet » → conversion invité→compte (flux déjà construit). Étage 0 de la value ladder + actif SEO. | L | — |
| GTM-5 | Capture e-mail sur le lead magnet | Envoi du résultat par e-mail (constitution de la liste, objectif affiché du lead magnet). Nécessite un provider d'e-mail transactionnel (Brevo/Resend). | M | GTM-4 |
| GTM-6 | CGU / CGV / mentions légales | La page confidentialité existe ([privacy/page.tsx](../apps/web/src/app/privacy/page.tsx)) ; il manque CGU, CGV (obligatoires pour vendre un abonnement en France) et mentions légales. | M | — |

### Epic OPS-A : Mise en production

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| OPS-1 | Provisionner le VPS + DNS + Caddy | Suivre [DEPLOY.md](DEPLOY.md) (Hetzner/OVH/Scaleway, 8 Go reco). Domaines `chiffreo.fr` / `api.chiffreo.fr`. | M | — |
| OPS-2 | Produits Stripe réels + webhook | Créer les 4 prix (Pro, Contractor ×3) en mode live, renseigner les `STRIPE_*_PRICE_ID`, configurer l'endpoint webhook. Tester un cycle complet abonnement/annulation. | S | OPS-1 |
| OPS-3 | Sauvegardes testées | Le cron pg_dump est documenté ; l'exécuter réellement + **tester une restauration** + sauvegarder le volume `uploads`. | S | OPS-1 |
| OPS-4 | CD automatisé | La CI existe sans déploiement. Job GitHub Actions : build images → registry → deploy VPS sur tag. Réduit le coût de chaque itération post-lancement. | M | OPS-1 |
| OPS-5 | Monitoring et alerting minimal | Uptime (healthchecks existants), erreurs (Sentry), alerte webhook Stripe en échec. On ne peut pas opérer un SaaS payant à l'aveugle. | M | OPS-1 |

### Epic DATA-A : Instrumentation du funnel

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| DATA-1 | Événements funnel complets | Étendre le module analytics existant ([apps/api/src/analytics/](../apps/api/src/analytics/)) : visite calculateur → compte → 1ʳᵉ estimation → liste → checkout. Sans ça, impossible d'arbitrer P1/P2. | M | — |
| DATA-2 | Tableau de bord North Star | Requêtes/dashboard simple : listes générées/semaine, conversion par marche du funnel, MRR par tier. | M | DATA-1 |

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
| BUY-3 | Liens d'achat commissionnés sur la liste | Chaque ligne de la liste d'achats → lien affilié « acheter chez X ». Revenu secondaire sans friction, y compris sur le tier Free. | M | BUY-1 |
| BUY-4 | Deuxième enseigne (Leroy Merlin ou Castorama) | La comparaison n'a de valeur qu'à ≥ 2 sources réelles. | L | BUY-1 |

### Epic PRO-A : Justifier les paliers Contractor

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| PRO-1 | Différenciation des paliers 50/100/200 € | Les 3 paliers donnent aujourd'hui les mêmes features. Définir et gater : Essentiel = devis+clients ; Standard = + chantier + relances ; Premium = + multi-utilisateurs + API. Mécanique = feature gates existantes. | M | — |
| PRO-2 | Suivi de chantier + timeline | Statuts d'avancement par projet client, jalons, dates prévues/réelles. Répond au « project timelines » de la vision ; différenciateur Standard. | L | PRO-1 |
| PRO-3 | Relances devis | Rappels automatiques sur devis « envoyé » sans réponse à J+7/J+14 (e-mail au client, notification à l'artisan). Augmente le taux d'acceptation = valeur mesurable de l'abonnement. | M | GTM-5 |
| PRO-4 | Devis → facture | Conversion d'un devis accepté en facture (mentions légales françaises, numérotation). Ferme la boucle métier de l'artisan. Évaluer conformité e-invoicing 2026-2027 avant de construire. | L | — |
| PRO-5 | Parcours « devis-minute » mobile | Optimiser le flux photo→estimation→devis PDF pour un enchaînement < 10 min sur mobile chez le client. Pitch commercial n°1 du tier Contractor (cf. stratégie §7.2). | M | CV-4 |

### Epic COM-A : Communauté comme canal d'acquisition

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| COM-1 | Coûts réels sur les projets partagés | Attacher la liste d'achats (quantités + coût final réel) aux partages communauté. L'angle « exact material costs » de la vision, absent aujourd'hui. | M | — |
| COM-2 | Pages communauté publiques et indexables | Rendre la galerie approuvée accessible sans compte + SEO (« coût réel carrelage salle de bain 8 m² »). UGC = acquisition gratuite à forte intention. | M | COM-1 |
| COM-3 | Parrainage | Offre « 1 mois Pro offert par filleul abonné ». Mécanique simple sur la base Stripe existante. | M | OPS-2 |

### Epic PLAT-A : Rétention

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| PLAT-1 | Carnet du logement | Historique persistant par pièce (dimensions validées, teintes/matériaux utilisés, dates). Raison de rester abonné entre deux chantiers — antidote au churn structurel du DIY (cf. stratégie §7.5). | L | ENG-2 |
| PLAT-2 | E-mails de cycle de vie | Onboarding J+1/J+3, projet abandonné à mi-parcours, fin d'essai Pro. | M | GTM-5, DATA-1 |
| PLAT-3 | Module éco-matériaux | Alternatives durables dans le catalogue (badge + filtre + équivalences). Intégré au tier Pro plutôt qu'add-on 4,99 € (cf. stratégie §4.4). | L | — |

---

## P3 — Étendre

*Objectif : étages hauts de la value ladder et nouveaux marchés. Ne lancer qu'avec une traction P0-P2 démontrée.*

### Epic PLAT-B : Fondations enterprise

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| PLAT-4 | Organisations, membres, rôles | Modèle `organizations`/`memberships` ; propriété des projets/clients/devis transférée à l'org. Prérequis de Contractor Premium multi-employés ET de l'enterprise. Migration structurante — à concevoir soigneusement. | XL | PRO-1 |
| PLAT-5 | API publique + clés | Endpoints d'estimation documentés, clés API, quotas par tier. Ouvre le widget embarquable (stratégie §7.3) et l'enterprise. | L | PLAT-4 |
| PLAT-6 | Offre Enterprise (10 k€+/an) | SSO (SAML/OIDC), facturation annuelle sur devis, SLA, environnement dédié éventuel. Uniquement sur demande entrante avérée. | XL | PLAT-4, PLAT-5 |
| PLAT-7 | Widget d'estimation marque blanche | Calculateur embarquable chez des médias bricolage / marchands, brandé « powered by Chiffréo ». Canal B2B2C (stratégie §7.6). | L | PLAT-5 |

### Epic MOB-A : Mobile

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| MOB-1 | Service worker PWA | Installation réelle + cache offline des projets consultés (le manifest existe déjà, sans SW). Mesurer l'adoption avant d'envisager du natif. | M | — |
| MOB-2 | App native (React Native/Expo) | Uniquement si les métriques PWA montrent une limite réelle (caméra avancée, LiDAR, stores comme canal). Réutilise l'API telle quelle. | XL | MOB-1, DATA-2 |

### Epic INTL-A : International

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| INTL-1 | Fondation i18n | Extraction des chaînes en dur (~60 fichiers) vers next-intl + gestion devises. À ne faire qu'une fois l'expansion décidée — coût de portage massif. | XL | traction FR |
| INTL-2 | Marché nord-américain | Catalogue matériaux US/CA, unités impériales par défaut (base existante dans [lib/units.ts](../apps/web/src/lib/units.ts)), affiliation Home Depot/Lowe's réelle, fiscalité. La vision d'origine, repositionnée en phase 2 géographique. | XL | INTL-1 |

### Epic DATA-B : Flywheel complet

| ID | Item | Description / valeur | Effort | Dépend de |
|---|---|---|---|---|
| DATA-3 | Facteurs de perte appris | Ajuster les facteurs de perte du catalogue à partir des écarts estimé/acheté réels (budget tracking) par matériau × pose × niveau. Le « learns from millions of projects » appliqué au moteur, pas seulement à la CV. | L | DATA-1, ENG-5 |
| DATA-4 | Benchmark de coûts anonymisé | « Votre projet coûte X % de moins que la médiane des projets similaires » — valeur ajoutée data impossible à copier sans le volume. | L | COM-1, DATA-3 |

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
