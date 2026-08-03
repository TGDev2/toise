# Chiffréo — Stratégie produit : analyse d'écart, architecture cible et recommandations

> **ARCHIVE** — décrit un produit non lancé, conservé pour l'historique, ne pas utiliser comme source. Voir [REPRISE_PROJET.md](../REPRISE_PROJET.md) et [BACKLOG_V1.md](../BACKLOG_V1.md).

> **Statut** : document de travail — juillet 2026
> **Complète** : [CONTEXT.md](CONTEXT.md) (brief de cadrage, mars 2026) et [ARCHITECTURE.md](ARCHITECTURE.md)
> **Backlog associé** : [BACKLOG.md](BACKLOG.md)

---

## 1. Résumé exécutif

La vision produit (estimation de matériaux par vision par ordinateur, freemium 9,99 €/mois, montée en gamme artisans, value ladder jusqu'à l'enterprise) est **déjà réalisée à environ 70 % pour les étages « frontend offer » et « core offer »**. Le codebase n'est pas un début d'idée : c'est un produit fonctionnel, durci pour la production, avec un moteur d'estimation testé, une analyse photo par IA en bêta, des abonnements Stripe câblés et des outils artisans complets.

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
| Monétisation | `apps/api/src/subscriptions/` + `feature-gates/` | Free (2 projets) / Pro 9,99 € (essai 7 j) / Contractor 19-29-49 € (§4.5). Checkout, portail, webhooks idempotents, gates en base fail-closed. |
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
| 9 | Artisans 50-200 €/mois | 🔴 Thèse invalidée | Le prix était 2 à 10× le marché FR (15-30 €) pour 7 ouvrages de finition et 1 bloc de main-d'œuvre. Repositionné en outil de chiffrage pour les métiers de finition à 19/29/49 € — voir §4.5. |
| 10 | Cost tracking | 🟢 Fait | Suivi budget sur la liste d'achats. |
| 11 | Project timelines | 🔴 Absent | — |
| 12 | Comparaison prix fournisseurs | 🟡 Structurel | Voir #6. |
| 13 | Lead magnet gratuit (value ladder) | 🟢 Fait, repositionné | Trois calculateurs publics indexables (GTM-4) avec capture e-mail (GTM-5). Positionnés d'abord sur le terme de tête des calculettes d'enseigne, où nous n'apportions rien ; recentrés sur la surface nette et la marge par niveau — voir §4.6. |
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
- **Artisan = moteur de revenu** (ARPU 2-5× supérieur après le réalignement §4.5, churn plus faible, besoin réel : chiffrer vite un devis). Le parcours « photo → estimation → devis PDF en 10 minutes chez le client » est un pitch différenciant qu'aucun concurrent français grand public ne tient.
- Conséquence pricing : **différencier réellement les paliers Contractor** (alors identiques). Proposition : Essentiel = devis+clients ; Standard = + suivi chantier + relances ; Premium = + multi-utilisateurs + API. *Fait ; les montants ont ensuite été réalignés sur le marché en §4.5.*

#### 4.2.1 Traduction en architecture de l'information (GTM-7, août 2026)

Cette décision est restée en prose pendant des mois et n'était traduite nulle part : la
page d'accueil ouvrait sur le bricoleur (« votre niveau de bricolage ») puis basculait en
milieu de page sur le tunnel artisan (« Photo de la pièce chez le client → Devis PDF envoyé
sur place »). Quatre offres — calculateurs, Pro, Contractor, Enterprise — se lisaient comme
quatre produits concurrents plutôt que comme les étages d'une échelle.

**Règle : une audience, une surface.**

| Surface | Audience | Récit qu'elle porte |
|---|---|---|
| `/` | particulier | « Arrêtez d'acheter 15 à 25 % de matériaux en trop » — photo → liste, mode invité |
| `/artisans` | artisan | « Chiffrez chez le client, pas le soir au bureau » — devis-minute, TVA/HT/TTC, fichier clients |
| `/calculateurs`, `/calculateurs/[type]` | particulier | lead magnet SEO — ne vend que des gates `free`/`pro` |
| `/pricing` | les trois | l'échelle complète, groupée par audience, Enterprise sur devis |

Aucune page ne consacre de section à une autre audience que la sienne : elle lui offre un
lien de bascule dans l'en-tête, et rien de plus.

L'audience est désormais une **donnée** portée par le catalogue d'offre
([apps/web/src/lib/pricing.ts](../apps/web/src/lib/pricing.ts), champ `audience` et table
`AUDIENCE_DEFINITIONS`), pas une intention réécrite page par page. Chaque ligne de
fonctionnalité annoncée est adossée à sa `feature_key` réelle ; les lignes qui n'en sont pas
(quota, héritage, support, clause contractuelle) doivent déclarer laquelle de ces catégories
elles sont. Ce que cela a corrigé : le palier Standard vendait deux fonctionnalités qui
n'ont jamais existé, neuf gates livrées et actives n'étaient annoncées nulle part, et le
palier `enterprise` était appliqué en base sans être joignable depuis aucune surface
publique.

Le garde-fou est [apps/web/src/\_\_tests\_\_/offer-catalogue.spec.ts](../apps/web/src/__tests__/offer-catalogue.spec.ts),
adossé au miroir de gates [feature-gates-catalogue.ts](../apps/web/src/lib/feature-gates-catalogue.ts) :
une gate ajoutée en base sans décision d'offre fait rougir la suite. **Toute migration
touchant `feature_gates` doit mettre ce miroir à jour dans le même lot.**

### 4.3 Honnêteté sur la précision CV

La promesse « exact quantities, down to the last tile » est le cœur de la marque ; la CV est en bêta avec fallback heuristique. Deux garde-fous :
- Ne jamais présenter un résultat CV sans intervalle de confiance ni sans parcours de correction (déjà en place — à conserver et renforcer).
- Mesurer la précision réelle (écart dimensions CV vs corrigées, via `cv_correction_logs`) **avant** toute communication marketing sur la précision. C'est aussi le premier maillon du flywheel.

### 4.4 Value ladder : simplifier

Les add-ons à 4,99 €/feature (éco, expert) fragmentent l'offre pour un revenu marginal et ajoutent une mécanique de billing à l'unité. **Recommandation** : les intégrer comme différenciateurs des tiers existants (éco-matériaux → Pro ; conseils avancés → contenu communauté/SEO), et ne les extraire en add-ons payants que si la demande le prouve. L'enterprise reste une vision long terme : ne poser que les fondations réutilisables (organisations/rôles, nécessaires de toute façon pour Contractor Premium).

### 4.5 Thèse artisan « suite généraliste » : invalidée (GTM-8, août 2026)

La montée en gamme artisan était vendue 50/100/200 €/mois. Le marché français du devis-facture artisan se situe entre 15 et 30 € :

| Outil | Prix mensuel | Périmètre |
|---|---|---|
| Costructor | gratuit | Devis-facture tous corps d'état |
| Boby | 14,99 € | Devis-facture tous corps d'état |
| Tolteck | 19 € | Devis-facture tous corps d'état |
| Obat | 29 € | Devis-facture tous corps d'état |
| EBP Bâtiment | 29,25 € | Devis-facture tous corps d'état |
| BatiChiffrage | à partir de 30 € | + bibliothèque de 80 000 travaux unitaires |
| **Chiffréo (avant)** | **50 à 200 €** | **7 ouvrages de finition, 1 bloc de main-d'œuvre** |

En face de ces prix, le produit porte :

- **Sept types d'ouvrage, tous de finition** ([migration `...003`](../apps/api/src/migrations/1711468800003-CreateWorkTypesAndProjectWorkItems.ts)) : `wall_painting`, `ceiling_painting`, `floor_tiling`, `wall_tiling`, `parquet_flooring`, `drywall`, `wall_covering`. Ni plomberie, ni électricité, ni isolation, ni maçonnerie, ni menuiserie.
- **Un seul bloc de main-d'œuvre** ([`quote.entity.ts`](../apps/api/src/quotes/entities/quote.entity.ts)) : `labor_type` horaire ou forfait, taux × heures estimées, ou montant forfaitaire. Aucune ligne de MO par corps d'état, aucun déboursé sec.

Un artisan ne peut pas produire un devis réel de rénovation avec ce périmètre. Demander 2 à 10 fois le prix du marché pour une couverture partielle n'est pas une erreur de packaging : c'est la thèse « Chiffréo est une suite devis-facture pour artisans » qui est invalidée.

**Décision** : rétrécir la promesse *et* réaligner le prix, plutôt que baisser le prix en gardant le récit généraliste.

- Chiffréo artisan n'est pas un concurrent d'Obat ou d'EBP. C'est un **outil de chiffrage pour les métiers de finition** : peintre, carreleur, plaquiste, solier, poseur de revêtement mural.
- Grille : **Essentiel 19 € · Standard 29 € · Premium 49 €**. Le palier d'entrée passe sous Obat et EBP ; le Premium dépasse le marché généraliste mais porte le multi-utilisateurs et l'API/widget, que ces outils ne vendent pas à ce prix.
- Les trois paliers et leur échelle de gates sont **conservés** : aucune migration, l'écart était dans les montants et le récit, pas dans la structure.
- Le périmètre couvert **et non couvert** est nommé sur `/artisans`, `/pricing` et dans la FAQ. Une couverture partielle annoncée coûte des inscriptions ; une couverture partielle découverte après paiement coûte la confiance et le remboursement.

**Conséquence sur la feuille de route** : toute hausse de prix doit être précédée d'une extension réelle du périmètre chiffrable (corps d'état supplémentaires, lignes de main-d'œuvre par ouvrage), jamais l'inverse. C'est le seul chemin qui rouvre le segment généraliste.

**Garde-fous** : `GENERALIST_MARKET_CEILING_EUR` et `COVERED_TRADES` / `TRADES_NOT_COVERED` ([`work-types.ts`](../apps/web/src/lib/work-types.ts)), vérifiés par [offer-catalogue.spec.ts](../apps/web/src/__tests__/offer-catalogue.spec.ts) §6 et §7 : un ouvrage seedé sans métier porteur, ou un palier d'entrée repassant au-dessus du marché, fait rougir la suite.

### 4.6 Lead magnet : sortir du terme de tête (GTM-9, août 2026)

Les calculateurs publics attaquaient le concurrent sur son point le plus fort. `title` et `h1` visaient « calculateur peinture », « calculateur de carrelage gratuit », « quantité au m² » — exactement les termes que possèdent les calculettes de Leroy Merlin et de Castorama : gratuites, indexées depuis des années, adossées à l'autorité de domaine d'une enseigne et à un stock réel derrière le bouton. Ce SEO-là se gagne, mais c'est un combat long sur un mot-clé où nous n'apportons rien : le mètre carré de peinture, tout le monde sait le calculer.

Et le déséquilibre était pire que le mot-clé, parce que **la page libre n'exposait que la brique commune**. Les trois atouts du produit sont derrière le compte :

| Atout | Où il vit | Sur la page publique |
|---|---|---|
| Photo → dimensions (CV) | `POST /projects/:id/analyze`, sous `FirebaseAuthGuard` + `FeatureGateGuard` | absent — la page n'a qu'un formulaire de saisie, comme une GSB |
| Prix et liens d'achat | `price_comparison`, liste d'achats | absent — la page annonce elle-même « hors prix » |
| Liste d'achats et matériaux complémentaires | `shopping_lists`, `complementary_materials` | absent de `estimatePublic` |

Chiffréo entrait donc dans le combat avec la seule fonctionnalité que tout le monde a, amputée de ses propres différenciateurs. **Et un défaut le retournait contre lui** : `DimensionsForm` propose les surfaces à exclure et les déduit dans son aperçu en direct, mais `handleCompute` ne recevait pas le 6ᵉ argument et le DTO public ne portait pas le champ. Un visiteur qui déclarait une crédence voyait l'aperçu la retirer et recevait une estimation qui l'ignorait — sur la page dont la promesse est « n'achetez pas 15 à 25 % en trop ».

**Décision** : garder le lead magnet, arrêter de le positionner sur le terme de tête.

- Le récit passe de « combien de m² » à **« combien acheter »** sur les quatre surfaces. Ce que nous tenons et qu'une calculette d'enseigne ne tient pas : la **surface nette** (ouvertures, exclusions, pièces en L/T/U) et la **marge de perte selon le niveau et la pose** (5 à 20 % réellement seedés, contre un forfait unique).
- Les promesses deviennent des **données**, pas de la prose : `CALCULATOR_DIFFERENTIATORS` ([`calculators.ts`](../apps/web/src/lib/calculators.ts)) est un ensemble fermé de clés, chacune portant le `proof` du mécanisme qui l'exécute **sur le chemin public**. C'est le motif de §4.2.1 appliqué au lead magnet.
- Ce qui n'existe pas sur ce chemin n'a pas de clé pour être annoncé : il n'y a ni `price` ni `photo` dans l'ensemble fermé, et en ajouter une casse le test.

**Conséquence sur la feuille de route** : le jour où la CV ou les prix deviendront accessibles sans compte, ce sera une clé de plus adossée à son mécanisme — pas une réécriture de page. Et toute nouvelle page de calculateur doit déclarer ses différenciateurs, sinon la suite rougit.

**Garde-fous** : [calculators-positioning.spec.ts](../apps/web/src/__tests__/calculators-positioning.spec.ts) pour le catalogue de promesses ; `estimations.service.spec.ts` (déduction des exclusions, filtrage par `surface_target`) et `PublicCalculator.spec.tsx` (transmission des exclusions saisies) pour l'exécution.

---

### 4.7 Contrôle de devis : Chiffréo mesure, il n'arbitre pas (GTM-10, août 2026)

Le moteur ne servait que dans un sens : préparer un achat. Or « quelles quantités cet ouvrage demande-t-il dans cette pièce ? » répond aussi à un besoin non couvert et à bien plus forte intention — un propriétaire qui reçoit deux ou trois devis pour 5 000 à 15 000 € n'a aucun moyen de juger les quantités qu'on lui facture. C'est la même opération, lue dans l'autre sens.

Ouvrir cette surface pose un conflit qui ne se gère pas : on ne peut pas vendre un outil aux artisans (19/29/49 €, §4.5) et publier en même temps des pages qui apprennent à leurs clients à contester leurs devis.

**Décision — la portée du verdict, pas l'audience.** Chiffréo répond « combien faut-il ? », **jamais** « est-ce trop cher ? ». Le contrôle porte sur les quantités face à la pièce ; il ne mentionne aucun prix et ne qualifie aucune entreprise.

Ce que la décision coûte, et qui en fait une décision :

- on renonce **définitivement** au mot-clé « devis trop cher », le plus à forte intention — y compris le jour où le benchmark se remplirait ;
- le titre naturel de la page (« Ce devis est-il juste ? ») devient « Vérifier les quantités d'un devis » ;
- en échange, les deux audiences tiennent ensemble : un artisan dont les quantités sont dans la fourchette obtient de la même page une justification opposable.

**La décision coïncide avec ce que le code peut tenir**, ce qui la rend soutenable plutôt que vertueuse. Il n'existe aucun prix de référence dans le système : `materials_catalog` n'a pas de colonne de prix, le seul prix saisi vit dans `shopping_lists.items_json[].real_unit_price`, et `cost_benchmarks` porte **en base** `CHECK (organization_count >= 5 AND sample_size >= 10)` avec une médiane `NOT NULL` — une cellule non publiable ne peut pas être stockée. Le verdict de prix n'est pas « pas encore » : il est inconstructible.

**La référence, elle, existe déjà.** Les `waste_factors` semés donnent la fourchette descriptive par pose et par niveau — carrelage pose droite 5/10/15 %, diagonale 10/15/20 %. Le verdict s'énonce donc comme un **taux de perte impliqué** (`déclaré / surface nette − 1`) confronté à cette fourchette. Descriptif par construction : « cette quantité correspond à X % de perte », jamais « ce devis est excessif ».

**Risque assumé et sa parade.** Un verdict « au-dessus » peut faire perdre un chantier à une entreprise honnête, sur la foi d'un calcul qui ignore la contrainte de chantier et la découpe réelle. La réserve nommant les causes légitimes n'est donc pas une précaution rédactionnelle : c'est un **champ obligatoire** du type de formulation, et un test refuse un verdict d'écart qui n'en porte pas.

**Limite annoncée, pas découverte.** Beaucoup de devis d'artisan sont au forfait, sans quantité — le contrôle est alors impossible. La page le dit d'elle-même et donne la question à poser, plutôt que de rendre un verdict sur une quantité devinée.

**Garde-fous** : [quote-check-wording.spec.ts](../apps/web/src/__tests__/quote-check-wording.spec.ts) interdit le lexique tarifaire et prescriptif sur toute la prose de la surface, exige la réserve, et ferme l'union des statuts des deux côtés ; `estimations.service.spec.ts` interdit toute clé de prix sur la réponse ; [quote-coherence.spec.ts](../apps/api/src/estimations/quote-coherence.spec.ts) ancre la fourchette sur les valeurs réellement semées.

**Hors périmètre à ce stade** : aucun paiement sur cette surface — la disposition à payer 15 € est une hypothèse, pas une mesure ; et aucune variante côté artisan, qui viendra si le taux d'usage la justifie.

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
2. **Devis-minute artisan comme wedge B2B** : positionner le parcours mobile « photo chez le client → devis PDF envoyé avant de partir » comme LE pitch Contractor. C'est le seul angle où Chiffréo bat les suites généralistes, qui font saisir les quantités à la main — et il ne vaut que sur les ouvrages de finition (§4.5).
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
