# Chiffréo — Stratégie produit : analyse d'écart, architecture cible et recommandations

> **Statut** : document de travail — juillet 2026
> **Complète** : [CONTEXT.md](CONTEXT.md) (brief de cadrage, mars 2026) et [ARCHITECTURE.md](ARCHITECTURE.md)
> **Backlog associé** : [BACKLOG.md](BACKLOG.md)

---

## 1. Résumé exécutif

La vision produit (estimation de matériaux par vision par ordinateur, freemium 9,99 €/mois, montée en gamme artisans 50-200 €/mois, value ladder jusqu'à l'enterprise) est **déjà réalisée à environ 70 % pour les étages « frontend offer » et « core offer »**. Le codebase n'est pas un début d'idée : c'est un produit fonctionnel, durci pour la production, avec un moteur d'estimation testé, une analyse photo par IA en bêta, des abonnements Stripe câblés et des outils artisans complets.

Les écarts réels ne sont pas là où la vision les situe. Par ordre d'importance :

1. **Le produit n'est pas lancé.** Aucune surface marketing, pas de lead magnet, Stripe et l'hébergement non provisionnés. Le premier euro de revenu ne dépend d'aucune nouvelle fonctionnalité.
2. **La boucle d'apprentissage n'existe pas.** La promesse « learns from millions of projects » n'a aucune fondation active : les corrections utilisateur sont loggées mais jamais exploitées.
3. **Le moteur est limité aux pièces rectangulaires mono-pièce**, en tension avec la promesse de précision « down to the last tile ».
4. **Une contradiction de marché doit être tranchée** : la vision cite Home Depot/Lowe's, mais tout le produit est français (langue, EUR, TVA, SIRET, catalogue). Ce document recommande d'assumer le marché France/Belgique d'abord.
5. **Les étages hauts de la value ladder** (add-ons de continuité, enterprise 10 k€+/an) n'ont aucune fondation technique (pas d'organisations multi-utilisateurs, pas d'API publique).

**Recommandation centrale : arrêter de construire, lancer, puis laisser les données d'usage arbitrer le backlog.** Les priorités P0 du backlog sont presque toutes des tâches de mise sur le marché, pas du développement.

---

## 2. État des lieux — ce qui existe et sa maturité

Monorepo pnpm à trois applications : `apps/api` (NestJS 11 + PostgreSQL/TypeORM), `apps/web` (Next.js 16, App Router, Tailwind 4), `apps/cv-service` (Python FastAPI). Docker prod complet, CI GitHub Actions (sans CD).

### 2.1 Mature et opérationnel

| Capacité | Implémentation | Remarques |
|---|---|---|
| Moteur d'estimation | [apps/api/src/estimations/estimation-engine.ts](../apps/api/src/estimations/estimation-engine.ts) | Surfaces murs/sol/plafond, déduction des ouvertures, facteurs de perte par pose × niveau (15/10/5 %), couches de peinture, optimisation des conditionnements. Testé unitairement. |
| Matériaux complémentaires | [apps/api/src/shopping-lists/complementary-formulas.ts](../apps/api/src/shopping-lists/complementary-formulas.ts) | Colle (3-5 kg/m² selon format), joint, croisillons. Testé. |
| Catalogue matériaux | `apps/api/src/materials/` | Catalogue français réel seedé (peinture, carrelage, sol, cloison, revêtement mural), conditionnements, facteurs de perte. CRUD admin. |
| Analyse CV photo→dimensions | `apps/cv-service/` + `apps/api/src/analysis/` | Depth Anything V2 (profondeur) + calibration par porte standard + YOLOv8 (ouvertures). Pipeline asynchrone avec jobs, confiance affichée, corrections loggées. Étiqueté « Bêta » côté web. |
| Parcours d'estimation web | `apps/web/src/app/(app)/projects/[id]/` | Photos → dimensions → type de travaux/niveau → estimation → liste d'achats. Complet et soigné. |
| Listes d'achats | `apps/api/src/shopping-lists/` | Génération, suivi budget avec prix réels, export PDF, partage public par token. |
| Auth | Firebase : email, Google, Apple, **invité anonyme** avec conversion invité→compte | Point fort sous-exploité pour l'acquisition. |
| Monétisation | `apps/api/src/subscriptions/` + `feature-gates/` | Free (2 projets) / Pro 9,99 € (essai 7 j) / Contractor 50-100-200 €. Checkout, portail, webhooks idempotents, gates en base fail-closed. |
| Outils artisans | `apps/api/src/clients/`, `quotes/`, `company-profiles/` | CRM clients, devis français complets (TVA, HT/TTC, marge matériaux, workflow de statut, PDF), profil SIRET. |
| Communauté | `apps/api/src/community/` | Galerie avant/après modérée, likes, commentaires, consentement RGPD. |
| Infra | `docker-compose.prod.yml`, [DEPLOY.md](DEPLOY.md) | 4 services, healthchecks, migrations auto, cible VPS + Caddy. |

### 2.2 Construit mais dégradé ou désactivé

- **Poids YOLO absents** (`models/door-window-yolov8n.pt` non versionné) → la détection portes/fenêtres tourne en fallback heuristique, moins fiable. Écart silencieux entre l'architecture annoncée et le comportement réel.
- **Comparaison de prix** : service complet ([apps/api/src/price-comparison/](../apps/api/src/price-comparison/) — cache, adaptateurs parallèles, total optimisé) mais seuls des **adaptateurs mock existent** (« Home Depot (mock) » en CAD), feature gate désactivée en base. Décision saine de ne pas servir de faux prix ; l'activation attend une vraie source.
- **`cv_correction_logs`** : les corrections utilisateur des résultats CV sont enregistrées mais aucun pipeline ne les consomme.

### 2.3 Absent

- Surface marketing : pas de page `/pricing`, landing minimaliste auto-étiquetée « MVP », pas de logo/OG, pas de calculateur public sans compte.
- Pièces non rectangulaires, projets multi-pièces.
- Timeline/suivi de chantier, relances devis, facturation (côté artisan).
- Organisations/équipes, rôles, SSO, API publique (fondations enterprise).
- Add-ons de continuité (module éco-matériaux, conseil expert).
- Service worker PWA, application mobile native.
- i18n (interface 100 % français, en dur).
- CD automatisé ; tests hors moteur d'estimation et auth.

---

## 3. Analyse d'écart : vision ↔ existant, pilier par pilier

| # | Pilier de la vision | État | Écart |
|---|---|---|---|
| 1 | Scan CV de la pièce → quantités exactes | 🟡 Construit, bêta | Précision réelle non mesurée ; poids YOLO manquants ; pas de calibration alternative à la porte. |
| 2 | Pertes, coupes, niveau de compétence | 🟢 Fait | Facteurs par pose × niveau, seedés avec des valeurs métier réalistes. |
| 3 | Listes d'achats précises | 🟢 Fait | PDF, partage, budget. |
| 4 | Freemium 9,99 €/mois | 🟢 Fait techniquement | Produits Stripe réels non créés ; jamais confronté à un utilisateur payant. |
| 5 | « Learns from millions of projects » | 🔴 Absent | Corrections loggées mais inertes ; analytics minimaux ; aucun flywheel. |
| 6 | Checkout Home Depot/Lowe's | 🔴 Mock désactivé | Contradiction de marché (voir §4.1). Structure d'adaptateurs prête pour de vraies intégrations. |
| 7 | Croissance (YouTube DIY, partenariats) | 🔴 Absent | Aucune surface d'acquisition : ni landing vendeuse, ni pricing public, ni lead magnet, ni programme de parrainage. |
| 8 | Communauté avec coûts réels partagés | 🟡 Partiel | La galerie existe ; le partage des **coûts matériaux réels** (l'angle différenciant de la vision) n'y est pas. |
| 9 | Artisans 50-200 €/mois | 🟢 Cœur fait | Devis + CRM solides. Manquent : suivi de chantier, timeline, relances, facturation — ce qui justifierait les paliers 100/200 € (aujourd'hui les 3 paliers Contractor donnent les mêmes features). |
| 10 | Cost tracking | 🟢 Fait | Suivi budget sur la liste d'achats. |
| 11 | Project timelines | 🔴 Absent | — |
| 12 | Comparaison prix fournisseurs | 🟡 Structurel | Voir #6. |
| 13 | Lead magnet gratuit (value ladder) | 🔴 Absent | Le mode invité existe mais exige d'entrer dans l'app ; pas de calculateur public indexable. |
| 14 | Add-ons 4,99 € (éco, expert) | 🔴 Absent | Aucune mécanique d'achat à l'unité (Stripe ne gère que les abonnements). |
| 15 | Enterprise 10 k€+/an | 🔴 Absent | Pas de multi-utilisateurs, pas d'orgs, pas d'API, pas de SSO. |
| 16 | Mobile (« scan your room ») | 🟡 Web mobile-first | Capture caméra via navigateur OK ; pas de service worker, pas d'app native. |

**Lecture d'ensemble** : les étages bas et médians de la value ladder sont construits, l'étage 0 (acquisition) et les étages hauts (continuité, enterprise) sont vides. Le produit a même dépassé son MVP de cadrage (communauté, artisans et comparaison de prix étaient hors MVP dans [CONTEXT.md](CONTEXT.md) et ont été construits) — le risque actuel est la **sur-construction sans validation marché**.

---

## 4. Décisions stratégiques à trancher

### 4.1 Marché : France/Belgique d'abord (recommandé)

La vision cite Home Depot et Lowe's ; le produit réel est intégralement français : langue en dur, EUR, TVA 20 %, SIRET, catalogue matériaux français, cible VPS `chiffreo.fr`. Réécrire tout cela pour l'Amérique du Nord coûterait des mois (i18n, catalogue, fiscalité, partenaires) pour un marché plus concurrentiel.

**Recommandation** : assumer FR/BE comme marché de lancement.
- Partenaires distribution cibles : **Leroy Merlin, ManoMano (programme d'affiliation existant, le plus accessible), Castorama, Brico Dépôt**. L'affiliation (lien sortant commissionné) est atteignable sans partenariat commercial, contrairement à un « seamless checkout ».
- L'expansion NA devient un item P3 conditionné à : traction FR démontrée + fondation i18n + catalogue matériaux US/CA.
- Corollaire immédiat : supprimer les mocks « Home Depot (mock) » en CAD dès qu'un adaptateur réel FR existe, pour lever l'ambiguïté.

### 4.2 Positionnement : DIY en acquisition, artisan en revenu

Les deux segments sont construits. Plutôt que d'en choisir un :
- **DIY = moteur d'acquisition et de données** (volume, SEO, communauté, corrections CV). Conversion Pro 9,99 € opportuniste.
- **Artisan = moteur de revenu** (ARPU 5-20× supérieur, churn plus faible, besoin réel : chiffrer vite un devis). Le parcours « photo → estimation → devis PDF en 10 minutes chez le client » est un pitch différenciant qu'aucun concurrent français grand public ne tient.
- Conséquence pricing : **différencier réellement les paliers Contractor 50/100/200 €** (aujourd'hui identiques). Proposition : Essentiel = devis+clients ; Standard = + suivi chantier + relances ; Premium = + multi-utilisateurs + API.

### 4.3 Honnêteté sur la précision CV

La promesse « exact quantities, down to the last tile » est le cœur de la marque ; la CV est en bêta avec fallback heuristique. Deux garde-fous :
- Ne jamais présenter un résultat CV sans intervalle de confiance ni sans parcours de correction (déjà en place — à conserver et renforcer).
- Mesurer la précision réelle (écart dimensions CV vs corrigées, via `cv_correction_logs`) **avant** toute communication marketing sur la précision. C'est aussi le premier maillon du flywheel.

### 4.4 Value ladder : simplifier

Les add-ons à 4,99 €/feature (éco, expert) fragmentent l'offre pour un revenu marginal et ajoutent une mécanique de billing à l'unité. **Recommandation** : les intégrer comme différenciateurs des tiers existants (éco-matériaux → Pro ; conseils avancés → contenu communauté/SEO), et ne les extraire en add-ons payants que si la demande le prouve. L'enterprise reste une vision long terme : ne poser que les fondations réutilisables (organisations/rôles, nécessaires de toute façon pour Contractor Premium).

---

## 5. Architecture fonctionnelle cible

Cinq domaines, du haut vers le bas du funnel :

```
┌─────────────────────────────────────────────────────────────┐
│ ACQUISITION (à créer)                                       │
│ Calculateurs publics SEO · Landing/pricing · Communauté     │
│ indexable · Parrainage                                      │
├─────────────────────────────────────────────────────────────┤
│ ESTIMATION CORE (existant, à fiabiliser)                    │
│ CV photo→dimensions · Moteur quantités · Catalogue ·        │
│ Formes complexes · Multi-pièces                             │
├─────────────────────────────────────────────────────────────┤
│ ACHAT (à activer)                                           │
│ Liste d'achats · Prix réels (affiliation) · Budget ·        │
│ Liens panier partenaires                                    │
├─────────────────────────────────────────────────────────────┤
│ PRO (à étendre)                                             │
│ CRM clients · Devis/PDF · Suivi chantier · Relances ·       │
│ Facturation                                                 │
├─────────────────────────────────────────────────────────────┤
│ PLATEFORME (fondations)                                     │
│ Comptes/orgs · Billing/gates · Analytics · Data flywheel ·  │
│ Admin/modération                                            │
└─────────────────────────────────────────────────────────────┘
```

Principes :
- **Acquisition** est le domaine le plus vide et le plus rentable à court terme : chaque calculateur public (« combien de peinture pour 12 m² ? ») est une page SEO qui alimente le funnel invité→compte→Pro, en réutilisant le moteur existant tel quel.
- **Estimation Core** est l'actif défendable ; sa crédibilité conditionne tout le reste.
- **Achat** transforme la liste (fin de parcours aujourd'hui) en source de revenu secondaire (affiliation) sans friction.
- **Pro** justifie les paliers de prix par des features réellement échelonnées.
- **Plateforme** absorbe les fondations transverses (organisations, flywheel) pour éviter que chaque domaine les réinvente.

---

## 6. Architecture technique cible

### 6.1 À conserver (choix sains)

- Monorepo pnpm 3 apps ; NestJS modulaire + TypeORM/migrations ; Next.js App Router ; CV isolée en microservice Python (seule brique gourmande, scalable indépendamment).
- Feature gates en base fail-closed : exactement la bonne mécanique pour piloter la value ladder sans redéployer.
- Auth Firebase avec mode invité : différenciateur d'acquisition.
- Pipeline CV asynchrone par jobs : correct au volume actuel.

### 6.2 Évolutions ciblées (déclencheur → évolution)

| Déclencheur | Évolution |
|---|---|
| Lancement (P0) | Provisionner VPS/Caddy/Stripe réels ; CD automatisé (build→registry→deploy) ; sauvegardes testées en restauration. |
| Premiers utilisateurs CV | Sourcer/entraîner les poids YOLO ; job hebdo de mesure de précision sur `cv_correction_logs`. |
| > 1 nœud ou > quelques Go d'uploads | Stockage S3-compatible (Scaleway/OVH Object Storage) derrière l'abstraction `STORAGE_PROVIDER` existante. |
| File de jobs CV saturée | Passer du polling en base à une vraie file (BullMQ/Redis) — **pas avant**. |
| Contractor Premium / Enterprise | Modèle `organizations` + `memberships` + rôles (la seule fondation enterprise à anticiper, car elle touche la propriété des projets/clients/devis). |
| Comparaison de prix réelle | Adaptateurs d'affiliation (flux produits ManoMano/Leroy Merlin) dans le registre existant — jamais de scraping. |
| Expansion NA décidée | i18n (next-intl) + catalogue multi-marché + devises. **Ne pas préparer avant.** |
| App mobile réclamée | Service worker PWA d'abord (installation + offline léger) ; natif seulement si les métriques PWA le justifient. |

### 6.3 Dette à résorber

- **Tests** : le moteur et l'auth sont couverts ; devis, webhooks Stripe, shopping-lists, community ne le sont pas. Prioriser E2E du parcours critique (projet→estimation→liste) et tests des webhooks Stripe (argent réel en jeu).
- **CV service** : aucun test ; ajouter au minimum des tests de non-régression sur `dimension_calculator` avec images de référence.
- **Cohérence devise/marché** : purger les artefacts NA (mocks CAD, mentions Home Depot dans CONTEXT.md §H4) une fois la décision §4.1 actée.

---

## 7. Nouvelles pistes (suggestions au-delà de la vision)

1. **« Garantie quantité »** : engagement marketing mesurable (« si notre estimation dévie de plus de X %, un mois offert »). Possible uniquement une fois la précision mesurée (§4.3) — transforme la fiabilité du moteur en argument commercial chiffré.
2. **Devis-minute artisan comme wedge B2B** : positionner le parcours mobile « photo chez le client → devis PDF envoyé avant de partir » comme LE pitch Contractor. C'est un gain de temps quantifiable (vs 2-3 h de chiffrage) qui justifie 50 €/mois à lui seul.
3. **Widget/API d'estimation embarquable** : les sites de contenu bricolage et les marchands pourraient embarquer le calculateur (marque blanche légère). Pont naturel vers l'offre enterprise et canal d'acquisition gratuit.
4. **Coûts réels dans la communauté** : chaque projet partagé avec sa liste d'achats et son coût final réel devient une page SEO à très forte intention (« coût réel carrelage salle de bain 8 m² »). L'UGC est le flywheel d'acquisition le moins cher.
5. **Récurrence par le foyer, pas par le projet** : la rénovation est épisodique (churn structurel du tier Pro). Piste : « carnet du logement » (historique des pièces mesurées, peintures utilisées, teintes) qui donne une raison de garder l'abonnement entre deux chantiers.
6. **Partenariat GSB en B2B2C** : à terme, proposer l'estimation en marque blanche aux enseignes (bornes/app Leroy Merlin) plutôt que de les concurrencer sur le checkout — inversion réaliste du rapport de force par rapport à la vision initiale.

---

## 8. Métriques de pilotage

- **North Star** : nombre de listes d'achats générées/semaine (proxy de valeur délivrée, tous tiers).
- Funnel : visiteur → calcul public → compte → première estimation → liste → Pro. Instrumenter chaque marche (le module analytics existe, l'étendre).
- Précision : écart médian dimensions CV vs corrigées ; % d'estimations corrigées par l'utilisateur.
- Revenu : MRR par tier ; conversion essai Pro 7 j ; churn 3 mois Pro vs Contractor.
- Le backlog P1+ doit être ré-arbitré à la lumière de ces métriques après lancement — pas avant d'avoir des données.
