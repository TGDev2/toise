# Chiffréo — suivi des tâches

> **ARCHIVE** — décrit un produit non lancé, conservé pour l'historique, ne pas utiliser comme source. Voir [REPRISE_PROJET.md](../REPRISE_PROJET.md) et [BACKLOG_V1.md](../BACKLOG_V1.md).

## GTM-10 — Vérifier les quantités d'un devis (LIVRÉE) (2 août 2026)

Nouvel usage du moteur existant : il ne servait qu'à préparer un achat, il sert
désormais aussi à contrôler une affirmation. Surface publique, sans compte.

### Vérification préalable (fait)

Trois prémisses de la demande, vérifiées avant d'écrire une ligne (leçons 1 et 17) :

- **« le contrôle de prix dépend du benchmark, qui est vide »** — exact, et plus fort
  que formulé. `materials_catalog` n'a **aucune** colonne de prix (le seul `ALTER TABLE`
  de la table ajoute `is_eco`/`eco_label_fr`, migration 051). Le seul prix du système est
  saisi à la main dans `shopping_lists.items_json[].real_unit_price`. Et
  `1711468800059-CreateCostBenchmarks.ts:24-31` porte
  `CHECK ("organization_count" >= 5 AND "sample_size" >= 10)` avec
  `median_cost_per_m2 NOT NULL` : une cellule non publiable ne peut pas être stockée.
  Zéro ligne semée, un seul écrivain (cron hebdo). Ce n'est pas un manque de données,
  c'est un invariant — le verdict de prix est inconstructible, pas « pas encore ».
- **« le contrôle de quantités suffit-il ? »** — le catalogue le rend immédiat.
  `1711468800006-SeedMaterialsCatalog.ts:38-49` sème carrelage pose droite 15/10/5 %
  (débutant/intermédiaire/expert) et pose diagonale 20/15/10 %. La fourchette
  descriptive réclamée sort de là, sans donnée accumulée.
- **« vous vendez 50 à 200 €/mois aux artisans »** — périmé d'un commit. `3f24c7a`
  (hier) a réaligné à 19/29/49 € avec `GENERALIST_MARKET_CEILING_EUR = 30` et un test
  qui le garde. Le conflit reste entier sur le fond ; son enjeu n'est plus 200 €/mois.

### Décision tranchée

> **Chiffréo mesure, il n'arbitre pas.** Le produit répond « combien faut-il ? »,
> jamais « est-ce trop cher ? ». Le verdict porte sur les quantités face à la pièce,
> ne mentionne aucun prix et ne qualifie aucune entreprise.

Coût accepté, sans quoi ce serait un compromis et non une décision : on renonce
définitivement au mot-clé « devis trop cher » — y compris le jour où le benchmark se
remplirait — et le titre demandé (« Ce devis est-il juste ? ») devient « Vérifier les
quantités d'un devis ». Les deux audiences sont conservées : un artisan dont les
quantités sont dans la fourchette obtient de la même page une justification opposable.

La décision est tenue par un test, pas par la relecture (leçon 15 : rendre l'omission
bruyante).

### Portée

Le contrôle porte sur la **quantité facturée pour l'ouvrage**, en m² — l'unité que
portent réellement les devis d'artisan français, le détail matériaux étant le plus
souvent noyé dans le forfait « fourniture ». Le devis au forfait, sans quantité, est un
cas **nommé dans l'écran** : il ne peut pas être vérifié, et la page dit quelle question
poser pour le rendre vérifiable.

Hors périmètre, explicitement : aucun paiement sur cette surface (la disposition à payer
15 € n'est pas testée) ; aucun verdict de prix (décision ci-dessus) ; aucune variante
côté artisan.

### Tâches

- [x] `quote-coherence.ts` — module pur (patron `room-geometry.ts`) : fourchette de
      référence, perte impliquée, classification en union fermée. Aucun texte.
- [x] `quote-coherence.spec.ts` — bornes, repli de pose, cas non comparable.
- [x] DTO `public-quote-check-request.dto.ts` (hérite de `PublicEstimateRequestDto`).
- [x] `estimations.service.ts` — extraire `toRoomData(dto)` **avant** d'ajouter
      `checkQuotePublic`, pour ne pas créer la deuxième copie qui dériverait.
- [x] `public-quote-check.controller.ts` — public, throttle 20/min.
- [x] `QUOTE_CHECK_VIEWED` dans l'enum **et** dans `PUBLIC_ANALYTICS_EVENT_NAMES`.
- [x] `lib/quote-check.ts` — source unique de la formulation française.
- [x] `QuoteCheckForm.tsx` — réutilise `DimensionsForm` avec ses **six** arguments.
- [x] `app/verifier-un-devis/page.tsx` + JSON-LD FAQPage.
- [x] Enregistrement : `MarketingFooter.LINKS` **et** `sitemap.ts`.
- [x] `quote-check-wording.spec.ts` — le test qui tient la décision.
- [x] `QuoteCheckForm.spec.tsx` — contrat de payload et rendu du verdict.
- [x] `PRODUCT_STRATEGY.md` § 4.7 et `BACKLOG.md` GTM-10.
- [x] Vérification : tests API + web, lint, `tsc --noEmit`, bout en bout.

### Revue

**Ce qui a été livré.** `POST /public/quote-check` et `/verifier-un-devis`. Le
verdict s'énonce comme un taux de perte impliqué (`déclaré / surface nette − 1`)
confronté à la fourchette semée pour la pose. Bout en bout contre la base de dev :
18 m² déclarés pour 12 m² nets → `+50 %`, référence `5–15 %`, statut
`above_reference` ; le même devis passe `within_reference` en pose diagonale
(référence `10–20 %`) ; peinture avec porte et crédence → 35 m² bruts, **31,11 m²
nets**, 3,89 déduits. Les rejets 400 tombent sur quantité absente et sur un ouvrage
hors allow-list publique.

**Décision de conception à noter.** Le catalogue attache un facteur de perte **par
matériau**, alors que la quantité d'un devis vise **l'ouvrage** : il fallait une
règle pour désigner la fourchette de référence. Retenue : celle que le plus grand
nombre de matériaux de l'ouvrage partagent, égalité tranchée par la fourchette la
plus **large**. Une règle par unité (`m2`, `L`) échouait — le white-spirit se compte
en litres comme la peinture tout en portant la fourchette des accessoires. Le
tie-break large est le sens prudent : moins de verdicts « au-dessus », donc moins
d'écarts signalés à tort chez une entreprise honnête.

**Un rouge instructif.** Le premier test de service échouait sur une référence
générique de 10 % au lieu de 5–15 %. Ce n'était pas un défaut : le carrelage n'a
**aucune** ligne `standard` au catalogue, et sans `laying_pattern` le moteur retombe
sur le défaut générique. Mon DTO de test omettait une question pourtant obligatoire
pour `floor_tiling`. Le cas est devenu un test à part entière (`is_default: true`),
parce que `wall_tiling` ne pose pas la question et tombe réellement dans ce cas — la
page doit alors dire qu'elle n'a pas de référence de pose, au lieu de présenter un
défaut comme une fourchette.

**Garde-fou éprouvé, pas seulement écrit.** `quote-check-wording.spec.ts` est passé
au vert du premier coup, ce qui ne prouve rien (leçon 10). Deux sondes l'ont validé :
un titre contenant « trop cher » et « prix » fait tomber exactement les deux gardes
lexicales ; une réserve mise à `null` fait tomber exactement les deux gardes de
réserve. Aucun test voisin ne bouge.

**Ce qui a été trouvé en chemin, et qui n'était pas dans le lot.** La vérification de
bout en bout a révélé que **l'API ne démarrait pas** — sur `main` propre également.
Traité à part (voir OPS-6 au backlog et leçon 19), dans son propre commit.

**Ce que ce lot ne fait pas**, volontairement : aucun paiement sur cette surface, la
disposition à payer 15 € n'étant qu'une hypothèse ; aucun verdict de prix, par
décision et parce qu'il est inconstructible ; aucune variante côté artisan.

## REVUE-5 — Constats 2.13 / 2.14 / 2.15 (LIVRÉE) (2 août 2026)

Constats issus d'une revue externe, revérifiés sur `HEAD` (af908aa) conformément à la
leçon 9. **Les trois sont exacts.**

### Vérification (fait)

**2.13 — Une requête peut saturer l'unique processus CV — CONFIRMÉ**

- `routes.py:21-42` : `async def` qui appelle `calculator.process(...)` **synchrone**. Torch,
  OpenCV et Pillow tournent donc *dans* la boucle d'événements ; `/health` ne répond plus
  pendant toute l'analyse. `docker-compose.prod.yml:135-142` : healthcheck toutes les 30 s,
  5 essais → 150 s de boucle bloquée suffisent à faire déclarer le conteneur malsain.
- `Dockerfile:47` : `uvicorn` sans `--workers` → un seul processus, une seule boucle.
- `schemas.py:52-57` : `image_paths` n'a **aucune borne haute**. L'API appelante en impose une
  (5 photos, `photos.service.ts:22`) mais rien ne la rend opposable ici.
- Aucune borne en pixels : `load_rgb` fait `Image.open(...).convert("RGB")`. Le garde-fou
  Pillow (`MAX_IMAGE_PIXELS`, ~89 Mpx) ne *lève* qu'au-delà de 2× ce seuil ; entre les deux il
  se contente d'un `warning`. Un JPEG de 20 Mo (limite d'ingestion, `photos.controller.ts:29`)
  peut porter 100 Mpx.
- `dimension_calculator.py:79-80, 251-252` : `PerImageResult` **retient** `depth_map`
  (float32, 4 o/px) et `contours` (dont `floor_mask`, 1 o/px) pour *toutes* les images
  jusqu'à la fin de la requête. Or seules des **statistiques** de profondeur sont relues
  (`_build_multi_image_raw:518-524`) et `contours` n'est jamais relu du tout. La mémoire est
  donc en O(nombre d'images) sans raison : 5 × 100 Mpx ≈ 2,5 Go de rétention pure, contre
  4 Go de limite (`docker-compose.prod.yml:146-147`).

**2.14 — Le CD ne livre jamais les changements du service CV — CONFIRMÉ**

- `deploy.yml:42-71` : build/push de `api` et `web` uniquement.
- `deploy.yml:99-112` : `docker compose pull api web` puis `up -d api web`.
- `deploy.yml:92-97` : seul `docker-compose.prod.yml` est copié sur le VPS — le checkout
  `/opt/chiffreo` n'est **jamais** synchronisé par ce workflow.
- `docker-compose.prod.yml:119-122` : `cv-service` n'a que `build:`, pas d'`image:`.
- Conséquence exacte : un tag qui change ensemble la requête API et le schéma CV déploie la
  nouvelle API contre l'**ancien** CV. Le contrat `AnalyzeRequest`/`AnalyzeResponse` n'est ni
  versionné ni négocié.

**2.15 — Sauvegardes dans le même domaine de panne, sans instantané cohérent — CONFIRMÉ**

- `backup.sh:96-99` : `backup_database` puis `backup_uploads`, séquentiellement, sur des
  données vivantes. Une photo supprimée entre les deux laisse une **référence sans fichier**
  dans la restauration.
- `local-storage.service.ts:27-28` : `writeFile(filePath, buffer)` — écriture **non atomique**
  au chemin final. Un `tar` concurrent capture un fichier tronqué. C'est la cause racine du
  scénario « une écriture est archivée partiellement ».
- `BACKUP.md:102-105` et `158-166` : absence de copie hors-site et absence d'alerte sur échec
  cron, l'une et l'autre écrites noir sur blanc.

### Corrections décidées

**2.13 — un contrat d'admission explicite, et du travail borné hors de la boucle**

1. `config.py` : `max_images_per_request` (8), `max_image_pixels` (50 Mpx),
   `max_concurrent_analyses` (1).
2. `schemas.py` : borne haute sur `image_paths` → 422 avant tout travail.
3. `image_loader.load_rgb(path, max_pixels=...)` : au-delà du budget, **réduction** (et non
   rejet) via `Image.thumbnail`, qui passe par `draft()` — un JPEG de 100 Mpx n'est jamais
   décodé en pleine résolution. Réduire plutôt que rejeter parce que les mesures sont
   invariantes d'échelle : chaque longueur est divisée par `px_per_cm`, mesuré dans la même
   image. Un 48 Mpx d'iPhone reste traité tel quel.
4. `routes.py` : `asyncio.to_thread` + sémaphore d'admission (429 immédiat si le slot est
   pris). La boucle reste libre → `/health` répond, le healthcheck ne bascule plus.
5. `dimension_calculator.py` : `PerImageResult` porte les **statistiques** de profondeur, plus
   la carte ; `contours` disparaît (jamais relu). Mémoire O(1) en nombre d'images.

Pas de `wait_for` côté serveur : il n'annulerait pas le travail Torch en cours, il masquerait
seulement le slot occupé. La borne est mise à l'entrée, là où elle est réelle.

**2.14 — faire entrer `cv-service` dans l'unité de livraison**

1. `deploy.yml` : récupération des poids YOLO (`fetch-model.sh`, `gh` + `GH_TOKEN`) puis
   build/push de `ghcr.io/tgdev2/chiffreo-cv:<tag>`. Échec **bloquant** si les poids manquent :
   remplacer silencieusement un conteneur YOLO par un conteneur heuristique est la régression
   que ce constat décrit.
2. `docker-compose.prod.yml` : `image:` sur `cv-service`, `build:` conservé en secours.
3. `deploy.yml` : `pull` et `up -d` incluent `cv-service` → les trois composants portent le
   même `IMAGE_TAG`.
4. `DEPLOY.md` : section réécrite (le CV n'est plus « hors CD »), rollback mis à jour.

**2.15 — un ensemble récupérable cohérent, hors du domaine de panne, qui se signale**

1. `local-storage.service.ts` : écriture temporaire + `rename` atomique. Aucun fichier
   partiel n'est jamais visible — ni pour `tar`, ni pour le service CV.
2. `backup.sh` : archive **avant** le dump, puis passe delta (`find -newermt`) **après**, dans
   la même archive. Le jeu de fichiers devient un sur-ensemble de ce que le dump référence :
   plus de référence sans fichier. Exige GNU tar (`--append`) → image `debian:12-slim`.
3. `backup.sh` : copie hors-site optionnelle (`BACKUP_REMOTE`, `rclone`/`rsync`), avertissement
   bruyant si non configurée.
4. `backup.sh` : `BACKUP_MONITOR_URL` (convention healthchecks.io) — ping au succès, `/fail`
   à l'échec. Couvre aussi le cron **qui n'a pas tourné**, qu'une alerte sur échec ne voit pas.

### Review

**Ce qui a été livré**

| Constat | Fichiers | Preuve |
|---|---|---|
| 2.13 | `config.py`, `schemas.py`, `image_loader.py`, `dimension_calculator.py`, `routes.py`, `Dockerfile`, `README.md` | 14 tests (`test_analyze_admission.py`) |
| 2.14 | `deploy.yml`, `docker-compose.prod.yml`, `DEPLOY.md` | `docker compose config` : les 3 services résolvent le même `IMAGE_TAG` |
| 2.15 | `local-storage.service.ts`, `backup.sh`, `backup.env.example`, `BACKUP.md`, `DEPLOY.md` | 4 tests + drill conteneurs réels |

**Rouge prouvé avant vert** (leçon 10). Mécanisme d'origine restauré, un axe à la fois :

- `routes.py` d'origine → 4 rouges, tous dans le nouveau fichier ;
- `schemas.py` d'origine → 3 rouges (`refuse_plus_d_images`, `borne_relue`, `refusee_avant_travail`) ;
- `dimension_calculator.py` + `image_loader.py` d'origine → 5 rouges ;
- `save()` non atomique → **1** rouge, exactement `n'expose jamais le chemin final`.

Deux des 14 tests CV ne tombent pas sous restauration : `accepte_la_borne_exacte` et
`sans_budget_l_image_reste_en_pleine_resolution` sont des gardes de non-régression — leur rôle
est de rester verts des deux côtés.

**Drill de sauvegarde, conteneurs réels** (`debian:12-slim` pour l'archivage, `alpine` pour
l'extraction, comme `restore.sh`). Scène : `supprimee.jpg` effacée *après* le dump,
`nouvelle.jpg` créée pendant la fenêtre, `modifiee.jpg` réécrite pendant la fenêtre.

- Ancien comportement (dump puis une archive) : `supprimee.jpg` → **ABSENTE**, référence sans
  fichier dans la restauration.
- Nouveau : `supprimee.jpg` restaurée, `nouvelle.jpg` restaurée, `modifiee.jpg` en version
  `v2` (l'entrée en double se résout par la plus récente), `stable.jpg` intacte.
- Le `tar` BusyBox d'`alpine` lit sans difficulté l'archive produite par `tar --append` de GNU
  tar : `restore.sh` n'a pas eu à changer.

**Suites** : CV 79 verts (+14). API 957 unitaires (+4), 180 e2e, `nest build` et `eslint`
verts. `bash -n` sur `backup.sh`.

### Écarts assumés

- **Aucune annulation du travail CV en vol.** Un `asyncio.wait_for` côté serveur
  n'interromprait pas Torch : il rendrait la main au client en laissant le slot occupé, donc
  la saturation invisible au lieu d'être signalée par un 429. La borne est mise à l'entrée
  (images, pixels, slots), là où elle est réelle. Le timeout client reste celui de l'API
  (`CV_SERVICE_TIMEOUT_MS`).
- **Le budget en pixels réduit au lieu de rejeter.** Défendable parce que la mesure est
  invariante d'échelle, et prouvé comme tel (`les_dimensions_survivent_a_une_reduction`). À
  50 Mpx par défaut, aucun capteur grand public actuel n'est concerné : le seul cas atteint
  est le fichier anormal.
- **Le CD échoue si les poids YOLO sont introuvables.** Choix délibéré : livrer une image
  sans poids remplacerait silencieusement un conteneur équipé par un conteneur heuristique.
  Coût : une release `cv-model-vN` doit exister avant le premier tag applicatif.
- **Copie hors-site et supervision restent opt-in.** Les deux demandent des identifiants qui
  ne peuvent pas vivre dans le dépôt. Le script avertit à chaque run tant qu'elles sont
  absentes — l'absence de protection est visible, pas tacite.
- **Un fichier créé *et* supprimé pendant la fenêtre de sauvegarde**, encore référencé par le
  dump, échappe aux deux passes. Le fermer demanderait un instantané de système de fichiers
  (LVM/ZFS), pas un `tar`.
- **Le premier `docker compose pull` du VPS tirera une image CV neuve** (~2 Go avec Torch et
  les poids du modèle de profondeur) là où il reconstruisait auparavant. Coût unique.

## REVUE-4 — Constats 2.10 / 2.11 / 2.12 (LIVRÉE) (2 août 2026)

Constats issus d'une revue externe, revérifiés sur `HEAD` (2ae2077) conformément à la
leçon 9. **Les trois sont exacts**, volet par volet.

### Vérification (fait)

**2.10 — « Refuser » n'empêche aucune télémétrie PWA — CONFIRMÉ**

- `CookieConsent.tsx:37-40` : `setConsent` écrit `localStorage` et émet un événement. Rien d'autre.
- `pwa-analytics.ts` : aucune lecture de `chiffreo_cookie_consent`. `trackPwaEvent` envoie ou
  empile inconditionnellement ; `flushPwaEvents` vide la file inconditionnellement.
- `ServiceWorkerRegister.tsx:74-76` : au montage, `flushPwaEvents()` puis `trackSessionOnce()`
  — avant tout choix de l'utilisateur.
- `public-analytics.controller.ts:38-46` : `OptionalAuthGuard` + `resolveUserId` → avec une
  session, l'événement est bien rattaché à un `user_id`.
- `pwa_offline_view` transmet `event.data.url` (`ServiceWorkerRegister.tsx:61`).
- Le même trou existe dans `useAnalytics.ts` (`track` et `usePublicAnalytics.track`) : même
  cause racine, non nommée par le constat mais indissociable du correctif (leçon 5 — ne pas
  ajouter la 28e occurrence d'une parade).

**2.11 — URL de photos privées inutilisables — CONFIRMÉ (deux volets)**

- Volet A, chemin : `photos.controller.ts:81-84` sérialise `/photos/file/<proj>/<id>` alors que
  les routes réelles sont `@Get(':projectId/photos/:photoId/file')` sur un contrôleur préfixé
  `projects` → `/projects/<proj>/photos/<id>/file`. 404 garanti.
- Volet B, authentification : `PhotoUploadItem.tsx:18-31` et `CommunityShareForm.tsx:186,227`
  posent l'URL dans `<img>` / `next/image`. Aucun Bearer n'est joint, alors que
  `FirebaseAuthGuard:25-29` en exige un → 401.
- Reproduction : `photos/page.tsx:47-50` (rechargement) et `share/page.tsx:53` (sélection
  avant/après) appellent `GET /projects/:id/photos`, puis `loadExistingPhotos` met
  `previewUrl: null` (`usePhotoUpload.ts:216-228`) — la miniature dépend entièrement de l'URL
  serveur.
- Les photos **communauté** (`/community/...`) sont, elles, publiques et correctes : hors
  périmètre, à ne pas casser.

**2.12 — Une organisation peut imposer la médiane globale — CONFIRMÉ**

- `minObservations: 8`, `maxObservationsPerOrg: 5` → une organisation pèse jusqu'à 5/8 = 62,5 %
  de l'échantillon retenu, au-delà du point de rupture de la médiane (50 %).
- Scénario 5 + 3 recalculé à la main (baseline 10, appliqué 10) :
  - attaquant ×5 : `estimated_units: 10, actual_units: 30` → perte impliquée 230 %
  - honnête ×3 : `actual_units: 10` → 10 %
  - médiane des 8 = (230+230)/2 = **230** (contrôlée par l'attaquant)
  - MAD = médiane de [0,0,0,0,0,220,220,220] = **0** → passe le test de dispersion
  - crédibilité 8/20 = 0,4 → cible 98 → écrêtée à `baseline + 10` = **20 %**
- `update-shopping-list.dto.ts:26-28` : `units_needed` n'a que `@Min(0)`, aucun plafond.
- Couverture : le test « caps how much a single organisation weighs in a cell » ne couvre que
  20 observations d'une seule organisation (retombe sous le minimum) ; le cas déterminant 5 + 3
  n'est couvert par aucun test.

### Correction

**A. 2.10 — le consentement devient un contrat d'émission**

- [x] `apps/web/src/lib/analytics-consent.ts` : source unique de `CONSENT_KEY`, `CONSENT_EVENT`,
      `readConsent()`, `setConsent()`, `hasChosenConsent()`, `isAnalyticsAllowed()`,
      `subscribeToConsent()`.
- [x] Contrat retenu : **rien ne part sur le réseau et rien ne se persiste tant que le
      consentement ne vaut pas `accepted`.** Pas de tampon « en attente de choix » — empiler
      dans `localStorage` avant le choix, ce serait déjà persister.
- [x] `pwa-analytics.ts` : `trackPwaEvent` sort immédiatement si non accepté ; `flushPwaEvents`
      **purge** la file si non accepté ; `registerPwaEventFlush` réconcilie aussi sur
      changement de consentement, pas seulement au retour du réseau.
- [x] `ServiceWorkerRegister.tsx` : `trackSessionOnce` teste le consentement **avant** d'écrire
      `sessionStorage` ; abonnement au changement de consentement pour compter la session au
      moment du choix.
- [x] `useAnalytics.ts` : même garde sur `track` et `usePublicAnalytics.track` (décision
      utilisateur : la garde porte sur toute la télémétrie).
- [x] `CookieConsent.tsx` / `InstallPrompt.tsx` : consomment le module ; les deux
      réimplémentations de l'abonnement `storage` + événement custom ont disparu.
- [x] Tests : 4 nouveaux dans `pwa-analytics.spec.ts`, 5 nouveaux dans un
      `ServiceWorkerRegister.spec.tsx` créé pour l'occasion.

**B. 2.11 — accorder URL sérialisée, route et consommateur**

- [x] `photos.controller.ts` : `PHOTOS_ROUTE_PREFIX` / `PHOTO_FILE_ROUTE` /
      `PHOTO_THUMBNAIL_ROUTE` servent **à la fois** aux décorateurs et à `buildPhotoUrl`.
- [x] `lib/api.ts` : `apiObjectUrl(path)` — `fetch` porteur du Bearer → `blob:` URL.
- [x] `components/photos/AuthenticatedImage.tsx` : révocation au démontage et au changement de
      source, réponse obsolète ignorée et révoquée, repli pendant le chargement et en échec.
- [x] `PhotoUploadItem.tsx` et `CommunityShareForm.tsx` branchés ; prop `apiUrl` et les deux
      constantes `API_URL` locales supprimées.
- [x] `CommunityProjectCard` (photos publiques `/community/...`) laissé intact.
- [x] Tests : `photos.controller.spec.ts` compare l'URL du DTO aux **métadonnées de route Nest** ;
      `AuthenticatedImage.spec.tsx` (4) ; 2 nouveaux dans `PhotoUploadPanel.spec.tsx`.

**C. 2.12 — aucun tenant ne détient la médiane**

- [x] `waste-learning.ts` : `organizationObservationCap(options)` =
      `min(maxObservationsPerOrg, ceil(minObservations / 2) - 1)`, soit **3** par défaut.
- [x] `update-shopping-list.dto.ts` : `@Max(10_000)` sur `units_needed` et `quantity`.
- [x] Tests : cas 5 + 3 et cas 5 + 5, plus un test d'invariant qui balaie plusieurs
      `minObservations` ; deux attendus existants réécrits en fonction du cap dérivé.

**D. Vérification**

- [x] api : 69 suites / 953 tests verts. web : 50 suites / 334 tests verts.
- [x] `tsc --noEmit` : web propre ; api affiche 5 erreurs **préexistantes**, identiques sur un
      `main` propre vérifié par `git stash` (leçon 4), toutes dans des fichiers de test non
      touchés par ce lot (`invoices.service.spec`, `org-context.service.spec`,
      `photos.service.spec`, `projects.service.spec`).
- [x] `npm run lint` propre sur les deux paquets.
- [x] Chaque test neuf vu rouge avant son correctif, avec le compte de rouges attendu.

### Revue

**Ce que la reproduction a confirmé, chiffres à l'appui**

- 2.12 : la sortie brute du cas 5 + 3 est `observed_percent: 230`, `factor_percent: 20`,
  `sample_size: 8`, pour une baseline de 10 — le constat annonçait « de 10 % à 20 % », c'est
  exactement ça. Après correctif : `insufficient_volume`.
- 2.11 : 3 des 4 tests du contrat d'URL tombent quand on restaure l'ancienne chaîne du DTO.
- 2.10 : les 4 tests de consentement PWA et 4 des 5 tests de `ServiceWorkerRegister` tombent
  sur le code d'origine, et **seulement** ceux-là.

**Deux pièges rencontrés, notés parce qu'ils ne se voyaient pas dans le plan**

1. `trackSessionOnce` posait sa marque `sessionStorage` *avant* d'émettre. Mettre la garde de
   consentement uniquement dans `trackPwaEvent` aurait « corrigé » le constat tout en rendant la
   première session définitivement incomptable, même après acceptation : la marque était déjà
   posée. La garde doit précéder l'écriture de la marque. C'est le seul endroit du lot où la
   correction évidente était fausse.
2. Un test neuf a d'abord fait tomber un test voisin : il enregistrait un écouteur `window` et
   son `unregister` ne s'exécutait pas quand l'assertion échouait. Rouge de pollution, pas
   rouge de régression (leçon 10) — corrigé par un `finally`, pas en touchant au test voisin.

**Choix qui méritent d'être discutés**

- `AuthenticatedImage` récupère les octets par `fetch` authentifié plutôt que par une URL signée.
  C'est plus lent au premier affichage qu'un `<img>` direct, mais ça n'ajoute ni secret, ni
  expiration, ni exemption de guard. Si le coût devient visible sur les grilles de photos, la
  suite est une URL signée courte durée, pas un assouplissement du guard.
- Bloquer `useAnalytics` derrière le consentement fera mécaniquement baisser les volumes
  analytics produit. C'est le comportement que le bandeau promet ; le texte du bandeau
  (« cookies essentiels ») mérite en revanche d'être relu par ailleurs, il ne décrit pas ce que
  l'application fait réellement.

**Reste ouvert, volontairement**

- `jest.setup.ts` stubbe désormais `URL.createObjectURL` / `revokeObjectURL`, absents de jsdom.
- La 12e occurrence de `jest.mock('@/lib/api')` a été ajoutée plutôt que supprimée : la chaîne
  d'import `lib/api → lib/firebase → firebase/auth` casse tout `testEnvironment: jsdom` faute de
  `fetch` global. C'est un défaut de harnais réel, mais le corriger touche 43 suites — hors
  périmètre d'un lot de correction de revue.

---

## REVUE-1 — Correction de 3 constats de revue de dépôt (LIVRÉE) (2 août 2026)

Trois constats remontés par une revue externe, **tous vérifiés sur le code** avant correction.
Les trois sont fondés. Le troisième en a révélé deux autres, jamais exécutés par aucun test.

### 3.1 — Fusion incorrecte d'ouvertures distinctes (défaut avéré, modéré)

**Vérifié.** `opening_merge.merge_and_group` étage 1 absorbe toute détection de même type dont
les dimensions concordent à > 70 % **sans regarder l'image d'origine ni la position**. Le NMS
intra-image (`OpeningDetector._nms`) ne supprime que les recouvrements IoU > 0.5 : deux portes
distinctes 90×204 dans **la même photo** (IoU = 0) le traversent, puis sont fusionnées ici →
2 boîtes sources mais `count = 1`. Cause racine : la similarité dimensionnelle sert d'identité
d'objet.

Reproduit avant correction : deux portes 90×204 sans recouvrement dans une même photo →
`groupes: 1, count: 1, boxes: 2`. Après : `count: 2`.

- [x] Invariant : un représentant ne peut absorber qu'**une seule** détection par image
      (un objet physique n'apparaît qu'une fois par photo). Corrige le cas intra-image
      *et* le cas « 2 portes vues chacune dans 2 photos ».
- [x] Tests : cas intra-image, cas 2 portes × 2 photos, non-régression dédup inter-images.
      Le fuzz d'équivalence avec l'algorithme historique a été remplacé (l'historique
      **est** le bug) par deux fuzz : équivalence stricte tant qu'aucune image ne porte
      deux détections — ce qui **borne** l'écart au seul cas fautif — et invariants sur
      scènes denses (aucune image ne contribue plus de boîtes à un groupe que son `count`).

### 3.2 — Contrat HEIC/HEIF divergent (risque probable, modéré)

**Vérifié.** `photos.controller.ts:30` + `configuration.ts` (`storage.allowedMimeTypes`)
annoncent HEIC/HEIF ; `photos.service.ts` stocke les octets **tels quels** en `.heic` ;
`analysis.service.ts` transmet ce `storage_url` au service CV ; `dimension_calculator.py:211`
l'ouvre avec `PIL.Image.open`. Or ni `requirements.txt` ni le `Dockerfile` (qui n'installe que
`libgl1`/`libglib2.0-0`) ne fournissent de décodeur HEIF → `UnidentifiedImageError` par image →
un projet 100 % HEIC finit en « Failed to process any image ».

Mesuré avant correction : `Image.registered_extensions()` ne contient ni `.heic` ni `.heif`.
Vérifié à l'autre bout : `sharp` 0.34.5 / libvips 8.17.3 décode bien un vrai HEIC, et
`image-signature.ts` couvre les marques ISO-BMFF — **la divergence était unilatérale**,
côté CV uniquement.

- [x] `pillow-heif==1.5.0` épinglé dans `requirements.txt` (roue autoporteuse : aucun
      paquet système à ajouter au Dockerfile).
- [x] `app/services/image_loader.py` : point d'ouverture **et** d'enregistrement unique.
      L'enregistrement conditionne l'ouverture, seule façon fiable de garantir l'ordre ;
      son échec dégrade (avertissement + `HEIF_SUPPORTED=False`) au lieu d'être fatal.
- [x] Exposé dans `/health` (`formats.heif`) : une image déployée sans décodeur se voit
      au déploiement, pas photo par photo.
- [x] Sous-ensemble CI `cv-service` étendu (compte de pins 5 → 6, vérifié à 6).
- [x] Tests : rejeu du scénario de non-régression CV-7 **en HEIC** à travers le vrai
      `DimensionCalculator.process()`, round-trip des 3 formats annoncés, garde-fou de
      déploiement sur `HEIF_SUPPORTED`.
- [x] **Hors constat, même cause racine** : `training/build_user_dataset.py` lisait les
      photos utilisateur avec `cv2.imread`, qui rend `None` sur du HEIC — chaque label
      issu d'une photo iPhone partait silencieusement en `image_unreadable`, hors du jeu
      de ré-entraînement. Passé par le même loader, avec transcodage JPEG à la copie
      (ultralytics ne lit pas le HEIC davantage : corriger la lecture sans la copie
      n'aurait fait que déplacer la panne dans l'entraînement).

### 3.3 — La qualification « e2e » masque l'absence d'intégration réelle (dette, modéré)

**Vérifié.** Les 16 `*.e2e-spec.ts` montent des `TestingModule` de contrôleurs avec services
mockés et `FirebaseAuthGuard` surchargé ; aucun ne monte `AppModule`, aucun ne touche
PostgreSQL. Une cascade destructrice, un webhook Stripe rejoué, une écriture JSONB concurrente
ou une migration invalide passent tous au vert.

Correctif : **couvrir** ce qui n'est pas couvert plutôt que renommer 16 fichiers (le renommage
réécrirait aussi tout l'historique de ce journal pour un gain de lisibilité seul).

- [x] `test/integration/schema.int-spec.ts` — les 61 migrations s'appliquent sur base vide,
      dans l'ordre des timestamps, sont rejouables et révocables, et le schéma obtenu porte
      toutes les colonnes des 46 entités TypeORM (dérive entités↔migrations). **Tout vert :
      aucun défaut de schéma à signaler.**
- [x] `test/integration/persistence.int-spec.ts` — cascades réelles, idempotence
      `stripe_events`, écritures JSONB concurrentes.
- [x] `test/jest-integration.json` + script `test:integration` (+ `test:api:integration` racine).
- [x] Job CI `api-integration` avec service `postgres:16-alpine` et sonde `pg_isready`.
- [x] `apps/api/test/README.md` + libellés d'étapes CI explicites (« Tests de contrat HTTP
      (services mockés) ») + `CONTRIBUTING.md`/`README.md` alignés. Le renommage des
      16 fichiers `*.e2e-spec.ts` a été **écarté** : il aurait réécrit tout l'historique de
      ce journal pour un gain de lisibilité seul, là où le libellé et le README lèvent
      l'ambiguïté au même endroit qu'un lecteur la rencontre.

### Deux défauts de production découverts par cet étage

Les deux vivaient exactement dans l'angle mort décrit par le constat 3.3 : aucun test
n'exécutait leur implémentation.

- **Idempotence des webhooks Stripe cassée** (`subscriptions.service.ts`).
  `claimWebhookEvent` lisait `InsertResult.identifiers`. Sondé : sur la 2ᵉ insertion du
  même `event_id`, `identifiers=[{event_id}]` mais `raw=[]` — TypeORM garnit `identifiers`
  depuis les **valeurs d'entrée** dès que la clé primaire est fournie par l'appelant, sans
  consulter la base. La réservation renvoyait donc toujours `true` : **chaque relance Stripe
  était retraitée** (surclassement rejoué, crédit de parrainage compté deux fois). Corrigé
  en lisant `raw`, avec `RETURNING` demandé explicitement — s'en remettre au `RETURNING`
  implicite de `processed_at` aurait retourné la panne dans l'autre sens (tous les events
  ignorés) le jour où cette colonne changerait. `claimWebhookEvent` n'était mockée qu'au
  niveau du contrôleur, jamais exécutée.
- **Perte de mise à jour sur `shopping_lists.items_json`** (`shopping-lists.service.ts`).
  Lecture-modification-écriture d'un blob JSONB sans transaction ni verrou : deux `PATCH`
  concurrents sur deux lignes différentes de la même liste, et la correction du premier
  disparaissait sans erreur. Corrigé par transaction + verrou de ligne
  (`pessimistic_write`), le corps du merge extrait en `applyUpdateLocked`. `update()`
  n'avait aucune couverture unitaire.

**Hors correctif, assumé et écrit dans `test/README.md`** : monter `AppModule` avec
Firebase/Stripe *réels* demanderait des credentials qu'une CI ne devrait pas détenir ; la
précision métrique CV sur corpus réel demanderait un corpus annoté
(`tests/_synthetic_room.py` documente déjà que ses scènes sont construites pour être
reconnues par l'algorithme testé). Signalé, non traité.

## Revue

**Vérification** (tout rejoué après correction) :

```
cv-service   python -m compileall app training tests   OK
cv-service   pytest tests -q                           58 tests (51 avant, +7)
api          lint | build                              OK
api          test                                      908 tests / 66 suites
api          test:e2e                                  177 tests / 15 suites
api          test:integration                          10 tests / 2 suites  (nouveau)
ci.yml       YAML valide, 6 jobs ; extraction des pins cv-service = 6
```

**Preuves de défaut avant/après**, plutôt que des tests écrits après coup :
`count: 1 → 2` sur deux portes distinctes ; `.heic` absent de
`Image.registered_extensions()` puis pipeline `status=success` sur un HEIC ;
`claimWebhookEvent` `true, true → true, false` ; `units[PEINTURE] 2 → 7` sous
écritures concurrentes.

**Portée** : 3 constats confirmés sur 3, 2 défauts supplémentaires trouvés et corrigés.
Aucune régression sur les 1 085 tests préexistants.

## PLAT-7 — Widget d'estimation marque blanche (LIVRÉE) (2 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic PLAT-B, PLAT-7 (effort L, dépend de PLAT-5).
Objectif : calculateur embarquable chez des médias bricolage / marchands, brandé « Propulsé par
Chiffréo », canal B2B2C (stratégie §7.6). Contrainte de départ : le `chf_` de PLAT-5 est
documenté comme ne devant **jamais** atteindre un navigateur, donc un widget tiers ne peut pas
l'utiliser directement — il fallait un second modèle de credential, pas un contournement.

### Décision de conception

- **Clé de widget non secrète (`wgt_...`), autorisée par origine plutôt que par
  confidentialité** — même logique qu'une clé publiable Stripe ou une clé Google Maps
  restreinte par referer. Alternatives écartées : un JWT signé n'aurait rien apporté (une
  lecture en base reste nécessaire à chaque appel pour la marque/l'état actif, donc aucun
  bénéfice de statelessness, plus un problème de rotation de clé de signature en plus) ; un
  proxy/iframe+BFF aurait ajouté une session/cookie, des en-têtes anti-clickjacking et un pont
  `postMessage` pour la taille, sans rien gagner sur l'isolation CSS/JS que la Shadow DOM
  fournit déjà. Contrepartie assumée : `Origin` n'est vérifié qu'au sens du navigateur — un
  script qui détient déjà la clé peut le forger (cf. Limites connues).
- **Une seule configuration par organisation** (`widget_configs`, `organization_id` unique) :
  le widget est un canal, pas une collection de credentials comme les clés d'API (jusqu'à 10
  actives par org en PLAT-5).
- **Quota mensuel partagé avec l'API partenaire** (même `ApiUsageService`/compteur Postgres) :
  un seul budget `public_api` par organisation plutôt qu'un second système de quota pour ce
  canal. Le widget embarqué et les appels directs à `/partner` consomment la même enveloppe.
- **Rafale à 120 req/min par widget, pas 60 comme `ApiKeyGuard`** : une clé de widget est
  appelée par de nombreux visiteurs indépendants d'un site tiers, pas par une seule intégration
  serveur-à-serveur — le plafond de PLAT-5 aurait produit des faux positifs sur le cas d'usage
  visé (un média à fort trafic).
- **Régénération de clé immédiate, sans fenêtre de grâce** (à la différence de la rotation des
  clés d'API) : la clé n'étant pas secrète, régénérer répond à un widget compromis ou mal
  configuré, pas à une fuite à couvrir en douceur. Toute page qui embarque déjà l'ancienne clé
  cesse de fonctionner aussitôt — compromis assumé pour la v1.
- **CORS rendu dynamique, mais seulement pour `/api/v1/widget/*`** : `main.ts` passe de
  `enableCors({ origin: corsOrigins })` (tableau statique) à une fonction `(req, callback)` qui
  ne change rien pour le reste de l'API et ne consulte, pour ce seul préfixe, qu'un cache en
  mémoire (`WidgetService.isOriginAllowedForCors`, TTL 60 s, même idiome que
  `FeatureGatesService.ensureCache()`) — sans ce cache, un en-tête `Origin` forgé par n'importe
  qui aurait forcé une requête Postgres à chaque préflight. Cette vérification n'est qu'une
  couche grossière (le préflight ne connaît pas le `:widgetKey` visé) ; `WidgetOriginGuard`
  reste la vérification précise, par clé.
- **`display_name` rendu en `textContent` uniquement, jamais en HTML**, côté widget : c'est un
  champ admin-défini (pas de dashboard, donc pas de sanitisation en amont) rendu sur des pages
  tierces — un vecteur XSS stocké si interpolé tel quel. Testé explicitement
  (`widget.spec.ts`).
- **Nouveau paquet workspace `apps/widget`**, sans dépendance React/framework (DOM et fetch
  natifs), isolé en **Shadow DOM** (`attachShadow`) — isolation CSS/JS dans les deux sens,
  satisfait directement la demande du ticket. Bundlé par `esbuild` (nouvelle dépendance,
  strictement nécessaire : `tsc` seul ne fabrique pas un unique fichier `<script>` à partir de
  modules ES, et un fichier sans imports aurait été impossible à tester via Jest). Le bundle
  construit est copié (`scripts/copy-to-web.mjs`) vers `apps/web/public/chiffreo-widget.js`,
  servi tel quel par Next — aucune route ni infrastructure supplémentaire. Ce fichier généré
  est **committé** (comme les autres assets de `apps/web/public/`) : toute modification de
  `apps/widget/src/widget.ts` doit être suivie d'un `pnpm build:widget` avant commit, sinon le
  bundle servi diverge de la source.
- **Une seule pièce / un seul ouvrage par estimation en v1** dans le formulaire du widget (pas
  d'ouvertures ni de segments) — le multi-pièces reste porté par l'API partenaire, pas exposé
  ici ; même réduction de périmètre que le calculateur public (`public/calculators`).
- **Pas d'écran de tableau de bord** pour configurer `allowed_origins`/la marque : même choix
  que les clés d'API (PLAT-5), qui n'en ont pas non plus — `GET/PATCH /widget-config` s'utilise
  directement.

### Vérification

```
pnpm --filter @chiffreo/api lint     # OK
pnpm --filter @chiffreo/api build    # OK (nest build)
pnpm --filter @chiffreo/api test     # 59 suites / 793 tests, aucune régression
pnpm --filter @chiffreo/widget lint  # OK
pnpm --filter @chiffreo/widget build # OK (tsc --noEmit + esbuild, bundle 6,2 ko minifié)
pnpm --filter @chiffreo/widget test  # 18 tests (montage Shadow DOM, bornes, forme de la
                                      # requête, rendu inerte d'un display_name malveillant,
                                      # messages d'erreur français)
```

Migration `1711468800057-CreateWidgetConfigs` validée `up()`/`down()`/`up()` sur une base
jetable `chiffreo_mig_test` (clone `pg_dump`/`psql` de `chiffreo`), puis appliquée pour de vrai
sur la base dev locale (`estimate-db`, désormais à jour jusqu'à `#057`) avec la commande
`ts-node` documentée en mémoire de session pour ce poste.

### Limites connues (assumées, documentées)

- Quota mensuel partagé entre l'API partenaire et le widget : un widget très fréquenté peut
  épuiser le budget mensuel de l'organisation plus vite qu'un usage `/partner` seul.
- `Origin` n'est une barrière qu'au sens du navigateur : un appelant scripté qui détient déjà la
  clé peut la forger. Acceptable car l'endpoint ne fait que du calcul de quantités, sans
  persistance ni prix — le pire cas est une consommation de quota, pas une fuite de données.
- Pas de fenêtre de grâce sur `regenerate-key` : une intégration déjà déployée casse aussitôt.
- Le widget ne calcule qu'une pièce et un ouvrage par soumission (l'API accepte davantage).
- Pas d'écran web pour configurer le widget (API-only, curl/Postman), et le bundle servi par
  `apps/web/public/chiffreo-widget.js` est un artefact committé, pas reconstruit à la volée.

## PLAT-6 — Offre Enterprise : SSO, contrat annuel, SLA (LIVRÉE) (2 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic PLAT-B, PLAT-6 (effort XL, dépend de PLAT-4 et
PLAT-5). Objectif : fédération d'identité par organisation (SAML/OIDC), habilitation portée par
un contrat annuel négocié sur devis, engagements de service lisibles dans le produit, mention
d'un environnement dédié. Sécurité critique : c'est le premier ticket qui laisse un tiers —
l'IdP du client — émettre des identités que nous acceptons.

### 1. État des lieux et invariants

Trois pièces étaient posées et attendaient cette livraison :

- la frontière de tenancy `organizations` + `OrgContextService` (PLAT-4), qui résout
  l'organisation active **exclusivement côté serveur** ;
- `MONTHLY_QUOTA_BY_TIER` (PLAT-5), dont le commentaire nomme déjà ce ticket comme son point
  d'extension ;
- le §10 de PLAT-4, qui inscrivait noir sur blanc les deux dettes que PLAT-6 doit solder :
  « facturation Stripe portée par l'organisation (aujourd'hui l'org projette simplement le plan
  de son propriétaire) » et « SSO ».

Rien d'autre n'existait : aucun code SAML/OIDC, aucune notion de contrat, `resolveProvider`
retombait silencieusement sur `email` pour tout fournisseur inconnu, et l'authentification était
intégralement déléguée à Firebase (`firebase_uid` seule ancre d'identité, aucun mot de passe
local).

Invariants que cette livraison ne doit pas casser :

- **I1 — Fail-closed.** Tout chemin d'échec (fournisseur inconnu, domaine non vérifié, contrat
  absent ou périmé, provisioning GCIP raté) doit refuser, jamais élargir.
- **I2 — Aucune organisation lue depuis le client.** L'ancre de confiance d'une session SSO doit
  être un identifiant que **nous** avons émis, pas une donnée que l'appelant contrôle.
- **I3 — Continuité d'accès.** Une organisation sans SSO et sans contrat doit se comporter
  exactement comme avant : même palier, même nombre de requêtes SQL sur le chemin chaud.
- **I4 — Aucun verrouillage irréversible.** Un IdP mal configuré ne doit jamais rendre une
  organisation à 10 k€/an inaccessible sans intervention du support.

### 2. Arbitrages de périmètre (validés avant implémentation)

- **Périmètre web** : contrairement à PLAT-4 et PLAT-5, le backend seul ne suffit pas. Une clé
  d'API s'essaie au `curl` ; une connexion SAML, non — elle exige un navigateur. Le strict
  nécessaire est donc livré côté web (découverte par e-mail + `signInWithPopup`), et **seuls**
  les écrans d'administration (connexions, domaines, contrat) restent différés, même séquencement
  assumé que PLAT-4 (UI membres) et PLAT-5 (UI clés).
- **Facturation** : le contrat est un enregistrement d'habilitation, pas un moteur de facturation.
  Les documents comptables (devis signé, facture annuelle) restent émis hors produit et sont
  référencés par `quote_reference` / `purchase_order_reference`. Réutiliser `invoices` était exclu :
  cette table modélise un artisan facturant **son** client, avec sa propre numérotation légale par
  organisation (art. 242 nonies A du CGI, cf.
  [docs/CONFORMITE_FACTURATION.md](../docs/CONFORMITE_FACTURATION.md)) — y glisser les factures de
  Chiffréo corromprait la séquence légale de chaque client.
- **SLA** : engagements chiffrés et opposables portés par le contrat, pas de mesure d'uptime. Une
  mesure réelle est un produit d'observabilité à part entière, que le ticket ne demande pas.
- **Environnement dédié** : « éventuel » au backlog, donc traité comme un attribut déclaratif du
  contrat. Aucune automatisation d'infrastructure.
- **Sièges** : hors périmètre. `multi_user` reste booléen, comme noté en PLAT-4 §10.

### 3. Décisions de conception

**D1 — L'habilitation Enterprise est un contrat porté par l'organisation, pas un abonnement
porté par une personne.** `enterprise_agreements` est rattaché à `organization_id` ;
`OrgContextService` renvoie `enterprise` dès qu'un contrat courant couvre l'organisation, **avant**
de retomber sur le palier du propriétaire. C'est exactement la dette inscrite en PLAT-4 §10 :
jusqu'ici une organisation ne faisait que projeter le plan de son propriétaire, si bien qu'un
changement de propriétaire ou une rétrogradation Stripe de sa personne éteignait le contrat de
l'entreprise. *Alternative écartée :* poser `subscription_tier = 'enterprise'` sur l'utilisateur
propriétaire — un attribut de personne tenant lieu de contrat d'entreprise, c'est-à-dire la dette
qu'on prétend rembourser.

**D2 — Le palier `enterprise` reste hors du catalogue self-serve.** Il est ajouté à
`SubscriptionTier`, à `TIER_RANK` (rang 5) et à `MONTHLY_QUOTA_BY_TIER` (100 000 appels/mois),
mais **pas** à `PLANS`, donc pas à la liste blanche de `createCheckoutSession`. Deux raisons : un
contrat à 10 k€ ne s'achète pas à la carte bancaire ; et un `price_id` Enterprise inconnu de
`priceIdToTier` ferait retomber `syncSubscriptionTier` sur son défaut `PRO` — un webhook Stripe
rétrograderait silencieusement le plus gros client de la base. En gardant Enterprise hors de
Stripe, ce chemin n'existe pas.

**D3 — L'ancre de confiance d'une session SSO est l'identifiant de fournisseur, jamais le
domaine e-mail.** `sso_connections.provider_id` (« `saml.acme-1a2b` ») est créé par nous dans
GCIP ; un jeton dont `firebase.sign_in_provider` vaut cette valeur prouve que l'assertion vient
de l'IdP de cette organisation-là. Le rattachement se fait donc `provider_id → organization_id`.
*Piège fermé :* rattacher par domaine d'e-mail aurait donné à l'IdP d'un client la capacité
d'affirmer `ceo@concurrent.fr` et d'entrer dans l'organisation d'un autre client. Un IdP ne parle
que pour lui-même, et c'est le `provider_id` — pas l'adresse qu'il affirme — qui dit lequel il est.

**D4 — Les domaines ne servent qu'à la découverte, et doivent être prouvés par DNS.** Un
enregistrement TXT `chiffreo-verification=<jeton>` sur le domaine est exigé avant qu'il ne route
quoi que ce soit. Comme le rattachement ne dépend pas du domaine (D3), un domaine non vérifié
n'ouvre aucun accès — mais un domaine usurpé enverrait les salariés d'un tiers vers l'IdP de
l'usurpateur, c'est-à-dire du hameçonnage. L'unicité est portée par un index **partiel**
`WHERE verified_at IS NOT NULL` : deux organisations peuvent tenter de prouver le même domaine,
une seule y parvient, et personne ne peut bloquer un concurrent en squattant une ligne non
vérifiée. Les domaines e-mail publics (gmail, orange, outlook…) sont refusés à l'ajout.

**D5 — Aucun secret d'IdP n'entre en base.** Certificats X.509, `client_secret` OIDC et URL de
SSO sont transmis à GCIP par le SDK Admin puis oubliés ; notre schéma ne garde que la
correspondance et la politique. Une fuite de la base ne livre donc aucun credential fédéré, et il
n'y a pas de second exemplaire à faire tourner le jour où le client change son certificat.

**D6 — Provisioning JIT idempotent, et jamais dégradant.** À la première connexion via l'IdP,
l'adhésion est créée avec `default_role` et `active_organization_id` pointe sur l'organisation de
la connexion. Si l'adhésion existe déjà, elle n'est **pas** touchée : sans cette règle, le
propriétaire de l'organisation serait rétrogradé en `member` à sa propre connexion SSO, et
perdrait au passage le bris de glace de D9.

**D7 — Aucun rattachement par e-mail à un compte existant.** Un nouveau `firebase_uid` reste un
nouvel utilisateur, conformément à `upsertFromFirebase` qui n'a jamais cherché par e-mail.
Fusionner sur l'adresse ferait de la prise de contrôle d'un compte mot-de-passe une simple
affaire d'assertion SAML. Le coût — un salarié déjà inscrit se retrouve avec deux comptes — est
assumé et documenté au §8 ; la fusion administrée est un ticket à part.

**D8 — L'enforcement se décide dans `FirebaseAuthGuard`, avec un chemin rapide à coût nul.** Le
guard est le seul point que traverse *toute* requête authentifiée, présente et future : y poser
la vérification la rend impossible à oublier sur un nouveau contrôleur, là où un guard à composer
manuellement serait fail-open par omission. Le coût sur le chemin chaud est nul tant qu'aucune
connexion n'est en enforcement : un booléen mis en cache 60 s (même TTL que `FeatureGatesService`)
court-circuite la vérification avant toute requête SQL, ce qui préserve I3.
*Alternative écartée :* faire porter la décision à `OrgContextService.resolveForUser` — plus juste
sémantiquement, mais il faudrait lui passer le jeton depuis la vingtaine de contrôleurs qui
l'appellent, pour une surface de modification sans rapport avec le risque traité.

**D9 — Le propriétaire de l'organisation est exempté de l'enforcement (bris de glace).** Un
certificat expiré ou une URL d'IdP erronée rendrait sinon une organisation à 10 k€/an totalement
inaccessible, et la seule sortie serait un contournement côté support — moins traçable que
l'exemption explicite qu'on documente ici (invariant I4).

**D10 — L'enforcement refuse explicitement (`403 SSO_REQUIRED`) et laisse une porte de sortie
nommée.** Quatre routes portent `@SsoExempt()` : `POST /auth/sync`, `GET /auth/me`,
`GET /organizations/mine`, `POST /organizations/:id/activate`. Sans elles, un salarié membre d'une
organisation en enforcement et connecté par mot de passe serait dans une impasse : refusé partout,
y compris sur la route qui lui permettrait de revenir à son espace personnel. L'exemption est un
décorateur — greppable, et fail-closed par défaut puisque son absence vaut enforcement.
*Alternative écartée :* retomber silencieusement sur l'espace personnel — l'utilisateur voit ses
données disparaître sans explication, et le motif du refus n'atteint jamais l'écran.

**D11 — SLA = engagements chiffrés sur le contrat, pas d'énumération de paliers.**
`sla_uptime_target`, `sla_support_response_hours` et `sla_support_email` sont des valeurs, pas un
`enum` : le commerce peut signer 99,5 % ou 99,95 % sans migration, et le produit n'a pas à
maintenir une table de correspondance qui divergerait du contrat signé.

**D12 — La provision GCIP est ordonnée pour échouer du bon côté.** La ligne est écrite en
`pending`, puis le fournisseur est créé chez Firebase, puis la ligne passe `active` — ou `failed`
avec le motif. L'orphelin possible est donc « une ligne sans fournisseur », inoffensive puisque
personne ne peut s'authentifier avec ; l'ordre inverse aurait laissé « un fournisseur sans
ligne », c'est-à-dire un IdP vivant que le rattachement JIT ne reconnaît pas. La suppression
efface d'abord chez Firebase : si cet appel échoue, la ligne est conservée et l'erreur remonte,
plutôt que de perdre la trace d'un fournisseur encore vivant.

**D13 — La découverte est publique, minimale et fortement limitée.** `GET /sso/discover?email=`
ne renvoie que `{ provider_id, protocol }`, jamais le nom de l'organisation ni l'état du contrat,
et porte un `@Throttle` de classe explicite. Une route de découverte révèle nécessairement qu'un
domaine est client — c'est la contrepartie inévitable du flux SP-initiated, assumée et documentée.
Le `@Throttle` n'est pas décoratif : le limiteur `auth` global (5 req/15 min par IP) plafonnerait
sinon tout un bureau derrière un même NAT (même précaution qu'en PLAT-5).

**D14 — Un seul contrat courant par organisation, garanti par index partiel.** Le renouvellement
se fait en repoussant `ends_at` ; un second contrat `active` est refusé
(`409 ENTERPRISE_AGREEMENT_OVERLAP`). L'expiration est **dérivée** de `ends_at`, jamais stockée :
un statut `expired` à maintenir aurait exigé un sweep, donc une fenêtre pendant laquelle la base
ment sur l'habilitation.

### 4. Schéma

```sql
-- migration 1711468800056
CREATE TABLE enterprise_agreements (
  id uuid PK, organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'draft',        -- draft | active | terminated (D14)
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  annual_amount_cents integer NOT NULL, currency varchar(3) NOT NULL DEFAULT 'EUR',
  quote_reference varchar(100) NOT NULL,              -- le devis signé, émis hors produit
  purchase_order_reference varchar(100), billing_contact_email varchar(255) NOT NULL,
  sla_uptime_target numeric(5,2), sla_support_response_hours integer,
  sla_support_email varchar(255),                     -- engagements chiffrés (D11)
  dedicated_environment boolean NOT NULL DEFAULT false, dedicated_environment_region varchar(50),
  notes text, created_by_user_id uuid REFERENCES users ON DELETE SET NULL,
  created_at, updated_at timestamptz
);
CREATE UNIQUE INDEX UQ_enterprise_agreements_active_org
  ON enterprise_agreements (organization_id) WHERE status = 'active';   -- un seul courant (D14)
CREATE INDEX IDX_enterprise_agreements_ends_at ON enterprise_agreements (ends_at);

CREATE TABLE sso_connections (
  id uuid PK,
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations ON DELETE CASCADE,
  provider_id varchar(64) NOT NULL UNIQUE,      -- « saml.acme-1a2b » : l'ancre de confiance (D3)
  protocol varchar(10) NOT NULL,                -- saml | oidc
  display_name varchar(100) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',      -- pending | active | failed (D12)
  enforced boolean NOT NULL DEFAULT false, default_role varchar(20) NOT NULL DEFAULT 'member',
  provisioning_error varchar(500),
  created_by_user_id uuid REFERENCES users ON DELETE SET NULL,
  created_at, updated_at timestamptz
);                                              -- aucun secret d'IdP dans cette table (D5)

CREATE TABLE sso_domains (
  id uuid PK, sso_connection_id uuid NOT NULL REFERENCES sso_connections ON DELETE CASCADE,
  domain varchar(255) NOT NULL, verification_token varchar(64) NOT NULL,
  verified_at timestamptz, created_at, updated_at timestamptz
);
CREATE UNIQUE INDEX UQ_sso_domains_connection_domain ON sso_domains (sso_connection_id, domain);
CREATE UNIQUE INDEX UQ_sso_domains_verified ON sso_domains (domain)
  WHERE verified_at IS NOT NULL;                -- partiel : le squat non vérifié ne bloque rien (D4)

INSERT INTO feature_gates (...) VALUES ('enterprise_sso', …, 'enterprise', true);
```

Une seule migration, seedée **activée** puisque la gate et son code arrivent ensemble (même geste
qu'en PRO-4/PLAT-1/PLAT-3). Aucun backfill : `down()` est trivialement réversible.

### 5. Impacts

- **API — nouveau** : module `enterprise` (3 entités, 2 services, 3 contrôleurs, un provisionneur
  GCIP et un vérificateur DNS isolés pour être injectables), `auth/sso-session.service.ts`,
  décorateur `@SsoExempt()`, 1 migration.
- **API — `OrgContextService`** : `resolveEffectiveTier` et `resolveTierForOrganization` passent
  toutes deux par un `hasCurrentAgreement()` privé — la règle reste à un seul endroit, comme le
  stipulait déjà le doc-comment de PLAT-5.
- **API — `FirebaseAuthGuard`** : appelle `SsoSessionService.assertSessionAllowed()` (D8).
- **API — `AuthService`** : `resolveProvider` reconnaît `saml.*`/`oidc.*` → `AuthProvider.SSO` ;
  `syncUser` déclenche le provisioning JIT (D6).
- **API — palier** : `SubscriptionTier.ENTERPRISE` + `TIER_RANK` + `MONTHLY_QUOTA_BY_TIER` +
  `UpsertFeatureGateDto`. `plans.constants.ts` **inchangé** (D2).
- **Web** : `AuthContext.loginWithSso`, composant `SsoLoginForm`, gestion de `SSO_REQUIRED`.
- **Docs** : `docs/API.md` (2 sections + TOC + codes d'erreur), `docs/BACKLOG.md` (PLAT-6 livrée),
  `docs/ARCHITECTURE.md` (module, palier, ligne SSO du tableau de sécurité).

### 6. Écarts entre la conception et l'implémentation

Trois points ne sont apparus qu'à la revue de sécurité de la conception, avant écriture :

- **L'impasse de l'enforcement.** La première version renvoyait `403` sans exception : un membre
  connecté par mot de passe ne pouvait plus appeler la route qui l'aurait ramené à son espace
  personnel. D'où `@SsoExempt()` et les quatre routes de D10.
- **La rétrogradation du propriétaire par son propre SSO.** Le provisioning JIT écrivait le rôle
  systématiquement ; le propriétaire serait passé `member` à sa première connexion fédérée, et
  aurait perdu le bris de glace de D9 au moment précis où il en aurait eu besoin. D'où D6.
- **Le webhook Stripe rétrogradant l'Enterprise.** `syncSubscriptionTier` retombe sur `PRO` pour
  tout `price_id` inconnu ; un plan Enterprise créé chez Stripe « pour la forme » aurait donc
  déclassé le client au premier événement. Résolu en gardant Enterprise entièrement hors de
  Stripe (D2), et non en ajoutant une exception dans le webhook.

### 7. Hors périmètre (assumé)

Écrans d'administration web (connexions, domaines, contrat) ; SCIM / déprovisionnement automatique ;
fusion administrée de deux comptes après bascule SSO (D7) ; e-mails de relance d'échéance de
contrat — l'écran d'administration expose la liste `expiring_within_days`, le sweep quotidien
viendra avec l'UI ; ARR des contrats dans `admin-analytics` (le MRR reste calculé sur Stripe seul) ;
automatisation d'un environnement dédié ; quotas de sièges.

### 8. Vérification

```
pnpm --filter @chiffreo/api lint       # OK (0 erreur)
pnpm --filter @chiffreo/api build      # OK
pnpm --filter @chiffreo/api test       # 768 tests / 57 suites (baseline 660/52), aucune régression
pnpm --filter @chiffreo/api test:e2e   # 174 tests / 14 suites (baseline 139/13), aucune régression
pnpm --filter @chiffreo/web lint       # OK (1 warning préexistant, no-img-element)
pnpm --filter @chiffreo/web build      # OK
pnpm --filter @chiffreo/web test       # 285 tests / 42 suites (baseline 279/41), aucune régression
```

**Suites neuves** (98 cas unitaires + 35 e2e + 6 web) : `sso-session.service.spec.ts` (23 cas :
reconnaissance de fournisseur, rattachement JIT, non-rétrogradation du propriétaire, course sur
l'index d'adhésion, matrice d'enforcement complète, chemin rapide et invalidation du cache) ;
`sso-connections.service.spec.ts` (25 cas, dont l'ordre d'écriture avant GCIP et l'assertion
négative « aucun secret persisté ») ; `public-email-domains.spec.ts` (26 cas) ;
`enterprise-agreements.service.spec.ts` (19 cas) ; `firebase-auth.guard.spec.ts` (5 cas, **guard
laissé réel**) ; `enterprise.e2e-spec.ts` (35 cas, **`FeatureGateGuard` laissé réel**) ;
`SsoLoginForm.spec.tsx` (6 cas).
**Suites étendues** : `org-context.service.spec.ts` (palier Enterprise sur les deux chemins de
résolution), `feature-gates.service.spec.ts` (rang `enterprise` dans l'échelle).

**Deux suites existantes ont dû être recâblées**, toutes deux par ajout de dépendance et non par
changement de comportement : `auth.service.spec.ts` et `org-context.service.spec.ts` (nouveaux
providers), et `community.e2e-spec.ts` qui laisse `FirebaseAuthGuard` réel et devait donc doubler
`SsoSessionService`.

**Migration** jouée `up → down → up` avec le vrai runner sur une base jetable
(`chiffreo_mig_test`, copie de la base dev), puis appliquée à la base dev. Contrôles passés sur
un jeu d'essai réel (deux organisations concurrentes) :

- un **second contrat `active`** sur la même organisation est refusé
  (`UQ_enterprise_agreements_active_org`), tandis qu'un contrat `terminated` coexiste sans gêne —
  c'est bien l'index *partiel* qui arbitre, pas une contrainte globale ;
- une **période inversée** est refusée par `CK_enterprise_agreements_period` ;
- **deux organisations peuvent revendiquer le même domaine** tant qu'aucune ne l'a prouvé ; la
  première à le prouver gagne, et la seconde est alors refusée (`UQ_sso_domains_verified`) — le
  squat d'une ligne non vérifiée ne bloque donc personne ;
- une **seconde connexion** sur la même organisation est refusée (`UQ_sso_connections_organization`) ;
- après `down()` : 0 table, 0 index et 0 ligne de gate résiduels.

**Revue sécurité** : la skill `/security-review` du repo ne démarre pas ici (elle diffe contre
`origin/HEAD`, absent — le dépôt n'a pas de remote), revue conduite manuellement sur le diff. Les
trois points relevés pendant la conception sont ceux du §6 ; les contrôles finaux sur le code
livré :

- **aucun secret d'IdP persisté ni journalisé** — vérifié par grep sur tous les appels au logger
  et par une assertion négative dans les tests (`expect(persisted).not.toContain(secret)`) ;
- **aucune organisation lue depuis le client** sur les trois contrôleurs : la portée vient
  toujours d'`OrgContextService`, et les recherches par `id` sont filtrées par
  `sso_connection_id`/`organization_id` de l'appelant ;
- **tous les chemins d'échec en refus** : fournisseur inconnu, connexion non active, domaine non
  vérifié, contrat absent ou hors période, provisioning GCIP raté ;
- `@Throttle` explicite sur les trois contrôleurs, sans quoi le limiteur `auth` global (5 req/15 min
  par IP) aurait plafonné un bureau entier derrière un même NAT.

### 9. Limites connues (assumées, documentées)

- **GCIP est un prérequis d'exploitation.** `createProviderConfig` exige l'upgrade du projet
  Firebase vers Identity Platform. Sans lui, la connexion reste `failed` avec le motif rendu à
  l'administrateur — refus lisible, jamais silencieux.
- **Un salarié déjà inscrit par mot de passe obtient un second compte à sa bascule SSO** (D7).
  Ses projets antérieurs restent dans son espace personnel.
- **L'enforcement ne porte pas sur les clés d'API.** Une clé appartient à l'organisation et non à
  une personne (PLAT-5 D1) : elle n'a pas de session à fédérer, et se révoque par sa propre
  surface. Ce n'est pas un contournement, c'est la conséquence du modèle — mais un lecteur
  pourrait supposer l'inverse.
- **Le cache d'enforcement est par instance** : une bascule met jusqu'à 60 s à se propager sur un
  déploiement multi-instances, exactement comme le cache de `FeatureGatesService`.
- **La découverte révèle qu'un domaine est client** (D13).
- **`admin-analytics` ignore les contrats Enterprise** : le MRR affiché reste celui de Stripe, un
  contrat annuel n'y apparaît donc pas.



Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic PLAT-B, PLAT-5 (effort L, dépend de PLAT-4).
Objectif : endpoints d'estimation documentés, clés d'API, quotas par palier. Ouvre PLAT-7
(widget marque blanche) et PLAT-6 (Enterprise), qui en dépendent tous deux. Sécurité critique :
authentification, rate limiting, rotation.

### 1. État des lieux

Deux pièces étaient déjà posées et attendaient cette livraison : la gate `public_api`, seedée
`min_tier = 'contractor_premium'`, `is_enabled = false` en `1711468800037` (PRO-1) ; et la
frontière de tenancy `organizations` + `OrgContextService` (PLAT-4), dont le §10 fixait déjà
l'intention — « les clés seront portées par l'organisation, plus par l'utilisateur ».

Tout le reste était à construire : aucune entité de clé, aucun guard, aucun compteur d'usage,
aucun Redis, aucun `@nestjs/swagger`. Le seul quota du repo était la limite Free de 2 projets
(`ProjectsService.countActiveProjects`), le seul rate limiting `@nestjs/throttler` en mémoire,
**tracké par IP**.

### 2. Arbitrages de périmètre (validés avant implémentation)

- **Documentation** : section dans `docs/API.md`, pas de `@nestjs/swagger`. Une spec OpenAPI
  aurait ajouté une dépendance et des décorateurs à maintenir en double de la doc Markdown déjà
  tenue à jour par convention (CONTRIBUTING §« Nouveau endpoint API »).
- **Périmètre** : backend seul, l'écran `settings/api-keys` est différé — même séquencement
  assumé que PLAT-4 (UI membres) et PRO-2.
- **Paliers** : la gate reste à `contractor_premium` telle que PRO-1 l'a arbitrée. La table de
  quotas est indexée par palier (point d'extension PLAT-6) mais un seul palier a un quota non
  nul. Aucun arbitrage de packaging rouvert par un ticket technique.

### 3. Décisions de conception

**D1 — La clé appartient à l'organisation, jamais à une personne.**
`api_keys.organization_id` porte la propriété ; `created_by_user_id` n'est qu'une trace
d'auteur (`ON DELETE SET NULL`), exactement le renversement de sens acté en PLAT-4 D1. Une clé
survit donc au départ du salarié qui l'a créée. C'est aussi la seule façon de résoudre une
portée : `OrgContextService` refuse par construction de lire une organisation depuis un en-tête
client (surface d'IDOR sur toutes les données métier) — la clé doit donc **porter** la sienne.

**D2 — Le secret n'est stocké que haché.** `chf_` + `randomBytes(32).toString('hex')`, persisté
en SHA-256 hex dans `varchar(64) UNIQUE`, rendu en clair **une seule fois**. Patron repris des
invitations PLAT-4. Ni sel ni HMAC : sur un secret aléatoire de 256 bits il n'y a pas de
dictionnaire à précalculer, et le hash nu permet la recherche O(1) sur index dont le guard a
besoin à chaque requête. `key_prefix` (« chf_a1b2c3d4 ») n'est qu'un repère d'affichage : il
révèle 8 caractères sur 64, soit 224 bits d'entropie intacts.

**D3 — Rotation en place avec fenêtre de grâce, distincte de la révocation.**
`POST /api-keys/:id/rotate` déplace `key_hash` → `previous_key_hash`, pose
`previous_key_expires_at = now() + 24 h` et rend le nouveau secret ; le guard accepte les deux
empreintes, la seconde tant qu'elle n'est pas expirée. L'`id` ne bouge pas : l'historique
d'usage et les références qui désignent la clé survivent. La révocation (`DELETE`) reste
immédiate et sans grâce — c'est le geste d'urgence après une fuite, et elle efface l'empreinte
précédente, sans quoi une rotation en cours laisserait un second secret vivant.
*Alternative écartée :* « créer une nouvelle clé + révoquer l'ancienne » — ne rote rien, oblige
l'intégrateur à gérer deux entrées et scinde l'historique.
*Piège fermé :* une seconde rotation pendant la grâce est refusée (`409 ROTATION_IN_PROGRESS`).
Sans ce garde-fou elle écrasait silencieusement l'empreinte précédente et tuait, sans aucun
signal, une clé encore déployée chez le client.

**D4 — Quota mensuel = compteur atomique par organisation, pas un journal de requêtes.**
`api_usage_counters (organization_id, period)` avec
`INSERT … ON CONFLICT … DO UPDATE … RETURNING` : le comptage et la valeur sur laquelle on décide
sont la **même** opération, donc insensibles à la concurrence. Patron déjà éprouvé sur
`invoice_sequences`/`quote_sequences` (PRO-4, PLAT-4).
*Alternatives écartées :* (a) `COUNT(*)` sur une table de log — croissance non bornée et
ralentissement à mesure que l'API réussit ; (b) `@nestjs/throttler` — stockage en mémoire, TTL à
l'échelle de la minute, remis à zéro à chaque redémarrage : structurellement inapte à un quota
mensuel facturable. Le compteur est porté par l'**organisation** et non par la clé : le quota
suit le palier et le palier suit l'organisation (PLAT-4 D3) — une organisation ne doit pas
pouvoir multiplier son quota en multipliant ses clés.

**D5 — Deux dimensions de limitation, chacune avec l'outil adapté.** Le mensuel est en Postgres
(D4) ; la **rafale** reste `@nestjs/throttler`, mais indexée sur la clé et non sur l'IP. Le
throttler global du repo suit l'IP, ce qui est faux pour un appel serveur-à-serveur : deux
clients derrière une même sortie (Make, n8n, un PaaS mutualisé) partageraient un compteur. Le
guard appelle donc directement `ThrottlerStorage.increment('api-key:<id>', …)`, et le
`@Throttle` de classe reste un plancher anti-inondation par IP qui protège la recherche de clé
elle-même. *Alternative écartée :* sous-classer `ThrottlerGuard` en surchargeant `getTracker()`
— les deux guards liraient la **même** métadonnée `@Throttle`, donc impossible de leur donner
des limites différentes, pour deux comptages par requête et aucun gain.

**D6 — La gate est réévaluée à chaque requête, pas seulement à la création de la clé.** Le
guard résout le palier de l'organisation puis appelle `isFeatureAllowed('public_api', …)` sur
chaque appel : une rétrogradation ou un impayé éteint la clé sans qu'aucun sweep n'ait à
passer. Le cache 60 s de `FeatureGatesService` ne porte que sur la *configuration* de la gate,
jamais sur le palier — celui-ci est relu à chaque requête.

**D7 — Endpoint d'estimation sans aucune persistance.** L'API publique ne crée ni projet, ni
pièce, ni `estimation_results` : c'est ce qui la rend utilisable par un widget tiers (PLAT-7) et
ce qui lui évite d'ouvrir une surface d'IDOR sur les données métier. Réponse en `200`, pas
`201` — rien n'est créé.

**D8 — Périmètre public volontairement étroit.** Trois routes : estimer, savoir quoi estimer,
connaître sa consommation. **Pas** de lecture des projets/devis/factures : ce serait une seconde
surface d'autorisation à auditer pour une valeur que le ticket ne demande pas.

**D9 — Préfixe d'URL `partner` et non `public`.** Dans cette base, `public/` désigne déjà les
routes **sans aucune authentification** (`public/calculators`, `public/analytics`). Les
confondre rendrait illisible, en lecture de code, la frontière entre ce qui exige un credential
et ce qui n'en exige aucun.

**D10 — Le quota est opt-in par route (`@CountsAgainstQuota`), pas appliqué en bloc.** Compter
toutes les routes ferait payer au client la lecture de son propre quota — un client au quota ne
pourrait même plus le consulter, et un monitoring interrogeant `/usage` chaque minute le
brûlerait à lui seul. Seul `POST /partner/estimate`, qui fait travailler le moteur, est
décompté. La rafale est vérifiée **avant** le quota, pour qu'une requête rejetée pour rafale
n'ait pas déjà consommé du quota facturable.

### 4. Schéma

```sql
-- migration 1711468800055
CREATE TABLE api_keys (
  id uuid PK, organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  name varchar(100), key_prefix varchar(16),
  key_hash varchar(64) NOT NULL UNIQUE,          -- sha256 hex (D2)
  previous_key_hash varchar(64), previous_key_expires_at timestamptz,   -- rotation (D3)
  created_by_user_id uuid REFERENCES users ON DELETE SET NULL,
  last_used_at, revoked_at, created_at, updated_at timestamptz
);
CREATE UNIQUE INDEX UQ_api_keys_previous_key_hash
  ON api_keys (previous_key_hash) WHERE previous_key_hash IS NOT NULL;   -- partiel : deux NULL
                                                                         -- ne sont jamais égaux
CREATE TABLE api_usage_counters (
  organization_id uuid REFERENCES organizations ON DELETE CASCADE,
  period varchar(7), request_count integer DEFAULT 0, updated_at timestamptz,
  PRIMARY KEY (organization_id, period)
);
UPDATE feature_gates SET is_enabled = true WHERE feature_key = 'public_api';
```

Une seule migration, comme PLAT-4 : la gate n'est allumée que par la livraison qui l'implémente.
Aucun backfill, donc `down()` trivialement réversible.

`period` et `reset_at` sont calculés **en SQL** (`to_char(now() AT TIME ZONE 'Europe/Paris',
'YYYY-MM')`) et non en Node : les calculer côté application les exposerait au fuseau du process,
et deux instances mal configurées scinderaient le quota d'un même client entre deux lignes.

### 5. Impacts

- **API — nouveau** : module `api-keys` (deux contrôleurs, deux services, un guard, deux
  décorateurs), 2 entités, 1 migration.
- **API — `OrgContextService`** gagne `resolveTierForOrganization(organizationId)` : le palier
  d'une organisation **sans utilisateur appelant**. La règle « le palier est celui du
  propriétaire » reste ainsi en un seul endroit ; la réécrire dans le guard l'aurait fait
  diverger au premier changement.
- **API — `EstimationsService`** gagne `estimatePublicMulti(dto)` et `listWorkTypes()`. Placer
  le calcul ici plutôt que dans le nouveau module évite de dupliquer `loadMaterialInputs` :
  en recopier le corps aurait forké l'invariant `is_eco: false` (PLAT-3) et l'API payante se
  serait mise, un jour, à chiffrer des matériaux éco que l'application n'utilise pas.
- **API — `types/express.d.ts`** gagne `apiKeyScope`. Type dédié `ApiKeyScope`, délibérément
  distinct d'`OrgScope` : il n'y a pas d'utilisateur derrière une clé, et fabriquer un `OrgScope`
  factice ferait entrer un appel machine dans `resolveForUser`, qui **crée** paresseusement une
  organisation personnelle.
- **Web** : aucun impact, aucun fichier touché.
- **Docs** : `docs/API.md` (deux sections + en-tête de rate limiting + codes d'erreur),
  `docs/BACKLOG.md` (PLAT-5 livrée).

### 6. Écarts entre la conception et l'implémentation

Trois points ne sont apparus qu'à la revue de sécurité de la conception, avant écriture :

- **Le contrôleur de gestion serait né plafonné à 5 requêtes/15 min.** Le limiteur `auth`
  déclaré globalement dans `app.module.ts` s'applique à **toutes** les routes ; sans `@Throttle`
  de classe, un bureau derrière un seul NAT aurait partagé ce compteur dérisoire. Le défaut est
  systémique dans le repo (`organizations.controller.ts` en souffre aussi) mais il n'y avait
  aucune raison d'y ajouter une surface neuve. Corollaire noté au passage : `@SkipThrottle()`
  sans argument est un **no-op** ici, puisqu'il cible un limiteur nommé `default` qui n'existe
  pas dans cette configuration.
- **Les bornes du DTO ne sont pas cosmétiques.** Le moteur reconstruit une grille de rectangles
  par surface calculée, soit quatre grilles par ouvrage et par pièce ; sans plafond sur `rooms`
  et `work_items`, une seule requête bien formée aurait monopolisé la boucle d'événements d'un
  process mono-thread. D'où `ArrayMaxSize` sur les pièces (20) et les ouvrages (7), en plus des
  bornes unitaires reprises du calculateur public.
- **Les 7 types de travaux sont exposés, pas les 5 du calculateur public.**
  `PUBLIC_WORK_TYPE_CODES` est un arbitrage produit du lead magnet `/calculateurs`, pas une
  limite technique : `drywall` et `wall_covering` ont leur catalogue seedé et s'estiment
  normalement. En priver une API payante aurait été un ticket de support en puissance. La
  validation se fait donc contre la table `work_types`, pas contre une constante.

### 7. Vérification

```
pnpm --filter @chiffreo/api lint       # OK (0 erreur)
pnpm --filter @chiffreo/api build      # OK
pnpm --filter @chiffreo/api test       # 660 tests / 52 suites (baseline 623/49), aucune régression
pnpm --filter @chiffreo/api test:e2e   # 139 tests / 13 suites (baseline 119/12), aucune régression
```

**Suites neuves** : `api-keys.service.spec.ts` (secret jamais persisté en clair, empreintes
jamais exposées par la liste, rotation qui conserve l'id et ouvre la grâce, double rotation
refusée, révocation qui efface l'empreinte précédente, plafond de clés, `member` refusé sur
toute gestion, **filtre `organization_id` présent sur chaque recherche manageable**) ;
`api-usage.service.spec.ts` (upsert atomique, période et remise à zéro calculées en SQL en
Europe/Paris, `peek` non incrémentant, quotas par palier) ;
`api-key.guard.spec.ts` (préfixe absent, jeton Firebase présenté à la place d'une clé — refusé
**sans requête en base**, clé inconnue, clé révoquée, empreinte de rotation dans puis hors
grâce, rétrogradation de palier, rafale, quota, exactement-à-la-limite accepté, route non
décomptée) ; `api-keys.e2e-spec.ts` (20 cas, **`ApiKeyGuard` laissé réel** — seules ses
dépendances sont doublées).

**Migration** jouée `up → down → up` avec le vrai runner sur une base jetable clonée de la base
de dev, puis pour de vrai sur la base de dev. Contrôles passés sur un jeu d'essai réel (artisan
Premium + son organisation) :

- upsert atomique : trois appels successifs rendent 1, 2, 3 ; `peek` rend 3 sans incrémenter ;
- `reset_at` = `2026-08-31 22:00 UTC`, soit bien le 1ᵉʳ septembre à minuit heure de Paris ;
- `UQ_api_keys_key_hash` rejette une empreinte dupliquée ;
- l'index **partiel** accepte plusieurs `previous_key_hash` NULL et rejette un doublon non-NULL
  — c'est précisément ce qu'une contrainte `UNIQUE` nue n'aurait pas fait ;
- supprimer une organisation efface en cascade ses clés **et** ses compteurs ;
- gate `public_api` à `true` après `up()`, re-éteinte par `down()` ;
- après `down()` : 0 table et 0 index résiduels.

**Revue sécurité** : la skill `/security-review` échoue sur ce repo (elle diffe contre
`origin/HEAD`, qui n'existe pas — pas de remote configuré). Revue conduite à la main sur les
fichiers sensibles, plus une revue adversariale du plan avant écriture, qui a produit six
bloquants tous corrigés avant la première ligne de code :

1. fabriquer un `OrgScope` sans utilisateur (ne compilait pas, et aurait déclenché la création
   paresseuse d'organisation sur un appel machine) → `ApiKeyScope` dédié ;
2. **IDOR inter-organisations** sur `rotate`/`revoke` : la conception ne parlait que du contrôle
   de rôle, pas du filtre `organization_id` — tout administrateur d'une organisation Premium
   aurait pu faire tourner ou révoquer la clé d'un autre client en devinant un UUID ;
3. quota décompté sur des requêtes sans valeur rendue (rafale rejetée, validation échouée,
   lecture du quota lui-même) → décompte opt-in par route ;
4. contrôleur de gestion plafonné à 5 req/15 min par le limiteur `auth` global ;
5. absence de bornes sur le DTO multi-pièces → DoS CPU ;
6. `GET /api-keys` renvoyant les entités, donc les empreintes → projection `ApiKeyView` explicite.

Contrôles finaux : aucun secret journalisé (les traces ne portent que l'`id` de la clé), aucun
`organization_id` lu depuis le client (les deux seules occurrences viennent d'une portée résolue
côté serveur), tous les chemins d'échec en refus.

### 8. Limites connues (assumées, documentées)

- **Le compteur de rafale est en mémoire du process**, comme tout le throttling de cette API :
  la limite de 60 req/min se multiplie donc par le nombre d'instances. Le quota mensuel, lui,
  est en Postgres et ne dérive pas — l'asymétrie est voulue, c'est le compteur facturable qui
  doit être exact.
- **Le quota suit le mois calendaire (Europe/Paris), pas l'anniversaire de facturation Stripe.**
  Aligner les deux relève de PLAT-6, qui déplace réellement la facturation sur l'organisation.
- **Aucune permission fine par clé** : une clé porte toute la portée de son organisation. Avec
  une seule route qui calcule et ne persiste rien, un modèle de scopes serait disproportionné.
- **Pas d'expiration programmée** (`expires_at`) : le cycle de vie livré est
  rotation + révocation, ce que demandait le ticket.
- **Pas de spec OpenAPI machine-lisible** ni d'écran web de gestion (cf. §2).
- Les clés ne sont pas utilisables depuis un navigateur, et c'est délibéré : la configuration
  CORS n'autorise que les origines déclarées, et une clé exposée côté client fuiterait. La
  documentation l'indique explicitement.

## PLAT-4 — Organisations, membres, rôles (LIVRÉE) (1 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic PLAT-B, PLAT-4 (effort XL, dépend de PRO-1).
Objectif : introduire `organizations`/`organization_memberships` + rôles et transférer la
propriété des projets/clients/devis à l'organisation. Prérequis de Contractor Premium
multi-employés (gate `multi_user`, seedée désactivée en PRO-1) et de toute l'assise enterprise
(PLAT-5 clés d'API par org, PLAT-6 SSO/facturation par entité).

### 1. État des lieux et invariants

La propriété est aujourd'hui strictement individuelle : `projects.user_id`, `clients.user_id`,
`quotes.user_id`, `invoices.user_id`, `company_profiles.user_id`, et
`invoice_sequences (user_id, year)`. Chaque service fait son propre contrôle via
`findOneByUser(id, userId)` — il n'existe aucun guard d'ownership générique
([docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) §Sécurité).

Invariants que la migration ne doit pas casser :

- **I1 — Continuité d'accès.** Aucun utilisateur existant ne perd l'accès à une donnée, et pour
  un solo (99 % de la base) le comportement observable est strictement inchangé.
- **I2 — Numérotation par émetteur légal.** Devis et factures doivent rester uniques et, pour
  les factures, continus **par entité émettrice** (art. 242 nonies A CGI, cf.
  [docs/CONFORMITE_FACTURATION.md](../docs/CONFORMITE_FACTURATION.md)). L'émetteur cesse d'être
  une personne pour devenir l'organisation : c'est la contrainte la plus dure du ticket.
- **I3 — Immuabilité des factures émises** (PRO-4) : on ne réécrit aucun `seller_snapshot`,
  aucun `invoice_number`.
- **I4 — Réversibilité.** `down()` doit rendre une base exploitable par le code d'avant, sans
  perte de ligne.
- **I5 — Fail-closed.** Une résolution d'organisation qui échoue refuse l'accès, elle ne
  retombe jamais sur « tous les projets ».

### 2. Décisions de conception

**D1 — `organization_id` s'ajoute à `user_id`, il ne le remplace pas.** Sur `projects`,
`clients`, `quotes`, `invoices`, `company_profiles`, `user_id` reste et change de sens : il
devient l'**auteur** (qui a créé la ligne), tandis que `organization_id` devient l'**axe de
propriété et de portée**. Tous les contrôles d'accès basculent sur `organization_id`.
*Alternatives écartées :* (a) renommer/remplacer `user_id` — perd l'attribution d'auteur, dont
on a besoin dès qu'une org a plusieurs membres (« devis créé par Untel »), et rend `down()`
destructif ; (b) table de jointure `resource_owner` polymorphe — indexation et jointures
coûteuses pour zéro bénéfice, la propriété est simple et exclusive.

**D2 — Une organisation personnelle pour chaque utilisateur, créée par backfill puis
paresseusement.** Après migration, `count(organizations) == count(users)` et chaque utilisateur
est `owner` de la sienne (`is_personal = true`). Il n'y a donc jamais de cas « utilisateur sans
org » à traiter dans le code applicatif, ce qui est ce qui rend I1 vrai par construction : pour
un solo, « mon org » ≡ « moi ». Un index unique partiel
(`UNIQUE (owner_user_id) WHERE is_personal`) garantit qu'il en existe exactement une, donc que
le repli de résolution est toujours défini et unique. Les comptes créés **après** la migration
l'obtiennent par création paresseuse dans `OrgContextService` — même patron que
`getOrCreateDefaultRoom` (ENG-2), qui évite d'avoir à modifier `AuthService.syncUser` et couvre
aussi les comptes anonymes.

**D3 — Le palier effectif suit l'organisation active, pas l'utilisateur.** `FeatureGateGuard`
lisait `user.subscription_tier` ; il lira le palier du **propriétaire de l'organisation
active**. C'est le cœur fonctionnel du ticket : un salarié au palier `free` invité dans l'org
d'un Contractor Premium doit travailler avec les capacités Premium **tant qu'il est dans cette
org**, et retrouver son propre palier dans son espace personnel. Stripe reste inchangé
(abonnement 1:1 utilisateur) : l'org ne fait que projeter le plan de son propriétaire. Déplacer
réellement la facturation sur l'org est un sujet PLAT-6, explicitement hors périmètre ici.
*Alternative écartée :* colonne `organizations.subscription_tier` dupliquant le palier — seconde
source de vérité à resynchroniser à chaque webhook Stripe, exactement l'indirection rejetée en
PRO-1.

**D4 — Trois rôles, `owner` / `admin` / `member`,** orthogonaux au `users.role`
(`user`/`admin`) qui reste un rôle *plateforme*.

| Rôle | Projets / clients / devis / factures de l'org | Membres | Org |
|---|---|---|---|
| `member` | CRUD complet | lecture | — |
| `admin` | CRUD complet | inviter, révoquer, changer un rôle non-`owner` | — |
| `owner` | CRUD complet | tout | seul non-supprimable, porte le palier |

**D5 — Périmètre exact du transfert de propriété.** Une donnée bascule à l'org si et seulement
si elle appartient à l'*entreprise* ; elle reste à l'utilisateur si elle appartient à la
*personne*.

| Bascule à l'org | Reste à l'utilisateur | Motif |
|---|---|---|
| `projects`, `clients`, `quotes` | `users`, `subscriptions` | énoncé du ticket / Stripe hors périmètre (D3) |
| `invoices`, `invoice_sequences` | `referral_credits`, `analytics_events` | I2 : l'émetteur est l'entreprise / attaché à une personne |
| `company_profiles` | `room_log_entries` (carnet) | identité légale de l'émetteur / le carnet documente *un logement*, pas une entreprise |
| `quote_sequences` (nouvelle) | `community_*` | I2 / un partage communauté est signé par une personne |

`rooms`, `room_dimensions`, `openings`, `project_work_items`, `project_photos`,
`estimation_results`, `shopping_lists`, `site_milestones` **ne changent pas** : ils n'ont pas de
colonne de propriété propre et héritent déjà de celle du projet. Le seul contrôle à faire
évoluer pour eux est le `ProjectsService.findOneByUser` qu'ils appellent tous en préambule.

**D6 — La numérotation devient un compteur par organisation, pour les devis comme pour les
factures.** `invoice_sequences` est re-clé sur `(organization_id, year)` : sans cela, deux
salariés d'une même entreprise émettraient chacun leur `F-2026-0001`, ce qui est une
non-conformité, pas un désagrément. Symétriquement, `QuotesService.generateNextQuoteNumber`
faisait un `MAX(quote_number) … LIKE` par utilisateur — sans verrou, donc racy dès que deux
personnes créent un devis en même temps, ce qui était impossible avant ce ticket et devient
banal après. On le remplace par une table `quote_sequences (organization_id, year)` allouée en
transaction avec l'`INSERT`, exactement le patron `ON CONFLICT … DO UPDATE … RETURNING` déjà
éprouvé et documenté en PRO-4. Les trous de séquence, illégaux sur une facture, sont sans enjeu
sur un devis — c'est le verrou qui nous intéresse ici, pas la continuité.

**D7 — Piège des contraintes d'unicité : `UQ_quotes_user_number` et `UQ_invoices_user_number`
doivent être *remplacées*, pas doublées.** Les conserver produirait de faux rejets : un
utilisateur membre de deux organisations obtiendrait légitimement `D-2026-001` dans chacune, et
l'ancienne contrainte `(user_id, quote_number)` refuserait la seconde écriture. Elles sont donc
droppées au profit de `(organization_id, quote_number)` et `(organization_id, invoice_number)`.

**D8 — `company_profiles` reçoit `organization_id`, il ne devient pas `organizations`.** La
tentation est réelle (SIRET, IBAN, assurance décennale : c'est déjà l'identité d'une
entreprise), mais les deux tables répondent à deux questions différentes : `organizations` est
la **frontière de tenancy** que possède *tout* utilisateur, y compris un particulier bricoleur
sans SIRET ; `company_profiles` est l'**identité légale d'émetteur**, optionnelle et propre aux
artisans qui facturent. Les fusionner imposerait des colonnes légales nullables à 100 % de la
base et rendrait la migration non réversible. Relation retenue : 0..1 profil par organisation
(`UNIQUE (organization_id)`, l'ancien `UNIQUE (user_id)` étant droppé pour la raison D7).

**D9 — Résolution du contexte via un `OrgContextService`, sans toucher à l'empilement des
guards.** Chaque contrôleur possède déjà un helper privé `resolveUserId(firebaseUser)` ; il
devient `resolveScope(firebaseUser)` et renvoie `{ userId, organizationId, role,
effectiveTier }`. Le diff reste d'une ligne par méthode et l'ordre des guards ne bouge nulle
part. L'organisation active se résout **exclusivement côté serveur** — jamais depuis un en-tête
ou un paramètre client, qui serait une surface d'IDOR — dans cet ordre : `users.active_organization_id`
si l'adhésion correspondante existe encore, sinon l'organisation personnelle, sinon création
paresseuse (D2). Le service vit dans un module `OrgContextModule` sans aucune dépendance vers
`FeatureGatesModule`, ce qui évite le cycle `FeatureGates → OrgContext → FeatureGates` : c'est
`FeatureGateGuard` qui dépend de `OrgContextService` (D3), pas l'inverse.

**D10 — Invitations par jeton à usage unique.** C'est le seul moyen de créer une seconde
adhésion, donc le minimum sans lequel `multi_user` resterait une gate sur du vide. Table
`organization_invitations`, jeton aléatoire 32 octets dont seul le **SHA-256 est stocké**
(une fuite de base ne donne pas d'invitation utilisable), expiration à 7 jours, e-mail via le
provider GTM-5. L'acceptation exige d'être authentifié et que l'e-mail du compte corresponde à
celui invité. Révocation = suppression de la ligne.

### 3. Schéma cible

```sql
-- Frontière de tenancy
CREATE TABLE organizations (
  id uuid PK DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_personal boolean NOT NULL DEFAULT true,
  created_at, updated_at timestamptz
);
CREATE UNIQUE INDEX UQ_organizations_personal_owner
  ON organizations (owner_user_id) WHERE is_personal;   -- garantit D2

CREATE TABLE organization_memberships (
  id uuid PK, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL DEFAULT 'member',
  created_at, updated_at timestamptz,
  UNIQUE (organization_id, user_id)
);

CREATE TABLE organization_invitations (
  id uuid PK, organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email varchar(255) NOT NULL, role varchar(20) NOT NULL DEFAULT 'member',
  token_hash varchar(64) NOT NULL UNIQUE,               -- sha256 hex, cf. D10
  invited_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL, accepted_at timestamptz, created_at timestamptz
);
CREATE UNIQUE INDEX UQ_org_invitations_pending
  ON organization_invitations (organization_id, lower(email)) WHERE accepted_at IS NULL;

ALTER TABLE users ADD active_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

-- Propriété (D1) : colonne ajoutée, user_id conservé comme auteur
ALTER TABLE projects   ADD organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE clients    ADD organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE quotes     ADD organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE invoices   ADD organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE company_profiles ADD organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE;
-- + index sur chaque organization_id ; UQ_quotes_user_number → UQ_quotes_org_number,
--   UQ_invoices_user_number → UQ_invoices_org_number, UQ_company_profiles_user droppée (D7/D8)

-- Séquences (D6)
ALTER TABLE invoice_sequences  -- PK (user_id, year) → (organization_id, year), user_id droppé
CREATE TABLE quote_sequences (organization_id uuid, year integer, last_number integer DEFAULT 0,
  PRIMARY KEY (organization_id, year), FOREIGN KEY … ON DELETE CASCADE);
```

### 4. Stratégie de migration des données (`1711468800054`)

Une seule migration, ordonnée pour qu'aucune colonne `NOT NULL` ne soit posée avant son
backfill :

1. Créer les trois tables + `users.active_organization_id`.
2. `INSERT INTO organizations (name, owner_user_id, is_personal) SELECT COALESCE(cp.company_name, 'Mon espace'), u.id, true FROM users u LEFT JOIN company_profiles cp ON cp.user_id = u.id`
   — l'org personnelle d'un artisan prend le nom de son entreprise, celle d'un particulier un
   libellé neutre.
3. `INSERT INTO organization_memberships … SELECT id, owner_user_id, 'owner' FROM organizations`.
4. Sur chacune des 5 tables : `ADD COLUMN organization_id uuid` (nullable), puis
   `UPDATE t SET organization_id = o.id FROM organizations o WHERE o.owner_user_id = t.user_id AND o.is_personal`,
   puis `SET NOT NULL` + FK + index. Le `SET NOT NULL` est la **sonde de complétude** : il
   échoue et annule la migration si une seule ligne n'a pas trouvé son org.
5. Échanger les contraintes d'unicité (D7), re-clé `invoice_sequences` (D6).
6. Créer `quote_sequences` et l'amorcer à l'état réel :
   `INSERT … SELECT organization_id, année, MAX(séquence) FROM quotes GROUP BY 1,2` — sans cet
   amorçage, le premier devis post-migration réémettrait `D-2026-001` en collision avec un
   existant.
7. Activer la gate `multi_user` (`is_enabled = true`), même geste qu'en BUY-2/PRO-2/PRO-3 :
   la gate ne s'allume que dans la livraison qui apporte la fonctionnalité réelle.

Comme le backfill est un 1:1 strict utilisateur → organisation, toutes les requêtes scopées
`organization_id` renvoient exactement le même résultat qu'avant sur la base existante : c'est
I1, et c'est ce qui rend le déploiement non-événementiel.

### 5. Réversibilité

`down()` reprend les étapes en ordre inverse, avec un seul point d'attention : les colonnes qui
ont été *supprimées* (`invoice_sequences.user_id`) doivent être restaurées **avant** le
`DROP TABLE organizations`, seule source du mapping org → propriétaire. Le reste est un
`DROP COLUMN organization_id` : comme `user_id` n'a jamais été retiré (D1), aucune ligne
n'est orpheline et le code d'avant retrouve exactement sa sémantique.

Perte assumée et documentée : les données créées **après** la migration par un salarié dans
l'org de son employeur (donc `user_id` = salarié, `organization_id` = employeur) se retrouvent,
après rollback, attribuées à leur auteur et non à l'entreprise. Il n'y a pas de meilleure
réponse — le modèle d'avant ne sait pas représenter cette information. Un rollback reste donc
sûr techniquement, et ne devient sémantiquement lossy qu'à partir du moment où une deuxième
adhésion a réellement été créée.

### 6. Impacts

- **API — portée** : `resolveUserId` → `resolveScope` dans les contrôleurs `projects`,
  `clients`, `quotes`, `invoices`, `company-profiles`, `photos`, `shopping-lists`,
  `estimations`, `site-tracking`, `analysis` ; `findOneByUser`/`findAllByUser`/`countByUser`
  des services correspondants prennent `organizationId`. `ProjectsService.findOneByUser` est
  l'unique préambule de contrôle de tous les sous-objets d'un projet : c'est le point de
  bascule à ne pas manquer.
- **API — quotas** : la limite Free de 2 projets se compte désormais par organisation
  (`countActiveProjects`), sans changement observable pour un solo.
- **API — gating** : `FeatureGateGuard` évalue le palier de l'org active (D3).
- **API — fusion de compte invité** : `UsersService.transferProjects` (appelée par
  `mergeGuestAccount`) doit repointer `organization_id` vers l'org personnelle du compte cible
  en même temps que `user_id`, sans quoi le projet fusionné resterait invisible.
- **API — nouveau** : module `organizations` (contexte, membres, invitations) et
  `OrgContextModule`.
- **Web** : aucune rupture de contrat — les réponses conservent `user_id` et gagnent
  `organization_id`. L'écran de gestion des membres est **hors périmètre** (cf. §7).
- **Docs** : `docs/API.md` (section Organisations), `docs/ARCHITECTURE.md` (§Ownership et
  diagramme de relations), `docs/BACKLOG.md` (PLAT-4 livré).

### 7. Hors périmètre (assumé)

Facturation Stripe portée par l'org (PLAT-6) ; SSO (PLAT-6) ; clés d'API par org (PLAT-5) ;
UI web de gestion des membres — l'API est livrée et testée, l'écran suivra, comme PRO-2 a livré
son backend avant son écran ; transfert de propriété d'une org entre utilisateurs ; suppression
d'une org non personnelle ; quotas de sièges par palier (`multi_user` est booléen aujourd'hui).

### 8. Écarts entre la conception et l'implémentation

Trois points sont apparus à l'écriture et méritent d'être notés, car aucun n'était visible
depuis le schéma seul :

- **L'attribution analytique a dû être threadée séparément.** Le renommage de l'axe de
  propriété a d'abord fait passer `organizationId` là où `AnalyticsService.track` attend un
  utilisateur (`estimate_created`, `shopping_list_generated`, `budget_tracked`) et là où
  `LogbookService` écrit `room_log_entries.user_id`. Un événement de funnel et le carnet du
  logement restent attachés à une **personne** (D5) : `estimate`, `getOrGenerate`, `generate`,
  `regenerate`, `finalizeBudgetSummary`, `recordChantierCompletion` et les trois méthodes de
  `PriceComparisonService` prennent donc désormais `(projectId, organizationId, userId)`. Sans
  cela l'événement aurait porté un identifiant d'organisation dans une colonne référençant
  `users` — corruption silencieuse, pas erreur bruyante.
- **`FeatureGateGuard` ne dépend plus de `UsersService` mais de `OrgContextService`**, qui lui
  fournit à la fois l'utilisateur et le palier effectif. C'est ce qui a permis de garder
  l'empilement de guards inchangé sur les ~14 contrôleurs (D9) : aucun n'a eu à ajouter un
  guard, seul le corps de leur helper privé a changé.
- **Le nom d'organisation part dans un e-mail vers un tiers**, ce qui en fait la première
  chaîne saisie par un utilisateur et rendue à quelqu'un d'autre. Le template d'invitation
  échappe donc son HTML, contrairement aux templates existants qui interpolent directement.

### 9. Vérification

```
pnpm --filter @chiffreo/api lint          # OK (0 erreur)
pnpm --filter @chiffreo/api build         # OK
pnpm --filter @chiffreo/api test          # 49 suites / 623 tests OK
pnpm --filter @chiffreo/api test:e2e      # 12 suites / 119 tests OK
pnpm --filter @chiffreo/web lint          # OK (1 warning préexistant, no-img-element)
pnpm --filter @chiffreo/web build         # OK — aucun fichier web modifié par ce ticket
```

`next build` a planté une première fois (access violation) puis passé au second essai : flake
connue de ce poste, documentée dans `.claude/skills/verify/SKILL.md`, sans rapport avec ce
ticket qui ne touche aucun fichier de `apps/web`.

**Suites neuves** : `org-context.service.spec.ts` (repli sur l'espace personnel, adhésion
révoquée, création paresseuse, course entre deux requêtes concurrentes, palier hérité du
propriétaire, fail-closed si le propriétaire est introuvable),
`organizations.service.spec.ts` (matrice des rôles, propriétaire ni rétrogradable ni
retirable, jeton stocké haché, remplacement d'une invitation en attente, expiration, e-mail
non concordant, rejeu, bascule refusée hors adhésion), `feature-gate.guard.spec.ts` (le
palier évalué est celui de l'organisation, fail-closed).

**Migration** jouée avec le vrai runner (`ts-node` + l'override
`TS_NODE_COMPILER_OPTIONS` documenté) sur un `postgres:16-alpine` jetable, migrations 001→053
d'abord, puis jeu d'essai (artisan avec profil d'entreprise + 3 devis dont une année
antérieure et des numéros non contigus + 1 facture + séquence à 3, particulier sans profil,
compte anonyme, second artisan témoin), puis `up()` → `down()` → `up()`. Contrôles passés :

- 4 organisations pour 4 utilisateurs, chacune `is_personal` avec une adhésion `owner` ; celle
  de l'artisan a bien pris `Peinture Dupont SARL`, les autres `Mon espace` ;
- 0 ligne orpheline sur les 5 tables, et 0 ligne rattachée à une organisation autre que celle
  de son auteur ;
- `quote_sequences` amorcée à 7 pour 2026 et 4 pour 2025 — le `MAX`, pas le nombre de lignes ;
  l'allocation suivante rend `D-2026-008` puis `D-2026-009`, donc aucune collision avec le
  `D-2026-007` déjà émis, et deux membres se partagent bien le même compteur ;
- `invoice_sequences` re-clé sur l'organisation sans perte (`last_number` = 3) ;
- les trois contraintes `*_user_*` remplacées par leurs équivalents `*_org_*` ;
- gate `multi_user` passée à `is_enabled = true` ;
- après `down()` : données intactes (3 projets / 3 devis / 1 facture / 1 client / 1 profil /
  4 utilisateurs), `invoice_sequences.user_id` restauré depuis `owner_user_id`, contraintes
  d'origine rétablies, 0 table et 0 colonne PLAT-4 résiduelles, gate réétente.

Un `pg_dump --schema-only` avant/après le cycle est identique **à une exception près** :
`invoice_sequences.user_id` revient en dernière position ordinale (colonne supprimée puis
recréée par `down()`). Type, nullabilité, clé primaire et clé étrangère sont identiques, et
aucun code ne dépend de l'ordre des colonnes — écart cosmétique, noté pour ne pas le
redécouvrir lors d'une comparaison de schémas.

### 10. Reste à faire (hors périmètre PLAT-4)

- **UI web de gestion des membres** : l'API est livrée et testée, l'écran suivra — même
  séquencement que PRO-2, qui a livré son backend avant son écran. Les réponses existantes
  restent compatibles (elles conservent `user_id` et gagnent `organization_id`), aucun écran
  actuel n'est cassé.
- **PLAT-5** (API publique + clés) : les clés seront portées par l'organisation, plus par
  l'utilisateur. La gate `public_api` reste éteinte.
- **PLAT-6** : facturation Stripe portée par l'organisation (aujourd'hui l'org projette
  simplement le plan de son propriétaire) et SSO.
- **Transfert de propriété d'une organisation** entre utilisateurs, suppression d'une
  organisation non personnelle, quotas de sièges par palier (`multi_user` est booléen).
- Le trou pré-existant de `mergeGuestAccount` (seuls les projets sont transférés, pas les
  clients/devis/factures) n'a pas été comblé : un compte anonyme ne peut pas en créer, les
  fonctionnalités correspondantes étant gatées.

## PLAT-3 — Module éco-matériaux (LIVRÉE) (1 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic PLAT-A, PLAT-3 (effort L, sans dépendance).
Objectif : alternatives durables dans le catalogue (badge + filtre + équivalences), intégrées
au tier Pro plutôt qu'en add-on payant séparé (stratégie §4.4).

### Décision de conception

- **Aucune navigation catalogue côté utilisateur n'existait** : le moteur d'estimation
  sélectionne automatiquement les matériaux, sans choix utilisateur ; la seule surface où un
  utilisateur voit des matériaux résolus est la liste de courses. Badge/filtre/équivalences
  s'intègrent donc là (`ShoppingListMaterials.tsx`), sur le même patron que le prop
  `budgetAllowed`/`onShowPaywall` déjà en place pour `budget_tracking`.
- **Correctif de fond découvert en amont** : `estimations.service.ts::loadMaterialInputs`
  charge TOUS les matériaux actifs d'une catégorie, et le moteur (`estimation-engine.ts`)
  génère une ligne par matériau — la catégorie regroupe des matériaux consommés ensemble (ex.
  peinture + sous-couche), pas des alternatives. Un matériau éco simplement ajouté comme ligne
  active aurait donc été injecté silencieusement dans le chiffrage de tous les utilisateurs,
  Free inclus. Corrigé en excluant `is_eco: true` de cette requête — fix nécessaire, pas
  optionnel, posé avant le reste.
- **Équivalences informationnelles, pas de switch automatique** : pas de bouton « basculer
  vers l'alternative éco » qui recalculerait les quantités de la liste de courses —
  `adjusted_qty` y est déjà post-rendement/perte du matériau d'origine, et la mutualisation
  (`aggregated_json`) rend une réécriture risquée pour un ticket L. Le module affiche : un
  badge « Éco » sur les matériaux déjà éco, et une suggestion textuelle (nom + justification)
  quand un équivalent éco est lié au matériau standard utilisé.
- **Table de jointure dédiée `material_eco_equivalences`** (`standard_material_id` →
  `eco_material_id`, tous deux FK vers `materials_catalog` en CASCADE), plutôt qu'un champ sur
  `materials_catalog` : un matériau standard peut avoir plusieurs alternatives éco. Contrainte
  `CHECK` anti-auto-lien + `UNIQUE` anti-doublon, doublées par les mêmes validations côté
  service (catégorie identique, cible bien `is_eco`, source pas déjà elle-même éco).
- **Endpoint dédié `GET /projects/:id/shopping-list/eco-suggestions`** (gate
  `@RequireFeature('eco_materials')`, même patron que `budget-summary`) plutôt
  qu'enrichissement du jsonb `items_json` : `shopping-list-shared.controller.ts`
  (`GET /shared/shopping-list/:token`) est entièrement public et sans notion de palier —
  toute donnée éco persistée dans `items_json` aurait fuité vers un destinataire de lien
  partagé Free, à l'encontre de la stratégie §4.4 (différenciateur Pro, pas gratuit pour tous).
- **Gate `eco_materials` au palier `pro`**, seedée activée (même patron que `invoicing`) :
  le module ship dans la même livraison que sa gate.
- **Admin** : `is_eco`/`eco_label_fr` sur le formulaire matériau (justification obligatoire si
  `is_eco`), section de liaison/déliaison d'équivalents sur la page d'édition, filtre `is_eco`
  sur la liste catalogue — couvre aussi le libellé littéral « dans le catalogue » du ticket,
  en plus de la surface Pro (liste de courses).

### Vérification

```
pnpm --filter @chiffreo/api lint       # OK
pnpm --filter @chiffreo/api build      # OK
pnpm --filter @chiffreo/api test       # 596 tests / 46 suites (baseline 581/46), aucune régression
pnpm --filter @chiffreo/api test:e2e   # 119 tests / 12 suites (nouveau : materials.e2e-spec.ts), aucune régression
pnpm --filter @chiffreo/web lint       # OK (1 warning <img> préexistant)
pnpm --filter @chiffreo/web build      # OK
pnpm --filter @chiffreo/web test       # 278 tests / 41 suites (baseline 270/40), aucune régression
```

Migrations `1711468800051`/`052`/`053` testées up→down→up sur une base clonée jetable
(`chiffreo_mig_test`, technique documentée en mémoire), y compris les contraintes `CHECK`
(anti-auto-lien) et `UNIQUE` (anti-doublon) vérifiées en conditions réelles (transaction de
test + `ROLLBACK`), puis exécutées pour de vrai sur la base de dev via la commande
`TS_NODE_COMPILER_OPTIONS` documentée — au passage, la migration `1711468800050` (PLAT-2,
seedée mais jamais rejouée ici) est passée avec, la base dev est donc désormais à jour jusqu'à
PLAT-3 incluse.

### Limites connues (assumées, documentées)

- Pas de swap automatique vers l'équivalent éco depuis la liste de courses (recalcul de
  quantités hors scope, cf. décision de conception ci-dessus) : l'utilisateur voit la
  suggestion mais achète manuellement l'alternative.
- Le filtre éco sur la liste de courses est un état client local (comme `CategoryTabs`), pas
  une URL — cohérent avec le reste de la page liste de courses, qui n'a pas de vocation SEO.
- La curation des équivalences (quel matériau éco remplace quel matériau standard) reste
  entièrement manuelle côté admin — pas de suggestion automatique par proximité de nom/rendement.

## PLAT-2 — E-mails de cycle de vie (LIVRÉE) (1 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic PLAT-A, PLAT-2 (effort M, dépend de GTM-5,
DATA-1, tous deux déjà livrés). Objectif : retenir les utilisateurs entre deux visites —
onboarding J+1/J+3, projet abandonné à mi-parcours, fin d'essai Pro. Aucune feature gate
(contrairement à PRO-2/PRO-3/PRO-4) : ces e-mails s'adressent à tous les `subscription_tier`.

### Décision de conception

- **Réutilisation intégrale de GTM-5/DATA-1** : aucun travail d'infra. `EmailService`
  (`apps/api/src/email/`) reçoit 4 nouvelles méthodes suivant le patron existant
  (`build*Email(data)` → `BrevoClientService.sendTransactionalEmail`) ; `AnalyticsEventName`
  reçoit 4 nouvelles valeurs sans migration (`event_name` est `varchar(50)`, pas un enum SQL).
- **Table d'idempotence dédiée `lifecycle_email_sends`**, pas de colonnes sur `users`/`projects`
  (à la différence des `reminder_7d_sent_at`/`reminder_14d_sent_at` de PRO-3) : 4 types
  d'e-mails sur 2 entités différentes ne passent pas à l'échelle en colonnes dédiées. Deux
  index uniques partiels (`WHERE project_id IS NULL` / `WHERE project_id IS NOT NULL`), même
  pattern que `UQ_invoices_quote_solde` (PRO-4) — un `UNIQUE` composite unique aurait laissé
  passer des doublons puisque deux `NULL` ne sont jamais égaux en SQL. Migration
  `1711468800050-CreateLifecycleEmailSends.ts`. Politique de stamp identique à PRO-3 : la
  ligne est insérée après tentative d'envoi, y compris en cas d'échec Brevo.
- **Sweep quotidien unique** (`LifecycleEmailsService`, `@Cron(EVERY_DAY_AT_8AM)`), même
  patron que `QuoteRemindersService` — pas de BullMQ, décision déjà actée dans le repo pour ce
  type de besoin. Module à dépendances étroites (`TypeOrmModule.forFeature([User, Project,
  Subscription, LifecycleEmailSend])`, pas d'import de `UsersModule`/`ProjectsModule`/
  `SubscriptionsModule` en entier), sans controller.
- **Fenêtres bornées haut ET bas** pour les 3 sweeps rétrospectifs (onboarding J+1
  `[j-2, j-1]`, onboarding J+3 `[j-4, j-3]`, projet abandonné `[j-12, j-5]` sur
  `project.created_at`), contrairement à PRO-3 qui n'a qu'un seuil bas : sans borne haute, le
  premier déploiement aurait envoyé ces e-mails à tous les comptes/projets existants d'un coup.
- **Projet abandonné défini par 4 critères cumulatifs** : `status IN (draft, active)` (proxy
  déjà fiable de « jamais estimé », `estimations.service.ts` pose `ESTIMATED` dès qu'une
  estimation existe), au moins une `Room.dimensions` non nulle (engagement réel, exclut les
  projets vides), `deleted_at IS NULL`, fenêtre sur `created_at` — **pas** `updated_at`, qui
  reste figé à la création car `updateDimensions` sauvegarde `RoomDimensions` séparément sans
  jamais toucher `project.updated_at`.
- **Fin d'essai Pro : un seul e-mail, avant la fin** (`trial_ending_soon`, `trial_end` dans les
  3 prochains jours). Pas d'e-mail après la fin : une conversion réussie relève de Stripe
  (reçu), un échec de conversion chevauche `PAYMENT_FAILED`/`SUBSCRIPTION_CANCELED` déjà
  déclenchés en temps réel par les webhooks — un futur winback post-churn serait mieux branché
  directement dessus plutôt que sur un sweep quotidien à ce même endroit.

### Vérification

```
pnpm --filter @chiffreo/api lint    # OK
pnpm --filter @chiffreo/api build   # OK
pnpm --filter @chiffreo/api test    # 581 tests / 46 suites (baseline 558/44), aucune régression
```

Migration vérifiée par relecture attentive (symétrie `up`/`down`, même pattern que
`1711468800044-CreateInvoices.ts`) plutôt qu'exécutée : le runner `ts-node` reste cassé sur ce
poste avec les options par défaut (cf. mémoire projet). Pas de `test:e2e` : module sans
controller ni endpoint HTTP, comme `quote-reminders`/`referrals`.

### Limites connues (assumées, documentées)

- Le signal « projet abandonné » repose sur `created_at`, pas une vraie dernière activité :
  un utilisateur qui modifie activement ses dimensions pendant 3 semaines reçoit quand même
  l'e-mail (faux positif accepté, comparable à un e-mail de panier abandonné). Un vrai
  `last_activity_at` (colonne + subscriber TypeORM) est hors scope d'un ticket M.
- Pas d'e-mail de bienvenue post-conversion ou de winback après un essai Pro raté : hors
  périmètre, cf. décision de conception ci-dessus.
- Pas de mécanisme de désabonnement dédié à ces e-mails (cohérent avec l'absence d'un tel
  mécanisme sur les relances devis PRO-3).

## COM-3 — Parrainage (LIVRÉE) (1 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic COM-A, COM-3 (effort M, dépend de OPS-2).
Objectif : « 1 mois Pro offert par filleul abonné », canal d'acquisition gratuit sur la base
Stripe existante (codes/attribution + crédit).

### Statut de la dépendance OPS-2

Comme documenté plus bas dans ce même fichier, OPS-2 a déjà revu tout le code Stripe
(checkout, webhook, sync de tier) comme entièrement câblé depuis la Phase 1 ; seules les
étapes opérationnelles (produits Stripe Live, `.env` du VPS) restent bloquées sur un accès
Dashboard/VPS hors CLI. COM-3 livre donc l'intégralité du code sur cette infrastructure
(fonctionnelle en mode Test dès aujourd'hui), même statut « prêt, activation finale hors
CLI » que OPS-1/OPS-2/OPS-3.

### Décision de conception

- **Le crédit passe par le solde client Stripe**
  (`stripe.customers.createBalanceTransaction`, montant = prix du plan Pro), pas par une
  extension locale de `subscription_tier`/`subscriptions` : `subscription_tier` reste piloté
  uniquement par les webhooks Stripe existants, sans double comptabilité à maintenir. Stripe
  applique automatiquement le crédit négatif à la prochaine facture du parrain.
- **Ledger local `referral_credits`** (statut `pending`/`applied`) pour couvrir le cas d'un
  parrain resté en Free (`subscriptions.stripe_customer_id` n'existe qu'à partir du premier
  checkout) : le crédit reste `pending` et est appliqué automatiquement au premier customer
  Stripe que ce parrain crée jamais (hook dans `SubscriptionsService.createCheckoutSession`,
  branche nouveau customer). C'est le cas principal du canal d'acquisition visé.
- **Déclencheur = `invoice.paid`, pas `checkout.session.completed`** : le plan Pro a un essai
  de 7 jours géré côté API (`subscription_data.trial_period_days`) — créditer au checkout
  récompenserait un essai gratuit, pas un abonnement payant réel. `users.referral_converted_at`
  (posée une seule fois) empêche tout re-crédit sur les factures suivantes du même filleul.
- **Idempotence financière** : clé d'idempotence Stripe `referral-credit-${credit.id}` sur
  `createBalanceTransaction` + insertion du ledger via `.orIgnore()` (même patron que
  `claimWebhookEvent`/`stripe_events`) — aucun double crédit possible, y compris au retry
  webhook (`releaseWebhookEvent` + retry Stripe en cas d'échec, volontairement non catché
  dans `handleInvoicePaid`).
- **Pas de feature gate** : le parrainage doit rester utilisable par un utilisateur Free
  (c'est le canal d'acquisition visé), donc aucun verrou de palier.
- **Fenêtre de rédemption de 7 jours + refus d'auto-parrainage** : garde-fou simple contre le
  rattachement tardif d'un compte déjà ancien, pas de KYC — limite assumée pour une
  « mécanique simple ».
- **`ReferralsModule` à dépendances étroites** (même patron que `QuoteRemindersModule`) :
  injecte directement les repos `User`/`Subscription` plutôt que d'importer
  `SubscriptionsModule`, pour que `SubscriptionsModule` puisse importer `ReferralsModule` sans
  dépendance circulaire.

### Vérification

```
pnpm --filter @chiffreo/api lint      # OK
pnpm --filter @chiffreo/api build     # OK
pnpm --filter @chiffreo/api test      # 558 tests / 44 suites (baseline 537), aucune régression
pnpm --filter @chiffreo/api test:e2e  # 109 tests / 11 suites, aucune régression
pnpm --filter @chiffreo/web lint      # OK (1 warning <img> préexistant)
pnpm --filter @chiffreo/web build     # OK — /referrals rendu statique (○)
pnpm --filter @chiffreo/web test      # 270 tests / 40 suites (baseline 262), aucune régression
```

Migration `1711468800047` rejouée up→down→up sur une base clonée jetable
(`chiffreo_mig_test`, technique documentée en mémoire — le runner `ts-node` reste cassé sur ce
poste avec les options par défaut), puis exécutée pour de vrai sur la base de dev via la
commande `TS_NODE_COMPILER_OPTIONS` documentée. Schéma et contraintes (unicité du code,
FK `ON DELETE SET NULL`/`CASCADE`, index) vérifiés en `\d` après coup.

### Limites connues (assumées, documentées)

- Fraude au parrainage non traitée au-delà de la fenêtre de 7 jours et du refus
  d'auto-parrainage (pas de KYC).
- Un crédit `pending` d'un parrain qui ne s'abonne jamais reste `pending` indéfiniment (pas de
  job de nettoyage/relance — cohérent avec l'absence de file de jobs lourde dans le repo, cf.
  décision PRO-3 sur `@nestjs/schedule` vs BullMQ).
- Activation en Stripe Live (produits réels + webhook) reste bloquée sur OPS-2 côté
  utilisateur (accès Dashboard Stripe + VPS hors CLI).
- Pas de tests e2e HTTP dédiés (le module est neuf mais couvert par tests unitaires denses sur
  la logique à risque — idempotence, concurrence, crédit financier) ; les e2e existants
  (auth, subscriptions) continuent de passer sans régression avec le nouveau câblage de
  modules.

## COM-2 — Galerie communauté publique et indexable (LIVRÉE) (1 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic COM-A, COM-2 (effort M, dépend de COM-1).
Objectif : rendre la galerie approuvée accessible sans compte + indexable pour des
requêtes à forte intention (« coût réel carrelage salle de bain 8 m² »). L'UGC est le
flywheel d'acquisition le moins cher (stratégie produit).

### Constat (avant)

L'accès sans compte existait déjà au niveau réseau : `proxy.ts` n'inclut pas `/community`
dans son matcher, et `GET /community`/`GET /community/:id` utilisent `OptionalAuthGuard`
(jamais bloquant). Le vrai trou était le rendu : les deux pages étaient `'use client'`
et fetchaient en `useEffect` — un crawler recevait une coquille vide et les balises
`<title>`/`<meta description>` génériques du layout racine. La galerie n'apparaissait pas
dans `sitemap.ts`, et aucune page projet n'avait de métadonnées ni de données structurées.

### Décision de conception

- **URLs en UUID conservées**, pas de slug SEO-friendly. Aucun champ `slug` n'existe dans
  le schéma (`CommunityProject` n'a qu'un `id` UUID), aucune convention de slug sur entité
  n'existe ailleurs dans le repo. Une migration + backfill serait hors du calibrage « M »
  du ticket (« Metadata + sitemap », pas une refonte d'URL) — le titre/description/JSON-LD
  portent le poids SEO à la place.
- **Déplacement `(app)/community` → `community`** (hors groupe de routes, `git mv`) :
  aligne la page sur `/pricing`, `/calculateurs` (déjà publiques, hors `(app)`). Pur
  renommage sans effet sur les URLs (les groupes de routes Next n'y apparaissent jamais).
- **Pages liste et détail converties en Server Components** avec `generateMetadata` (suit
  le patron de `calculateurs/[type]/page.tsx`). Le filtre par travaux et la pagination de
  la liste passent d'un état client à de vrais `<Link>` (`CommunityWorkTypeFilter` perd
  `onChange`), pour que chaque vue filtrée soit une URL crawlable.
- **Personnalisation isolée dans `CommunityDetailActions`** (client) : `has_liked`/
  `is_owner` ne peuvent pas être résolus côté SSR (le cookie `chiffreo_auth` n'est qu'un
  marqueur, pas le jeton Firebase — le fetch serveur est toujours anonyme). Ce composant
  refait son propre appel client au montage, comme `CommunityComments` le fait déjà pour
  les commentaires ; `CommunityLikeButton` n'est monté qu'une fois cet état résolu (son
  `useState(initialLiked)` ne se resynchronise pas si les props changent après coup).
- **JSON-LD `Article`** (pas `HowTo`) : ces données n'ont pas de séquence d'étapes, et
  Google a restreint l'éligibilité rich-results de `HowTo` en 2023 — `Article` est le type
  sémantiquement correct pour une page « voici le coût réel de mon chantier ».
- `sitemap.ts` passe en `async`, pagine `/community?limit=50` (max API) jusqu'à
  épuisement (plafond de sécurité 20 pages), dégrade vers les entrées statiques si l'API
  échoue, `revalidate = 3600`.

### Bug trouvé en vérifiant le rendu

Le `<title>` affichait « ... | Chiffréo | Chiffréo » en double : le layout racine ajoute
déjà le suffixe via son title template (`%s | Chiffréo`), et `community-seo.ts` l'incluait
aussi dans le titre construit. Corrigé en suivant le patron déjà établi par
`calculateurs/[type]/page.tsx` : `title` sans suffixe (le template l'ajoute), `openGraph.title`
avec le suffixe explicite (non soumis au template).

### Vérification

- Tests : `pnpm --filter @chiffreo/api test` (537) + `test:e2e` (109, dont le nouveau
  `community.e2e-spec.ts` qui prouve au niveau HTTP — pas juste en lisant le code des
  guards — que `GET /community`/`GET /community/:id` répondent sans en-tête
  `Authorization`) ; `pnpm --filter @chiffreo/web test` (262, dont `community-seo.spec.ts`,
  `CommunityWorkTypeFilter.spec.tsx`, `CommunityDetailActions.spec.tsx`).
- Lint + build (`tsc --noEmit && next build`) : les deux workspaces passent sans erreur ;
  `/community` et `/community/[id]` apparaissent bien en `ƒ` (server-rendered) dans la
  sortie de build, `/sitemap.xml` en ISR (`revalidate 1h`).
- Rendu statique réel : base de dev remise à niveau (migrations en retard, cf.
  [migration-runner-tsnode-broken] et [dev-db-schema-drift] en mémoire — désormais résolu
  jusqu'à la migration COM-1 incluse), projet approuvé semé directement en SQL, API et web
  lancés en local. `curl` sans exécution JS confirme : le `<h1>` et le titre du projet
  apparaissent dans le HTML brut de `/community` et `/community/<id>` ; `<title>` et
  `<meta description>` sont corrects et uniques (bug de duplication corrigé) ; le JSON-LD
  `Article` est présent ; `/community/<id-inconnu>` renvoie 404 (`notFound()`) ;
  `/sitemap.xml` liste `/community` et `/community/<id>`. Données de test nettoyées après
  vérification.

### Reste à faire (hors périmètre COM-2)

- Slugs SEO-friendly sur les URLs projet (nécessite migration + backfill).
- Ciblage géographique (aucun champ ville/localisation sur `CommunityProject`).

## PRO-5 — Parcours « devis-minute » mobile (LIVRÉE) (1 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic PRO-A, PRO-5 (effort M, dépend de CV-4).
Objectif : enchaînement photo → estimation → devis PDF en < 10 min sur mobile chez le
client. Pitch commercial n°1 du tier Contractor (stratégie §7.2 : « photo chez le client
→ devis PDF envoyé avant de partir »).

### Diagnostic (exploration du parcours + audit 390 px)

Le tunnel compte **7 écrans / ~15 taps**, mais ce n'est pas le nombre d'étapes qui coûte
les minutes — c'est l'ergonomie mobile de chacune :

1. **Zoom iOS sur chaque champ.** Tous les inputs sont en `text-sm` (14 px) ; iOS Safari
   zoome automatiquement sous 16 px. Chaque saisie force un dézoom manuel.
2. **Virgule décimale refusée.** `type="number"` sans `inputMode` partout (0 occurrence
   de `inputMode` dans le repo). Un artisan qui tape « 3,5 » sur un pavé français saisit
   une valeur vide ou tronquée — **erreur de mesure silencieuse**, pas un simple inconfort.
3. **CTA en bas de pages très longues.** « Enregistrer les dimensions » est à ~1400 px de
   scroll avec 2 portes + 1 fenêtre ; « Voir la liste de courses » après 15 matériaux.
4. **Boucle marge ↔ total sur le devis.** Le récapitulatif TTC est ~600 px sous le champ
   de marge : ajuster la marge oblige à scroller pour voir l'effet, puis à remonter.
5. **Aucun repère de progression** : pas de `(app)/layout.tsx`, pas de nav, chaque page
   réimplémente son lien retour en cible ~20 px.
6. **`env(safe-area-inset-*)` inopérant** : aucun `export const viewport`, donc pas de
   `viewportFit: 'cover'` — tout collage en bas d'écran serait masqué par la barre home.
7. **Cibles tactiles sous 44 px** dans les primitives elles-mêmes (`Button` md = 40 px,
   `Input` = 42 px) et pire dans `OpeningsSection` (~51 px utiles par champ à 390 px).
8. **`capture="environment"`** force l'appareil photo et supprime l'accès à la galerie.
9. **Le PDF se télécharge, il ne s'envoie pas** — un blob dans « Téléchargements » n'est
   pas « le devis envoyé avant de partir ».

### Réalisé

- [x] **A. Fondations mobiles**
  - [x] `export const viewport` (`viewportFit: 'cover'`, `themeColor` aligné sur `manifest.ts`)
  - [x] `Button` : `min-h-11` (44 px) ; `Input`/`Textarea`/`Select` : `text-base sm:text-sm`
  - [x] `DecimalInput` : `type="text" inputMode="decimal"`, virgule française normalisée
  - [x] `StickyActionBar` : barre d'action collante + `env(safe-area-inset-bottom)`
- [x] **B. Fil conducteur du tunnel**
  - [x] `lib/quote-flow.ts` : 6 étapes (Photos → Mesures → Travaux → Estimation → Prix → Devis)
  - [x] `FlowProgress` monté sur les 6 pages du tunnel (toujours, pas derrière un flag)
  - [x] CTA de chaque étape passés en `StickyActionBar`
  - [x] Total TTC en direct dans la barre collante du devis
- [x] **C. Entrée « Devis-minute »** : 1 tap depuis le dashboard Contractor → caméra
- [x] **D. Envoi mobile du PDF** : Web Share API avec fichier, repli téléchargement
- [x] **E. Correctifs du tunnel** (tous les points, + ceux révélés par le rendu réel)
- [x] **F. Vérification** : lint + build + tests (api & web) + rendu réel 390 px (Playwright)

### Décision de conception

- **Le tunnel est toujours un tunnel — pas de mode `?devis=1`.** Première intention :
  un « mode devis-minute » activé par un paramètre d'URL propagé de page en page.
  Écarté : ç'aurait fait vivre deux rendus par écran (avec et sans fil conducteur),
  donc deux chemins à tester et à maintenir, pour une question — « où j'en suis, que
  reste-t-il ? » — dont la réponse ne dépend pas du palier d'abonnement. `FlowProgress`
  est monté inconditionnellement sur les six pages ; le DIY y gagne autant que
  l'artisan. « Devis-minute » désigne donc l'entrée depuis le dashboard Contractor et
  le fait que le tunnel soit devenu praticable au doigt, pas un parcours parallèle.
- **`StickyActionBar` est un conteneur présentationnel, pas une barre pilotée par les
  pages.** Chaque formulaire enveloppe *son* bouton existant : aucun handler ne remonte,
  aucun prop-drilling d'action, et `DimensionsForm`/`WorkSelectionForm` gardent leur
  `type="submit"` natif. `sticky` plutôt que `fixed` : la barre reste dans le flux,
  donc pas de `padding-bottom` compensatoire à maintenir sur chaque page et un
  comportement correct quand le clavier virtuel réduit le viewport. Elle redevient un
  bloc statique sous `sm:` — le CTA en fin de formulaire reste la convention desktop.
- **`viewportFit: 'cover'` est un prérequis, pas un détail.** Aucun `export const
  viewport` n'existait dans le repo : `env(safe-area-inset-*)` valait donc 0 et toute
  barre collée en bas serait passée sous la barre home des iPhone à encoche. Posé
  d'abord, tout le reste en dépend. `themeColor` est réaligné sur `manifest.ts`, qui
  déclarait déjà `#1d6b57` de son côté.
- **`min-h-11` porté par `BASE` de `Button`, pas par les tailles.** Même `sm` (utilisé
  pour la pagination) devient conforme, et une future taille ne peut pas repasser sous
  le seuil par omission.
- **`text-base sm:text-sm` sur tous les champs du parcours.** Sous 16 px, iOS Safari
  zoome à la prise de focus ; il fallait dézoomer à la main après *chaque* champ, soit
  trois fois rien que pour L/l/H. Aucun `maximum-scale=1` en contrepartie : ça
  supprimerait aussi le zoom volontaire, ce qui est un recul d'accessibilité.

### Bug corrigé au passage : la virgule décimale mangeait les mesures

Les champs métriques étaient en `type="number"`. Sur un clavier mobile français, la
touche du séparateur décimal est une **virgule**, que `type="number"` refuse : le
navigateur renvoie alors une chaîne vide. « 2,5 m » de hauteur partait donc à **0 cm**
vers l'API — sans message, sans champ en erreur, avec une estimation et un devis
cohérents mais faux. Le même piège existait sur les sept champs du devis (marge, TVA,
taux horaire…) et sur la saisie des prix.

Corrigé à la racine par `DecimalInput` (`type="text" inputMode="decimal"`), qui ouvre
le pavé décimal **et** normalise la virgule en point avant `parseFloat` — inchangé en
aval. La normalisation est une fonction pure (`lib/decimal-input.ts`) testée à part :
elle refuse la frappe plutôt que de la stocker, donc « 3,5,2 » ne devient jamais
« 3.52 ». Filet de non-régression posé sur `DimensionsForm` (« 5,2 m × 4 m × 2,5 m »
→ `520, 400, 250`).

### Autres correctifs de fond

- **Paywall fantôme sur l'étape « Devis ».** `isFeatureAllowed` est fail-closed
  *pendant* le chargement des gates : tout arrivant sur `/quote/new` déclenchait
  `showPaywall`, y compris un Contractor qui y a droit — la modale s'ouvrait puis se
  refermait, avec le formulaire complet rendu derrière elle entre-temps. Le garde
  `isLoading` (déjà exposé par `FeatureGateContext`, jamais consommé) règle les deux :
  plus de flash, et plus de formulaire rendu sous la modale pour qui n'y a pas droit.
  Constaté dans le navigateur, pas dans les tests — les specs ne mockaient nulle part
  `FeatureGateContext`.
- **Deux systèmes d'autorisation divergents.** Le bouton « Générer un devis » était
  conditionné à `subscription_tier.startsWith('contractor')` alors que la route serveur
  est gardée par `export_devis` : il restait invisible à des utilisateurs que l'API
  aurait acceptés. Aligné sur la même gate que le serveur.
- **`capture="environment"`** forçait l'appareil photo et supprimait l'accès à la
  photothèque : un artisan ayant déjà photographié la pièce devait tout refaire sur
  place. Deux entrées distinctes désormais, la capture restant l'action mise en avant.
- **`overflow-x-auto` neutralisé par `w-full`** sur la table du devis : elle se
  comprimait dans 358 px au lieu de déborder, chaque ligne partant sur trois ou quatre
  retours. `min-w-[32rem]` rend le scroll horizontal effectif.
- **`OpeningsSection`/`ExclusionsSection`** : `flex` non wrappé de cinq éléments, il
  restait ~51 px de saisie utile par champ à 390 px. Passés en grille dont seul le
  gabarit change au breakpoint — **pas** deux variantes masquées l'une ou l'autre, qui
  auraient mis deux boutons « Supprimer » dans le DOM (les tests existants ont
  d'ailleurs attrapé cette erreur au premier essai).
- **Ligne matériau de l'étape « Prix »** : le suffixe « x Rouleau 150 m » du bloc de
  contrôles ne se tronquait pas et poussait la désignation à **un mot par ligne**.
  Contrôles empilés sous le libellé sur mobile.
- **Cibles tactiles sous 44 px** relevées puis corrigées dans `RoomSwitcher`
  (« Renommer »/« Supprimer » à 22 px, séparés de 4 px — supprimer une pièce au lieu de
  la renommer, au doigt, était quasi certain, et fait perdre toutes ses mesures),
  `SkillLevelSelector`, `PhotoCaptureGuidance`, `ShapeSections`, `BudgetDashboard`,
  la bascule horaire/forfait du devis et le déclencheur de saisie de prix.

### Vérification

```
pnpm --filter @chiffreo/web lint     # OK (1 warning <img> préexistant)
pnpm --filter @chiffreo/web build    # OK
pnpm --filter @chiffreo/web test     # 239 tests / 34 suites (baseline 208 / 28)
pnpm --filter @chiffreo/api lint | build | test | test:e2e   # OK — 523 + 104, intacts
```

Nouvelles suites : `decimal-input`, `quote-flow`, `api-share`, `DecimalInput`,
`FlowProgress`, `ContractorDashboard`. Cas ajoutés à `DimensionsForm` (virgule) et
`PhotoUploadPanel` (accès galerie). **Aucun changement côté API** — l'ensemble tient
côté web, sans migration.

**Rendu mobile réellement mesuré**, pas seulement en jsdom : Chromium piloté par
Playwright en profil iPhone 14 (390 × 844), sur les 8 écrans du parcours. Ni Firebase
ni Postgres ne tournant sur ce poste, l'état d'auth a été amorcé dans IndexedDB
(`firebaseLocalStorageDb`, où le SDK v9+ persiste — pas dans localStorage) avec les
endpoints `securetoken`/`identitytoolkit` et l'API Chiffréo stubbés, script confiné au
scratchpad. Résultat final sur les 8 écrans : **aucun débordement horizontal, aucune
cible tactile sous 44 px, aucun champ sous 16 px**. Cinq défauts de cette liste
n'étaient visibles que là (paywall fantôme, ligne matériau cassée, `Finaliser le
budget` à 40 px, cibles de `RoomSwitcher`, `Compris, commencer` à 32 px).

### Limites connues (assumées, documentées)

- **Le mur des prix subsiste.** Le catalogue n'a aucun prix : sans au moins une saisie
  manuelle sur l'étape « Prix », `POST /quotes` produit un devis vide et le formulaire
  refuse la soumission. PRO-5 rend cette étape rapide (pavé décimal, virgule acceptée,
  cibles au doigt) et surtout **explicite** — le compteur « N matériaux chiffrés sur
  M » annonce le prérequis, que rien ne signalait jusqu'ici. Il ne la supprime pas.
  Suite naturelle, hors périmètre d'un ticket UX : mémoriser les prix par matériau et
  par artisan (`user_material_prices`) pour préremplir les listes suivantes — le 2ᵉ
  devis deviendrait alors sans saisie du tout. Nécessite une migration, donc un ticket
  à part.
- **Aucun défaut de chiffrage sur le profil entreprise.** Le formulaire de devis reste
  prérempli en dur (45 €/h, marge 20 %, TVA 20 %) : l'artisan corrige deux nombres à
  chaque devis. ~20 secondes, pas des minutes — écarté sciemment plutôt que d'ajouter
  une migration `company_profiles` à un ticket frontend.
- **L'envoi natif du PDF n'a pas pu être testé sur un vrai téléphone** (pas d'appareil
  ici) : seuls les quatre chemins de `apiShareOrDownload` sont couverts en test
  (partage, absence de `canShare`, `AbortError`, autre échec). Chromium desktop retombe
  sur le téléchargement, comportement attendu et vérifié.
- **Pas de `(app)/layout.tsx` ni de navigation applicative persistante.** L'audit la
  recommandait ; c'est un chantier de navigation globale (accès à `/quotes`,
  `/invoices`, `/settings` depuis n'importe où) plus large que le tunnel, et le fil
  conducteur suffit à répondre au besoin de PRO-5. Restent aussi hors périmètre : le
  bloc `@theme` de Tailwind v4 (absent, d'où ~200 `bg-[var(--accent)]` en valeurs
  arbitraires), un composant `Card` (chaîne de classes dupliquée 30+ fois), la variante
  bottom-sheet de `Modal`, et `PaywallModal`/`ContractorPricingModal` qui
  réimplémentent l'overlay sans focus trap ni `Escape`.
- Deux mesures « sous 44 px » subsistent au rapport et sont des faux positifs assumés :
  le lien « Politique de confidentialité » **dans une phrase** du bandeau cookies, et
  les `input[type=radio]` natifs de la sélection de niveau, dont la cible réelle est le
  `<label>` de 56 px qui les enveloppe.


## PRO-4 — Devis → facture (LIVRÉE) (1 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic PRO-A, PRO-4 (effort L, sans dépendance).
Objectif : transformer un devis accepté en facture immuable, numérotée sans rupture et
portant les mentions légales françaises, derrière une gate `invoicing` (Contractor
Essentiel). Évaluation de conformité e-invoicing 2026-2027 exigée avant construction.

### Évaluation e-invoicing (préalable)

Conclusion complète dans [docs/CONFORMITE_FACTURATION.md](../docs/CONFORMITE_FACTURATION.md).
En bref : au 1er septembre 2026 seule la **réception** est obligatoire pour tous
(l'émission ne l'est que pour les GE/ETI) ; la cible TPE/artisan de Chiffréo bascule au
**1er septembre 2027**. L'émission passe alors exclusivement par une **Plateforme Agréée
DGFiP**, que Chiffréo n'est pas et ne peut pas devenir dans le cadre d'un lot. D'où le
périmètre retenu : **facture PDF conforme au droit en vigueur + modèle de données déjà
aligné EN 16931**, pour qu'un sérialiseur Factur-X et un connecteur PA soient en 2027 un
travail purement additif (sérialisation + transport) et non une refonte de schéma.
Écartés et documentés comme tels : Factur-X/PDF-A3, connecteur PA, e-reporting B2C.

### Décision de conception

- **Table `invoices` dédiée, pas de discriminant sur `quotes`.** Une facture doit se
  réimprimer à l'identique dix ans plus tard : identités vendeur/acheteur, lignes et
  ventilation de TVA sont figées en jsonb à l'émission. Corollaire assumé :
  `quote_id`/`project_id`/`client_id` sont **nullables en `ON DELETE SET NULL`**, y
  compris le devis. Un `RESTRICT` sur `quote_id` aurait fait échouer la suppression
  d'un projet (`quotes.project_id` est CASCADE depuis `projects`) — un bug hors du
  périmètre de la feature. `source_quote_number` conserve la mention « Réf. devis ».
- **Numérotation par table compteur `invoice_sequences (user_id, year, last_number)`**,
  allouée dans **la même transaction** que l'INSERT via
  `INSERT ... ON CONFLICT DO UPDATE SET last_number = last_number + 1 RETURNING`.
  L'upsert prend un verrou de ligne : les allocations concurrentes se sérialisent, et
  un rollback restitue le numéro au lieu de laisser un trou (art. 242 nonies A du CGI).
  Le `SELECT MAX ... LIKE` sans verrou de `QuotesService.generateNextQuoteNumber` n'était
  pas transposable. Piège encodé dans le service : l'allocation passe par
  `manager.query`, jamais `dataSource.query` — ce dernier emprunterait une autre
  connexion du pool et tournerait *hors* transaction, ce qui rouvre exactement le trou
  qu'on ferme. Année et `issued_on` viennent d'une source unique en `Europe/Paris`
  (un serveur UTC le 31/12 à 23 h 30 aurait émis un `F-2026-xxxx` après un `F-2027-0001`).
- **Unicité « une facture de solde par devis » par index partiel**
  (`WHERE invoice_type = 'solde' AND quote_id IS NOT NULL`) plutôt que par un `findOne`
  applicatif, qui serait racy. `quote_id` reste non-unique : la facture d'acompte
  (`invoice_type = 'acompte'`) reste un ajout additif, sans migration structurante.
- **Remise matérialisée en ligne négative, en montant.** `quotes.discount_percent`
  s'applique au total et non aux lignes : recopier les lignes du devis aurait donné
  `Σ lignes ≠ total_ht` sur un document légal. On ajoute une ligne
  `round(total_ht − (matériaux + main-d'œuvre), 2)`, donc l'égalité est vraie par
  construction. La main-d'œuvre devient elle aussi une vraie ligne (elle vit dans
  `labor_*` sur un devis) — d'où un `InvoiceLineItem` **distinct** de `QuoteLineItem`,
  et non un type réutilisé.
- **TVA : taux unique hérité du devis, mais `vat_breakdown` en sortie.** Passer le devis
  en TVA par ligne aurait changé la sémantique de devis **déjà acceptés** et imposé une
  migration de données — disqualifiant. Le PDF rend la ventilation sous forme de tableau
  même à une seule ligne, donc le multi-taux (20/10/5,5 % en rénovation) sera une pure
  évolution de données, sans travail sur le PDF. La facture recalcule
  `TVA = arrondi(HT × taux)` puis `TTC = HT + TVA` : écart possible d'1 centime avec
  `quote.total_ttc`, la facture faisant foi.
- **Franchise en base traitée explicitement** : `vat_exempt` force le taux à 0 et porte
  « TVA non applicable, art. 293 B du CGI » dans `vat_breakdown.exemption_reason`. Une
  très grande partie des artisans cibles sont micro-entrepreneurs ; l'oublier aurait
  produit des factures illégales pour eux.
- **Contrôle des mentions à l'émission, pas à l'enregistrement du profil**, avec un 400
  structuré `MISSING_LEGAL_MENTIONS` + `missing_fields[]` (même patron que le 403
  `FEATURE_GATED`, que `ApiError` côté web sait déjà déplier). Bloquant : SIRET, adresse,
  TVA intracom **ou** franchise, RCS **ou** répertoire des métiers, décennale
  (assureur + couverture, art. L243-2 du code des assurances). **Non bloquant** : forme
  juridique et capital social, obligatoires pour les seules sociétés et non déductibles
  de façon fiable — un refus abusif qui empêche de facturer coûte plus cher qu'une
  mention facultative absente.
- **`POST /invoices { quote_id }` plutôt que `POST /quotes/:id/invoice`.** Argument
  décisif et concret : `InvoicesService` dépend de `QuotesService` ; héberger la route
  sur `QuotesController` aurait imposé un cycle de modules et un `forwardRef`, absent de
  tout le repo. Second appel → **409 `INVOICE_ALREADY_EXISTS`** avec `invoice_id`, pas un
  200 idempotent : un 200 graverait « une facture par devis » dans le contrat, ce qui
  deviendra faux le jour de l'acompte. Le web exploite le 409 pour router vers la facture
  existante — même UX, contrat honnête.
- **Statuts `issued | paid` uniquement, aucun `cancelled`.** Annuler une facture émise
  exige légalement un **avoir**, qui est lui-même une facture numérotée ; un drapeau sans
  avoir n'a aucune valeur juridique. `invoice_type` prévoit déjà `'avoir'`, non
  implémenté. Ni PATCH de contenu ni DELETE ne sont exposés — c'est précisément ce qui
  rend la continuité de la séquence vérifiable.
- **`InvoicePdfService.generatePdf(invoice)` ne prend que la facture** — ni
  `CompanyProfile` ni `Client` en paramètre, contrairement à `QuotePdfService`. Tout est
  rendu depuis les snapshots : la dérive est rendue *impossible par la signature* plutôt
  que par une convention. Un test l'assert (`toHaveLength(1)`).
- **`PdfBuilder` partagé devis ↔ facture, mais pas avec la liste d'achats.** Le PDF de
  facture doit rester le frère jumeau de celui du devis ; deux implémentations parallèles
  divergent en une release. `shopping-list-export.service.ts` est un autre document
  (regroupement par catégorie, lignes complémentaires) : recouvrement superficiel, non
  migré volontairement.

### Bug corrigé au passage : dérive horizontale du PDF de devis

En instrumentant `PDFDocument.prototype.text` avant d'extraire `PdfBuilder`, on a
constaté que **le PDF de devis était cassé dès qu'un client était rattaché** — c'est-à-dire
le cas normal chez un artisan. PDFKit laisse `doc.x` sur la dernière abscisse écrite ;
l'encadré client étant positionné à x=350 sans remise à zéro, tout le corps du document
dérivait ensuite vers la droite : titre et métadonnées centrés dans la moitié droite,
première ligne du tableau matériaux tracée à **x=710 sur une A4 de 595 pt**, lignes
suivantes à 1070 puis 1430 — hors page. Seul le bloc de totaux (abscisses codées en dur)
retombait sur ses pieds.

Corrigé à la racine : chaque méthode de `PdfBuilder` repart explicitement de la marge
gauche au lieu de lire `doc.x`. Filet posé **avant** le refactor (`quote-pdf.service.spec.ts`,
le module quotes n'ayant aucun test), plus un test de non-régression dédié qui échoue si
un texte est tracé au-delà de la marge droite — présent sur le devis et sur la facture.
`tableRow` calcule en prime la hauteur de ligne via `heightOfString`, donc une désignation
longue qui passe à la ligne ne chevauche plus la suivante.

### Limites connues (assumées, documentées)

Pas d'avoir ni d'annulation ; pas de facture d'acompte (« 30 % à la commande » reste du
texte libre) ; un seul taux de TVA par facture ; pas d'autoliquidation en sous-traitance
BTP (art. 283-2 nonies du CGI) ; pas de logo sur le PDF ; écart possible d'1 centime avec
le TTC du devis. La numérotation des **devis** reste racy — non corrigé sciemment : un
devis n'est soumis à aucune exigence légale de continuité, un doublon y produit au pire
une erreur d'unicité.

### Vérification

- `pnpm --filter @chiffreo/api lint | build | test | test:e2e`, idem web.
- Migrations rejouées `up`/`down`/`up` sur une base jetable en psql (le runner ts-node
  est cassé sur le poste de dev), avec vérification de l'index partiel `UQ_invoices_quote_solde`.
- **Numérotation testée en concurrence réelle**, deux sessions psql : la seconde bloque
  sur le verrou, `COMMIT` de la première → elle obtient 2 ; `ROLLBACK` → elle obtient 1,
  sans trou.

---

## PRO-3 — Relances devis (LIVRÉE) (1 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic PRO-A, PRO-3 (effort M, dépend de GTM-5).
Objectif : rappels automatiques sur un devis « envoyé » sans réponse à J+7/J+14 (e-mail au
client, notification à l'artisan), derrière la gate `quote_reminders` (seedée désactivée en
PRO-1, activée par cette livraison).

### Décision de conception

- **`@nestjs/schedule` (nouvelle dépendance, v6.1.3) plutôt que le patron « fire-and-forget
  déclenché par une requête + TTL »** déjà en place pour le cache de flux fournisseur
  (BUY-1). Ce patron ne transpose pas ici : une relance qui ne part que si quelqu'un ouvre
  l'app un jour donné manque son but (relancer le client même si l'artisan ne se reconnecte
  pas). `docs/PRODUCT_STRATEGY.md` §6.2 ne diffère que l'introduction d'une file lourde
  (BullMQ/Redis) pour la queue de jobs CV saturée, pas un scheduler in-process léger. Un seul
  `@Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: 'Europe/Paris' })` sur
  `QuoteRemindersService.runDailySweep()`, `ScheduleModule.forRoot()` dans `AppModule`.
  Alternative écartée : cron OS + endpoint admin protégé (secret à gérer, étape de
  déploiement crontab à documenter, moins bien adapté à une logique qui a de toute façon
  besoin d'accès DB/services).
- **Idempotence par deux colonnes (`reminder_7d_sent_at`/`reminder_14d_sent_at`) sur
  `quotes`**, pas de table séparée — même style que `sent_at`/`accepted_at`/`refused_at`.
  Le filtre `sent_at <= now() - N jours` (pas `=`) rend le sweep auto-réparant si le cron
  manque une exécution (déploiement, downtime) : une relance due est rattrapée à la
  prochaine passe plutôt que perdue silencieusement.
- **Politique de stamp : toujours marquée après tentative**, même si les deux envois e-mail
  échouent — évite qu'une panne du provider fasse grossir indéfiniment le lot rejoué chaque
  jour. Contrepartie assumée : une relance perdue pendant une panne ne repart pas toute
  seule ; acceptable pour une relance commerciale (pas un e-mail transactionnel à enjeu
  légal). Documenté dans le JSDoc de la migration `1711468800040` et du service.
- **Gate vérifiée par tentative (`FeatureGatesService.isFeatureAllowed`), pas par la requête
  SQL.** Un refus de gate saute la relance **sans marquer les colonnes** : un artisan qui
  upgrade en cours de route est relancé au sweep suivant plutôt que bloqué à vie par un skip
  silencieux.
- **Deux branches explicites (J7/J14) plutôt qu'un helper générique par nom de colonne
  dynamique** — exactement deux seuils, jamais destiné à devenir un moteur de relance à N
  échéances ; un accès dynamique aurait coûté du typage sans rien apporter. Même position
  anti-sur-abstraction que `EmailModule` (GTM-5) et `CsvRowParser` (BUY-4).
- **« Notification à l'artisan » = un second e-mail**, via la même plomberie
  `EmailService`/`BrevoClientService` que le client. Aucune table de notifications ni UI de
  notification in-app n'existe dans le repo (vérifié par recherche globale) ; en inventer une
  aurait dépassé le périmètre effort M de ce ticket.
- **Module `quote-reminders/` à dépendances étroites** : `TypeOrmModule.forFeature([Quote])`
  directement (pas `QuotesModule` en entier), `FeatureGatesModule`, `CompanyProfilesModule`,
  `EmailModule` — même logique que `SiteTrackingModule` qui injecte `ProjectsService` plutôt
  que d'importer tout `ProjectsModule`. Les relations `quote.user`/`quote.client` déjà
  présentes sur l'entité couvrent tous les besoins (email/tier du contractant, nom/email du
  client).
- **Coercition numérique de `total_ttc`** (`numeric` Postgres → `string` via TypeORM) avant
  de l'injecter dans les templates e-mail, même règle que `quote-pdf.service.ts`.
- **Pas d'événement analytics** : `quotes.service.ts` n'instrumente déjà rien
  (création/changement de statut) ; ajouter un tracking spécifique aux relances aurait
  introduit une première instrumentation du domaine devis non demandée par le ticket.
- **Page détail devis (`quotes/[id]/page.tsx`)** : deux lignes ajoutées au bloc « Historique »
  existant (`quote.reminder_7d_sent_at`/`reminder_14d_sent_at`), même patron que
  `sent_at`/`accepted_at`/`refused_at`. Décision consciente d'inclure cette surface web
  minimale (l'artisan voit qu'une relance est déjà partie) plutôt que de rester
  backend-only ; la liste des devis n'a pas ce patron par ligne et n'a pas été touchée.

### Vérification

```
pnpm --filter @chiffreo/api lint          # OK
pnpm --filter @chiffreo/api build         # OK
pnpm --filter @chiffreo/api test          # nouvelle suite quote-reminders.service.spec.ts
                                           # (12 cas) + 6 cas ajoutés à email.service.spec.ts
                                           # — 469 tests / 38 suites, aucune régression
pnpm --filter @chiffreo/web lint          # OK (1 warning <img> préexistant)
pnpm --filter @chiffreo/web build         # OK
pnpm --filter @chiffreo/web test          # OK — 193 tests / 25 suites, aucune régression
```

SQL des migrations 040/041 validé sur conteneur `postgres:16-alpine` jetable (le runner
`ts-node` reste cassé sur ce poste, cf. BUY-1) : `up()` puis `down()` de l'ajout des deux
colonnes (schéma `quotes` minimal), et bascule `false → true → false` de `is_enabled` pour
`quote_reminders`. Démarrage réel de l'API (`pnpm start:dev`, `docker compose up postgres`)
pour vérifier le câblage DI de `ScheduleModule`/`QuoteRemindersModule` : démarrage propre,
toutes les routes mappées, aucune erreur — les tests unitaires (repos/services mockés)
n'auraient pas détecté une erreur de câblage Nest.

### Reste à faire (hors périmètre PRO-3)

- L'envoi réel via Brevo n'a pas pu être vérifié en conditions réelles (aucune clé API
  disponible sur ce poste, même limite que GTM-5) — seuls les mocks `HttpService` couvrent le
  chemin « clé présente ».
- PLAT-2 (e-mails de cycle de vie) pourra réutiliser le même `EmailModule`/`BrevoClientService`
  ainsi que, si un besoin de scheduling quotidien apparaît ailleurs, le même
  `ScheduleModule.forRoot()` déjà enregistré dans `AppModule`.

## PRO-2 — Suivi de chantier + timeline (LIVRÉE) (1 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic PRO-A, PRO-2 (effort L, dépend de PRO-1).
Objectif : statuts d'avancement par projet client, jalons, dates prévues/réelles —
différenciateur Standard. PRO-1 avait seedé la gate `site_tracking` désactivée
(migration `1711468800037`), en attente de la fonctionnalité réelle derrière.

### Décision de conception

- **Une seule entité `SiteMilestone`**, pas de champ de statut global séparé sur
  `projects`. Les 3 éléments du backlog (statut d'avancement, jalons, dates
  prévue/réelle) sont portés par le même objet : chaque jalon a son propre statut
  (`pending`/`in_progress`/`done`) et ses propres dates. Un second champ de statut
  « chantier » sur `Project` aurait introduit un état à resynchroniser manuellement
  avec les jalons sans rien apporter — l'avancement du chantier se lit déjà par la
  position dans la timeline (jalons faits vs restants).
- **Module dédié `apps/api/src/site-tracking/`**, même charpente que `clients`/`quotes`
  (entité + dto + service + controller + module), plutôt qu'extension de
  `ProjectsController`. Le contrôleur est monté sous `/projects/:id/milestones`, même
  patron que `PriceComparisonController` (contrôleur séparé sous le préfixe `/projects`) :
  garde `ProjectsController` inchangé, et permet à `SiteTrackingService` d'injecter
  `ProjectsService` (déjà exporté par `ProjectsModule`) pour réutiliser
  `findOneByUser` comme vérification de propriété, sans dupliquer cette logique.
- **`actual_date` auto-renseignée à la date du jour** quand le statut passe à `done`
  sans date réelle explicite fournie — même mécanique que `sent_at`/`accepted_at`/
  `refused_at` sur `updateStatus` des devis (`quotes.service.ts`). Une date réelle déjà
  présente n'est jamais écrasée silencieusement, et une valeur explicite dans le body
  a toujours priorité sur l'auto-remplissage.
- **Colonnes `planned_date`/`actual_date` en `date` (pas `timestamptz`)** : premier
  usage de ce type dans le repo (tout le reste est `timestamptz`), choix délibéré —
  une date de jalon de chantier n'a pas de composante horaire à préserver.
- **Pas de réordonnancement drag-and-drop.** Chaque nouveau jalon est ajouté en fin de
  liste (`sort_order` = nombre de jalons existants, sauf valeur explicite fournie) ;
  l'ordre de création suffit pour un MVP d'effort L raisonnable. `sort_order` reste
  ajustable via `PATCH` pour permettre une réorganisation manuelle ultérieure sans
  migration.
- **Entrée `ProjectCard`** : bouton « Suivi de chantier » affiché uniquement quand
  `appUser.subscription_tier` commence par `contractor` (lu via `useAuth()`, déjà
  utilisé ailleurs dans le composant). `ProjectCard` est partagé entre le dashboard DIY
  et `ContractorDashboard` — ce garde-fou évite d'exposer le bouton aux comptes non
  Contractor. La page cible applique elle-même le gate standard
  (`isFeatureAllowed`/`showPaywall`), même comportement que `quotes/page.tsx`, pour les
  Contractor Essentiel qui n'ont pas encore `site_tracking`.
- **Migration séparée pour l'activation de la gate** (`1711468800039`, `is_enabled =
  true`), distincte de la création de table (`1711468800038`) — même découpage que
  BUY-1/BUY-2 pour `price_comparison`, pour rester réversible indépendamment.

### Vérification

```
pnpm --filter @chiffreo/api lint          # OK
pnpm --filter @chiffreo/api build         # OK
pnpm --filter @chiffreo/api test          # nouvelle suite site-tracking.service.spec.ts (9 tests)
pnpm --filter @chiffreo/api test:e2e      # nouvelle suite site-tracking.e2e-spec.ts (10 tests)
pnpm --filter @chiffreo/web lint          # OK
pnpm --filter @chiffreo/web build         # OK
pnpm --filter @chiffreo/web test          # nouveaux cas ProjectCard.spec.tsx (entrée Contractor)
```

SQL des migrations 038/039 validé sur conteneur `postgres:16-alpine` jetable (le runner
`ts-node` reste cassé sur ce poste, cf. BUY-1) : schéma minimal `users`/`projects`/
`feature_gates`, `up()` puis `down()` des deux migrations, en vérifiant en particulier
les valeurs par défaut de `site_milestones`, l'index sur `project_id`, la suppression en
cascade des jalons quand le projet est supprimé, et le basculement
`false → true → false` de `is_enabled` pour `site_tracking`.

### Reste à faire (hors périmètre PRO-2)

- PRO-3 (relances devis) reste à construire séparément — même geste d'activation de
  gate (`quote_reminders`, actuellement désactivée) une fois la fonctionnalité réelle
  en place.
- Pas de notification (e-mail, push) quand une date prévue est dépassée : hors
  périmètre de ce ticket, pourrait s'appuyer sur le même mécanisme que PRO-3 le jour où
  il existe.

## PRO-1 — Différenciation des paliers Contractor (LIVRÉE) (1 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic PRO-A, PRO-1 (effort M, aucune dépendance).
Objectif : les 3 paliers Contractor (Essentiel 50 €/Standard 100 €/Premium 200 €) donnaient
un accès strictement identique — définir et gater : Essentiel = devis+clients ; Standard =
+ suivi chantier + relances ; Premium = + multi-utilisateurs + API, en réutilisant la
mécanique de feature gates existante (`feature_gates` + `@RequireFeature` + `FeatureGateGuard`).

### Décision de conception

- **`SubscriptionTier.CONTRACTOR` (une valeur) remplacé par 3 valeurs distinctes**
  (`contractor_essentiel`/`_standard`/`_premium`), et `TIER_RANK`
  ([feature-gates.service.ts](../apps/api/src/feature-gates/feature-gates.service.ts))
  étendu à 5 rangs ordonnés (`free=0 … contractor_premium=4`). C'était la seule vraie cause
  racine : le mécanisme de gate (`isFeatureAllowed`, guard, contexte React) n'avait rien à
  faire d'autre que comparer un rang — il ne connaissait simplement qu'un seul rang Contractor
  pour 3 price IDs Stripe distincts (`subscriptions.service.ts` collapsait déjà tout vers
  `CONTRACTOR` dans `syncSubscriptionTier`). Alternative écartée : stocker le sous-palier
  ailleurs (ex. sur `Subscription`) plutôt que sur `User.subscription_tier` — rejetée, ç'aurait
  été une seconde indirection pour la même donnée que `FeatureGateGuard` lit déjà.
- **Aucune migration de schéma.** `users.subscription_tier` et `feature_gates.min_tier` sont
  déjà `varchar(20)` ; les 3 nouvelles valeurs (18 à 20 caractères) y tiennent. Seule une
  migration de données était nécessaire.
- **Gates Standard/Premium seedées désactivées**, même patron que `price_comparison`
  (migration 1711468800020, activée seulement en BUY-2 une fois l'adaptateur réel prêt) :
  `site_tracking`/`quote_reminders` (`contractor_standard`) et `multi_user`/`public_api`
  (`contractor_premium`) existent et pointent déjà vers le bon palier, mais restent éteintes
  tant que PRO-2/PRO-3/PLAT-4/PLAT-5 (aucun n'est construit — confirmé par exploration : pas de
  notion de chantier/jalons, relances, organisations ou clés API dans le repo) n'ont pas
  livré la fonctionnalité réelle derrière.
- **Migration 1711468800037** : backfill de `users.subscription_tier` pour les abonnés déjà à
  `'contractor'`, en résolvant leur price ID Stripe réel via `subscriptions.stripe_price_id`
  face aux 3 price IDs d'environnement — défaut `contractor_essentiel` si aucune
  correspondance (aucun abonnement retrouvé) : on ne sur-attribue jamais un palier supérieur à
  ce qui est prouvé. Validée sur conteneur `postgres:16-alpine` jetable (`up()` puis `down()`,
  cf. Vérification) avec 5 utilisateurs de test (essentiel/standard/premium/sans abonnement/pro
  témoin) : tous résolus au bon palier, `down()` restaure l'état initial à l'identique.
- **Effets de bord nécessaires du changement d'enum**, tous dans `apps/api` : `resolvePlanName`
  et `syncSubscriptionTier` ([subscriptions.service.ts](../apps/api/src/subscriptions/subscriptions.service.ts))
  résolvent désormais le sous-palier précis (analytics `CHECKOUT_STARTED`/`SUBSCRIPTION_STARTED`
  portent `contractor_standard` au lieu de `'contractor'` générique) ; `getMrr()`
  ([admin-analytics.service.ts](../apps/api/src/admin-analytics/admin-analytics.service.ts))
  ventile désormais le MRR sur 4 paliers payants au lieu de 2 (Pro agrégeait déjà les 3 plans
  Contractor en un seul tier). Côté web, les 3 comparaisons strictes
  `subscription_tier === 'contractor'` (dashboard, liste d'achats, `PaywallModal`) généralisées
  en `?.startsWith('contractor')` — sinon elles cessaient de matcher après le changement
  d'enum, pour un sens ("un Contractor, peu importe le palier") resté inchangé.
- **`ContractorPricingModal` recevait déjà la mécanique du problème qu'elle vient de créer** :
  le badge "Populaire" était câblé en dur sur Standard, ce qui n'était pas un souci tant que
  les 3 paliers étaient équivalents. Devenu un vrai piège UX une fois différenciés : un
  utilisateur bloqué par une gate Premium aurait pu se voir recommander Standard, qui ne
  débloque pas la fonctionnalité qui l'a amené là. `PaywallModal` transmet maintenant
  `requiredTier` (le `min_tier` de la gate déclenchante) à la modale, qui met en avant le
  palier réellement requis.
- **Couleurs `MrrChart`** : rampe à 2 teintes (Pro/Contractor) étendue à 4, validée avec le
  skill `dataviz` en mode `--ordinal` (paliers Pro < Essentiel < Standard < Premium, une seule
  teinte, luminosité monotone) plutôt qu'inventées à la main.

### Vérification

```
pnpm --filter @chiffreo/api lint          # OK
pnpm --filter @chiffreo/api build         # OK
pnpm --filter @chiffreo/api test          # nouvelle suite feature-gates.service.spec.ts,
                                           # cas ajoutés dans admin-analytics/subscriptions specs
pnpm --filter @chiffreo/api test:e2e      # OK — aucune régression
pnpm --filter @chiffreo/web lint          # OK
pnpm --filter @chiffreo/web build         # OK
pnpm --filter @chiffreo/web test          # OK — aucune régression
```

SQL de la migration 037 validé sur une base jetable (le runner `ts-node` reste cassé sur ce
poste, cf. BUY-1) : conteneur `postgres:16-alpine` éphémère, schéma minimal `users`/
`subscriptions`/`feature_gates`, `up()` puis `down()`, en vérifiant en particulier le backfill
par price ID (essentiel/standard/premium/sans abonnement) et la réversibilité complète de
`down()`.

### Reste à faire (hors périmètre PRO-1)

- PRO-2 (suivi de chantier + timeline) et PRO-3 (relances devis) : construire la fonctionnalité
  réelle derrière `site_tracking`/`quote_reminders`, puis activer la gate (`is_enabled=true`),
  même geste que BUY-2 pour `price_comparison`.
- PLAT-4 (organisations/membres/rôles) et PLAT-5 (API publique + clés), P3 : prérequis avant de
  pouvoir activer `multi_user`/`public_api` — aucune notion d'organisation ni de clé API
  n'existe encore dans le repo.

## BUY-4 — Deuxième enseigne Leroy Merlin (LIVRÉE) (1 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic BUY-A, BUY-4 (effort L, dépend de BUY-1).
Objectif : un deuxième adaptateur fournisseur réel — « la comparaison n'a de valeur qu'à
≥ 2 sources réelles ».

### Décision de conception

- **Même patron que ManoMano (BUY-1), sans écart.** Le contrat `SupplierAdapter`, le
  moteur de rapprochement générique (`matching/*`) et l'entité `supplier_material_match`
  (contrainte unique `(supplier_key, material_id)`) ont été conçus dès BUY-1 pour
  plusieurs enseignes — vérifié en pratique : aucune migration, aucun changement de
  `price-comparison.service.ts`/`.controller.ts`. Nouveau dossier
  `adapters/leroymerlin/` avec les quatre mêmes rôles que `adapters/manomano/`
  (constants, feed client Awin/Effiliation/Kwanko, service de synchronisation, adaptateur
  qui lit l'index déjà rapproché — jamais d'appel réseau par matériau, jamais de prix
  approximatif hors bande de prorata).
- **`CsvRowParser` déplacé vers `adapters/shared/csv-row-parser.ts`.** C'était la seule
  vraie duplication possible : cette machine à états CSV (RFC 4180) ne connaît aucune
  enseigne. Le dupliquer aurait recopié ~170 lignes déjà testées ; l'importer depuis
  `../manomano/csv-row-parser` aurait couplé deux dossiers censés être indépendants.
  Aucun changement de comportement (mêmes tests, déplacés à l'identique).
  `FEED_COLUMNS`/`toFeedProduct` restent en revanche dupliqués par enseigne, comme déjà
  le cas pour ManoMano : ce mapping encode un choix métier qui peut légitimement diverger
  d'un flux à l'autre, pas sur-abstrait au-delà de ce que BUY-1 avait posé.
- **`SupplierRegistry` étendu, pas remplacé** : `LeroyMerlinAdapter` injecté au
  constructeur, enregistré sur son propre flag `priceComparison.leroyMerlin.enabled`, aux
  côtés de ManoMano. Nouveau test de coexistence des deux adaptateurs activés
  simultanément — le comportement que BUY-4 existe pour prouver.
- **Config miroir exact de ManoMano** : bloc `priceComparison.leroyMerlin` dans
  `config/configuration.ts`, variables `LEROY_MERLIN_ENABLED`/`_FEED_URL`/`_TIMEOUT_MS`/
  `_FEED_TTL_HOURS` dans `.env.example`. Programme d'affiliation non souscrit à ce stade :
  `LEROY_MERLIN_ENABLED=false` par défaut, comme ManoMano l'a été jusqu'à son intégration
  réelle.

### Vérification

```
pnpm --filter @chiffreo/api test -- price-comparison   # OK — 155 tests, 12 suites (leroymerlin.*, csv-row-parser déplacé, supplier-registry étendu)
pnpm --filter @chiffreo/api lint                       # OK
pnpm --filter @chiffreo/api build                      # OK
pnpm --filter @chiffreo/api test                       # OK — 431 tests, 35 suites (suite complète, aucune régression)
pnpm --filter @chiffreo/api test:e2e                   # OK — 74 tests, 8 suites
```

### Reste à faire (hors périmètre BUY-4)

- Aucun programme d'affiliation Leroy Merlin n'est souscrit à ce jour : `LEROY_MERLIN_FEED_URL`
  reste vide en production tant que le partenariat n'est pas signé, comme documenté pour
  ManoMano en BUY-1 (credentials non vérifiés faute d'accès).
- Castorama (l'autre option du ticket BUY-4) n'a pas été implémenté : le même patron
  s'appliquerait à l'identique si une troisième enseigne devenait nécessaire.

## BUY-3 — Liens d'achat commissionnés sur la liste (LIVRÉE) (1 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic BUY-A, BUY-3 (effort M, dépend de BUY-1).
Objectif : chaque ligne de la liste d'achats → lien affilié « acheter chez X », y compris
sur le tier Free (revenu secondaire sans friction).

### Décision de conception

- **Nouvel endpoint `GET /projects/:id/shopping-list/buy-links`, volontairement sans
  feature gate.** C'est le point même du backlog : Free inclus, contrairement à
  `compare-prices`/`compare-prices/apply` (`price_comparison`, Pro+). Précédent déjà
  présent dans le repo : `GET .../shopping-list` (liste elle-même) n'a jamais eu de gate
  non plus.
- **Aucune persistance nouvelle, aucune migration.** Le lien vient de
  `supplier_material_match.product_url` — déjà le lien affilié depuis BUY-1 (« le prix
  stocké est celui du marchand, le prorata se fait à la lecture », `tasks/todo.md` §BUY-1)
  — lu à la demande via le même cache `supplier_price_cache` que `comparePrices`. BUY-3
  n'ajoute rien à stocker, seulement un chemin de lecture différent.
  - Un seul lien par ligne : le fournisseur disponible le moins cher, même critère que
  `best_supplier_key` de BUY-2. Choisi plutôt que « premier adaptateur enregistré » pour
  ne pas avoir à réarbitrer quand BUY-4 (2ᵉ enseigne) ajoutera un concurrent au pool.
  - Une ligne `not_found` (aucun rapprochement marchand exploitable) n'apparaît
  simplement pas dans `links` — pas de lien approché, cohérent avec le principe déjà
  posé en BUY-1.
- **Refactor avant l'ajout** (`price-comparison.service.ts`) : la boucle
  `Promise.allSettled` sur les adaptateurs et le tri « not_found en dernier, prix
  croissant » de `comparePrices` étaient inline ; extraits en `fetchSupplierPriceMaps` et
  `collectSortedPrices`, réutilisés à l'identique par `getBuyLinks`. Comportement de
  `comparePrices` inchangé (couvert par ses tests existants, aucune assertion modifiée).
- **`rel="sponsored"`** sur le lien côté web (recommandation pour un lien rémunéré).

### Vérification

```
pnpm --filter @chiffreo/api lint          # OK
pnpm --filter @chiffreo/api build         # OK
pnpm --filter @chiffreo/api test          # nouvelle suite : getBuyLinks (price-comparison.service.spec.ts)
pnpm --filter @chiffreo/api test:e2e      # nouveaux cas : GET .../buy-links, dont la preuve d'absence de gate
pnpm --filter @chiffreo/web lint          # OK
pnpm --filter @chiffreo/web build         # OK
pnpm --filter @chiffreo/web test          # nouveaux cas : lien affilié dans ShoppingListMaterials.spec.tsx
```

### Reste à faire (hors périmètre BUY-3)

- Disclosure légale complète des liens affiliés (mentions requises en droit français)
  reste portée par GTM-6 (CGU/CGV/mentions légales), pas encore livré.
- BUY-4 (2ᵉ enseigne) changera le pool de fournisseurs interrogé mais pas la logique de
  sélection (déjà « le moins cher disponible »).
- Le lien n'est pas exposé sur la liste partagée (`/shared/shopping-list/[token]`) :
  cette page est sans authentification et n'affiche déjà pas le comparateur de prix,
  périmètre inchangé par BUY-3.

## BUY-2 — Réactivation de la feature gate `price_comparison` (LIVRÉE) (1 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic BUY-A, BUY-2 (effort S, dépend de BUY-1).
Objectif : une fois l'adaptateur ManoMano en place (BUY-1), réactiver la gate `price_comparison`
(désactivée en migration 027) et QA le parcours comparaison → application à la liste.

### Bug trouvé en QA-ant le parcours

`applySelections` matchait les sélections sur `(material_id, work_item_id)`
([price-comparison.service.ts](../apps/api/src/price-comparison/price-comparison.service.ts)),
mais depuis ENG-2 les lignes d'achat sont mutualisées par `material_id` seul : le chemin
`aggregated_json` qui alimente toute liste générée aujourd'hui ne renseigne jamais
`work_item_id`. Le DTO `ItemSupplierSelectionDto.work_item_id` était pourtant `@IsUUID()`
**requis**, alors que `shopping-lists` avait déjà résolu exactement ce problème pour
`MaterialItemUpdateDto` (champ optionnel, toléré mais non utilisé pour le matching). Sans
correctif, réactiver la gate aurait livré une fonctionnalité payante cassée : sur toute
liste mutualisée (le cas normal), l'application d'une sélection ne trouvait jamais la ligne
et n'appliquait silencieusement rien.

Le module n'avait aucun test au niveau service/contrôleur (seuls les adaptateurs/matching
ManoMano de BUY-1 sont testés) — la gate étant éteinte depuis la migration 027, personne
n'avait exercé ce chemin en conditions réelles. Corrigé en alignant `ItemSupplierSelectionDto`
et `applySelections` sur le même principe que `shopping-lists` (matching sur `material_id`
seul, `work_item_id` optionnel et toléré pour compatibilité). Le type frontend
correspondant (`price-comparison-types.ts`) était également mensonger (`work_item_id`
déclaré requis alors que la réponse API l'a toujours renvoyé optionnel depuis BUY-1) ;
corrigé pour cohérence — aucun changement de comportement côté composants, `JSON.stringify`
éliminait déjà silencieusement les clés `undefined` avant envoi.

Corrigé aussi au passage le bug de documentation déjà noté dans BUY-1 : `docs/API.md`
montrait un corps erroné (objet) pour `compare-prices/apply` au lieu du tableau
`selections: [{material_id, supplier_key}]` réellement exigé par le DTO.

### Vérification

```
pnpm --filter @chiffreo/api lint          # OK
pnpm --filter @chiffreo/api build         # OK
pnpm --filter @chiffreo/api test          # nouvelles suites : price-comparison.service.spec.ts
pnpm --filter @chiffreo/api test:e2e      # nouvelle suite : price-comparison.e2e-spec.ts
pnpm --filter @chiffreo/web lint          # OK
pnpm --filter @chiffreo/web build         # OK (typecheck des interfaces modifiées)
```

SQL de la migration 036 validé sur une base jetable (le runner `ts-node` reste cassé sur ce
poste, cf. BUY-1) : conteneur `postgres:16-alpine` éphémère, `up()` puis `down()`, en
vérifiant que `is_enabled` bascule bien à `true` puis `false` pour `price_comparison`.

### Reste à faire (hors périmètre BUY-2)

- Le format exact du flux marchand livré par la plateforme d'affiliation retenue reste
  non vérifié faute de credentials (déjà noté dans BUY-1, sans lien avec ce correctif).

## BUY-1 — Adaptateur d'affiliation ManoMano (LIVRÉE) (29 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic BUY-A, BUY-1 (effort L, aucune dépendance).
Objectif : premier adaptateur fournisseur réel dans le registre existant, via le flux produits
du programme d'affiliation ManoMano, avec le rapprochement catalogue→produits marchands et la
suppression des mocks CAD. La feature gate `price_comparison` reste désactivée : sa
réactivation et la QA du parcours sont BUY-2.

### Décision de conception

- **Le flux n'est jamais persisté.** Le catalogue est petit et stable (208 matériaux), le flux
  marchand est gros et jetable : on le parcourt en streaming et on n'écrit que le gagnant par
  matériau dans `supplier_material_match` (≤ 208 lignes). Pas de copie du flux en base, pas de
  table de produits à purger.
- **Le prix stocké est celui du marchand, le prorata se fait à la lecture.** Le moteur choisit
  le conditionnement projet par projet (`selectBestPackaging`), donc un prix pré-calculé serait
  faux pour le projet suivant. `supplier_material_match` garde prix et conditionnement réels ;
  l'adaptateur ramène au conditionnement du devis, borné à un rapport de 1 à 4 — au-delà,
  `not_found` plutôt qu'une extrapolation.
- **`SupplierLookupItem` étendu** avec `packaging_label` / `packaging_qty_per_unit`. Sans eux,
  `unit_price * units_needed` ([price-comparison.service.ts:124](../apps/api/src/price-comparison/price-comparison.service.ts))
  est incohérent : `units_needed` compte des colis, l'adaptateur ne connaissait que l'unité de base.
- **Pas d'ordonnanceur.** `@nestjs/schedule` n'est pas une dépendance et
  [docs/PRODUCT_STRATEGY.md](../docs/PRODUCT_STRATEGY.md) diffère l'introduction d'une file. On
  suit le patron fire-and-forget déjà en place (`analysis.service.ts`) : une passe au démarrage,
  puis resynchronisation en tâche de fond quand l'index dépasse `MANOMANO_FEED_TTL_HOURS`. Verrou
  en processus — en multi-instance chaque instance téléchargerait le flux, sans corruption
  (l'écriture est un upsert idempotent), mais c'est un coût à revoir si l'API est répliquée.
- **Parseur CSV écrit à la main** plutôt qu'une dépendance : machine à états RFC 4180 d'une
  cinquantaine de lignes, alimentée par les chunks de `createGunzip()`, avec détection du
  séparateur et résolution des colonnes par alias (Awin, Effiliation…). Le flux n'est jamais
  matérialisé en mémoire, et `apps/api` garde son arbre de dépendances minimal.
- **`orUpdate` et non `orIgnore`** : le cache prix existant (`supplier_price_cache`) souffre
  déjà de `orIgnore`, qui fait retomber les écritures de rafraîchissement dans le vide. La
  nouvelle table rafraîchit réellement, et supprime les rapprochements que le flux ne soutient
  plus.
- **`is_pinned`** protège un rapprochement corrigé à la main : la synchronisation ne l'écrase
  jamais. C'est le garde-fou qui permet de rattraper un mauvais match sans toucher au code.

### Stratégie de rapprochement (5 verrous)

Le catalogue n'offre que trois signaux : nom français en texte libre, catégorie parmi cinq,
unité parmi cinq. Ni référence, ni EAN, ni mot-clé, et aucun utilitaire de normalisation ou
index trigram n'existait dans le dépôt.

1. **Rayon** — regex par catégorie sur « chemin de catégorie + titre » normalisés. Ramène un
   flux de plusieurs centaines de milliers de références aux seuls rayons couverts. Le titre
   participe volontairement au test : les chemins de catégorie des flux d'affiliation sont peu
   fiables.
2. **Tokens techniques** — tout token du nom portant un chiffre doit se retrouver dans le
   produit (`30x30` ≠ `60x60`, `C2` ≠ `C1`). Le préfixe n'est toléré que pour les codes
   normalisés — un mortier `C2S1` est bien un `C2` — jamais pour un mot ordinaire ni un
   nombre, sinon « materiau » satisferait « mate » et « 12.5 » satisferait « 2.5 ».
3. **Tokens rivaux** — le produit ne doit pas porter le mot qui caractérise un voisin de rayon.
   Ce qui disqualifie « Peinture glycéro satinée » face au matériau « Peinture glycéro mate »
   n'est pas ce qui lui manque, c'est le « satinée » qu'il porte.
4. **Couverture pondérée IDF** ≥ 0,55, l'IDF étant calculé sur le catalogue (une passe,
   déterministe) : « peinture » apparaît dans 54 noms et ne discrimine rien, « satinée »
   discrimine tout.
5. **Meilleure revendication** — un produit n'est attribué qu'au matériau auquel il correspond
   le mieux. « Peinture acrylique mate blanche » satisfait entièrement « Peinture acrylique
   mate » et aux deux tiers « Peinture acrylique extra-mate » : sans arbitrage, le second
   recevrait le prix du premier.

Plus un verrou de conditionnement : le produit doit exposer une grandeur compatible avec
l'unité du matériau, sinon le total n'a pas de sens.

**Verrous 3 et 5 sont complémentaires** : le premier protège quand le vrai matériau est absent
du catalogue (aucun concurrent pour arbitrer), le second quand il y est. Les deux ensemble
privilégient la précision sur le rappel — un rapprochement manqué donne `not_found`, un
mauvais rapprochement donne un prix faux à un utilisateur payant.

### Bugs trouvés en écrivant les tests

- **Le verrou « token discriminant » initial (ratio du poids IDF max) était trop fragile.**
  Vérifié sur le catalogue réel extrait du seed (199 noms) : « Peinture glycéro **mate** »
  récupérait « Peinture glycéro **satinée** » (score 0,628) parce que « mate », très fréquent
  dans le catalogue, tombait à 0,89 du poids max — juste sous le seuil de 0,9. Remplacé par le
  verrou des tokens rivaux, qui vise la cause réelle. Deux autres faux positifs tombaient avec :
  « Sous-couche carrelage » → « Sous-couche universelle », et « Peinture acrylique extra-mate »
  → « Peinture acrylique mate » (celui-là réglé par la meilleure revendication).
  Après correction : 7 rapprochements sur 12 produits du flux de test, tous à 1,000, zéro faux
  positif.
- **Le verrou discriminant utilisait l'égalité stricte** là où le verrou technique utilisait le
  préfixe de code : `C2` cessait d'accepter `C2S1`. Les deux partagent désormais
  `isTokenSatisfied`, et le préfixe a été restreint aux codes (lettres puis chiffre).
- **Le catalogue écrit « 2.6m », le flux marchand « 2,6 m ».** Sans séparation du nombre et de
  son unité à la normalisation, les deux ne produisaient pas le même token technique et le
  verrou rejetait un rapprochement pourtant correct.
- **`ml` est ambigu en français** (millilitre ou mètre linéaire). Une plinthe de 2,6 ml est
  plausible, un lambris de 500 ml non : la lecture en mètres est plafonnée à 20.
- **« boîte de 11 carreaux » n'est pas un lot de 11 colis.** Le multiplicateur est restreint à
  la forme explicite « lot/paquet/pack de N », sinon le conditionnement était surestimé d'un
  facteur 11.
- **Les caractères multi-octets coupés entre deux chunks réseau** produisaient des caractères
  de remplacement — d'où `StringDecoder` plutôt que `chunk.toString('utf8')`.

### Suppression des mocks CAD

`MockSupplierAdapter` supprimé (prix fabriqués par hash, en CAD, incohérents avec un produit
intégralement français), avec `PRICE_MOCK_ENABLED` et la configuration morte `homeDepot`/
`lowes` (jamais lue, artefact du positionnement nord-américain initial). Côté web, l'affichage
passe de `CAD`/`$` à `EUR` et `fr-CA` à `fr-FR` — sinon on aurait servi des prix EUR étiquetés
CAD.

### Vérification

```
pnpm --filter @chiffreo/api lint          # OK
pnpm --filter @chiffreo/api build         # OK
pnpm --filter @chiffreo/api test          # 31 suites, 379 tests
pnpm --filter @chiffreo/api test:e2e      # 7 suites, 65 tests
pnpm --filter @chiffreo/web lint          # OK (1 warning préexistant, sans rapport)
pnpm --filter @chiffreo/web test          # 25 suites, 188 tests
```

Le module n'avait **aucun test** avant cette story ; il en compte 105 (8 suites).

SQL de la migration 035 validé sur une base jetable (le runner `ts-node` est cassé sur ce
poste, cf. ESM/`__dirname`) : conteneur `postgres:16-alpine` éphémère, `up()` puis `down()`,
en vérifiant les 15 colonnes et leurs précisions, les 3 index, le rejet du doublon
`(supplier_key, material_id)`, le rafraîchissement par `ON CONFLICT DO UPDATE` (34,90 → 29,90),
la coexistence d'une seconde enseigne sur le même matériau (nécessaire à BUY-4) et la purge
par `ON DELETE CASCADE`.

Qualité du rapprochement mesurée sur le **catalogue réel** (199 noms extraits du seed) contre
un flux de 12 produits aux titres réalistes, via le pipeline complet (parseur CSV → mapping des
colonnes → matcher) — voir « Bugs trouvés » ci-dessus.

### Reste à faire (hors périmètre BUY-1)

- BUY-2 : réactiver la feature gate et faire la QA du parcours comparaison→application.
- Non vérifié faute de credentials : le format exact du flux livré par la plateforme
  d'affiliation retenue. La résolution des colonnes par alias couvre Awin et Effiliation ;
  `MANOMANO_FEED_URL` accepte un chemin local pour valider sur un extrait réel avant bascule.
- `docs/API.md` documente toujours un corps erroné pour `compare-prices/apply` (objet au lieu
  du tableau exigé par `ApplySelectionsRequestDto`) — bug de documentation préexistant, laissé
  en l'état pour ne pas élargir le périmètre.

## CV-7 — Tests de non-régression CV (LIVRÉE) (24 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic CV-B, CV-7 (effort M, aucune dépendance).
Objectif : jeu d'images de référence à dimensions connues + assertion d'écart max dans la CI
du cv-service — jusqu'ici aucun test n'exerçait le pipeline complet (`DimensionCalculator.
process()`), seulement `ReferenceDetector` isolément.

### Décision de conception

- **Images synthétiques, pas de fixtures binaires** : même approche que `test_reference_
  detector.py` (scènes construites en mémoire via cv2/numpy) plutôt que des photos réelles
  commitées — déterministe, rapide (~0,8 s pour la suite), pas de gestion d'assets binaires.
  Nouveau module [`_synthetic_room.py`](../apps/cv-service/tests/_synthetic_room.py) : génère
  image + depth map pour des `width_cm/length_cm/height_cm` cibles, dimensionnées
  algébriquement pour que le **vrai** Canny/Hough/Otsu de `ContourDetector` et le **vrai**
  `ReferenceDetector` (marqueur A4 ou porte) retrouvent ces valeurs.
- **2 scénarios** ("jeu d'images") : un via marqueur A4, un via porte standard — couvrant les
  deux chemins de calibration distincts en plus du calcul de dimensions partagé. La carte
  bancaire a été écartée : sa taille physique (≈ 46 cm²) est ~13× trop petite pour satisfaire
  le seuil d'aire minimal du détecteur (`MARKER_MIN_AREA_FRAC`) à l'échelle d'une pièce
  entière — la porte teste un chemin de détection plus distinct de toute façon (aspect +
  position + discontinuité de profondeur, vs. quadrilatère + aspect pour les marqueurs).
- **Seuil d'écart max = 20 %** (`MAX_DEVIATION_PCT`), volontairement large : pipeline
  heuristique approximatif par construction (cf. CV-2/CV-5), le but est d'attraper une vraie
  régression, pas de garantir une précision. Écarts réels mesurés sur les 2 scénarios :
  0,4–1,3 % (largeur/longueur), 9–16 % (hauteur, plus bruitée car dépend du comptage de
  lignes Hough) — marge confortable sous le seuil.
- **Pas de modèle ML** : `_FakeDepthEstimator` renvoie la depth map précalculée au lieu
  d'appeler `DepthEstimator` (torch/transformers) — garde la CI cv-service légère, cohérent
  avec le choix déjà fait pour `test_reference_detector.py`.

### Bugs trouvés en écrivant les tests

- `DimensionCalculator` importait `DepthEstimator` au niveau module, ce qui tirait torch/
  transformers dès l'import — impossible d'exercer `process()` dans la CI actuelle (install
  minimale sans torch). Fix : import sous `TYPE_CHECKING` (annotation en string), zéro impact
  d'exécution (`app/main.py` importe déjà `DepthEstimator` indépendamment pour l'instancier).
- `ContourDetector.detect()` : `x1,y1,x2,y2 = line[0]` plantait sur OpenCV 5.x, qui renvoie
  `HoughLinesP` en forme `(N,4)` au lieu de `(N,1,4)` (OpenCV 4.x). Jamais détecté avant car
  aucun test n'exerçait ce chemin. Confirmé que `pip install opencv-python-headless` (non
  épinglé, comme dans `ci.yml`) résout aujourd'hui vers 5.0.0 — ce bug affectait donc
  potentiellement la CI dès qu'un futur test toucherait cette méthode. Fix : `line.reshape(-1)`
  (fonctionne pour les deux formes).
- CI : `pydantic-settings` et `pillow` manquaient de l'install minimale (packages distincts de
  `pydantic`, utilisés par `app/config.py` et `dimension_calculator.py`) — ajoutés à `ci.yml`.

### Checklist

- [x] 1. `_synthetic_room.py` — générateur de scènes (2 scénarios : A4, porte)
- [x] 2. `test_dimension_regression.py` — pipeline complet + assertion d'écart max
- [x] 3. Fix `contour_detector.py` (HoughLinesP OpenCV 5.x) + `dimension_calculator.py`
  (import TYPE_CHECKING)
- [x] 4. `ci.yml` — ajout `pydantic-settings pillow` à l'install minimale
- [x] 5. Vérifié : suite complète verte (40 tests) en venv local ET en venv propre répliquant
  l'install CI minimale ; seuil abaissé temporairement à 0 % pour confirmer que l'assertion
  échoue bien (2 tests rouges avec message d'écart clair), puis restauré à 20 %

### Livré

- [`_synthetic_room.py`](../apps/cv-service/tests/_synthetic_room.py),
  [`test_dimension_regression.py`](../apps/cv-service/tests/test_dimension_regression.py) —
  suite de non-régression CV-7, 2 nouveaux tests.
- [`contour_detector.py`](../apps/cv-service/app/services/contour_detector.py),
  [`dimension_calculator.py`](../apps/cv-service/app/services/dimension_calculator.py) — fixes
  ci-dessus (comportement de production inchangé, uniquement débloque la testabilité +
  corrige un vrai bug latent).
- [`ci.yml`](../.github/workflows/ci.yml) — dépendances minimales complétées.

## CV-6 — Boucle de ré-entraînement (LIVRÉE) (24 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic CV-B, CV-6 (effort XL, dépend de CV-1 et CV-2).
Objectif : pipeline périodique corrections (`cv_correction_logs`) + photos associées → dataset →
fine-tuning → éval → déploiement des poids. Première brique réelle du « learns from real projects ».

### Décision de conception

- **Périmètre honnête** : le seul modèle fine-tunable est le détecteur YOLO d'ouvertures
  (`door-window-yolov8n.pt`). Les dimensions sont géométriques (depth + calibration) — leurs
  corrections continuent d'alimenter l'incertitude empirique CV-2/CV-5, pas un modèle. CV-6 =
  fondations de capture (aujourd'hui inexistantes : bbox non persistées, corrections d'openings
  jamais loggées) + boucle complète sur le détecteur d'ouvertures.
- **Stockage** : aucune migration. `raw_output` enrichi (bbox par image, `openings_detail` avec
  provenance, flag `opening_detector`) transite tel quel par `analysis_jobs.result_json` ; les
  corrections d'openings vont dans `cv_correction_logs` existante (snapshots jsonb, valeurs objet
  ignorées par le rapport CV-2 qui ne lit que les numériques). État de la boucle sans fichier
  local : baseline = dernière release `cv-model-vN`, cutoff = asset `USER_DATASET_MANIFEST.json`
  de cette release (hors `SHA256SUMS` pour ne pas casser `fetch-model.sh` côté VPS).
- **Déclenchement** : cron sur la machine d'entraînement (précédent : crontab backups), l'API
  reste passive (endpoints admin d'export). Pas de scheduler/queue côté API (interdit avant
  saturation, PRODUCT_STRATEGY §6.2) ; l'entraînement ne peut pas tourner sur le VPS (CPU, 4 Go).
- **RGPD** : photos transitoires sur la machine d'entraînement, purgées en fin de cycle par
  `retrain.py` (`--keep-data` debug) ; la release ne contient que poids + métriques +
  `USER_DATASET_MANIFEST.json` (ids, aucune photo) ; dataset reconstruit à chaque cycle depuis
  la base vivante (droit à l'effacement via les CASCADE existants).

### Garde-fous d'éval anti-régression

1. **Gate volume** : < 20 nouvelles images labellisées depuis la dernière release → skip propre
   (exit 0) — écho du seuil `sufficient_data` de CV-2.
2. **Labels prudents** : une suppression d'opening n'est **jamais** convertie en négatif
   d'entraînement (l'utilisateur supprime souvent pour cadrer son chiffrage, et ne voit jamais la
   bbox) → image exclue du dataset + listée en triage humain. Validation implicite gated :
   `opening_detector == "yolo"` + confiance ≥ 0.5 + job ≥ 7 jours + projet engagé (≥ 1 correction
   toute catégorie). Ajouts manuels (`field='added'`) = report-only (pas de bbox).
3. **Critères absolus** (`evaluate.py`, existant) : mAP50 ≥ 0,65/classe, mAP50-95 ≥ 0,40,
   précision ≥ 0,6/classe @conf 0,3, sur le test public — exit 2 si FAIL.
4. **Non-régression comparative** (`compare_models.py`, nouveau) : candidat ≥ baseline − 0,02 sur
   mAP50 **par classe** (public) + mAP50-95 global ; sur user-val : candidat ≥ baseline, gate
   actif seulement si ≥ 30 images user-val (sinon bruit statistique).
5. **Smoke test** du chemin runtime réel (`smoke_test.py`).
6. **Release jamais automatique** : le cron s'arrête après les gates ; un humain inspecte
   `preview.jpg` (seul contrôle de localisation existant) puis relance `retrain.py --release`.
   Déploiement VPS = runbook DEPLOY.md inchangé. Déviation assumée vs « pipeline périodique » du
   backlog : la périodicité porte sur préparation + éval, pas sur la publication.

### Checklist

- [x] 1. Capture cv-service : `opening_merge.py` (extraction merge/group avec provenance) +
  `dimension_calculator.py` (raw_output enrichi, réponse API inchangée)
- [x] 2. API : `findOpeningForUser()` + logs corrections openings sur PUT/DELETE/POST
- [x] 3. API : export admin `GET /admin/cv-retraining/export` + `GET photo?path=` (AdminGuard)
- [x] 4. Training : `export_client.py`, `build_user_dataset.py`, `compare_models.py`,
  `retrain.py`, `release-model.sh` (asset optionnel), README § boucle CV-6
- [x] 5. Tests : Jest (openings/export/photos) + pytest CI-safe (sans torch) — ci.yml intact,
  tous les imports yaml/cv2/torch des nouveaux modules training sont lazy
- [x] 6. Docs : BACKLOG.md, API.md ; Review ici

### Livré

- **cv-service** : [opening_merge.py](../apps/cv-service/app/services/opening_merge.py)
  (extraction de `_merge_openings`/`_group_openings` avec conservation de la provenance des
  boîtes par image — équivalence prouvée par fuzz vs l'algorithme historique) ;
  `dimension_calculator.py` enrichit `raw_output` : `per_image[].openings` (bbox_xywh + conf),
  `openings_detail` (groupes + boxes contributrices), `opening_detector` (`yolo|heuristic|none`).
  Réponse API inchangée.
- **API — capture** : `ProjectsService.findOpeningForUser()` (factorise le bloc dupliqué de
  `updateOpening`/`removeOpening`) ; `ProjectsController` logge dans `cv_correction_logs`
  (snapshots jsonb `{opening_id, type, width_cm, height_cm, count, cv_confidence}`) : PUT
  opening cv → un log par champ modifié, DELETE → `removed` + `{deleted:true}`, POST manuel en
  room par défaut → `added` (report-only). Best-effort `.catch(() => {})`, pattern dimensions.
- **API — export** : `CvRetrainingService.buildExport()` (jobs COMPLETED avec bbox, corrections
  'opening' liées, compteurs d'engagement, pagination `next_since` sur la page brute) ;
  `CvRetrainingController` (`GET /admin/cv-retraining/export`, `GET photo?path=` — résolution
  par match DB exact, anti-traversal) ; `PhotosService.findByStorageUrl()`. Aucune migration.
- **Training** ([README § Boucle CV-6](../apps/cv-service/training/README.md)) :
  `export_client.py` (auth Firebase signInWithPassword, pagination, bundle transitoire) ;
  `build_user_dataset.py` (labels prudents, appariement strict, split temporel par projet,
  manifest + preview) ; `compare_models.py` (non-régression par classe ε=0,02 + gate user-val
  conditionnel) ; `retrain.py` (orchestrateur : baseline/cutoff via releases GitHub, gate
  volume, data.yaml combiné en listes ultralytics — `prepare_dataset.py` intact, purge RGPD,
  reprise `--release` sur verdict caché) ; `release-model.sh` accepte un 5ᵉ asset hors
  SHA256SUMS (`fetch-model.sh` intact).

### Vérification

- **API** : `test` (**276** tests, dont `findOpeningForUser`, `cv-retraining.service`,
  `findByStorageUrl`) ; `test:e2e` (**65**, dont corrections openings sur
  `projects.e2e-spec.ts` et `cv-retraining.e2e-spec.ts` — AdminGuard réel, 403 non-admin,
  404 sans résolution du paramètre brut) ; `lint`/`build` ✓.
- **cv-service** : `pytest` (**38** tests : équivalence merge/group par fuzz 200 cas +
  provenance ; sémantique labels — suppression → exclusion+triage jamais négatif, type flip,
  gates conf/appariement ; gates comparatifs) ; `compileall app training tests` ✓ ;
  `bash -n release-model.sh` ✓. CI intacte (aucun nouvel import module-level lourd).
- **Reste (hors périmètre, assumé)** : premier cycle réel bloqué par `cv-model-v1`
  (entraînement GPU, reliquat CV-1) ; annotation manuelle des `added` (futur outil) ; le
  rapport CV-2 ignore les valeurs objet des logs openings (par construction, seuls les
  numériques sont agrégés) ; une re-analyse écrase les openings cv corrigées (préexistant).

### Reste assumé (dès la conception)

- Annotation manuelle des détections manquées (`'added'`, sans bbox) : hors périmètre, les logs
  les comptabilisent pour un futur outil d'annotation.
- Premier run réel bloqué par la publication de `cv-model-v1` (reliquat CV-1 : entraînement GPU à
  exécuter) — la boucle est opérationnelle mais ne produira `cv-model-v2` qu'après v1 déployé +
  volume atteint ; d'ici là les détections heuristiques sont capturées mais filtrées du dataset.
- Une re-analyse écrase les openings CV corrigées (comportement produit préexistant, hors CV-6).

## CV-5 — Intervalles de confiance visibles (LIVRÉE) (22 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic CV-B, CV-5 (effort M, dépend de CV-2). Objectif :
afficher « 4,2 m ± 15 cm » plutôt qu'une valeur sèche pour les dimensions détectées par CV, avec
répercussion sur les quantités de matériaux (fourchette basse/haute) dans la liste d'achats.

### Décision de conception

Le backlog lie explicitement CV-5 à CV-2 (`CV-2 ──► CV-5`) : aucune donnée d'incertitude par
dimension n'existe côté `cv-service` (seul un score de confiance **global** 0-1 existe) — CV-5 ne
touche donc pas le service Python, conformément au sens de la dépendance et aux notes de CV-3/CV-4
qui punt déjà les intervalles de confiance sur CV-5 sans jamais évoquer le modèle CV.

- **Source de l'incertitude** (par champ `length_cm`/`width_cm`/`height_cm`) : écart médian
  empirique de `CvAccuracyService.getReport()` (CV-2) si `sufficient_data`, sinon repli
  heuristique par `confidence_score` (HIGH=±2cm, MEDIUM=±8cm, LOW=±20cm,
  [dimension-uncertainty.ts](../apps/api/src/analysis/dimension-uncertainty.ts)). `null` pour
  toute dimension `source !== 'cv'` (pas de modèle d'erreur pour la saisie manuelle).
- **Snapshot à l'écriture, pas de recalcul à la lecture** : calculée une seule fois dans
  `AnalysisService.processAnalysis()` (même module qu'`CvAccuracyService`, aucune nouvelle arête
  inter-modules) et persistée sur `room_dimensions` (3 nouvelles colonnes nullable), comme
  `confidence_score`/`source` le sont déjà. Une sauvegarde manuelle (`PUT /dimensions` sans source
  CV) remet l'incertitude à `null`.
- **Propagation vers la surface = bornes pire-cas** : `EstimationEngine.computeSurfaceBounds`
  réutilise `computeSurface` sur des `RoomData` clonés à `∓Δ` (bornés à ≥ 0) plutôt qu'une
  propagation d'erreur statistique formelle — toutes les formules de surface étant monotones en
  chaque dimension, les extrêmes sont exacts. Limite assumée : sur une pièce composite (segments
  ENG-1), `length_cm`/`width_cm` ne pilotent plus `computeSurface` → fourchette de largeur nulle
  en sol/plafond, seule la hauteur continue de produire une fourchette murale.
- **Champs optionnels partout en aval** (même convention que `excluded_surface_m2?`) : anciennes
  lignes jsonb sans ces champs → aucune fourchette affichée, pas de migration de données.
- **Affichage** : panneau d'analyse CV (`AnalysisResultPanel`) et formulaire de dimensions
  persistant (`DimensionsForm`, badge `± X cm` sous chaque champ métrique quand `source='cv'`) ;
  fourchette `units_needed` dans la liste d'achats (`ShoppingListMaterials`), masquée dès qu'une
  correction manuelle a été appliquée.

### Livré

- **API** : migration `1711468800034-AddUncertaintyToRoomDimensions` (3 colonnes nullable sur
  `room_dimensions`) ; `dimension-uncertainty.ts` (résolution empirique/heuristique) ;
  `AnalysisService` (calcul + persistance à l'écriture, fusion dans `getJobStatus`) ;
  `ProjectsService.updateDimensions`/`ProjectsController` (persist/clear, exposé sur
  `GET/PUT /dimensions` et `GET /rooms`) ; `EstimationEngine.computeSurfaceBounds` +
  `computeEstimation`/`aggregatePurchases` (fourchette surface/qty/units) ;
  `ShoppingListMaterialItem`/`shopping-lists.service.generate` (passthrough `units_needed_low/high`
  sur les 2 chemins ENG-2/legacy).
- **Web** : `format-dimension.ts` (formatage fr-FR « X,XX m ± Y cm ») ; types (`room-types.ts`,
  `estimation-types.ts`, `shopping-list-types.ts`) ; `useAnalysis`/`dimensions/page.tsx`/
  `AnalysisResultPanel` ; `DimensionsForm` (badge `± X cm`, mode métrique uniquement) ;
  `ShoppingListMaterials` (fourchette `units_needed`).

### Vérification

- **API** : nouveaux tests `dimension-uncertainty.spec.ts`, `analysis.service.spec.ts` (1ʳᵉ suite
  sur ce service), extensions `estimation-engine.spec.ts`/`projects.service.spec.ts`/
  `estimations.service.spec.ts`/`shopping-lists.service.spec.ts`. `lint`/`build`/`test`
  (**265** tests)/`test:e2e` (**55**) ✓.
- **Web** : nouveaux tests `format-dimension.spec.ts`, `AnalysisResultPanel.spec.tsx`,
  `ShoppingListMaterials.spec.tsx`, extension `DimensionsForm.spec.tsx`. `lint`/`tsc`/`test`
  (**188** tests)/`build` ✓.
- **Migration** : up→down→up testé via psql sur base jetable `chiffreo_cv5_test` (runner ts-node
  cassé sur ce poste, cf. [[migration-runner-tsnode-broken]]), avec insertion réelle d'une ligne
  `length_cm_uncertainty/width_cm_uncertainty/height_cm_uncertainty` pour vérifier le round-trip
  des données. Base dev `chiffreo` intacte. Note hors périmètre : la base dev locale de ce poste
  s'est révélée en retard sur plusieurs migrations déjà mergées (`rooms`, `segments_json`,
  `exclusions_json` absents) — dérive d'environnement préexistante, sans rapport avec cette
  migration (ADD/DROP COLUMN pur, sans dépendance au reste du schéma).
- **Reste (hors périmètre, assumé)** : `cv-service` non touché (aucune donnée d'incertitude par
  dimension n'y existe, cf. décision de conception) ; fourchette non affichée sur l'écran
  d'estimation intermédiaire (`EstimationResults`, seule la liste d'achats l'affiche, libellé
  backlog exact) ; pas d'incertitude sur les ouvertures (`cv_correction_logs` ne journalise jamais
  `entity_type='opening'`) ; mode impérial du formulaire de dimensions sans badge.

## CV-4 — Guidage de prise de vue (LIVRÉE) (22 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic CV-B, CV-4 (effort M). Objectif : écran de
conseils **avant** capture (angles, recul, lumière, porte visible) + rejet des photos
inexploitables avec explication. Ferme le « reste » explicitement laissé ouvert par CV-3
(cf. section suivante, « Reste (hors périmètre, assumé) ») : le guidage y était limité au
prompt réactif `no_reference`, sans écran proactif ni aucun rejet qualité au-delà du
format/de la taille de fichier.

### Décision de conception

Deux volets indépendants, aucun ne touche cv-service/le modèle :

- **Écran de conseils** : purement frontend. Plutôt qu'un simple texte statique (l'existant
  avant cette passe), un **gate bloquant** — l'écran remplace la zone de dépôt tant qu'il
  n'a pas été validé, sur un projet sans aucune photo. Une fois validé (ou si des photos
  existent déjà, ex. reprise d'un projet), il cède la place à un rappel compact + la zone
  de dépôt habituelle. État local (`useState`, non persisté) : aucune autre page/composant
  ne consomme cet état (vérifié), donc pas de remontée au niveau page ni de `localStorage` —
  le gate réapparaît naturellement sur un projet vraiment vierge, jamais sur un projet déjà
  entamé.
- **Rejet des photos inexploitables** : **côté serveur** (`PhotosService`, via `sharp`,
  déjà une dépendance du projet pour le sniffing de format et les vignettes), pas côté
  navigateur. Un pré-check navigateur (`createImageBitmap`/canvas) aurait le même trou de
  décodage HEIC que `browser-image-compression` sur Chrome/Firefox (cf.
  `usePhotoUpload.compressFile`, déjà tolérant à cet échec) — deux chemins de validation
  incohérents (le serveur voit tout, le client seulement JPEG/PNG) auraient été pires qu'un
  seul chemin serveur uniforme. Trois signaux, tous dérivés de `sharp(buffer)` :
  - **Résolution** : `metadata().width/height` (déjà récupéré une fois pour le sniff de
    format — l'extraction anticipait une double décodification) ; rejette si le plus petit
    côté < 480 px (proxy du « reculez-vous », la distance réelle n'étant pas mesurable sans
    modèle).
  - **Luminosité** : `sharp(buffer).greyscale().stats().channels[0].mean` (le `.greyscale()`
    est nécessaire — sans lui, `channels[0]` est le canal rouge, pas la luminance) ; rejette
    hors de [40, 235].
  - **Flou** : `stats().sharpness` — métrique de netteté (Laplacien) native de libvips,
    documentée « expérimentale » par sharp (à réétalonner si `sharp` monte de version).
    Seuil **0,15**, calibré empiriquement (script Node contre `sharp@0.34.5` réellement
    installé) : un mur uni net avec bruit capteur réaliste donne ~0,6-3,0 ; le même mur flou
    (rayon 2-3, flou visible) tombe à ~0,09-0,13. Seuil volontairement conservateur pour ne
    jamais rejeter à tort une photo de mur uni net (cas dominant de cet usage), en ne
    capturant que le flou réellement inexploitable.
  Le calcul luminosité/flou est encapsulé dans son propre `try/catch` : en cas d'échec sharp
  inattendu, on **journalise et laisse passer** (fail-open, même philosophie que
  `generateThumbnail` déjà en best-effort) plutôt que de renvoyer une 500. Chaque rejet est
  un `BadRequestException` avec message FR **sans accents**, pour matcher la convention déjà
  en place dans ce fichier (`'Format non supporte'`, `'Acces interdit'` — ASCII, contrairement
  au reste du repo qui est mixte). Aucune DTO/migration/champ de réponse nouveau : le message
  transite déjà tel quel via `apiUpload` → `ApiError.message` → l'overlay d'erreur existant
  de `PhotoUploadItem`.
  Seuils routés via `ConfigService` (`storage.minPhotoDimensionPx/minPhotoBrightness/
  maxPhotoBrightness/minPhotoSharpness`), même convention que `thumbnailWidth`/
  `allowedMimeTypes` (valeurs par défaut en dur, indirection uniquement pour la
  testabilité — pas de vraie variable d'env aujourd'hui dans ce fichier).
- **Effet de bord corrigé** : `usePhotoUpload.uploadSingleFile` réessayait aveuglément
  **toute** erreur jusqu'à `MAX_RETRIES` avant affichage — sans conséquence jusqu'ici
  (les seules erreurs qui atteignaient ce code étaient réseau ; les rejets format/taille
  sont filtrés plus tôt dans `addFiles` et n'appellent jamais `uploadSingleFile`). Le
  nouveau rejet serveur est le premier rejet **déterministe** à emprunter ce chemin : sans
  correction, il aurait réessayé 3 fois le même fichier condamné avant d'afficher enfin
  l'explication. Correction : `isRetryableUploadError` ne réessaie que sur une vraie panne
  transitoire (`code === 'NETWORK_ERROR'`, réutilise `errorHasCode` de `lib/errors.ts`) ou
  une 5xx (`details.statusCode >= 500`, présent sur toute réponse du filtre d'exception
  global) — jamais sur un rejet 4xx déterministe. Corrige au passage le même gaspillage
  latent sur le bouton « Réessayer » d'un rejet format/taille préexistant.

### Livré

- **API** ([photos.service.ts](../apps/api/src/photos/photos.service.ts)) : extraction
  `readImageMetadata`/`resolveMimeType` (un seul décodage de métadonnées, réutilisé par le
  check format existant et le nouveau check résolution) ; nouveau `assessImageQuality`
  (résolution/luminosité/flou, fail-open sur erreur sharp inattendue) ; 4 seuils ajoutés à
  [configuration.ts](../apps/api/src/config/configuration.ts).
- **Web** :
  [PhotoCaptureGuidance.tsx](../apps/web/src/components/photos/PhotoCaptureGuidance.tsx)
  (nouveau, écran de conseils + `CAPTURE_TIPS` partagé) câblé dans
  [PhotoUploadPanel.tsx](../apps/web/src/components/photos/PhotoUploadPanel.tsx) (gate sur
  `photos.length === 0 && !guideAcknowledged`) ;
  [usePhotoUpload.ts](../apps/web/src/hooks/usePhotoUpload.ts) : `isRetryableUploadError`.

### Vérification

- **API** : `photos.service.spec.ts` étendu (mock `sharp` enrichi de `greyscale`/`stats`,
  seuils par défaut passants pour ne casser aucun test existant) + 5 nouveaux tests (chaque
  motif de rejet + fail-open sur erreur sharp). `lint`/`build`/`test`/`test:e2e` ✓.
- **Web** : nouveaux tests `PhotoCaptureGuidance.spec.tsx`, 2 tests de gate ajoutés à
  `PhotoUploadPanel.spec.tsx`, nouveau `usePhotoUpload.spec.ts` (1ʳᵉ suite de test sur un
  hook dans ce repo — `renderHook`/`act` de `@testing-library/react` v16, mock `@/lib/api`
  sans `requireActual` pour éviter la chaîne d'import Firebase incompatible jsdom, cf. le
  mock déjà utilisé par `PublicCalculator.spec.tsx`). `lint`/`test`/`build` ✓.
- **cv-service** : non touché (aucun fichier Python modifié) — le job CI correspondant n'a
  pas été relancé, sans objet.

### Reste (hors périmètre, assumé)

- Aucune vérification automatique des angles/de la visibilité de la porte : nécessiterait de
  faire tourner le détecteur, donc de toucher au modèle — explicitement hors périmètre CV-4.
- Aucune couverture e2e des routes photos (aucune n'existait avant cette passe non plus —
  lacune préexistante, pas introduite ici ; même arbitrage que les routes hors périmètre
  d'ENG-4).
- Pas de pré-check côté navigateur (cf. décision de conception ci-dessus).
- Correction de perspective/homographie fine, intervalles de confiance visibles = territoire
  CV-5/CV-6.

## CV-3 — Calibration par objet étalon universel (LIVRÉE) (22 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic CV-B, CV-3 (effort L). Objectif : débloquer
l'analyse photo **sans porte visible** en laissant l'utilisateur poser un **étalon universel**
(feuille A4 ou carte bancaire) au mur, guidé par l'UI. Touche cv-service + UI de capture.

### Constat (avant)

La calibration d'échelle dépendait **exclusivement** d'une porte (~204 cm) :
`px_per_cm = ref_height_px / 204` dans
[dimension_calculator.py](../apps/cv-service/app/services/dimension_calculator.py). Le schéma
`ReferenceObject{type, height_cm}` existait mais était un **leurre** — quel que soit `type`, le
pipeline appelait toujours `detect_door()`. L'API NestJS n'envoyait **jamais** de
`reference_object` et `POST /:id/analyze` ne prenait aucun body. Sur `no_reference`, l'UI ne
proposait que « reprendre une photo avec porte » ou la saisie manuelle.

### Décision de conception

La **géométrie** de la pièce (largeur/longueur/hauteur via depth + contours) est **inchangée** ;
seule la **source de l'échelle** devient l'étalon. `DetectedReference` porte désormais un champ
`px_per_cm` (source unique de l'échelle, calculée par le détecteur qui seul connaît la géométrie
du marqueur) → `_calculate_dimensions` consomme `px_per_cm` directement (fin du recalcul interne
`ref_height_px/ref_height_cm`). Étalons (dimensions réelles = source de vérité) : **A4** 29,7×21,0 cm,
**carte bancaire** ISO/IEC 7810 ID-1 8,56×5,398 cm. Un **gate d'aspect dur** (`MARKER_ASPECT_TOL=0.06`)
rejette ce qui n'est pas le marqueur (une porte ≈ 0,44, une fenêtre…) **avant** de faire confiance à
son échelle → un shot trop biaisé retombe en `no_reference` plutôt que sur une échelle silencieusement
fausse. `reference_type` de la réponse devient **dynamique** (door/a4/card) au lieu de `"door"` en dur.

### Livré

- **CV** ([reference_detector.py](../apps/cv-service/app/services/reference_detector.py)) : champ
  `px_per_cm` sur `DetectedReference` ; `detect_door(height_cm=…)` (hauteur custom) ; nouveau
  `detect_marker(image, ref_type)` (quad convexe → côtés opposés → `px_per_cm = ½(long_px/long_cm +
  short_px/short_cm)`) ; dispatcher `detect(image, depth, reference_object)` (door par défaut, marqueur
  si `type∈{a4,card}`). [dimension_calculator.py](../apps/cv-service/app/services/dimension_calculator.py) :
  appel unifié `detect()`, `reference_type` propagé (PerImageResult + raw_output + réponse).
  [schemas.py](../apps/cv-service/app/models/schemas.py) : `type: Literal["door","a4","card"]` + bornes.
- **API** : nouveau [start-analysis-request.dto.ts](../apps/api/src/analysis/dto/start-analysis-request.dto.ts)
  (`reference_object?` validé, `@ValidateNested`) ; `AnalysisController.startAnalysis(@Body())` +
  `AnalysisService.startAnalysis/processAnalysis(referenceObject?)` → `cvClient.analyze`. Rétro-compat :
  body absent → auto-détection porte (comportement actuel). `CvAnalysisRequest.reference_object.height_cm`
  passé optionnel (markers keyés par type).
- **Web** : `useAnalysis.startAnalysis(referenceObject?)` (POST du body) ;
  [ReferenceObjectPrompt.tsx](../apps/web/src/components/analysis/ReferenceObjectPrompt.tsx) enrichi
  (sélecteur A4 / Carte bancaire + consignes de pose + « Relancer avec cet étalon ») ;
  `dimensions/page.tsx` câble `handleRetryWithReference(type)`. `AnalyzeButton` : `onClick={() => onStart()}`
  (évite que le `MouseEvent` parte en `reference_object`).

### Vérification (exigence : « tests CV + build »)

- **CV** (nouveau — 1ʳᵉ suite pytest du service, cf. CV-7) :
  [tests/test_reference_detector.py](../apps/cv-service/tests/test_reference_detector.py) **8 tests**
  (images synthétiques en mémoire, cv2/numpy sans torch) : porte + `px_per_cm`, hauteur custom,
  A4/card `px_per_cm` corrects, marqueur absent → `None`, dispatch par type, **porte jamais prise pour
  un marqueur**. `requirements-dev.txt` (pytest) + étape CI (`pytest tests`) ajoutée au job `cv-service`
  de [ci.yml](../.github/workflows/ci.yml). `python -m compileall app training tests` ✓.
- **API** : `lint` ✓, `nest build` ✓, `test` **234** ✓ (+3 `analysis.controller.spec` passthrough),
  `test:e2e` **55** ✓.
- **Web** : `lint` ✓ (1 warning `<img>` préexistant), `test` **168** ✓ (+5 `ReferenceObjectPrompt`),
  `next build` ✓.

### Reste (hors périmètre, assumé)

- Écran de conseils **avant** capture + rejet des photos inexploitables = **CV-4** (ici : guidage
  limité au prompt `no_reference`). Correction de perspective/homographie fine du marqueur (échelle
  plane au mur, même hypothèse que la porte) = territoire CV-5/CV-6. Multi-marqueurs par image, étalon
  en mode invité (funnel mono-pièce).

## ENG-5 — Étalonnage du catalogue (LIVRÉE) (20 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) ENG-5 (P?, effort M). Objectif : vérifier rendements
(`yield_per_unit`) et facteurs de perte (`factor_percent`) seedés en
[1711468800006](../apps/api/src/migrations/1711468800006-SeedMaterialsCatalog.ts) contre les fiches
techniques fabricants (recherche web), signaler les écarts, ne corriger qu'après validation du
porteur. Le plan/tableau complet source→seedé→recommandé est dans le fichier de plan de la session.

### Sémantique & périmètre

Le moteur fait `qty = surface_m2 / yield_per_unit` (× couches pour la peinture) puis
`× (1 + factor_percent/100)` ([estimation-engine.ts](../apps/api/src/estimations/estimation-engine.ts)).
Donc `yield_per_unit` = **surface couverte par unité** ; un yield trop haut ⇒ **sous-achat** (casse
la promesse), trop bas ⇒ sur-achat. Point clé :
[estimations.service.loadMaterialInputs](../apps/api/src/estimations/estimations.service.ts) charge
**tous** les matériaux actifs d'une catégorie et les attache à chaque work item → chaque yield
produit une ligne d'achat réelle.

### Écarts corrigés (24 matériaux, `yield_per_unit` uniquement — `factor_percent` inchangés)

- **🔴 Sous-achats critiques** : plaques BA (BA13 std/hydro/feu, BA10, BA18, phonique) `3 → 1`
  (le conditionnement valait déjà 3 m²/plaque ⇒ double division ⇒ ~3× trop peu) ; mortiers-colles
  C1 `5→0,25`, C2 `4→0,22`, C2F `4→0,25`, C2S1 `3,5→0,15`, colle en pâte `3→0,4` (réel 3,5–8 kg/m²
  vs ~0,2–0,3 seedé) ; ragréages (autolissant/fibré/ext.) `1,5→0,2` (1,5 kg/m²/mm × ~3 mm) ;
  SEL `1,5→0,7` (1,4 L/m² en 2 couches).
- **🟠 Sur-achats** : colles papier peint (intissé/vinyle/universelle/renforcée) `4–5 → 30`
  (poudre ~10 g/m² réel) ; joint fin `1→2,5` ; colle vinyle `1,5→3`.
- **🟡 Mineurs** : enduit de lissage `1,5→0,8` ; colle parquet `1,2→0,9` ; joint large `0,5→1`.

**Conforme, non touché** : peintures (6–12 m²/L, dans la fourchette fabricant), revêtements en m²
(carrelages/sols/papiers peints/lambris/isolants à `yield=1`), **tous les `factor_percent`**
(carrelage droit 5–10 % / diagonal 10–15 %, parquet 5–15 %, papier peint 10–18 %, placo ~8–12 % —
conformes DTU/usage, débutant volontairement conservateur), enduits à joint placo, primaires. Non
calibrables : enduit de rebouchage & joint époxy (dépend localisation/format — limitation notée),
accessoires (`unit`, yield=1).

### Livré

- **Seed** [1711468800006](../apps/api/src/migrations/1711468800006-SeedMaterialsCatalog.ts) :
  24 `yield_per_unit` recalibrés (source de vérité, installs neuves / CI).
- **Migration** [1711468800033-RecalibrateCatalogYields](../apps/api/src/migrations/1711468800033-RecalibrateCatalogYields.ts) :
  `UPDATE` idempotents pour les bases **déjà seedées**, pilotés par une table `{name, category,
  old, new}` unique (up = old→new, down = new→old). Prédicat `AND yield_per_unit = <old>` ⇒ UP
  rejouable et n'écrase pas une valeur déjà retouchée en admin ; `modified_by/at` non touchés
  (correction de seed, pas édition admin).

### Vérification

- **Tests moteur inchangés au vert** (exigence ENG-5) : seule la donnée bouge →
  `estimation-engine.spec` **52/52** identique à la baseline. Suite API **231** ✓, e2e **55** ✓,
  `nest build` ✓, `eslint` ✓. Aucun test ne dépendait des valeurs seedées (fixtures inline).
- **Migration** up→down→up + double-UP testée via **psql sur base jetable** `chiffreo_eng5_test`
  (runner ts-node cassé sur ce poste, cf. [[migration-runner-tsnode-broken]]) : 24 lignes bougent à
  l'UP, reviennent au DOWN, 3ᵉ UP affecte **0 ligne** (idempotence), témoin hors périmètre
  (`Peinture acrylique mate`) jamais modifié. Base dev `chiffreo` intacte.
- **Reste (hors périmètre)** : rendre la conso. dépendante de l'épaisseur (ragréage/enduit) ou du
  format de carreau (joint) — le moteur ne prend qu'un yield scalaire, épaisseur/pose nominale
  documentée. Débloque DATA-3 (facteurs de perte appris depuis les écarts réels).

## ENG-4 — Tests E2E du parcours critique (LIVRÉE) (20 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic ENG-A. Objectif : protéger par des tests E2E API le parcours **projet → dimensions → estimation → liste d'achats**. Jusqu'ici seuls `auth`/`projects` avaient une couverture E2E : `EstimationsController` et `ShoppingListsController` — qui portent les fonctionnalités les plus récentes et les plus risquées (mutualisation multi-pièces ENG-2, pièces composites ENG-1, exclusions ENG-3, cf. sections ci-dessous) — n'en avaient aucune. La CI n'exécutait par ailleurs jamais la suite E2E existante (seulement les tests unitaires).

### Décision de conception

Les E2E de ce repo ne sont pas des tests full-stack sur vraie DB (confirmé : `test/jest-e2e.json` ne bootstrap aucune DB ; les specs existants mockent entièrement les services et overrident `FirebaseAuthGuard`) — convention conservée à l'identique plutôt que d'introduire un premier test réel-DB (disproportionné pour un item M, aucun précédent dans le repo). 4 fichiers (3 nouveaux + 1 amendé), sans nouvelle fixture partagée (aucun précédent ; chaque spec garde ses mocks inline, comme `auth.e2e-spec.ts`/`projects.e2e-spec.ts`) :

- `estimations.e2e-spec.ts` / `shopping-lists.e2e-spec.ts` : contrat HTTP de chaque contrôleur isolé (services mockés statiquement), même structure que `projects.e2e-spec.ts`.
- `critical-path.e2e-spec.ts` : le test de **parcours** proprement dit — un seul `TestingModule` avec les 3 contrôleurs (`Projects`/`Estimations`/`ShoppingLists`) et des mocks **stateful** (`jest.fn().mockImplementation` fermant sur un état minimal : dimensions posées ? work item ajouté ? estimation générée ?) qui rejouent les mêmes garde-fous 400/404 que les vrais services, sans réimplémenter la géométrie/l'agrégation (déjà couvertes par `estimation-engine.spec.ts`/`estimations.service.spec.ts`/`shopping-lists.service.spec.ts`) — évite un test dupliqué à faible valeur. Un cas dédié vérifie que `room_count` (mutualisation ENG-2) traverse le contrôleur/DTO sans altération plutôt que de rejouer l'agrégation.
- `projects.e2e-spec.ts` amendé : `POST /projects/:id/work-items` n'avait aucune couverture bien qu'il soit un prérequis direct de l'estimation (une pièce sans work item bloque `POST /estimate`).
- **Hors périmètre** (arbitrage) : routes `budget-summary` (feature Pro distincte, gate `FeatureGateGuard`/`RequireFeature('budget_tracking')`, pas dans le parcours décrit par ENG-4).

### Livré

- **Backend** : `apps/api/test/estimations.e2e-spec.ts` (11 tests), `apps/api/test/shopping-lists.e2e-spec.ts` (11 tests), `apps/api/test/critical-path.e2e-spec.ts` (5 tests : parcours nominal, 3 cas limites 400/404, mutualisation `room_count`), `apps/api/test/projects.e2e-spec.ts` (+4 tests `work-items`).
- **CI** : `.github/workflows/ci.yml` — le job `api` exécute désormais `pnpm --filter @chiffreo/api test:e2e` après `test` (jusqu'ici jamais lancé en continu, seulement en local avant livraison des tâches précédentes).

### Vérification

- Backend : `pnpm --filter @chiffreo/api test:e2e` (6 suites/55 tests, +31), `test` (19 suites/231 tests), `build`, `lint` → tous verts.

## ENG-3 — Surfaces à exclure (LIVRÉE) (20 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) Epic ENG-A. Objectif : déduction manuelle simple d'une aire (crédence, demi-mur, plinthes…) par pièce, répercutée sur la surface nette puis les quantités de matériaux.

### Décision de conception

`exclusions_json` en JSONB sur `room_dimensions` (comme `segments_json`, ENG-1) plutôt qu'une entité + CRUD dédiés (comme `openings`) : ces zones n'ont ni provenance CV ni besoin d'édition individuelle hors du formulaire dimensions — elles se déclarent et se remplacent en bloc à chaque sauvegarde. `surface_target` (`wall|floor|ceiling`) reste générique au niveau modèle/moteur, mais l'UI v1 n'expose que les exclusions murales (crédence/demi-mur/plinthes sont des cas muraux en pratique).

### Livré

- **Backend** : migration `1711468800032-AddExclusionsToRoomDimensions` (testée up/down/up via psql sur base jetable, cf. [[migration-runner-tsnode-broken]]) ; `RoomExclusionDto` + `ProjectsService.updateDimensions` ; exposé aux 5 mêmes endroits que `segments` dans `ProjectsController`. Moteur (`EstimationEngine.computeSurface`) déduit les exclusions après les ouvertures (mur) ou directement (sol/plafond), clampé à 0 ; `excluded_surface_m2` ajouté à `EstimationLineItem` (uniquement si > 0).
- **Frontend** : `ExclusionsSection.tsx` (calqué sur `OpeningsSection.tsx`, 4 boutons rapides Crédence/Demi-mur/Plinthes/Autre, saisie directe en m²) intégré à `DimensionsForm.tsx` (nouvelle ligne « Zones exclues » dans le récap mur) ; partagé avec l'invité mono-pièce via `localStorage`, comme `segments`/`openings`. `EstimationResults.tsx`/`WorkTypeSection.tsx` affichent « (dont X m² exclus) » quand applicable.
- **Hors périmètre** (arbitrage, cf. plan) : calculateurs publics `/calculateurs` non touchés (lead-magnet volontairement minimal, même arbitrage que ENG-2).

### Vérification

Tests ajoutés : `estimation-engine.spec.ts` (cumul ouverture+exclusion, clamp à 0, sol/plafond), `estimations.service.spec.ts`, `projects.service.spec.ts` (persist/clear `exclusions_json`), `surface.spec.ts`, `ExclusionsSection.spec.tsx`, `DimensionsForm.spec.tsx`, `EstimationResults.spec.tsx`. `shopping-lists.service.ts` non modifié (ne connaît que `surface_m2` déjà net) — suite existante rejouée sans régression plutôt qu'un test dédié à faible valeur.

- Backend : `pnpm --filter @chiffreo/api test` (19 suites/231 tests), `build`, `lint` → tous verts.
- Web : `pnpm --filter @chiffreo/web test` (19 suites/163 tests), `build`, `lint` → tous verts.
- Migration : up→down→up testé via psql sur `chiffreo_mig_test` (clone du schéma dev), avec insertion réelle d'une ligne `exclusions_json` pour vérifier le round-trip des données.

## ENG-2 Phase 2 — UI multi-pièces (LIVRÉE) (20 juillet 2026)

Réf : suite de la Phase 1 (backend, ci-dessous). Objectif : permettre à l'utilisateur connecté de **gérer N pièces** dans un projet (ajouter / renommer / supprimer / basculer), chaque pièce ayant sa géométrie et ses travaux. L'estimation et la liste d'achats agrégeaient déjà (Phase 1) — cette passe expose les pièces dans le wizard. Arbitrages validés : **sélecteur inline** + **invité mono-pièce**.

### Constat (état actuel)

- Le wizard `dimensions → work-selection → estimate → shopping-list` opère **implicitement sur la pièce par défaut** (endpoints projet `/dimensions`, `/openings`, `/work-items` → shim Phase 1). Aucune notion de pièce côté web.
- Aucun endpoint de **CRUD pièces**. Les méthodes service géométriques ciblent la pièce par défaut en interne.
- Mode **invité** = mono-pièce à plat en `localStorage` (`chiffreo_local_projects` : `length_m/width_m/height_m/openings/segments/work_items`).

### Périmètre Phase 2 (arbitrages proposés)

- **Connecté seulement** : le multi-pièces est réservé aux comptes. L'**invité reste mono-pièce** (funnel lead-magnet ; restructurer le localStorage + `PublicCalculator` serait disproportionné). Le sélecteur de pièces n'apparaît pas en invité.
- **Présentation** : sélecteur de pièces **en tête des étapes dimensions & work-selection** (pills « Salon · Chambre · + Ajouter »), pièce active portée par l'URL `?room=<roomId>`. (Alternative : page hub `/projects/:id/rooms` dédiée — à trancher.)
- **Photos par pièce** : hors périmètre (restent projet, CV → pièce par défaut) — Phase 3.

### Backend (surface minimale)

- `projects.service` : méthodes géométriques (`updateDimensions/getDimensions/addOpening/getOpenings/saveWorkItems/getWorkItems/removeCvOpenings`) gagnent un `roomId?` optionnel (absent → pièce par défaut, **rétro-compat stricte**, tests Phase 1 inchangés) ; validation « la pièce appartient au projet ». `updateOpening/removeOpening` valident déjà via la pièce (multi-pièces OK).
- CRUD pièces : `createRoom(name)`, `renameRoom(roomId, {name?, sort_order?})`, `deleteRoom(roomId)` (garde-fou : **≥ 1 pièce** ; refuse la suppression de la dernière).
- Controller (`ProjectsController`, réutilise les mappers de réponse) :
  - `GET /projects/:id/rooms` (liste : pièces + dimensions + ouvertures + work items pour l'UI)
  - `POST /projects/:id/rooms` · `PATCH /projects/:id/rooms/:roomId` · `DELETE /projects/:id/rooms/:roomId`
  - `?room=<roomId>` (optionnel) sur les routes `/dimensions`, `/openings`, `/work-items` existantes → cible cette pièce ; absent → pièce par défaut (web actuel + PDF/partage inchangés).

### Web

- `RoomSwitcher.tsx` (nouveau) : pills des pièces + « Ajouter une pièce » + menu renommer/supprimer ; masqué en invité.
- `dimensions/page.tsx` & `work-selection/page.tsx` : chargent la liste des pièces, gèrent `?room=` (défaut = 1re pièce), chargent/sauvent la pièce sélectionnée (`?room=` sur les appels), affichent le `RoomSwitcher`. Navigation « suivant » conserve `?room=`.
- `estimate/page.tsx` : badge « N pièces » (léger ; la répartition par pièce détaillée = plus tard). `project-types.ts` : type `Room`.

### Tâches

- [x] `projects.service` : `roomId?` sur les méthodes géométriques + `createRoom/renameRoom/deleteRoom` + validation d'appartenance (résolveurs `resolveRoomForWrite/Read`)
- [x] DTOs : `CreateRoomDto` / `UpdateRoomDto` (param `?room=` validé par `ParseUUIDPipe({ optional: true })`)
- [x] `projects.controller` : routes CRUD pièces + param `?room=` sur dimensions/openings/work-items + mapper `mapRoom`
- [x] Web : `RoomSwitcher` + intégration dimensions/work-selection + `lib/room-types.ts`
- [x] Tests : service (roomId ciblé, garde-fou dernière pièce, appartenance), controller e2e (CRUD pièces), web (`RoomSwitcher`)
- [x] Vérifier : API lint/build/test/e2e + web tsc/lint/test/build

### Review (Phase 2)

- **Rétro-compatibilité par paramètre optionnel** : les 6 méthodes géométriques du service gagnent un `roomId?` en **dernier** argument ; absent → pièce par défaut (`resolveRoomForWrite/Read`), présent → pièce validée (appartenance au projet, sinon `NotFoundException`). Les appelants existants (contrôleur mono-pièce, `analysis.service` CV) sont inchangés — **aucun test Phase 1 touché**, les 3 routes `/dimensions|/openings|/work-items` restent valides sans `?room=` (PDF/partage/CV OK).
- **Surface API minimale** : 4 routes pièces (`GET/POST /:id/rooms`, `PATCH/DELETE /:id/rooms/:roomId`) + un `?room=` optionnel sur l'existant, plutôt qu'une arbo REST parallèle complète — moins de code, un seul mapper `mapRoom`. `DELETE` gardé par « ≥ 1 pièce » (400 sur la dernière), toutes les écritures par `ensureProjectWritable` (free-tier).
- **Sélecteur inline, pièce active dans l'URL (`?room=`)** : `RoomSwitcher` (pills + ajout + renommage inline + suppression avec confirmation inline) en tête des étapes dimensions & work-selection. L'URL porte l'état → back/forward et navigation « suivant » cohérents. Callbacks CRUD **optionnels** → work-selection l'utilise en **sélection seule** (le CRUD vit à l'étape dimensions).
- **Seed idempotent par pièce** : garde `seededRoomIdRef` → le formulaire se ré-amorce **une fois par pièce sélectionnée** (remontage via `key={activeRoomId}`), jamais lors d'un renommage (qui change `rooms` mais pas l'id actif) — pas de perte de saisie. Le renommage fusionne le nom côté client (la réponse `PATCH` ne recharge pas la géométrie) → pas d'écrasement des dimensions affichées.
- **CV borné à la pièce par défaut** : l'analyse photo (photos = niveau projet) reste sur la 1re pièce (`isDefaultRoom`) pour éviter d'écrire les dimensions CV dans la mauvaise pièce. Photos par pièce = Phase 3.
- **Invité inchangé** : le mode invité (localStorage à plat) reste mono-pièce, sans sélecteur — le multi-pièces devient une raison de créer un compte.
- **Vérifications** : API lint/build ✓, **222** tests unitaires ✓ (+11 : CRUD pièces, garde-fou, ciblage roomId), **23** e2e ✓ (+5 : routes pièces, dont 400 sur dernière pièce et 201/204). Web `tsc` ✓, **145** tests ✓ (+6 `RoomSwitcher`), `eslint` ✓ (1 warning `<img>` préexistant), `next build` ✓.
- **Reste (Phase 3)** : photos/CV par pièce, répartition par pièce détaillée sur l'écran d'estimation (badge « N pièces » déjà visible sur la liste via `room_count`), multi-pièces en mode invité, débloque PLAT-1 (carnet du logement par pièce).

## ENG-2 — Multi-pièces par projet (PHASE 1 BACKEND LIVRÉE) (19 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) ENG-2 (P1, effort XL). Dépend de ENG-1 (livré). Prérequis de PLAT-1 (carnet du logement). Plan validé par le porteur (2 arbitrages : **work items par pièce** + **backend d'abord, UI en Phase 2**). Phase 1 (entités + moteur + liste + migration + tests) livrée ci-dessous ; Phase 2 (UI de gestion multi-pièces) reste à faire.

### Constat (état actuel : 1 projet = 1 pièce)

- **Entités** : `Project` ─OneToOne→ `RoomDimensions` (`UNIQUE(project_id)`) ; `Project` ─OneToMany→ `Opening` (FK `project_id`) ; `Project` ─OneToMany→ `ProjectWorkItem` (`UNIQUE(project_id, work_type_id)`). Photos, estimation, liste = tous rattachés au `project_id`.
- **Moteur** ([estimation-engine.ts](../apps/api/src/estimations/estimation-engine.ts)) : `computeEstimation(room, workItems)` sélectionne le conditionnement **par ligne** (`selectBestPackaging` appelé pour chaque (work_item × matériau)).
- **Liste d'achats** ([shopping-lists.service.ts](../apps/api/src/shopping-lists/shopping-lists.service.ts) `generate`) : mapping **1:1** des lignes d'estimation (clé `material_id:work_item_id`), conditionnement déjà arrondi repris tel quel. **Aucune agrégation**, même entre deux work items d'un même projet qui partagent un matériau.
- **Conséquence** : la promesse « mutualisation des pots de peinture entre pièces » **n'existe pas aujourd'hui**.

### Principe de correction (cœur de la promesse)

La mutualisation doit **sommer les quantités continues** (`adjusted_qty`, en unités matériau : L, kg, m²…) **par matériau, à travers toutes les pièces et tous les work items, AVANT `selectBestPackaging`**. Comme `ceil(Σ qtyᵢ) ≤ Σ ceil(qtyᵢ)`, mutualiser **ne coûte jamais plus** de pots (gain strict — propriété qui garantit que la promesse est toujours tenue).

Clé d'agrégation = **`material_id`** : un `material_id` du catalogue = exactement une catégorie, un jeu de conditionnements et une unité (les matériaux sont chargés `by category`, un matériau appartient à une seule catégorie). `work_item_id` **ne peut pas** faire partie de la clé (deux pièces ont des work items distincts pour le même `work_type`).

### Modèle cible

Introduire la **pièce comme entité de 1er rang**. Un projet possède N pièces ; chaque pièce porte sa géométrie (dimensions 1:1 + ouvertures N) **et** ses work items (une chambre peut être « murs seuls » quand le salon est « murs + plafond »). L'estimation et la liste restent **par projet** (elles agrègent les pièces).

```
Project ─OneToMany→ Room ─OneToOne→  RoomDimensions   (room_id UNIQUE)
                         ─OneToMany→ Opening          (room_id FK)
                         ─OneToMany→ ProjectWorkItem   (room_id, UNIQUE(room_id, work_type_id))
Project ─OneToMany→ EstimationResult (project_id)   ← granulaire + agrégé
Project ─OneToOne→  ShoppingList     (project_id)   ← mutualisée
```

**Entités touchées** :
- `Room` (**nouvelle**, [projects/entities/room.entity.ts]) : `id, project_id (FK CASCADE), name, sort_order, created_at, updated_at`.
- `RoomDimensions` : `project_id` → **`room_id`** (reste `UNIQUE`, OneToOne). Champs inchangés (length/width/height/segments_json/source/confidence/raw_cv_output_json).
- `Opening` : `project_id` → **`room_id`**.
- `ProjectWorkItem` : `project_id` → **`room_id`** ; `UNIQUE(project_id, work_type_id)` → `UNIQUE(room_id, work_type_id)`. (Table + classe conservées pour limiter le churn — commentaire ajouté.)
- `EstimationResult` : reste `project_id`. **Ajout `aggregated_json jsonb NULL`** (plan d'achat mutualisé). `EstimationLineItem` gagne `room_id?`, `room_name?` (optionnels → rétro-compat des lignes déjà persistées).
- `ShoppingList` : reste `project_id`. `ShoppingListMaterialItem` re-clé sur **`material_id`** (+ `room_count?` pour l'affichage « utilisé dans N pièces », `work_item_id?` conservé optionnel pour lire les anciennes listes).

### Compatibilité descendante — « pièce par défaut »

Levier qui rend ce changement structurel **non cassant** pour le web (inchangé en Phase 1) : chaque projet a **toujours ≥ 1 pièce**. Les endpoints projet existants (`PUT/GET /projects/:id/dimensions`, `/openings`, `/work-items`) continuent de fonctionner en **déléguant à la pièce par défaut** (la 1re par `sort_order`). `createProject` crée la pièce par défaut ; la migration en backfille une pour chaque projet existant. Les nouveaux endpoints `/:id/rooms…` (CRUD pièces) sont **Phase 2**.

### Moteur — agrégation (pure, testable)

- `computeEstimation(room, workItems)` **inchangé** (utilisé tel quel par le calculateur public et par chaque pièce). Chaque ligne porte déjà `adjusted_qty` (continu) et `theoretical_qty`.
- **Nouvelle méthode pure** `aggregatePurchases(granularLines, packagingByMaterialId) → AggregatedMaterialLine[]` : regroupe par `material_id`, somme `adjusted_qty`, appelle **une fois** `selectBestPackaging(Σ, packagings)`, conserve les `contributions` (room_id, room_name, work_item_id, work_type_code, surface_m2, adjusted_qty) pour la traçabilité (affichage par pièce + coût « brut » du budget).

### Estimation multi-pièces ([estimations.service.ts] `estimate`)

Boucle sur **toutes les pièces estimables** du projet (dimensions présentes **et** ≥ 1 work item), catalogue matériaux mis en cache par catégorie (une seule requête par catégorie pour tout le projet) :
```
for room of rooms estimables:
   roomData ← room.dimensions (+ segments_json) + room.openings
   lines   ← engine.computeEstimation(roomData, workItemInputs)   // taggées room_id/room_name
   granular.push(...lines) ; mémorise packagings par material_id
aggregated ← engine.aggregatePurchases(granular, packagingByMaterialId)
save EstimationResult{ project_id, items_json: granular, aggregated_json: aggregated, total_items: granular.length }
```
Si **aucune** pièce estimable → `BadRequestException` (messages adaptés des deux gardes actuels). Pièce sans dimensions ou sans work item = ignorée (ne casse pas l'estimation des autres).

### Liste d'achats — mutualisée ([shopping-lists.service.ts])

- `generate` : construit les `material_items` à partir d'`estimation.aggregated_json` (1 ligne par matériau, `units_needed` = arrondi **unique** sur le total). Fallback sur l'ancien chemin 1:1 depuis `items_json` si `aggregated_json` est `null` (anciennes estimations) → zéro régression sur les lignes déjà en base.
- `buildTilingContext` : surface carrelage sommée **sur toutes les pièces** (déjà une somme sur les lignes → naturel). Format de carreau : 1er work item carrelage (limitation documentée, identique à l'hypothèse mono-format actuelle ; multi-format = passe ultérieure).
- `update` / `regenerate` / `computeBudgetSummary` : re-clés sur **`material_id`**. Le **coût brut** (baseline « acheteur naïf ») est recalculé **par ligne granulaire** (`theoretical_qty × 1,10`, arrondi par pièce) puis sommé par matériau → l'écart réel↔brut capture désormais **aussi** le gain de mutualisation (exactement la promesse chiffrée).
- `UpdateShoppingListDto.material_items` : matching par `material_id` (`work_item_id` optionnel/ignoré).

### Migration réversible — `1711468800031-CreateRoomsAndReparentGeometry.ts`

**up()** :
1. `CREATE TABLE rooms` (+ index `project_id`).
2. Backfill : 1 pièce par projet existant (`name` ← `NULLIF(room_name,'')` sinon `'Pièce 1'`, `sort_order = 0`).
3. `ADD COLUMN room_id uuid NULL` sur `room_dimensions`, `openings`, `project_work_items`.
4. Backfill `room_id` via jointure `rooms.project_id` (1:1 à ce stade).
5. `room_id` → `NOT NULL` + FK `REFERENCES rooms(id) ON DELETE CASCADE` ; bascule des contraintes `UNIQUE` (project_id→room_id) ; index.
6. `ALTER TABLE … DROP COLUMN project_id` sur les 3 tables (reconstruit en down via `rooms.project_id`).
7. `ALTER TABLE estimation_results ADD COLUMN aggregated_json jsonb DEFAULT NULL`.

**down()** (réversible ; **lossless** pour tout projet resté mono-pièce ; les pièces créées après l'up « s'effondrent » sur la 1re pièce — limite inhérente, documentée) :
1. Re-`ADD COLUMN project_id` (nullable) sur les 3 tables.
2. **Supprimer** les lignes rattachées à une pièce **non-première** (min `sort_order,created_at` par projet) → garantit les `UNIQUE(project_id[, work_type_id])`.
3. Backfill `project_id` depuis `rooms` puis `NOT NULL` + FK projects + restauration des `UNIQUE` d'origine.
4. `DROP COLUMN room_id` ; `DROP COLUMN estimation_results.aggregated_json` ; `DROP TABLE rooms`.

`docker compose` + `pnpm --filter @chiffreo/api migration:run` puis `migration:revert` testés sur DB jetable (skill `verify`) : up→revert→up, données mono-pièce identiques (diff avant/après).

### Tâches Phase 1 (= périmètre backlog : entités + moteur + liste + migration)

- [x] `room.entity.ts` (nouvelle) + relation `Project.rooms` + enregistrement `TypeOrmModule.forFeature`/module projets
- [x] `RoomDimensions`/`Opening`/`ProjectWorkItem` : `project_id` → `room_id` (+ contraintes)
- [x] Migration `…031` up/down réversible (+ test up/revert sur DB jetable)
- [x] `projects.service` : `getRooms`, `getOrCreateDefaultRoom`, `createProject` crée la pièce par défaut, shim des méthodes dimensions/openings/work-items vers la pièce par défaut, `removeCvOpenings` par pièce
- [x] Moteur : `aggregatePurchases` (pure) + `AggregatedMaterialLine`/`PurchaseContribution` + `room_id?/room_name?` sur `EstimationLineItem`
- [x] `estimations.service.estimate` : boucle multi-pièces + cache catalogue + `aggregated_json`
- [x] `shopping-lists.service` : `generate` mutualisé (fallback legacy), `buildTilingContext` multi-pièces, `update`/`regenerate`/budget re-clés `material_id` ; `UpdateShoppingListDto`
- [x] Web minimal (garder `next build`/tests verts) : `shopping-list-types.ts`, `ShoppingListMaterials.tsx` (clé `material_id`, badge « N pièces »), payload update
- [x] Tests (voir ci-dessous) + docs (`ARCHITECTURE.md`, `BACKLOG.md` ENG-2)
- [x] Vérifier : `pnpm --filter @chiffreo/api lint|build|test` + `test:e2e` + web `lint|build|test` + migration up/revert

### Tests

- Moteur : `aggregatePurchases` — 2 pièces même peinture (1,2 + 1,2 pot → mutualisé 3 L ⇒ **1 pot** vs 2 séparés), matériaux distincts non fusionnés, `contributions` correctes, pièce unique = identique à aujourd'hui, choix de conditionnement re-sélectionné sur le total (ex. bascule 10 L↔2,5 L).
- `estimations.service` : multi-pièces (adapter les mocks `getRooms`), pièce sans dimensions ignorée, aucune pièce estimable → `BadRequest`, `aggregated_json` peuplé.
- `shopping-lists.service` : génération mutualisée depuis `aggregated_json`, fallback legacy si `null`, budget brut = Σ par-ligne (le gain de mutualisation apparaît), update/regenerate par `material_id`.
- Non-régression : les 196 tests API + e2e existants au vert (ajustements de mocks attendus : `dimensions`/`openings`/`workItems` désormais chargés via pièce).

### Décisions validées (check-in porteur)

1. **Granularité des work items** : par **pièce** — une pièce peut être « murs + plafond », une autre « murs seuls ». `project_work_items` re-parenté sur `room_id`.
2. **Phasage** : backend maintenant (Phase 1), **UI multi-pièces en Phase 2**.
3. **Réversibilité** : `down()` faithful pour les projets mono-pièce ; effondrement des pièces ajoutées après migration — accepté et testé.

### Review (Phase 1)

- **La mutualisation est le seul vrai changement de comportement, et il vit au bon endroit** : `estimation_engine.aggregatePurchases` somme les `adjusted_qty` **continus** par `material_id` à travers toutes les pièces/work items **avant** `selectBestPackaging`. Propriété clé `ceil(Σ) ≤ Σ ceil` ⇒ mutualiser ne coûte **jamais** plus de conditionnements (test : 2 pièces × 4 L, cond. 10 L ⇒ **1 pot** au lieu de 2). Re-sélection du format sur le total testée (2 × 1,2 L ⇒ 1 pot de 2,5 L au lieu de 6 × 0,5 L).
- **`aggregated_json` sur l'estimation, pas recalcul à la volée** : l'agrégation est décidée au moment de l'estimation (catalogue chargé, conditionnements connus, mis en cache par catégorie) et persistée. La liste d'achats la consomme telle quelle, avec **repli 1:1 sur `items_json`** si `aggregated_json` est `null` (estimations antérieures) → zéro régression sur les données existantes. `items_json` reste granulaire (par pièce/work item) pour la traçabilité et le coût « brut » du budget.
- **Le budget capture désormais le gain de mutualisation** : coût brut = acheteur naïf (10 % forfait, conditionnement arrondi **par pièce**, sommé par matériau) vs coût réel mutualisé ⇒ l'écart reflète facteurs de perte **+** mutualisation. Clé unifiée sur `material_id` (update/regenerate/budget/DTO/web).
- **Compat descendante par « pièce par défaut »** : tout projet a ≥ 1 pièce (créée par `createProject`, backfillée par la migration). Les endpoints projet historiques (`/dimensions`, `/openings`, `/work-items`) délèguent à la 1re pièce ; `Project.dimensions`/`.openings` deviennent des **getters** résolvant la pièce par défaut → contrôleur, PDF, communauté et partage inchangés. Le web actuel fonctionne sans modification (hors la liste, re-clé sur `material_id`).
- **Migration `…031` réversible — vérifiée en SQL réel sur base jetable** (le runner ts-node est cassé sur ce poste : `NodeNext`/ESM `__dirname`, indépendant du code ; SQL rejouée à l'identique via psql). Round-trip **avec données** : après UP, géométrie reparentée sur `room_id`, `project_id` supprimés, `aggregated_json` présent ; après DOWN, schéma d'origine restauré à l'octet près (dims 400×300×250, 2 ouvertures, 1 work item sur `project_id`, `rooms`/`aggregated_json` supprimés). **Collapse multi-pièces** testé : 2 pièces → DOWN conserve la 1re et supprime la géométrie de la 2e, **sans violer** `UNIQUE(project_id[, work_type_id])`. Base dev `chiffreo` jamais touchée.
- **Duplication assumée de rien** : aucune logique de surface dupliquée ajoutée ; l'agrégation est une fonction pure du moteur, testée isolément.
- **Vérifications automatisées** (commandes du job `api`/`web` de `.github/workflows/ci.yml`) : API `jest` **211** ✓ (+15 : 6 `aggregatePurchases`, +8 `projects.service` re-parenté, +1 shopping mutualisé), e2e API **18** ✓, `nest build` ✓, `eslint {src,test}` ✓. Web `tsc --noEmit` ✓, `jest` **139** ✓, `next build` ✓, `eslint src` ✓ (1 warning `<img>` préexistant). Migration up/down/collapse ✓ (psql).
- **Reste (Phase 2)** : UI de gestion multi-pièces (onglets/CRUD pièces, saisie géométrie + work items par pièce), photos rattachées à la pièce (aujourd'hui projet, CV → pièce par défaut), format de carreau multi-pièces dans les compléments (aujourd'hui 1er work item carrelage), débloque PLAT-1 (carnet du logement par pièce).

## ENG-1 — Pièces non rectangulaires (19 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) ENG-1 (P1, effort L), prérequis de ENG-2 (multi-pièces) et PLAT-1. « Écart le plus cité entre promesse et réalité » : le moteur ne gérait que L×l×h. Objectif de cette itération (arbitrée avec le porteur) : **moteur + API publique + tests d'abord** ; la persistance projet (colonne DB) et la saisie guidée UI (`DimensionsForm`) sont une 2ᵉ passe.

Décision géométrique : une pièce composée = **union de rectangles positionnés** (`RectSegment{ x_cm, y_cm, length_cm, width_cm }`). Sol/plafond = **aire de l'union** ; murs = **périmètre du contour de l'union × hauteur − ouvertures**. Les arêtes internes partagées entre rectangles ne sont pas des murs → une somme des périmètres serait fausse. Algorithme : compression de coordonnées + remplissage de cellules (exact pour L/T/U/croix, robuste aux chevauchements, aucune dépendance). Rétro-compatible : une pièce sans `segments` = un seul rectangle `[{0,0,L,l}]`, donc aire = L×l et périmètre = 2(L+l), strictement identique à l'ancien comportement (chemin de code unifié, tous les tests moteur existants restent verts).

- [x] `apps/api/src/estimations/room-geometry.ts` : `RectSegment`, `unionAreaCm2`, `unionPerimeterCm` (fonctions pures)
- [x] `apps/api/src/estimations/estimation-engine.ts` : `RoomData.segments?`, `resolveSegments`, `computeSurface`/`computeGrossSurface` délèguent aux primitives
- [x] `apps/api/src/estimations/room-geometry.spec.ts` : rectangle simple, L, T, U, chevauchement, vide (aire + périmètre calculés à la main)
- [x] `apps/api/src/estimations/estimation-engine.spec.ts` : `computeSurface` sol/plafond/murs composés (avec/sans ouvertures), `computeGrossSurface`, `computeEstimation` complet sur pièce en L, non-régression `segments` absent
- [x] `apps/api/src/estimations/dto/public-estimate-request.dto.ts` : `RectSegmentDto` + `segments?` optionnel (validation + bornes)
- [x] `apps/api/src/estimations/estimations.service.ts` : mapping `dto.segments` → `room.segments` dans `estimatePublic`
- [x] Vérifier : lint + build + test API

### Review

- **Union de rectangles positionnés plutôt que « rectangle principal moins décroché d'angle »** (arbitré avec le porteur) : le moteur reste général — il gère L, T, U, croix et extensions, pas seulement les cas amputés d'un coin. Le contrat d'entrée `RectSegment{ x_cm, y_cm, length_cm, width_cm }` (vue de dessus) est la même primitive que la future UI guidée générera.
- **Murs = périmètre du contour de l'union, pas somme des périmètres** : point de correction central. Sur la pièce en L de test, sommer les périmètres donnerait 52,5 m² (2100 cm × 2,5 m) contre 45 m² réels (1800 cm × 2,5 m) — un test l'asserte explicitement et documente le piège. L'arête interne partagée entre deux rectangles n'est pas un mur.
- **Sol/plafond = aire de l'union** (compression de coordonnées + remplissage de cellules) : robuste aux chevauchements (union, pas de double comptage) — un test couvre le doublon parfait et le chevauchement partiel via inclusion-exclusion. Adjacence propre : deux rectangles accolés fusionnent en un seul contour (test 400×200 = périmètre 1200).
- **Chemin de code unifié / rétro-compatibilité stricte** : `resolveSegments` transforme une pièce sans `segments` en `[{0,0,L,l}]`, si bien que rectangle unique ⇒ aire L×l et périmètre 2(L+l), identiques à l'ancien calcul. Les 4×3 m des tests historiques restent à 12 m² (sol) et 35 m² (murs bruts) — les 141 tests API préexistants passent sans modification.
- **Ouvertures inchangées** : déduites de la surface murale totale (composite comme rectangulaire), la surface brute continue de les ignorer.
- **Algorithme choisi pour la vérifiabilité** : grille comprimée exacte et sans dépendance, minuscule pour une poignée de rectangles (`ArrayMaxSize(10)` côté DTO). Préféré à un algorithme de balayage (sweepline) plus performant mais plus difficile à relire/tester, l'usage réel étant de 2-4 rectangles.
- **Segments dégénérés** (longueur/largeur ≤ 0) filtrés : ne contribuent ni à l'aire ni au périmètre (test dédié).
- **Vérifications automatisées** : `npx jest` ✓ (19 suites, 196 tests, dont 55 sur géométrie+moteur) · `npx nest build` ✓ · `npx eslint "{src,test}/**/*.ts"` ✓ — mêmes commandes que le job `api` de `.github/workflows/ci.yml`. Web non modifié cette passe.

### 2ᵉ passe — Persistance projet + UI guidée (19 juillet 2026)

Deuxième itération : rendre le décroché saisissable et persistant de bout en bout. Modèle de saisie retenu (arbitré avec le porteur) : **sections positionnées générales** exposées à l'utilisateur via des décrochés relatifs à un mur (côté + décalage + largeur + profondeur), le moteur restant l'union de rectangles positionnés.

- [x] `apps/api/src/migrations/1711468800030-AddSegmentsToRoomDimensions.ts` : colonne `segments_json jsonb` (nullable)
- [x] `room-dimensions.entity.ts` : `segments_json` + interface locale `RoomSegment` (pas de couplage au module estimations)
- [x] `dto/update-dimensions.dto.ts` : `RoomSegmentDto` + `segments?` (validation + bornes, `ArrayMaxSize(10)`)
- [x] `projects.service.updateDimensions` : persiste `segments_json` (sémantique replace-all : une sauvegarde rectangulaire efface une forme antérieure)
- [x] `projects.controller` : `segments` dans les réponses GET (liste + détail + `:id/dimensions`) et PUT
- [x] `estimations.service.estimate` : mappe `dimensions.segments_json` → `room.segments`
- [x] `apps/web/src/lib/surface.ts` : `RectSegment`, `compositeFloorArea/Perimeter/WallArea/NetWallArea`, `ShapeSection`, `sectionsToSegments` + `segmentsToSections` (inverse, pour ré-hydrater le formulaire)
- [x] `components/dimensions/ShapeSections.tsx` : éditeur « Votre pièce a-t-elle un décroché ? » (même pattern qu'`OpeningsSection`)
- [x] `DimensionsForm.tsx` : état `sections`, surfaces composite-aware, `RoomPreview` composite, `onSave` porte `segments`
- [x] `RoomPreview.tsx` : rendu composite (chemin simple inchangé)
- [x] `dimensions/page.tsx` + `PublicCalculator.tsx` : chargent/sauvent `segments` (API + brouillon local invité)
- [x] Tests web : `surface.spec` (composite + round-trip `sections↔segments`), `RoomPreview.spec` (composite), `DimensionsForm.spec` (ajout d'un décroché → segments)
- [x] Vérifier : test/build/lint API + web

### Review (2ᵉ passe)

- **Persistance en `segments` bruts (RectSegment[]), pas en descripteurs de sections** : le format stocké est aligné sur le contrat du moteur et sur les futurs producteurs de géométrie (CV, ENG-2 multi-pièces), pas sur l'abstraction UI. L'abstraction friendly « décroché = côté + décalage + largeur + profondeur » reste confinée au web, avec `segmentsToSections` pour reconstruire l'état éditable au rechargement (déterministe car nos sections sont toujours strictement à l'extérieur du rectangle principal). Round-trip couvert par un test sur les 4 côtés.
- **Décroché purement additif** : une pièce en L saisie comme « rectangle principal + aile ». Pas de soustraction de coin — inutile puisque l'union de rectangles couvre L/T/U/croix, et ça garde le modèle simple et cohérent avec le moteur (déjà livré en 1ʳᵉ passe).
- **Sémantique replace-all** : le formulaire renvoie l'état complet à chaque save ; une sauvegarde sans décroché remet `segments_json` à `null` (même logique que les ouvertures). Un projet CV (rectangulaire) reste `null`.
- **Duplication assumée de la géométrie** (grille comprimée) entre `apps/api/.../room-geometry.ts` et `apps/web/.../surface.ts` : pas de package partagé dans le monorepo, et `surface.ts` dupliquait déjà la logique de surfaces murs/sol. Les deux implémentations sont couvertes par des tests avec valeurs calculées à la main (mêmes fixtures L/T).
- **UI partagée = couverture gratuite du lead magnet** : `DimensionsForm` étant réutilisé par `PublicCalculator`, le décroché apparaît aussi dans les calculateurs publics ; l'API publique gérait déjà `segments` (1ʳᵉ passe), il ne restait qu'à forwarder.
- **Vérifications automatisées** : API `npx jest` 196 ✓ · `npx nest build` ✓ · `eslint {src,test}` ✓. Web `npx jest` 139 ✓ · `tsc --noEmit` ✓ · `next build` ✓ · `eslint src` ✓ (1 warning `<img>` préexistant, hors périmètre). Un test service existant a été ajusté (`create` inclut désormais `segments_json: null`).
- **Reste possible (3ᵉ passe)** : validation anti-chevauchement des décrochés côté DTO, contour d'union net dans le preview (au lieu de rectangles superposés), et intégration au flux CV. Non requis par ENG-1.

## CV-2 — Mesure de précision CV (19 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) CV-2, prérequis explicite de CV-5 (intervalles de confiance) et CV-6 (ré-entraînement). `cv_correction_logs` existait déjà (alimentée depuis `projects.controller.ts` à chaque correction de dimension) mais rien n'exploitait ces données. Aucune infra de job/cron/CLI n'existe côté API ; suivi le pattern REST admin-guardé déjà établi par DATA-2 (`admin-analytics`) plutôt que d'introduire un nouveau mécanisme.

- [x] `apps/api/src/analysis/dto/cv-accuracy-query.dto.ts` : `days` (filtre optionnel) + `format` (`json`/`csv`)
- [x] `apps/api/src/analysis/cv-accuracy.service.ts` : lecture complète de `cv_correction_logs`, regroupement générique par `entity_type`+`field` (pas de liste de champs en dur, absorbe les futures corrections `opening`), écart médian absolu (cm) et relatif (%), garde-fou `sufficient_data` (seuil 5 échantillons)
- [x] `apps/api/src/analysis/cv-accuracy.controller.ts` : `GET /admin/cv-accuracy/report`, gardé `FirebaseAuthGuard`+`AdminGuard`, export `format=json|csv` (CSV via `Content-Disposition`, même pattern que l'export PDF de la liste de courses)
- [x] Enregistrement dans `analysis.module.ts` (aucun nouveau module — `CvCorrectionLog` et `UsersModule`, requis par `AdminGuard`, y étaient déjà)
- [x] `cv-accuracy.service.spec.ts` : médiane pair/impair, seuil `sufficient_data`, exclusion écart relatif si `cv_value=0`, exclusion valeurs non numériques, regroupement multi-champs, `overall` = médiane sur l'union des écarts (pas la moyenne des médianes par groupe), filtre `days`
- [x] Docs : `docs/BACKLOG.md` (CV-2 marqué livré)
- [x] Vérifier : lint + build + test API

### Review

- **Nommage `median_error_*` plutôt que `median_absolute_deviation_*`** : la « median absolute deviation » (MAD) est un terme statistique différent (médiane de l'écart à la médiane) ; ici on calcule la médiane de `\|cv - user\|`, donc l'« écart médian » au sens littéral du backlog. Éviter la confusion terminologique dans une donnée destinée à la communication publique sur la précision.
- **`overall` calculé sur l'union des écarts, pas la moyenne des médianes par groupe** — un test dédié le vérifie explicitement (groupe A : 5×écart=1 cm, groupe B : 7×écart=9 cm → moyenne des médianes donnerait 5, la vraie médiane pondérée donne 9), pour éviter un biais si les groupes ont des tailles d'échantillon très différentes.
- **Garde-fou `sufficient_data`** (seuil 5) plutôt qu'un simple nombre : le volume de corrections est encore très faible (feature récente), et CV-2 est explicitement le prérequis de toute communication publique sur la précision — afficher une « médiane » sur 1-2 points serait trompeur.
- **Pas de nouveau module** : `CvCorrectionLog` et `UsersModule` (requis par `AdminGuard`, cf. commentaire dans `admin-analytics.module.ts`) étaient déjà importés dans `analysis.module.ts`, donc extension du module existant plutôt qu'un `cv-accuracy` module dédié — cohérent avec la propriété de l'entité par ce module.
- **Pas de dashboard web** : contrairement à DATA-2 (qualifié de « dashboard » avec page `apps/web/.../admin/analytics`), le backlog qualifie CV-2 de « job » sans mention d'UI — livré comme calcul + export exploitable (JSON pour tooling, CSV pour reporting humain), sans frontend.
- **Vérifications automatisées** : `pnpm --filter @chiffreo/api lint` ✓, `pnpm --filter @chiffreo/api build` ✓, `pnpm --filter @chiffreo/api test` ✓ (nouveaux tests inclus) — mêmes commandes que le job `api` de `.github/workflows/ci.yml`.
- **Suite** : une fois un volume réel de corrections accumulé (`sufficient_data=true`), ce endpoint devient la source de vérité pour CV-5 (intervalles de confiance) et pour toute communication marketing chiffrée sur la précision.

## CV-1 — Poids YOLO portes/fenêtres (19 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) CV-1. Plan détaillé : `C:\Users\DIEUTAXI\.claude\plans\piped-giggling-nova.md`. `models/door-window-yolov8n.pt` est absent → fallback heuristique silencieux en prod. Livrable : évaluation des datasets publics, décision pré-entraîné vs fine-tuning (tranché : fine-tuning YOLOv8n depuis COCO, aucun modèle public porte+fenêtre avec licence commerciale claire et le contrat 2 classes du code), scripts d'entraînement/éval, versionnement des poids en GitHub Release `cv-model-vN` (hors git). L'entraînement lui-même tournera séparément (GPU/Colab).

- [x] Correctifs cv-service : câbler `settings.opening_model_path` dans `main.py` (env var `OPENING_MODEL_PATH` documentée mais morte), épingler `ultralytics==8.4.101` (seule dépendance non épinglée)
- [x] Hygiène repo : `.gitignore` (models/* avec négation README, datasets/, runs/, reports/, .venv/, yolov8n.pt), `apps/cv-service/.dockerignore` (nouveau), `apps/cv-service/models/README.md` (committé), `Dockerfile` `COPY models/`
- [x] `training/prepare_dataset.py` : télécharge Roboflow doors-windows-iliyz (cœur, CC BY 4.0) + Paul Yi optionnel + Open Images optionnel (fiftyone, filtre véhicules), remap `{0: door, 1: window}`, dédup inter-sources SHA-256, `data.yaml` + `DATASET_MANIFEST.json` (attributions CC BY) + mosaïque de contrôle
- [x] `training/train.py` : fine-tune `yolov8n.pt`, seed déterministe, garde-fou classes = contrat runtime, export `--out` + `training_summary.json`
- [x] `training/evaluate.py` : mAP50/mAP50-95 + P/R par classe, balayage conf (sanity du 0.3 runtime), verdict PASS/FAIL vs critères (exit 2 si FAIL), `MODEL_CARD.md`, inférence qualitative `--images`
- [x] `training/smoke_test.py` : chemin runtime réel (`OpeningDetector.load_model` → `detect`), mode `--make-dummy` sans poids entraînés
- [x] `scripts/release-model.sh` + `scripts/fetch-model.sh` : GitHub Release `cv-model-vN` avec SHA256SUMS, fetch idempotent (gh ou curl+token+python3)
- [x] Docs : README cv-service, `training/README.md` (runbook + critères d'acceptation), DEPLOY.md (fetch avant build VPS), ARCHITECTURE.md, BACKLOG.md ; CI `compileall app training`
- [x] Vérifier sans GPU : compileall, bash -n, smoke test dummy + poids réels, dry-run train/eval sur dataset synthétique, fix env var, docker build avec/sans poids + `/health` en conteneur (voir Review)

### Review

- **Trois bugs préexistants du Dockerfile trouvés et corrigés pendant la vérification** — le build à froid était impossible (jamais revu depuis l'écriture, le VPS vivait sur son cache de couches) : (1) stage 1 `pip install transformers torch --index-url <pytorch-cpu>` — avec `--index-url`, pip n'interroge QUE l'index PyTorch, qui n'héberge pas transformers → `No matching distribution`. (2) stage 2 installait `torch` non épinglé depuis l'index CPU (aujourd'hui → 2.13) puis `requirements.txt` exigeait `torch==2.5.1+cpu`, introuvable sur PyPI → conflit ; ça ne marchait à l'époque que parce que « latest CPU » valait 2.5.1. (3) stage 1 sans Pillow → `DPTImageProcessor requires the PIL library` au pré-cache HF. Corrigés en épinglant partout les mêmes versions que `requirements.txt` (`torch==2.5.1+cpu`, `torchvision==0.20.1+cpu` — requis par ultralytics —, `transformers==4.47.1`, `Pillow==11.1.0`).
- **Piège ultralytics neutralisé** : le premier dry-run a écrit `runs/` à la **racine du repo** — ultralytics résout ses sorties via le `runs_dir` global de `%AppData%/Ultralytics/settings.json`, pas le CWD. `train.py`/`evaluate.py` passent désormais `project=` explicitement (défaut `runs/detect`, résolu depuis `apps/cv-service`, gitignoré). Idem `yolov8n.pt` (checkpoint COCO de base) téléchargé dans le CWD par ultralytics → ajouté au `.gitignore`.
- **Décisions** (détail : plan `piped-giggling-nova.md` + tableau datasets dans `training/README.md`) : fine-tuning YOLOv8n depuis COCO (aucun pré-entraîné public porte+fenêtre avec licence commerciale claire et le contrat 2 classes) ; cœur du corpus = Roboflow doors-windows-iliyz (~7,3k, CC BY 4.0, 2 classes exactes), renforts optionnels Paul Yi puis Open Images filtré ; DoorDetect écarté (aucune licence) et « Construction Plan » écarté (plans 2D ≠ photos de pièces) ; poids versionnés en GitHub Release `cv-model-vN` (gh/GHCR déjà dans les habitudes, zéro nouvelle infra, le tag ne matche pas le trigger CD `v*.*.*` — vérifié dans deploy.yml) ; critères d'acceptation : mAP50 ≥ 0,65/classe, mAP50-95 ≥ 0,40, précision ≥ 0,6/classe à conf=0,3, passe qualitative sur vraies photos.
- **Vérifications automatisées** (venv local py3.11, pins exacts de prod) : `compileall app training` ✓ ; `bash -n` des 2 scripts ✓ ; `OPENING_MODEL_PATH` désormais réellement pris en compte (surcharge env vérifiée, défaut conservé) ✓ ; `smoke_test.py --make-dummy` ✓ (checkpoint 2 classes random-init reconstruit au format ultralytics, rechargé via le vrai `OpeningDetector`, schéma de sortie validé — le risque « quirk make-dummy » du plan est levé sur 8.4.101) ; dry-run complet sur mini-dataset synthétique : `train.py --epochs 1` CPU ✓ (export + garde-fou classes + `training_summary.json`), `evaluate.py` ✓ (métriques par classe, balayage conf, verdict FAIL attendu avec exit 2, `metrics.json`/`report.md`/`MODEL_CARD.md` bien formés), `smoke_test.py --weights` sur ces poids ✓ ; **Docker de bout en bout** : build avec poids → conteneur → `GET /health` = `{"depth":true,"yolo":true}` ✓, build sans poids (models/ = README seul, cas limite du `COPY`) → `{"yolo":false}` + warning « falling back to heuristic » ✓ ; chemins d'erreur des scripts sans gh/sans tag/sans `GITHUB_REPOSITORY` ✓ (messages fail-fast corrects). Nettoyage complet après vérification (conteneur, images de test, runs/, poids factices).
- **Non vérifié / reste à faire** : (1) `prepare_dataset.py` contre la vraie API Roboflow — `ROBOFLOW_API_KEY` absente de ce poste (le fail-fast est vérifié) ; les versions de projet Roboflow sont épinglées à `1` par défaut, à confirmer au premier téléchargement (`--core-version`/`--paul-yi-version` sinon, l'erreur API liste les versions disponibles). (2) Round-trip `release-model.sh` → `fetch-model.sh` — `gh` non installé sur ce poste et repo privé (`TGDev2/Estimate`, 404 anonyme) : à jouer au premier release réel ; les chemins d'erreur et la logique SHA-256 sont relus, pas exécutés contre GitHub. (3) L'entraînement GPU lui-même (prévu séparément — runbook complet dans `training/README.md`, commande par commande jusqu'au déploiement VPS).
- **Notes** : `ultralytics` est AGPL-3.0 (dépendance préexistante, désormais signalée dans `training/README.md` — mitigation future : export ONNX) ; ultralytics tire `opencv-python` (non-headless) en plus du `-headless` épinglé — préexistant, fonctionne en conteneur grâce à `libgl1` déjà installé.

## DATA-2 — Tableau de bord North Star (19 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) DATA-2. Dépend de DATA-1 (fait, même jour). DATA-1 a instrumenté le funnel complet dans `analytics_events` mais n'offrait aucune lecture agrégée (`AnalyticsService` ne fait que `track()`). Objectif : premier tableau de bord exploitable pour arbitrer le reste du backlog P1/P2 — listes générées/semaine, conversion par marche du funnel, MRR par tier. Lecture seule sur `analytics_events`/`subscriptions`/`users`, aucune migration.

- [x] Nouveau module `AdminAnalyticsModule` (`apps/api/src/admin-analytics/`, entités importées directement pour éviter le cycle avec `SubscriptionsModule`/`AnalyticsModule`) : `GET /admin/analytics/dashboard?weeks=&days=`, guard `FirebaseAuthGuard` + `AdminGuard` au niveau controller
- [x] `AdminAnalyticsService` : 3 agrégations — listes générées/semaine (zero-fillée, bucketing en JS plutôt que `date_trunc` SQL pour rester indépendant du fuseau de session Postgres), funnel (marche 1 = `COUNT(*)`, marches 2-5 = `COUNT(DISTINCT user_id)` sur la fenêtre, conversion étape-à-étape et depuis le début, division par zéro → `0`), MRR par tier (résolution `stripe_price_id` → plan via une `Map` construite au constructeur à partir de `PLANS`/`ConfigService`, statuts `active`+`past_due` comptent comme revenu, `trialing`/`free` exposés à part hors du montant)
- [x] `admin-analytics.service.spec.ts` : zero-fill avec trou au milieu de la série, division par zéro → `0` (jamais `NaN`), `price_id` inconnu ignoré sans throw, agrégation des 3 plans Contractor dans un seul tier
- [x] `docs/API.md` (nouvel endpoint documenté) + `docs/ARCHITECTURE.md` (17ᵉ module)
- [x] Web : `apps/web/src/app/(admin)/admin/analytics/page.tsx` + composants `StatTile`/`WeeklyShoppingListsChart`/`FunnelChart`/`MrrChart` (`apps/web/src/components/admin/`), lien de nav dans `admin/layout.tsx`. Palette dataviz validée avec le script officiel du skill (`--ordinal --surface "#fff9ef" --mode light`, ALL PASS) : rampe émeraude 5 crans pour le funnel, 2 crans pour MRR Pro/Contractor, teinte unique pour le graphique hebdomadaire
- [x] Vérifier : tests API + lint API/web + build API + build web (voir Review)

### Review

- **Bug DI réel trouvé et corrigé pendant la vérification** (pas dans les tests unitaires — masqué par le mock du repo) : `AdminAnalyticsModule` n'importait pas `UsersModule`. `AdminGuard` (fourni par `AuthModule`, `@Global()`) dépend de `UsersService` dans son constructeur ; malgré `@Global()`, NestJS résout les dépendances d'un guard appliqué via `@UseGuards()` dans le contexte d'injection du module qui héberge le controller consommateur, pas seulement celui qui déclare le guard. `materials.module.ts` et `community.module.ts` importent déjà `UsersModule` pour cette même raison — convention établie que le plan initial avait manquée. Corrigé en ajoutant `UsersModule` aux imports, avec un commentaire expliquant pourquoi. Trouvé en démarrant réellement l'`AppModule` complet via `NestFactory.createApplicationContext` (voir Vérifications) : `UnknownDependenciesException` explicite au boot, pas une erreur silencieuse.
- **Décisions produit** (détaillées dans le plan) : funnel = utilisateurs distincts actifs *pendant* la fenêtre (pas une cohorte « 1ʳᵉ fois »), MRR = statuts `active`+`past_due` uniquement (`trialing` exposé à part, hors du montant), agrégation MRR à 2 tiers (Pro/Contractor) pour le graphique, tier Free jamais tracé comme barre à 0.
- **Palette dataviz** : rampe ordinale 5 crans (funnel) et 2 crans (MRR) dérivées de l'émeraude déjà utilisé par `BudgetDashboard.tsx`, validées avec `node scripts/validate_palette.js "<hex,...>" --ordinal --surface "#fff9ef" --mode light` (surface réelle des pages admin) — `ALL CHECKS PASS` sur les deux rampes avant d'écrire le moindre JSX. Le site n'a pas de mode sombre, donc pas de second passage `--mode dark`.
- **Vérifications automatisées** : API 17 suites / 167 tests ✓ (dont les 3 nouveaux cas `admin-analytics.service.spec.ts`), `tsc --noEmit` API et web ✓, lint API + web 0 erreur (1 warning `<img>` préexistant, inchangé), `pnpm build:api` ✓, `pnpm --filter @chiffreo/web build` ✓ (`/admin/analytics` prérendue statique ○ comme les autres pages admin — a nécessité d'arrêter le `next dev` actif sur le port 3000 le temps du build, incident déjà documenté GTM-3/GTM-5 sur ce poste ; dev server relancé ensuite).
- **Vérification réelle en base** (skill `verify`, DB dev `estimate-db`, après correctif DI) : `AdminAnalyticsService.getDashboard()` exécuté directement via `NestFactory.createApplicationContext` (contourne l'auth Firebase, indisponible en dev sans identifiants réels) contre la DB vide → réponse entièrement zero-fillée, forme JSON conforme. Puis données réalistes insérées temporairement (2 utilisateurs free, 3 `calculator_viewed` dont 2 anonymes, 2 `account_created`, 1 `estimate_created`, 2 `shopping_list_generated` du même utilisateur sur 2 semaines différentes) : `calculator_viewed` compte bien 3 (bruts, anonymes inclus), `account_created`/`estimate_created` distincts corrects, `shopping_list_generated` = 1 utilisateur distinct malgré 2 événements (COUNT DISTINCT confirmé contre du vrai Postgres, pas un mock), zero-fill hebdomadaire correct sur les 2 semaines concernées, `checkout_started` à 0 sans `NaN`. Toutes les lignes de test supprimées ensuite, état final revérifié identique à l'état initial (`email_capture: 2`, `users: 0`).
- **Limite assumée** : la résolution `stripe_price_id` → montant MRR n'a pas pu être vérifiée contre de vraies données (aucun `STRIPE_*_PRICE_ID` configuré dans le `.env` de ce poste, cohérent avec OPS-2 non finalisé) — couverte uniquement par les tests unitaires (mocks `ConfigService`/`createQueryBuilder`), qui exercent exactement cette logique (résolution multi-plans, `price_id` inconnu ignoré).
- **Suite** : le dashboard est prêt à trancher les arbitrages P1/P2 dès que du trafic réel existe ; aujourd'hui les métriques seront à ~0 partout (DATA-1 vient d'être livré le même jour). Pas de sélecteur de fenêtre (`weeks`/`days`) côté UI en v1 — query params fixés à `8`/`30` dans la page, évolution possible si le besoin apparaît.

## DATA-1 — Événements funnel complets (19 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) DATA-1. Plan détaillé : `C:\Users\DIEUTAXI\.claude\plans\transient-wandering-cook.md`. Le module analytics existait déjà (`AnalyticsService.track()`, fire-and-forget, jsonb) mais avec 3 trous : aucune trace de la visite calculateur (anonyme, avant tout compte — l'endpoint existant exige un Bearer token), aucun événement dédié à la 1ʳᵉ estimation in-app / génération de liste / démarrage de checkout, et des noms d'événements en strings libres sans garantie de typage.

- [x] `AnalyticsEventName` (nouvel enum, 14 membres — les 9 événements existants + les 5 du funnel) devient l'unique source de vérité ; `track()` n'accepte plus `string` nu (signature unique, pas de surcharge générique par forme de payload — écarté comme sur-ingénierie face au besoin réel : éliminer les typos de noms, pas typer les payloads) ; `TrackEventDto.event_name` passe à `@IsEnum`
- [x] `POST /public/analytics/events` (nouveau, module analytics) : auth **optionnelle** (`OptionalAuthGuard`, déjà utilisé par `community.controller.ts` — pas un nouveau guard non gardé) pour tracer la visite calculateur avant toute création de compte, tout en attribuant l'événement au `user_id` si l'appelant a déjà une session (y compris invitée) ; allow-list volontairement restreinte (`calculator_viewed` seul aujourd'hui) — jamais le plein enum, pour qu'un appelant anonyme ne puisse jamais injecter un `checkout_started`/`account_created`
- [x] `account_created` : `UsersService.upsertFromFirebase()` retourne désormais `{ user, isNewAccount }` (calculé gratuitement, sans requête supplémentaire) au lieu de `User` nu — couvre email signup (`AuthService.register()`), social signup **et** conversion invité→compte réel (même firebase_uid, `linkWithCredential`/`linkWithPopup` côté front) via `AuthService.syncUser()`, sans jamais re-déclencher sur une simple reconnexion/refresh de token. Un compte invité anonyme qui démarre ne compte pas comme création de compte pour le funnel
- [x] `estimate_created` (`EstimationsService.estimate()`), `shopping_list_generated` (`ShoppingListsService.generate()` — se déclenche aussi depuis `regenerate()`, volontaire), `checkout_started` (`SubscriptionsService.createCheckoutSession()`) : chaque occurrence est loguée brute (pas de requête bloquante pour vérifier « est-ce la 1ʳᵉ ? ») — le « premier par utilisateur » sera calculé en aval par DATA-2 (`MIN(created_at)`), cohérent avec les événements déjà en place
- [x] Web : `usePublicAnalytics()` (nouveau hook, poste vers l'endpoint public) + `PublicCalculator.tsx` trace `calculator_viewed` au montage (une fois, pas à chaque changement de variante)
- [x] `docs/API.md` (section Analytics enrichie + nouvel endpoint documenté) et `docs/ARCHITECTURE.md` (ligne AnalyticsModule) mis à jour
- [x] Vérifier : tests API + e2e + build API + lint + build web (voir Review)

### Review

- **Conception validée par un agent Plan** avant implémentation (relecture ligne à ligne de tous les fichiers concernés) — deux corrections retenues : `generate()` est aussi appelé par `regenerate()` (événement peut se déclencher plus d'une fois par projet, volontaire) ; `OptionalAuthGuard` existant réutilisé au lieu de laisser l'endpoint public totalement non gardé.
- **Rétrocompatibilité** : les 5 call sites internes préexistants (`email_capture`, `subscription_started`, `payment_failed`, `subscription_canceled`, `budget_tracked`) migrés du littéral string vers l'enum — obligatoire dès que `track()` n'accepte plus `string` nu (TS n'assimile pas un littéral à un enum même si la valeur correspond), sans changement de comportement (mêmes valeurs runtime). Les 4 événements client-only (`paywall_shown`, `paywall_clicked`, `pricing_cta_clicked`, `contractor_plan_clicked`, envoyés uniquement depuis React) inclus dans l'enum pour que `@IsEnum` sur le DTO authentifié existant ne casse pas la prod.
- **`auth.service.spec.ts`** : les 5 `upsertFromFirebase.mockResolvedValue(mockUser)` mis à jour en `{ user, isNewAccount }` + nouvelles assertions (tracé sur nouveau compte, **pas** tracé sur reconnexion/refresh normal). `auth.e2e-spec.ts` non affecté (mocke `AuthService` en bloc, pas `UsersService` — changement interne invisible du contrôleur), vérifié en le rejouant.
- **Nouveaux fichiers de test** pour les deux services qui n'avaient aucune couverture unitaire avant cette tâche : `shopping-lists.service.spec.ts` (scope strict sur `generate()`), `subscriptions.service.spec.ts` (scope strict sur `createCheckoutSession()`, `jest.mock('stripe', ...)` suivant le pattern déjà établi pour `sharp` dans `photos.service.spec.ts`). Pas de backfill du reste de ces services (hors périmètre DATA-1).
- **Vérifications** : tests API **16 suites / 164 tests** ✓ (dont les 2 nouveaux fichiers + `estimations.service.spec.ts`/`auth.service.spec.ts` étendus), e2e API **3 suites / 18 tests** ✓, `pnpm build:api` ✓, lint API+web 0 erreur (1 warning préexistant `<img>`), `pnpm --filter @chiffreo/web build` ✓ (les 3 pages `/calculateurs/*` restent SSG).
- **Limite assumée** : pas de package de types partagé entre `apps/web` et `apps/api` (aucun `packages/` n'existe dans ce monorepo) — le nom d'événement `calculator_viewed` côté front reste une constante string alignée sur la valeur de l'enum backend, comme les 4 événements client-only déjà existants.
- **Suite** : DATA-2 (tableau de bord North Star) peut maintenant s'appuyer sur ces événements pour calculer la conversion par étage du funnel (`MIN(created_at) GROUP BY user_id`).

## OPS-5 — Monitoring et alerting minimal (18 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) OPS-5, dépend de OPS-1 (fait). Rien n'existait : aucun package/code Sentry nulle part dans le repo (grep vérifié), aucun canal d'alerte (pas de Slack/Discord/webhook générique), et `/health` était un stub qui ne vérifiait rien (`return {status:'ok'}` inconditionnel) — un healthcheck qui ne peut jamais échouer ne peut jamais être alerté.

- [x] API : `@sentry/node` — `src/instrument.ts` (gate sur `SENTRY_DSN` via `getSentryOptions()`, importé en toute première ligne de `main.ts` pour que l'instrumentation par défaut patche `http`/`pg` avant le reste de l'app) + un `Sentry.captureException()` ajouté dans `AllExceptionsFilter` (point de capture unique déjà existant pour toute erreur non gérée ≥ 500 — pas de nouveau filtre, pas de `SentryModule`/`app.module.ts` touché)
- [x] API : `/health` fait désormais un vrai `SELECT 1` (`AppController`, `DataSource` injectée) — une panne DB remonte non interceptée, traitée comme n'importe quel autre 500 par `AllExceptionsFilter` (donc reportée à Sentry, sans double capture) ; corrigé au passage `test/app.e2e-spec.ts` dont le `TestAppModule` n'avait aucun provider `DataSource` et aurait cassé en résolution DI dès cette dépendance ajoutée
- [x] API : webhook Stripe — `Sentry.captureException` uniquement sur l'échec de traitement réel (catch de `handleWebhookEvent`), tag `component: stripe-webhook` ; délibérément pas sur signature invalide (bruit de scanners attendu en continu sur un endpoint public, mauvais rapport signal/bruit)
- [x] Web : `@sentry/nextjs` — `src/instrumentation.ts` + `src/instrumentation-client.ts` (hooks App Router natifs, stables depuis Next 15 ; `withSentryConfig`/upload de source maps volontairement omis — nécessiterait `SENTRY_AUTH_TOKEN`/org/project en secrets CI supplémentaires, hors périmètre « minimal », documenté comme limite connue) ; `Sentry.captureException` ajouté dans `error.tsx` (à côté du `console.error` existant) et `global-error.tsx` (qui ne reportait rien du tout auparavant — `error` était typé mais jamais utilisé)
- [x] Variables d'env : `SENTRY_DSN` / `SENTRY_TRACES_SAMPLE_RATE` (api) + `NEXT_PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (web), toutes optionnelles (absentes des deux listes de `env.validation.ts` → no-op garanti dans tous les environnements), défaut de taux d'échantillonnage `0.2` cohérent entre les deux helpers, `.env.example` et `docker-compose.prod.yml` (pas `1.0` : les healthchecks Docker pingent `/health` toutes les 15 s sur 2 services, soit ~5700 traces/jour de bruit d'infra pur à 100 %)
- [x] Une fonction pure et testée par app pour la logique d'activation (`sentry-options.ts` côté API, `lib/sentry.ts` côté web), séparée de l'appel `Sentry.init()` lui-même — le helper web ne prend délibérément aucun paramètre (lecture de `process.env.NEXT_PUBLIC_*` en expression littérale brute), sinon l'inlining statique de Next.js au build casse silencieusement en prod tout en semblant fonctionner sous Jest
- [x] Tests : 4 nouveaux fichiers de spec API (`sentry-options`, `http-exception.filter`, `app.controller` étendu de 2 cas, `subscriptions.webhook.controller` — premier test de ce contrôleur) + 1 côté web (`lib/sentry`)
- [x] `docs/DEPLOY.md` section 8 (nouvelle, avant `## Dépannage`) : création des 2 projets Sentry (Node + Next.js), les 4 variables, alerte e-mail par défaut sur nouvelle issue (+ point de vigilance : vérifier que la résolution du destinataire ne tombe pas sur personne sans règle d'ownership), Sentry Uptime Monitor optionnel sur `/health` public pour le cas « processus totalement mort » (seul cas qu'aucun code embarqué ne peut jamais auto-signaler), limite connue (pas de source maps)
- [ ] Créer les 2 projets Sentry (Node + Next.js) et renseigner les 4 variables dans le `.env` du VPS — action utilisateur, hors accès CLI
- [ ] Vérifier dans le dashboard Sentry que l'alerte par défaut « nouvelle issue » résout bien vers un destinataire réel — action utilisateur
- [ ] Optionnel : configurer un Sentry Uptime Monitor externe sur l'URL publique `/health` — action utilisateur
- [x] Vérifier : lint + build + tests (voir Review)

### Review

- **Architecture** : `@sentry/node` (pas `@sentry/nestjs`) — `@sentry/nestjs` documente officiellement la coexistence avec un filtre global existant (`@SentryExceptionCaptured()`), donc pas un problème de conflit ; la vraie raison est l'empreinte plus petite (zéro touche à `app.module.ts`, pas de `SentryModule.forRoot()` requis pour des « traces de base »). Un point de capture dans `AllExceptionsFilter` (déjà le choke point unique de toute erreur ≥ 500) + un second, distinct, dans le catch de traitement du webhook Stripe (tag `component: stripe-webhook`, délibérément pas sur signature invalide — bruit de scanners attendu sur un endpoint public).
- **`/health` n'était qu'un stub** (`return {status:'ok'}` inconditionnel, ne pouvait jamais échouer) — fait désormais un vrai `SELECT 1` via `DataSource` injectée ; l'échec remonte non intercepté et emprunte le même chemin que toute autre erreur 500 (pas de double capture Sentry). A cassé `test/app.e2e-spec.ts` au passage (son `TestAppModule` n'avait aucun provider `DataSource`) — corrigé avec un mock + un nouveau cas `/api/v1/health (GET)`.
- **Web** : `@sentry/nextjs`, hooks App Router uniquement (`instrumentation.ts` + `instrumentation-client.ts`) — `withSentryConfig`/upload de source maps volontairement omis (secrets CI supplémentaires `SENTRY_AUTH_TOKEN`/org/project, hors périmètre « minimal »), documenté comme limite connue. `Sentry.captureException` ajouté dans `error.tsx` (à côté du `console.error` existant) et `global-error.tsx` (qui ne reportait rien du tout — `error` était typé mais jamais utilisé).
- **Bug évité en cours de route** : le helper web (`lib/sentry.ts`) ne prend délibérément aucun paramètre — Next.js/webpack inline les `NEXT_PUBLIC_*` par remplacement textuel statique de l'expression littérale exacte au build ; lire la valeur via un paramètre nommé aurait fonctionné sous Jest (Node réel) tout en valant silencieusement `undefined` dans le vrai bundle navigateur, un bug invisible en test. Le helper API (`sentry-options.ts`) garde un paramètre `env`, sans risque côté serveur Node (aucune étape de bundling).
- **Taux d'échantillonnage par défaut 0.2** (pas 1.0) partout (les deux helpers, `.env.example`, `docker-compose.prod.yml`) : les healthchecks Docker pingent `/health` toutes les 15 s sur 2 services, soit ~5700 traces/jour de bruit d'infra pur à 100 %.
- **Alerting = Sentry lui-même**, aucun nouveau canal (aucun Slack/webhook n'existe dans ce repo) : alerte e-mail par défaut sur nouvelle issue, documentée dans `docs/DEPLOY.md` §8 avec un Sentry Uptime Monitor optionnel pour le seul cas qu'aucun code embarqué ne peut auto-signaler (processus API totalement mort).
- **Vérifications automatisées** (commandes exactes de `.github/workflows/ci.yml`) : lint API 0 erreur (un `@typescript-eslint/unbound-method` trouvé et corrigé dans le nouveau test du webhook — le mock de `Response` était typé avec l'interface Express réelle au lieu de son type inféré, cassant la règle sur `expect(res.status)...`), build API ✓, tests API **151/151** (+13 : `sentry-options` 5, `http-exception.filter` 3, `app.controller` +2, `subscriptions.webhook.controller` 3 — premier test de ce contrôleur), e2e API **18/18** (+1). Lint web 0 erreur (1 warning préexistant `<img>`), tests web **127/127** (+4 : `lib/sentry`), build web ✓ **avec zéro variable Sentry dans l'environnement** (même condition que la CI) — preuve que le chemin no-op est inerte au build, pas seulement à l'exécution. `pnpm install --frozen-lockfile` ✓ (lockfile régénéré par `pnpm add`, jamais édité à la main).
- **Vérifications manuelles réelles** (API compilée lancée localement, DB dev `estimate-db`, via le skill `verify`) : ① sans variable Sentry, le warn de boot « SENTRY_DSN absente… » apparaît en toute première ligne de log (avant même le bootstrap Nest) et `/health` renvoie `{"status":"ok"}` ; ② avec un DSN syntaxiquement valide mais faux, le warn disparaît et l'app démarre normalement (transport vers un hôte injoignable toujours avalé, jamais fatal) ; ③ `estimate-db` arrêté réellement (`docker stop`) → `/health` renvoie **500** `{"statusCode":500,"message":"Internal server error"}` (fini le `{status:'ok'}` inconditionnel) et la ligne `[AllExceptionsFilter] Unhandled exception` / `AggregateError [ECONNREFUSED]` apparaît dans les logs — le même point de code que le test unitaire relie déjà à `Sentry.captureException` ; `estimate-db` relancé → retour à `{"status":"ok"}` dès la première tentative. État final restauré (DB up, aucun processus API résiduel sur le port 3001).
- **Non vérifiable sans compte Sentry réel** : la livraison effective d'un événement dans un dashboard Sentry, et la résolution du destinataire de l'alerte e-mail par défaut — couverts par les tests unitaires (`Sentry.captureException` bien appelé, avec les bons tags) et par `DEPLOY.md` §8, qui demande explicitement de vérifier ce point à la mise en place réelle. Le chemin « webhook Stripe en échec de traitement réel » n'est lui aussi vérifié qu'en test unitaire (impraticable à déclencher en boîte noire sans casser délibérément un handler).
- **Suite** : créer les 2 projets Sentry (Node + Next.js), renseigner les 4 variables dans le `.env` du VPS, vérifier la résolution de l'alerte par défaut, configurer optionnellement le Sentry Uptime Monitor — actions utilisateur hors accès CLI, listées dans la checklist ci-dessus.

## OPS-4 — Déploiement continu (18 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) OPS-4, dépend de OPS-1 (pas encore fait — pas de VPS réel). La CI existait sans aucun déploiement : chaque mise à jour prod nécessitait un `git pull` + `docker compose up -d --build` manuel *sur le VPS*, reconstruisant les images à chaque fois. Décisions d'architecture validées avec l'utilisateur (plan complet : `C:\Users\DIEUTAXI\.claude\plans\cozy-leaping-teacup.md`) : registry **GHCR** (pas Docker Hub — pas de compte tiers, auth par `GITHUB_TOKEN` automatique des deux côtés), déclenchement sur tag `vX.Y.Z`, `ci.yml` rendu réutilisable (`workflow_call`) et gaté avant tout déploiement.

- [x] `.github/workflows/ci.yml` : ajout de `workflow_call:` aux triggers existants (`push`/`pull_request` inchangés) — aucun secret/input requis, les 3 jobs n'en consomment aucun
- [x] `docker-compose.prod.yml` : clé `image: ghcr.io/tgdev2/chiffreo-{api,web}:${IMAGE_TAG:-latest}` ajoutée à côté du `build:` existant pour `api`/`web` uniquement (`cv-service` reste hors périmètre, toujours construit sur le VPS) — les deux clés coexistent proprement en Compose, le flux manuel `up -d --build` documenté reste utilisable en secours
- [x] `.github/workflows/deploy.yml` (nouveau) : 3 jobs séquentiels — `ci` (gate, réutilise `ci.yml`) → `build-push` (`docker/build-push-action` ×2, cache `type=gha`, tags `${{ github.ref_name }}` + `latest`, web reçoit les 6 `NEXT_PUBLIC_*` en `build-args` depuis des secrets) → `deploy` (SSH : sync du compose file par `scp`, puis `docker login`/`pull`/`up -d`/`prune`/`logout` sur `api web` uniquement). Permissions scoppées par job (`packages: write` sur build-push, `packages: read` sur deploy — chaque job a son propre `GITHUB_TOKEN`). Token GHCR relayé au VPS via stdin du pipe SSH (jamais en argument de commande, jamais stocké — `docker logout` en fin de script). `known_hosts` épinglé à l'avance (pas de `StrictHostKeyChecking=no`). `concurrency:` au niveau workflow pour empêcher deux déploiements SSH simultanés
- [x] `docs/DEPLOY.md` : nouvelle section 6 « Déploiement continu (CD) » (ancienne section 6 renumérotée 7, `Dépannage` reste en dernier) — flux, tableau des 10 secrets GitHub requis, procédure `ssh-keyscan` pour `VPS_SSH_KNOWN_HOSTS`, rollback manuel, limites connues
- [x] Vérifier : lint du workflow + dry-run (voir Review)

### Review

- **Lint** : `actionlint` v1.7.12 (binaire officiel téléchargé dans le scratchpad, pas dans le repo) + `shellcheck` v0.11.0 intégré (`-shellcheck`) sur `ci.yml` et `deploy.yml` → 0 finding sur les deux fichiers, y compris les blocs `run:` locaux (config clé SSH, `scp`). Le script distant exécuté via `ssh "..."` est une chaîne opaque pour `actionlint` (il ne voit pas dedans) : extrait séparément dans un `.sh` autonome et passé à `shellcheck` + `bash -n` directement → 0 finding également.
- **Dry-run `docker compose config`** : avec un `--env-file` factice (scratchpad, jamais le vrai `.env`) fournissant toutes les variables `:?requis`, `docker compose -f docker-compose.prod.yml config` sort en exit 0 sans stderr. Confirmé la coexistence `image:`/`build:` : sans `IMAGE_TAG` défini, résout `ghcr.io/tgdev2/chiffreo-{api,web}:latest` (défaut `${IMAGE_TAG:-latest}`) ; avec `IMAGE_TAG=v1.2.3` exporté, résout bien `:v1.2.3` pour les deux services — le mécanisme que `deploy.yml` utilise (`IMAGE_TAG=$TAG docker compose ... pull/up`) fonctionne comme prévu.
- **Limite assumée et annoncée** : pas de dry-run bout-en-bout réel (push GHCR réel, SSH vers un vrai VPS) — aucun secret registry/VPS n'existe encore (greenfield), cohérent avec OPS-1 non fait. Le pipeline ne pourra être exercé réellement qu'une fois le VPS provisionné et les 10 secrets GitHub renseignés (tableau dans `DEPLOY.md` §6).
- **Suite** : une fois OPS-1 fait, suivre `DEPLOY.md` §6 pour générer `VPS_SSH_KNOWN_HOSTS` et renseigner les 10 secrets, puis pousser un premier tag `v1.0.0` et vérifier le run complet dans l'onglet Actions.

## OPS-3 — Sauvegardes testées (18 juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) OPS-3, dépend de OPS-1 (pas encore fait — pas de VPS réel). Le cron pg_dump n'était que documenté (deux snippets ad-hoc dans `DEPLOY.md` §5, sans chiffrement, sans rotation, sans sauvegarde du volume `uploads`, sans restauration jamais testée). Décision produit validée avec l'utilisateur : chiffrement GPG **asymétrique** (clé publique seule sur le VPS, clé privée générée et gardée hors ligne — un VPS compromis ne doit pas pouvoir déchiffrer ses propres sauvegardes), une seule clé pour l'instant (pas d'escrow).

- [x] `docs/deploy/backup.sh` : cron pg_dump (`-Fc`, format custom) + tar du volume uploads, chaque sortie chiffrée GPG (`--recipient`, clé publique uniquement), écriture en fichier temporaire puis renommage atomique (un run interrompu ne laisse jamais de fichier corrompu au nom final), `flock` anti-chevauchement, rotation par âge (`RETENTION_DAYS`, 14 j par défaut), `set -euo pipefail` (échec bruyant, pas de silence)
- [x] `docs/deploy/restore.sh` : un seul script, deux modes — `--mode verify` (défaut, cible jetable auto-générée, restaurée, vérifiée, détruite) et `--mode prod` (cible explicite, confirmation « retaper le nom » obligatoire si la cible correspond à `chiffreo-db`/`chiffreo_uploads`, jamais de destruction automatique). `pg_restore --clean --if-exists --no-owner --no-privileges -j2`
- [x] `docs/deploy/backup.env.example` : template `/etc/chiffreo/backup.env` (host-level, volontairement hors de l'`.env` applicatif — c'est un concern cron/ops, pas un concern app)
- [x] `docs/deploy/BACKUP.md` : runbook complet — modèle de menace/choix du chiffrement, mise en place clé GPG, installation cron, politique de rétention, drill de vérification, reprise sur sinistre (VPS perdu), journal des tests, non-goals explicites (pas de copie hors-site, pas d'alerting — OPS-5)
- [x] `docs/DEPLOY.md` §5 : remplacé par un pointeur vers `BACKUP.md` + la ligne crontab
- [x] `docs/deploy/provision.sh` : ajout d'une vérification/installation `gnupg` (le script appelait déjà `gpg --dearmor` pour la clé Caddy sans jamais garantir sa présence ; dépendance dure désormais avec OPS-3)
- [x] Dry-run local complet (voir Review) : backup réel sur DB+volume jetables, restauration testée sur base jetable avec assertion de contenu, rotation testée, chemin d'échec testé

### Review

- **Bug réel trouvé et corrigé pendant la vérification** (pas un artefact Windows — aurait cassé le script sur le vrai VPS Linux aussi) : `backup.sh` ligne 32 contenait `${DB_PASSWORD:?DB_PASSWORD introuvable (ni dans l'environnement, ni dans $APP_ENV_FILE)}` — l'apostrophe française de « l'environnement », même à l'intérieur de guillemets doubles, casse le parseur bash : `${var:?message}`/`${var:-message}` fait son propre suivi de guillemets pour repérer la substitution de commande imbriquée, indépendamment du contexte de guillemets englobant. Un seul guillemet simple non apparié dans le message suffit à faire échouer `bash -n` avec « unexpected EOF while looking for matching `'` », jusqu'à la fin du fichier. Reformulé sans apostrophe (« DB_PASSWORD manquant (ni en variable, ni dans $APP_ENV_FILE) »). Point de vigilance pour tout futur message d'erreur français dans un `${var:?...}`/`${var:-...}` : éviter l'élision (l', d', qu'…).
- **Bug réel trouvé et corrigé** : `restore.sh` attendait la disponibilité Postgres via un simple `pg_isready`, mais un conteneur Postgres neuf démarre une instance temporaire (exécution des scripts d'init), l'arrête, puis relance l'instance définitive — `pg_isready` peut répondre « ready » pendant la fenêtre transitoire, juste avant l'arrêt, laissant `pg_restore` échouer avec « the database system is shutting down » (reproduit une fois pendant le test). Corrigé : `wait_for_postgres` attend désormais la 2ᵉ occurrence de « database system is ready to accept connections » dans les logs du conteneur, seul signal fiable que l'instance définitive tourne.
- **Environnement de test** : ce poste est Windows (Git Bash), sans `flock` ni `postgresql-client`, et le CLI `docker` invoqué depuis Git Bash mélange mal la conversion de chemins MSYS avec `docker cp`/`docker run -v` (un chemin hôte a besoin de la conversion automatique, un chemin interne au conteneur doit au contraire y échapper — les deux cohabitent dans `restore.sh`). Contournement propre : un conteneur Linux jetable (`alpine` + `bash`/`docker-cli`/`gnupg`/`util-linux`/`tar`, lancé avec le socket Docker de l'hôte monté dedans) a servi de bac à sable pour exécuter les deux scripts *tels quels*, sans aucune adaptation Windows — reproduit fidèlement l'environnement Linux réel du VPS. Seule subtilité : les répertoires hôte partagés (scratch, dépôt, trousseau GPG) sont montés au **même chemin absolu** des deux côtés, et `TMPDIR` est pointé dans ce répertoire partagé — sinon les conteneurs jetables lancés *depuis* le conteneur bac-à-sable (« Docker outside of Docker », résolus par le démon hôte et non par l'espace de noms du bac-à-sable) ne voient pas les fichiers temporaires créés par `mktemp -d`. Ce détail ne concerne que ce poste de dev Windows ; sur le VPS Linux réel, `backup.sh`/`restore.sh` tournent directement sur l'hôte, sans cette couche.
- **Vérifications réelles effectuées** (toutes dans ce bac-à-sable Linux jetable, jamais sur `estimate-db`/`estimate_pgdata`) :
  - `bash -n` sur les deux scripts ✓ (après correctif de l'apostrophe)
  - Backup réel : conteneur Postgres jetable seedé (table `demo`, 3 lignes, empreinte `md5(string_agg(...))` enregistrée) + volume uploads jetable (2 fichiers dans un sous-répertoire, manifeste `md5sum` enregistré) → `backup.sh` produit bien 2 fichiers `.gpg` (dump `-Fc` + tar), chiffrés vers une paire de clés GPG jetable (trousseau isolé, jamais celui de l'utilisateur)
  - Restauration (`restore.sh` sans `--mode`, donc `verify`) : cible jetable auto-créée, `RESTAURATION: PASS`. Assertions indépendantes (pas seulement le rapport du script) : empreinte de contenu de la table restaurée **identique** à celle enregistrée avant sauvegarde ; manifeste `md5sum` des fichiers uploads restaurés **identique** (diff vide) à celui enregistré avant sauvegarde
  - Mode `--keep` vérifié (cible jetable conservée pour inspection) **et** mode par défaut vérifié séparément (sans `--keep` : `RESTAURATION: PASS` puis conteneur + volume jetables absents de `docker ps -a`/`docker volume ls` juste après — la destruction automatique fonctionne réellement, pas seulement documentée)
  - Rotation : fichier `.gpg` avec date de modification forcée à 20 jours → un second run de `backup.sh` (rétention 14 j) supprime bien uniquement les 2 fichiers vieillis (log `-print` confirmé), les sauvegardes fraîches des deux runs survivent
  - Chemin d'échec : `GPG_RECIPIENT` pointé vers une adresse inexistante → sortie non nulle, **aucun** fichier partiel/corrompu au nom final (diff vide avant/après), le fichier temporaire en clair est bien supprimé par le trap `cleanup_tmp`
  - Après chaque étape : conteneurs/volumes de test supprimés ; confirmé à la fin que `estimate-db` est toujours `Up` et que `docker exec estimate-db psql ... count(*) from information_schema.tables` renvoie toujours 28 (aucune donnée de dev touchée)
- **Limite assumée, documentée dans `BACKUP.md`** : pas de copie hors-site des sauvegardes (une panne disque VPS emporterait prod + sauvegardes ensemble) et pas d'alerting sur échec cron (OPS-5) — non-goals explicites, pas des oublis.
- **Suite** : une fois OPS-1 fait (VPS réel), suivre `BACKUP.md` §3 (génération de la vraie paire de clés GPG **hors du VPS**, jamais la paire de test utilisée ici) puis §4 (installation du cron réel) ; consigner le premier drill de restauration réel dans le tableau §8 de `BACKUP.md`.

## OPS-2 — Produits Stripe réels + webhook (juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) OPS-2, dépend de OPS-1. Aucune modification de code requise : le checkout, le portail client, le dédoublonnage webhook (table `stripe_events`) et la synchronisation du tier utilisateur étaient déjà entièrement câblés depuis la Phase 1 (1.5, voir plus bas) — cette tâche est une checklist opérationnelle Stripe Dashboard + variables d'environnement VPS, pas un chantier de développement.

- [x] Vérification du code existant : 4 plans dans `plans.constants.ts` (Pro 9,99 €/mois essai 7 j, Contractor Essentiel/Standard/Premium 50/100/200 €/mois) mappés aux 4 variables `STRIPE_*_PRICE_ID` (`configuration.ts`, `env.validation.ts`, `docker-compose.prod.yml` cohérents) ; endpoint webhook confirmé `POST /api/v1/subscriptions/webhook` (`subscriptions.webhook.controller.ts`), déjà documenté dans `docs/DEPLOY.md` §4 avec les 5 mêmes événements
- [x] Checklist de test livrée à l'utilisateur (mode Test complet via Stripe CLI + smoke test minimal en mode Live) — pas encore exécutée
- [ ] Créer les 4 produits/prix dans le Dashboard Stripe en mode Live — action utilisateur (accès Dashboard Stripe requis)
- [ ] Renseigner `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / les 4 `STRIPE_*_PRICE_ID` dans le `.env` du VPS (jamais commité — `.env` déjà dans `.gitignore`) — action utilisateur, hors accès CLI
- [ ] Configurer l'endpoint webhook Live (Dashboard → Developers → Webhooks) et copier le signing secret — action utilisateur
- [ ] Exécuter la checklist de test (mode Test puis smoke Live) une fois VPS + clés en place

### Review

- Rien à committer : ce travail est une revue de code (confirmation que `plans.constants.ts`, `configuration.ts`, `env.validation.ts`, `docker-compose.prod.yml`, `subscriptions.service.ts` et le controller webhook sont cohérents entre eux) + une checklist opérationnelle transmise à l'utilisateur en chat, pas un diff.
- Point de vigilance signalé à l'utilisateur : l'essai de 7 jours du plan Pro est géré côté API (`subscription_data.trial_period_days` dans `subscriptions.service.ts:116`), pas par le Price Stripe — ne pas configurer d'essai en double en créant le Price dans le Dashboard.
- Bloqué comme OPS-1 : la création réelle des produits Stripe et le remplissage du `.env` de prod nécessitent un accès au Dashboard Stripe et au VPS que je n'ai pas dans cette session.
- Suite : une fois les 4 `price_id` et le webhook secret en place, dérouler la checklist de test ci-dessus avant d'ouvrir l'offre aux clients réels ; COM-3 (parrainage) dépend explicitement de OPS-2 selon le backlog.

## OPS-1 — Provisionner le VPS + DNS + Caddy (juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) OPS-1. Bloqueur de tout l'epic OPS-A (OPS-2 à OPS-5 en dépendent). Rien n'était encore provisionné (pas de VPS, pas de domaine pointé).

- [x] `docs/deploy/provision.sh` : script d'amorçage VPS neuf (Ubuntu/Debian) — Docker + Compose plugin, dépôt apt officiel Caddy (absent des dépôts Debian/Ubuntu, `apt install caddy` seul échoue), pare-feu UFW (SSH/80/443 uniquement)
- [x] `docs/deploy/Caddyfile` : reverse proxy `chiffreo.fr` → :3000, `api.chiffreo.fr` → :3001
- [x] `docs/DEPLOY.md` : section Prérequis + section 3 mises à jour pour référencer les deux fichiers au lieu de dupliquer/reproduire des étapes d'install invalides
- [ ] Créer le VPS (reco Hetzner CX32, 8 Go RAM, région UE) — action utilisateur, hors accès CLI
- [ ] Enregistrer/pointer les DNS `A` (+ `AAAA` si IPv6) de `chiffreo.fr` et `api.chiffreo.fr` vers l'IP du VPS — action utilisateur (registrar .fr)
- [ ] Lancer `provision.sh` sur le VPS, puis `docker compose -f docker-compose.prod.yml up -d --build` + copier le Caddyfile

### Review

- Le provisioning réel (achat VPS, registrar de domaine) nécessite des comptes externes et un accès SSH que je n'ai pas — hors de portée de ce repo. Le travail préparé ici couvre tout ce qui peut l'être à l'avance : les deux fichiers `docs/deploy/` rendent le reste de OPS-1 copier-coller une fois l'IP disponible.
- Correctif découvert en préparant le script : `docs/DEPLOY.md` documentait `sudo apt install caddy` tel quel, qui échoue sur Debian/Ubuntu sans ajouter le dépôt officiel Caddy au préalable (Caddy n'est pas dans les dépôts par défaut) — corrigé dans `provision.sh` et la doc renvoie désormais dessus au lieu de dupliquer une commande invalide.
- Suite : une fois VPS + DNS en place côté utilisateur, reprendre `docs/DEPLOY.md` section 1 (`.env`) puis section 2 (lancement des services) ; OPS-2 (Stripe) et OPS-3 (sauvegardes testées) dépendent de cette tâche.
- **Vérifications (2026-07-18)** : `caddy validate --adapter caddyfile` sur `docs/deploy/Caddyfile` (image `caddy:2-alpine`) → config JSON valide, auto-HTTPS + redirection HTTP→HTTPS activées automatiquement pour les deux domaines ; `caddy fmt` signalait un défaut de formatage (indentation espaces au lieu de tabs) → corrigé, revalidé propre sans warning. `docker compose -f docker-compose.prod.yml config` (avec `--env-file` temporaire à valeurs factices, jamais avec le vrai `.env` local pour ne pas exposer de secrets) → exit 0, les 4 services + volumes + ports 127.0.0.1-only résolvent correctement.

## GTM-6 — CGU / CGV / mentions légales (juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) GTM-6. La page confidentialité existait déjà ; il manquait CGU, CGV (obligatoires pour vendre un abonnement en France) et mentions légales.

Décisions produit (validées avec l'utilisateur) :
- **Identité juridique non finalisée** → toutes les données d'entreprise (dénomination, SIRET, siège, capital, TVA, directeur de publication, hébergeur) sont des placeholders `[À compléter : …]` visuellement repérables, à renseigner avant lancement commercial.
- **Droit de rétractation** : 14 jours à compter de la souscription ; l'accès immédiat est fourni à la demande expresse du client, **sans renonciation automatique** ; en cas de rétractation, seule une retenue proportionnelle au service payant déjà fourni est possible (conditions d'information/consentement respectées).

- [x] Composant `components/legal/LegalLayout.tsx` : shell public (header Logo + nav, colonne de lecture `max-w-3xl`, footer avec liens légaux croisés) + primitives `LegalSection`/`P`/`Bullets`/`Fill` (placeholder repérable) — design system courant (stone + `--accent`)
- [x] `/mentions-legales` : éditeur, directeur de publication, hébergeur (placeholders), propriété intellectuelle, responsabilité, données perso (→ /privacy), cookies, contact
- [x] `/cgu` : objet, description du service (estimations **indicatives**, analyse photo bêta), inscription, obligations, contenus utilisateur, PI, disponibilité, responsabilité, suspension/résiliation, droit applicable + médiation
- [x] `/cgv` : identité vendeur (placeholders), offres/prix (Pro 9,99 €, Contractor dès 50 €, essai 7 j), souscription (obligation de paiement), paiement Stripe, durée/reconduction/résiliation, droit de rétractation (posture ci-dessus) + formulaire type, garanties légales, médiation, litiges
- [x] Retrofit `/privacy` sur `LegalLayout` (palette alignée + liens croisés) — **texte inchangé**
- [x] Footers landing/pricing/calculateurs : ajout liens CGU / CGV / Mentions légales
- [x] RegisterForm : acceptation CGU + confidentialité (lien `/privacy` conservé pour les specs ; CGV au checkout → à suivre)
- [x] `sitemap.ts` : +3 URLs (0.2, yearly) ; robots autorise déjà `/` (vérifié)
- [x] Vérifier : `next build` (pages statiques ○), tsc, lint, tests web verts, HTML rendu

### Review

- **Trois pages créées** (`/cgu`, `/cgv`, `/mentions-legales`) + `/privacy` refondu, tous montés sur un shell commun `components/legal/LegalLayout.tsx` (header Logo + nav, colonne `max-w-3xl`, footer à liens croisés) et des primitives `Section`/`P`/`Bullets`/`LegalLink`/`Fill` — design system courant (stone + `--accent`), remplaçant le gris/bleu obsolète de l'ancienne page privacy.
- **Placeholders repérables** : chaque donnée d'entreprise manquante est un `<Fill>` rendu `[À compléter : …]` sur fond ambre. À renseigner avant lancement : dénomination/forme/capital/siège/SIRET/RCS ou RM/TVA, directeur de publication, hébergeur (nom/adresse/tél.), TTC-HT + TVA dans les CGV, et **médiateur de la consommation** (obligatoire à désigner).
- **CGV — droit de rétractation** encodé exactement selon la décision produit : 14 j à compter de la souscription ; accès immédiat à la demande expresse **sans renonciation automatique** ; retenue proportionnelle au service déjà fourni uniquement si information + consentement respectés (art. L221-25 / L221-28) ; formulaire type de rétractation en annexe.
- **Confidentialité** : sens du texte préservé mais diacritiques corrigées (« collectees » → « collectées », etc. — la page avait échappé à la passe 2.2) + lien vers les mentions légales.
- **Wiring** : liens CGU/CGV/Mentions ajoutés aux footers landing/pricing/calculateurs (nav passée en `flex-wrap`) ; RegisterForm mentionne désormais l'acceptation des CGU **et** de la confidentialité (lien `/privacy` conservé pour la spec) ; `sitemap.ts` +3 URLs ; `robots.ts` autorise déjà ces routes.
- **Vérifications** (serveur `next dev` actif → build non relancé localement pour ne pas reproduire le crash concurrent `.next` de GTM-3 ; le build reste couvert par la CI) : `tsc --noEmit` ✓, `eslint` 0 erreur (1 warning `<img>` préexistant) ✓, jest **16 suites / 123 tests** ✓ (dont la spec RegisterForm « lien confidentialité »). Smoke HTTP réel : `/cgu` `/cgv` `/mentions-legales` `/privacy` → 200 avec contenu attendu, `/sitemap.xml` liste les 3, footers `/` `/pricing` `/calculateurs` rendent les 3 liens, aucun marqueur d'erreur.

### Reste à faire (hors code, avant commercialisation)

- Renseigner tous les `[À compléter : …]` (identité juridique, hébergeur, TVA, médiateur de la consommation).
- **Faire relire CGU/CGV/mentions par un juriste** avant la mise en vente — ce sont des modèles conformes à la structure attendue, pas un avis juridique.
- Point d'acceptation des **CGV au checkout** : le paiement passe par Stripe Checkout (redirection). Ajouter la collecte de consentement CGV côté Stripe (`consent_collection` / terms of service URL) et un libellé de bouton « commande avec obligation de paiement » pour être pleinement conforme (backend, hors périmètre de cette tâche).
- Optionnel : refléter l'acceptation CGU dans `GuestPromptModal` (aujourd'hui ne mentionne que la confidentialité).

## GTM-5 — Capture e-mail sur le lead magnet (juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) GTM-5, dépend de GTM-4 (fait). Plan détaillé : `C:\Users\DIEUTAXI\.claude\plans\floating-rolling-wind.md`. Décisions produit validées avec l'utilisateur : provider **Brevo** (pas Resend), consentement **opt-in explicite** dès cette itération (case décochée par défaut, politique de confidentialité mise à jour en conséquence).

- [x] API : module `email/` générique et réutilisable (`BrevoClientService` via `HttpModule`, pas de SDK ajouté ; client nullable + garde 503 en dev sans clé, même idiome que `SubscriptionsService`/Stripe ; `EmailService.sendCalculatorResultEmail()` ; template HTML/texte inline dans `templates/calculator-result.template.ts`, `escapeHtml` en défense en profondeur)
- [x] API : migration `CreateEmailCaptures` (table `email_captures`, aucune FK `users`) + entité `EmailCapture` ; `EstimationsService.emailEstimate()` — recalcule toujours l'estimation via `estimatePublic()` en interne (le DTO n'a pas de champ `items`, impossible de faire confiance à un résultat fourni par le client) ; capture **toujours persistée**, envoi Brevo **best-effort** (`{ sent: false }` sans jamais faire échouer la requête si la clé est absente ou l'appel échoue) ; événement analytics `email_capture`
- [x] API : route `POST /public/calculators/estimate-email` sur `PublicCalculatorsController`, throttle dédié 3 req/h/IP (plus strict que `/estimate`, aligné sur `forgot-password` — écrit en base et envoie à une adresse tierce arbitraire) ; `consent !== true` → 400
- [x] Config : `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` (requis en prod) / `BREVO_SENDER_NAME` dans `.env.example`, `env.validation.ts`, `configuration.ts`, `docker-compose.prod.yml`
- [x] Web : carte « Recevoir cette estimation par e-mail » dans `PublicCalculator.tsx`, sœur de « Sauvegarder mon projet » — case de consentement décochée par défaut (inline, comme `CommunityShareForm`), bouton désactivé tant qu'e-mail **et** consentement ne sont pas réunis, toast succès/erreur (`useToast`), formulaire réinitialisé après envoi
- [x] `/privacy` : clause ajoutée sur la capture d'e-mail aux calculateurs et son usage (résultat + actualités occasionnelles sur consentement), retrait sur demande
- [x] Tests : 16 cas API (`EstimationsService.emailEstimate`, `EmailService`, `BrevoClientService`) + 4 cas web (`PublicCalculator.spec.tsx`)

### Review

- Architecture : `EmailModule` volontairement générique (pas spécifique aux calculateurs) car le backlog liste explicitement PRO-3 (relances devis) et PLAT-2 (e-mails de cycle de vie) comme dépendants de GTM-5 — surface minimale aujourd'hui (une méthode), pas de moteur de templating prématuré.
- Sécurité : le contenu de l'e-mail est entièrement déterminé côté serveur (template + catalogue recalculé), aucun champ libre côté client ne l'atteint — borne le risque d'un endpoint anonyme qui envoie du courrier à une adresse arbitraire au cas « un visiteur reçoit une estimation plausible », pas une injection de contenu. L'adresse e-mail elle-même n'est jamais loguée (seul l'id de la capture, en cas d'échec Brevo).
- RGPD : case nommant les deux finalités (envoi du résultat + actualités éventuelles) — une case qui n'aurait couvert que l'envoi n'aurait légalement pas couvert un usage marketing ultérieur. Pas de désinscription en self-service ni de double opt-in en v1 (limites assumées et documentées dans le plan, pas des oublis).
- Vérifications : tests API 11 suites / 138 ✓ (+16), tests web 16 suites / 123 ✓ (+4), `pnpm build:api` ✓, `pnpm build:web` ✓ (les 3 pages `/calculateurs/*` restent SSG), lint API/web 0 erreur (1 warning `<img>` préexistant). Smoke réel : `POST /public/calculators/estimate-email` → 200 `{sent:false}` sans clé Brevo + ligne persistée en base (vérifié via `psql`), `consent:false` → 400, e-mail invalide → 400, 4ᵉ requête dans l'heure → 429. Parcours rejoué dans un vrai navigateur (Playwright, installé localement hors dépendances du repo) sur `/calculateurs/peinture` : carte visible sous « Sauvegarder mon projet », bouton désactivé→activé selon e-mail+consentement, toast de succès, formulaire réinitialisé, ligne confirmée en base, aucune erreur console/hydratation.
- Limite : l'envoi réel via Brevo n'a pas pu être vérifié (aucune clé API disponible sur ce poste) — seul le chemin « clé absente » a été rejoué en conditions réelles ; le chemin « clé présente » n'est couvert que par les tests unitaires (mocks `HttpService`). Nécessite la création du compte Brevo, la vérification du domaine d'envoi (SPF/DKIM/DMARC) et l'acceptation du DPA RGPD côté utilisateur avant mise en prod.
- Incidents outillage (déjà documentés en partie GTM-3/GTM-4, reconfirmés ici) : l'override `TS_NODE_COMPILER_OPTIONS={"module":"commonjs"}` seul casse `emitDecoratorMetadata` (`TS1240` sur les entités) — il faut aussi restaurer explicitement `moduleResolution`/`emitDecoratorMetadata`/`experimentalDecorators` dans l'override pour que `migration:run` fonctionne sur ce poste. `next build` a de nouveau crashé de façon intermittente (accès mémoire invalide) même dev server arrêté et `.next` nettoyé, repassé au vert au 3ᵉ essai — cohérent avec l'incident déjà noté en GTM-3, pas une régression de cette tâche.
- Recette de vérification capitalisée dans `.claude/skills/verify/SKILL.md` (nouveau) pour éviter de redécouvrir ces incidents la prochaine fois.

## GTM-4 — Calculateurs publics sans compte (juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) GTM-4. Plan détaillé : `C:\Users\DIEUTAXI\.claude\plans\snazzy-kindling-tide.md`.

- [x] API : `POST /public/calculators/estimate` public (sans `FirebaseAuthGuard`) — DTO validé strict (`public-estimate-request.dto.ts`, 5 codes whitelist, bornes anti-abus), `EstimationsService.estimatePublic()` réutilise le moteur + catalogue sans rien persister, throttling 20 req/min (`short` **et** `auth` surchargés)
- [x] API : factorisation `loadMaterialInputs(category)` partagée entre `estimate()` et `estimatePublic()` ; `WorkType` ajouté au module
- [x] Web : `lib/calculators.ts` (config data-only : slugs peinture/carrelage/sol, variantes murs/plafond & sol/mur, params couches/format/pose, FAQ SEO) — copie marketing à affiner dans ce seul fichier
- [x] Web : `/calculateurs` (hub) + `/calculateurs/[type]` SSG (`generateStaticParams` + `dynamicParams=false` → 404 sinon), metadata + canonical + JSON-LD `FAQPage`, sections « comment ça marche » et FAQ
- [x] Web : `PublicCalculator.tsx` — réutilise `DimensionsForm` (nouvelle prop `submitLabel`/`savingLabel`), `SkillLevelSelector`, `EstimationResults` ; CTA « Sauvegarder mon projet » → draft localStorage `chiffreo_local_projects` (forme exacte du dashboard) + `startGuestSession()` → `/dashboard` (utilisateur connecté : création directe du projet via API → work-selection)
- [x] SEO : sitemap (+4 URLs), lien « Calculateurs gratuits » aux footers landing et pricing
- [x] Tests : `estimations.service.spec.ts` (5 cas, non-persistance vérifiée) + `PublicCalculator.spec.tsx` (3 cas, payload + draft invité)

### Review

- Le moteur ne produisant que des quantités (pas de prix), les calculateurs affichent les quantités/conditionnements avec la mention « hors prix » — cohérent avec l'app.
- Limite v1 assumée : niveau/params ne font pas partie du schéma de draft invité, l'utilisateur re-choisit ses travaux dans work-selection après sauvegarde (étendre le schéma toucherait dashboard + AuthContext + API).
- Vérifications : tests API 9 suites/127 ✓, web 16 suites/119 ✓, tsc ✓×2, lint ✓, `next build` ✓ (3 pages SSG), smoke réel : 200 avec items catalogue (peinture 2 couches, carrelage diagonale), 400 code inconnu/champ en trop, 429 à la 21e req/min, pages 200 + JSON-LD + sitemap, `/calculateurs/foo` → 404.
- **Corrections préexistantes nécessaires à la vérification** (l'API ne bootait pas du tout en local) : ① migration `1711468800020` : `UNIQUE(... COALESCE(...))` est un SQL invalide → remplacé par un index unique d'expression (cette migration n'avait jamais pu s'exécuter nulle part) ; ② `AuthModule` marqué `@Global()` : `FirebaseAuthGuard` était irrésoluble dans `CompanyProfilesModule` (crash DI au boot, reproduit sur main propre).
- **À suivre (préexistant, non corrigé ici)** : le throttler nommé `auth` (5 req/15 min) s'applique par défaut à *toutes* les routes de l'API — chaque route est plafonnée à 5 req/15 min/IP dès qu'elle n'a pas de `@Throttle`/`@SkipThrottle` explicite. À corriger globalement (probablement retirer `auth` de `forRoot` et le déclarer uniquement sur les routes sensibles).
- Incident outillage : `pnpm db:migrate` échoue sur ce poste (`ts-node` + `module: NodeNext` → data-source chargée en ESM, `__dirname` indéfini) ; contourné via `TS_NODE_COMPILER_OPTIONS` CommonJS. À fiabiliser si les migrations locales deviennent fréquentes.

---

## GTM-3 — Page /pricing publique (juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) GTM-3. Plan détaillé : `C:\Users\DIEUTAXI\.claude\plans\iterative-greeting-summit.md`.

- [x] `apps/web/src/lib/pricing.ts` : module de données partagé (Free/Pro/Contractor ×3), copie fidèle des sources existantes (`plans.constants.ts`, `ContractorPricingModal`, landing) ; `LANDING_PLANS` extrait de la landing
- [x] `apps/web/src/components/pricing/PlanCtaButton.tsx` : CTA auth-aware — connecté → `price_id` via `GET /subscriptions/plans` puis `POST /subscriptions/checkout` (fetch au clic, promesse mémoïsée) ; anonyme/invité → `/register` (un invité Firebase anonyme ne doit pas entrer dans Stripe) ; Pro déjà abonné → bouton désactivé « Votre offre actuelle »
- [x] `apps/web/src/app/pricing/page.tsx` : page serveur prérendue statique — metadata (title/description/canonical/OG), JSON-LD `SoftwareApplication` + `AggregateOffer` (5 offres, généré depuis `pricing.ts`), grille Gratuit/Pro/Contractor + section `#contractor` (Essentiel/Standard/Premium), FAQ, header/footer publics
- [x] `sitemap.ts` : entrée `/pricing` (monthly, 0.8) ; `robots.ts` ne bloque pas la route (vérifié)
- [x] Landing : tableau `plans` remplacé par `LANDING_PLANS`, lien « Voir le détail des tarifs → » sous la grille Tarifs, lien « Tarifs » au footer
- [x] Vérifier : build, tests, lint, rendu statique, contenu SEO, CTA par état d'auth

### Review

- Aucun changement backend : le checkout reste derrière `FirebaseAuthGuard` ; la page publique affiche des prix statiques (un seul fichier source côté front désormais) et n'envoie jamais un montant, uniquement un `price_id` résolu à l'exécution pour un utilisateur connecté.
- Pas de plomberie `?plan=` à travers l'inscription : le flux email exige une vérification qui casse la chaîne de redirection ; après inscription l'upgrade passe par le paywall in-app existant.
- Vérifications : `pnpm --filter @chiffreo/web build` ✓ (`/pricing` prérendue statique ○), tests 15 suites / 116 ✓, lint 0 erreur (1 warning préexistant). HTML vérifié via `next start` : title « Tarifs | Chiffréo », canonical, meta description, JSON-LD valide (lowPrice 0 / highPrice 200 / 5 offres), 7 CTA `/register` hors session, ancre `#contractor`, `/sitemap.xml` contient `/pricing`. Landing : cartes identiques après refactor, 2 liens `/pricing`.
- Incident d'environnement pendant la vérification : `next build` plantait (access violation 0xC0000005, phase « Running TypeScript ») car il tournait en concurrence avec le serveur `next dev` actif partageant `.next`. Après arrêt du dev server et nettoyage complet de `.next`, le build est déterministe (reproduit vert 5×). Le dev server a été relancé ensuite. À retenir : ne pas lancer `next build` pendant que `next dev` tourne sur ce poste.
- Limite : le parcours checkout connecté (Stripe test) n'a pas été rejoué bout en bout ici (nécessite l'API + Stripe configurés) ; le code CTA est le même pattern que `ContractorPricingModal`, déjà en production.

---

## GTM-2 — Landing page vendeuse (juillet 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) GTM-2. Dépendance GTM-1 (logo/favicon/OG) satisfaite (commit 7699990).

- [x] Réécrire `apps/web/src/app/page.tsx` : hero avec promesse chiffrée (surachat DIY 15-25 % évité), CTA « Essayer sans compte » sur le mode invité existant
- [x] Démo visuelle du parcours photo → travaux → quantités → liste (étapes + maquette de liste d'achats)
- [x] Section preuve honnête (facteurs de perte par pose × niveau, catalogue FR réel, CV en bêta corrigeable) — pas de chiffre de précision tant que CV-2 n'est pas fait (stratégie §4.3)
- [x] Bandeau artisans (devis-minute) + aperçu tarifs Free / Pro 9,99 € / Contractor (pas de lien /pricing : GTM-3 pas fait)
- [x] Vérifier : build web + tests web verts

### Review

- Page réécrite en 7 sections : header, hero + maquette de liste (carte sombre « Chambre 12 m² »), parcours en 4 étapes, preuve (« Une précision qui ne repose pas sur des promesses »), bandeau artisans devis-minute, aperçu tarifs, CTA final + footer.
- La logique invité (`startGuestSession` → `/dashboard`) est reprise à l'identique de l'ancienne page ; seul l'habillage change.
- Promesse chiffrée formulée côté problème (« Arrêtez d'acheter 15 à 25 % de matériaux en trop ») pour rester défendable sans mesure de précision (CV-2 non fait) ; l'analyse photo est présentée comme bêta corrigeable, conformément à la stratégie §4.3.
- Faits vérifiés dans le code : Free = 2 projets actifs (`projects.service.ts`, `FREE_TIER_PROJECT_LIMIT`), Pro 9,99 €/mois essai 7 j, Contractor dès 50 €/mois (`plans.constants.ts`), pertes 5-15 % par pose × niveau (moteur d'estimation).
- Vérifications : `pnpm --filter web build` ✓ (route `/` prérendue statique), tests web 15 suites / 116 tests ✓, lint 0 erreur (1 warning préexistant volontaire).
- Limite : le parcours invité complet (Firebase) n'a pas été rejoué en E2E — inchangé par rapport à l'ancienne page.
- **Correctif préexistant découvert en visualisant la page** : `ToastProvider` ([Toast.tsx](../apps/web/src/components/ui/Toast.tsx)) rendait son portail derrière `typeof document !== 'undefined'`, un branchement serveur/client qui causait une erreur d'hydratation sur *toutes* les pages (le portail est absent du HTML serveur, présent au premier rendu client). Remplacé par `useSyncExternalStore` (snapshot serveur `false` / client `true`) — le portail n'apparaît qu'après hydratation, sans le anti-pattern « setState synchrone dans un effect » que le lint du projet interdit désormais (`react-hooks/set-state-in-effect`). Vérifié : lint 0 erreur, 116 tests verts, 0 erreur console au rechargement (avant : 1 erreur d'hydratation).

---

# Mise en production Chiffréo — suivi

Plan complet : `C:\Users\DIEUTAXI\.claude\plans\je-veux-que-tu-kind-brook.md`

## Phase 1 — Bloqueurs prod
- [x] 1.1 Build front sans `ignoreBuildErrors` (aucune erreur TS révélée)
- [x] 1.2 Validation d'env (`env.validation.ts`) + fail-fast Firebase + garde Stripe (503 en dev sans clé)
- [x] 1.3 10 × `throw new Error('User not found')` → `UnauthorizedException` (401)
- [x] 1.4 Helmet + compression + CORS multi-origines + logs JSON en prod
- [x] 1.5 Stripe : plans centralisés (`plans.constants.ts`, price_id exposés) + idempotence webhook (table `stripe_events`, claim/release)
- [x] 1.6 `apiUpload` → `ApiError`

## Phase 2 — Design system + UX
- [x] 2.1 Composants `ui/` : Button, LinkButton, Input, Textarea, Select, Modal, ConfirmDialog, Toast, Skeleton, Spinner, Alert
- [x] 2.2 7 `confirm()` natifs → ConfirmDialog ; feedbacks → toasts ; palette auth/settings/cookie/paywall bleu→émeraude ; ContractorPricingModal branché sur `/subscriptions/plans` (suppression des `NEXT_PUBLIC_STRIPE_*`)
- [x] 2.2 Passe diacritiques : ~60 fichiers corrigés (source + specs)
- [x] 2.3 `proxy.ts` anti-flash (cookie `chiffreo_auth`) + `error.tsx`/`global-error.tsx`/`not-found.tsx`/`loading.tsx` + cartes cliquables → `<Link>` + `next/image` (galerie, comparateur, formulaire partage) + suppression SVG starter
- [x] 2.4 CV étiqueté « Bêta — estimation approximative » (AnalyzeButton, AnalysisResultPanel) + suppression du faux formulaire « objet de référence » + tuile « Ce mois » et bouton « Envoyer par email » retirés

## Phase 3 — Infra déploiement
- [x] 3.1 `apps/api/Dockerfile` (migrations auto au boot) + `apps/web/Dockerfile` (standalone, NEXT_PUBLIC_* en build args) + `.dockerignore`
- [x] 3.2 `docker-compose.prod.yml` (4 services, healthchecks, volumes pgdata/uploads, ports liés à 127.0.0.1, CV 4G) ; `/health` API + `/health` CV avec état des modèles ; timeout CV 120 s
- [x] 3.3 `.env.example` complet (Stripe, storage, site URL…) + `.github/workflows/ci.yml` (lint+build+tests api/web, compile-check cv)

## Phase 4 — Polish
- [x] Metadata OpenGraph + `robots.ts` + `sitemap.ts` + `manifest.ts`
- [x] `docs/DEPLOY.md` (VPS, Caddy, webhook Stripe, sauvegardes)
- [x] Lint API : 53 erreurs préexistantes corrigées (types Request via `express.d.ts`, EntityManager, enums, imports morts) → 0 erreur
- [x] Lint web : 3 erreurs corrigées (retry en boucle dans `usePhotoUpload`, gates dérivés par utilisateur dans `FeatureGateContext`, `location.assign`) → 0 erreur

## Review

**Vérifications finales (toutes vertes) :**
- `pnpm build:api` ✓ · `pnpm build:web` ✓ (tsc strict, plus d'`ignoreBuildErrors`)
- Tests API : 8 suites / 122 tests ✓ · Tests web : 15 suites / 116 tests ✓
- Lint API : 0 erreur ✓ · Lint web : 0 erreur (1 warning volontaire : `<img>` sur blob URL local)
- `docker compose config` valide (dev + prod) ✓
- Validation d'env : stricte en prod (13 variables), permissive en dev ✓

**Reste à faire avant lancement (hors périmètre code) :**
- Provisionner le VPS et suivre `docs/DEPLOY.md` (test compose prod sur DB vierge, checkout Stripe en mode test bout en bout)
- Créer les produits Stripe réels et le webhook
- Remplacer le favicon par défaut par un vrai logo + image OG
- Décision produit : la comparaison de prix reste désactivée (aucun fournisseur réel intégré)

## Renommage produit : EstiMate → Chiffréo (18 juillet 2026)

Décision : abandonner « EstiMate » (générique, anglophone, jeu de mots muet en français) pour **Chiffréo** — racine « chiffrer » (chiffrer ses travaux / un chantier : le geste commun aux artisans et aux particuliers), prononciation française naturelle, aucune collision constatée avec les logiciels devis/chiffrage du marché (Obat, Tolteck, Batiprix, BatiChiffrage, Tarifeo…). Slug technique ASCII : `chiffreo`.

- [x] Marque « EstiMate » → « Chiffréo » partout : UI, metadata/OG/manifest, pages légales (CGU/CGV/mentions/privacy), e-mails Brevo, PDF (devis + liste d'achats), docs, README, CONTEXT.md
- [x] Identifiants techniques `estimate` → `chiffreo` : packages pnpm `@chiffreo/api|web` + racine, CI, Dockerfiles, conteneurs `chiffreo-*`, DB/rôle/mdp dev, domaines cibles `chiffreo.fr` / `api.chiffreo.fr` (Caddyfile, DEPLOY.md, provision.sh), adresses `estimations@chiffreo.fr` / `privacy@chiffreo.fr` (l'incohérence `estimate.app` a été unifiée en `.fr`), cookie `chiffreo_auth`, localStorage `chiffreo_local_projects` / `chiffreo_cookie_consent`, event `chiffreo-cookie-consent-change`
- [x] `name: chiffreo` épinglé dans les deux docker-compose → volumes déterministes (`chiffreo_pgdata`, `chiffreo_uploads`) quel que soit le nom du dossier de clone
- [x] Logo : wordmark texte « Chiffr·éo » (finale en `--accent`) dans `Logo.tsx` — plus cohérent avec la charte stone/vert que l'ancien PNG bleu marine ; `logo-wordmark.png` supprimé, `logo-mark.png` (pictogramme neutre sans texte) conservé ; prop `priority` retirée (plus d'image)
- [x] Base dev migrée à chaud : rôle `chiffreo` (superuser) créé, `ALTER DATABASE estimate RENAME TO chiffreo`, ownership des tables/séquences transférée
- [x] Nettoyage : répertoire parasite vide `docs/deploy/Caddyfile;C` supprimé

### Review

- **Vérifications** : lint 0 erreur (1 warning préexistant `PhotoUploadItem`) ; tests API 138 ✓ + e2e 17 ✓ ; tests web 123 ✓ (16 suites) ; `docker compose config` OK sur les 2 fichiers ; build web ✓ ; connexion DB `chiffreo/chiffreo_dev@localhost/chiffreo` ✓ (30 migrations, 28 tables — données dev conservées). Grep résiduel : zéro occurrence de marque ; les tokens `estimate`/`estimation` restants sont du vocabulaire métier volontairement conservé (routes `/estimate`, DTO, colonne `estimate_snapshot`, module `estimations`).
- `pnpm db:migrate` échoue localement avec « __dirname is not defined » — **préexistant** (ts-node × Node 22), sans lien avec le renommage (le diff de `data-source.ts` ne porte que sur des littéraux). À corriger séparément.
- **Restes assumés** : projet Firebase réel `estimate-dev` référencé par `apps/web/.env.local` (ID Google immuable — créer un projet `chiffreo` plus tard si souhaité) ; `EstiMate_Product_Backlog.docx` cité dans CONTEXT.md (nom d'un fichier externe réel) ; rôle Postgres bootstrap `estimate` dans le volume dev (indélébile sans réinitialiser le cluster).
- **Actions manuelles restantes** (suppression de conteneur refusée par les permissions de session) :
  1. Basculer le conteneur/volume Docker dev — avec conservation des données :
     ```bash
     docker stop estimate-db && docker rm estimate-db
     docker compose up -d postgres && docker compose stop postgres
     docker run --rm -v estimate_pgdata:/from -v chiffreo_pgdata:/to alpine sh -c "find /to -mindepth 1 -delete && cp -a /from/. /to/"
     docker compose start postgres
     docker volume rm estimate_pgdata   # une fois vérifié
     ```
     — ou, si les données dev sont sacrifiables : `docker stop estimate-db && docker rm estimate-db && docker volume rm estimate_pgdata && docker compose up -d postgres && pnpm db:migrate`. En attendant, l'ancien conteneur `estimate-db` continue de servir la base renommée : le dev fonctionne.
  2. Renommer le dossier local `Estimate/` → `Chiffreo/` (session IDE ouverte dessus, impossible à chaud).
  3. Renommer le repo GitHub : `gh repo rename Chiffreo` (redirections automatiques), puis mettre à jour le remote si besoin.
  4. Avant tout usage public : vérifier la disponibilité du domaine `chiffreo.fr` (registrar) et une recherche INPI sur la marque.

---

## MOB-1 (volet mesure) — Instrumenter l'adoption PWA (2 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) MOB-1 / MOB-2.

**Contexte** : la demande initiale était de démarrer MOB-2 (app native React Native/Expo), *à condition que les métriques PWA le justifient*. Vérification faite, la condition ne tenait pas :

| Garde-fou | État constaté |
|---|---|
| MOB-1 livré | ✅ commit `ae6ff09`, le jour même à 03h51 — fenêtre d'observation nulle |
| DATA-2 livré | ✅ dashboard North Star, mais **aucune dimension mobile/PWA** |
| Métriques PWA | ❌ 0 événement PWA dans l'enum analytics |
| Signal d'installation | ❌ `userChoice` et `appinstalled` capturés puis **jetés** dans `InstallPrompt.tsx` |
| Télémétrie du SW | ❌ aucune |
| Utilisateurs réels | ❌ P0 non terminé (VPS non provisionné, Stripe non live) |

Décision : ne pas lancer MOB-2 (XL, > 3 semaines, le plus gros pari du backlog) sans donnée, et livrer à la place le volet « mesure » que MOB-1 promettait (« mesurer l'adoption avant d'envisager du natif ») et n'avait pas fait.

- [x] 7 événements dans `AnalyticsEventName` : `pwa_session_start`, `pwa_install_prompted/accepted/dismissed`, `pwa_installed`, `pwa_offline_view`, `photo_quality_rejected`
- [x] Tampon `localStorage` (`lib/pwa-analytics.ts`) + rejeu sur `online`
- [x] `InstallPrompt` : entonnoir d'installation complet ; `ServiceWorkerRegister` : session + écoute des messages du SW ; `sw.js` : `postMessage` sur réponse servie hors ligne
- [x] API : rejets qualité CV-4 tracés avec leur motif (`too_small`/`too_dark`/`overexposed`/`too_blurry`)
- [x] Bloc `pwa` dans `GET /admin/analytics/dashboard` + garde-fou `sufficient_data`
- [x] Règle de décision MOB-2 (seuils go/no-go) inscrite dans le backlog **avant** la collecte
- [x] Vérifier : lint, tests API + web, builds

### Review

- **Un seul point de conception structurant** : ces événements se déclenchent quand le réseau est le plus mauvais (standalone, hors ligne, mobile). Le `track()` existant est un `apiPost(...).catch(() => {})` — les envoyer sans tampon aurait biaisé toutes les métriques vers zéro pour exactement la population mesurée (un utilisateur installé consultant hors ligne = indiscernable d'un utilisateur absent). D'où un unique `queueEvent` partagé, borné à 50 événements, avec `occurred_at` figé à l'émission pour qu'un rejeu tardif ne fausse pas la date.
- `pwa_session_start` porte à lui seul part standalone, plateforme et éligibilité : sur iOS `beforeinstallprompt` n'existe pas, donc sans cet événement les utilisateurs iOS seraient absents des mesures au lieu d'être comptés comme non-promptables — c'est le signal qui ferait justement pencher MOB-2 vers les stores.
- Plutôt qu'un `camera_capture_failed` à inventer, on instrumente le rejet qualité **déjà existant** de CV-4 : mesure serveur, fiable, et ces 4 causes sont précisément ce qu'une capture native guidée corrigerait. Dénominateur du taux = photos réellement stockées (une photo rejetée n'est jamais stockée), donc aucun événement de succès à ajouter.
- Messages d'erreur FR rendus à l'utilisateur **inchangés** : seule la mesure est ajoutée.
- **Correctif préexistant découvert en vérifiant** : les 43 suites de tests web échouaient sur `TypeError: this._moduleMocker.clearMocksOnScope is not a function`, y compris sur un `main` propre (vérifié par `git stash`) — donc la CI aussi. Cause : dans `apps/web`, `jest` et `jest-environment-jsdom` étaient tous deux déclarés `^30.3.0` mais résolus à des versions différentes (30.4.2 vs 30.3.0) ; `jest-runtime@30.4.2` appelle `clearMocksOnScope`, absent de `jest-mock@30.3.0` fourni par l'environnement jsdom. Versions alignées sur celles d'`apps/widget` (`jest ^30.4.2`, `jest-environment-jsdom ^30.4.1`). Ces deux paquets doivent rester alignés.
- **Vérifications** : tests API 9 suites / 145 ✓ + e2e 17 ✓, tests web 44 suites / 298 ✓, lint 0 erreur, `build:api` ✓, `build:web` ✓.
- **Limite assumée** : rien n'est mesuré tant que P0 n'est pas fait (pas de production, pas d'utilisateurs). L'instrumentation ne remplace pas la mise en ligne — elle garantit seulement que le jour où il y aura du trafic, la décision MOB-2 sera factuelle.
- **Point signalé, hors périmètre** : le bandeau cookies propose « Refuser » mais l'analytics existant (`paywall_shown`, `calculator_viewed`…) émet sans consulter ce choix. Comportement reproduit à l'identique pour les événements PWA plutôt que d'introduire en douce une sémantique de consentement différente pour eux seuls. À arbitrer pour tout le module analytics.

---

## DATA-3 — Facteurs de perte appris (2 août 2026)

Réf : [docs/BACKLOG.md](../docs/BACKLOG.md) DATA-3. « Ajuster les facteurs de perte du catalogue à partir des écarts estimé/acheté réels (budget tracking) par matériau × pose × niveau. »

### Vérification des dépendances (leçon n°1) — faite avant d'écrire une ligne

| Dépendance | État réel constaté |
|---|---|
| DATA-1 (événements funnel) | ✅ livré, commit `54c6aac` — **le tableau du backlog ne le marque pas « Livré »** (leçon n°2) ; DATA-2 aussi (`65f884b`) |
| ENG-5 (étalonnage catalogue) | ✅ livré, commit `892aba2`, migration `…033` — rendements recalibrés, **facteurs de perte DTU laissés intacts** |
| Donnée d'entrée réelle | ✅ `shopping_lists.items_json.material_items[]` porte `original_units_needed` (estimé moteur) vs `units_needed` (réellement acheté), `is_manually_adjusted`, et `budget_summary_json ≠ null` marque la finalisation du chantier |

**Constat à signaler** : la dépendance de fait de DATA-3 n'est pas DATA-1 (événements funnel, agrégats anonymes) mais le **budget tracking**, présent depuis bien plus longtemps. DATA-1 ne porte aucune donnée quantité estimée/achetée. Le backlog liait la mauvaise brique ; je livre contre la donnée qui existe réellement.

### Méthode statistique

Une observation = (projet, matériau) sur une liste d'achats **finalisée** :

```
ratio          = units_needed / original_units_needed      (acheté / estimé, en conditionnements)
implied_pct    = (1 + applied_pct/100) × ratio − 1         (en %)
```

- `applied_pct` = `waste_factor_percent` **figé sur la ligne d'estimation**, pas la valeur catalogue courante : une observation reste correctement interprétée même après un ré-apprentissage → l'estimateur converge au lieu de dériver.
- Propriété clé : `ratio = 1` (l'utilisateur achète exactement ce qu'on a dit) ⇒ `implied_pct = applied_pct`. **Ne rien ajuster est un point fixe** : l'inaction ne produit aucune dérive, et l'arrondi au conditionnement — présent des deux côtés du ratio — ne biaise pas le résultat.
- On garde les lignes **non ajustées** : les exclure serait un biais de sélection massif (« on n'apprend que des erreurs »). Un utilisateur qui néglige d'ajuster tire vers `ratio = 1`, donc vers le statu quo : biais conservateur, assumé.
- Agrégat par cellule (matériau × pose × niveau) : **médiane** des `implied_pct` (point de rupture 50 %, insensible au chantier qui achète 10 boîtes pour un autre projet).

### Garde-fous

1. **Volume minimal** : `MIN_OBSERVATIONS = 8` par cellule, sinon aucune valeur apprise.
2. **Plafond par organisation** : `MAX_PER_ORG = 5` observations par cellule (les plus récentes) — une seule entreprise ne peut pas s'imposer comme la vérité d'une cellule.
3. **Crédibilité (Bühlmann)** : `w = n / (n + 12)`, `appris = base + w × (médiane − base)`. Rapprochement progressif et auto-amorti, jamais un saut.
4. **Base de référence = le catalogue DTU** résolu exactement comme le moteur (exact → `standard` → défaut 10 %). ENG-5 reste la ligne de base vers laquelle on rétrécit.
5. **Bornes absolues** : `[0 %, 30 %]`.
6. **Écart maximal à la base** : ±10 points. Au-delà, ce n'est plus une perte, c'est un problème de données ou de rendement — arbitrage humain (ENG-5), pas apprentissage silencieux.
7. **Dispersion** : rejet si `MAD > 15` points — la médiane d'un échantillon bimodal ne veut rien dire.
8. **Zone morte** : pas d'écriture si `|appris − base| < 0,5` point (bruit sans valeur).

### Conception

Le catalogue DTU (`waste_factors`) **n'est jamais écrasé** : les valeurs apprises vivent dans une table dédiée `learned_waste_factors`, superposée au chargement du catalogue. Auditable (base, médiane observée, taille d'échantillon, date), réversible par un `TRUNCATE`, et une cellule apprise absente du catalogue devient un nouveau point de résolution exact — ce qui est précisément la valeur de l'apprentissage. Le moteur expose une 3ᵉ source : `waste_factor_source: 'learned'`.

- [x] Entité `LearnedWasteFactor` + migration `…058` (unique `(material_id, pose_type, skill_level)`, FK cascade)
- [x] `waste-learning.ts` : statistiques **pures** (médiane, MAD, crédibilité, bornes) — aucune dépendance Nest
- [x] `WasteLearningService` : extraction des observations (listes finalisées + estimations), attribution pose/niveau, persistance ; cron hebdomadaire
- [x] Contrôleur admin : `GET /admin/waste-learning` (inspection) + `POST /admin/waste-learning/run`
- [x] Superposition dans `EstimationsService.loadMaterialInputs` + source `learned` dans le moteur
- [x] Front : type élargi + badge « appris » à côté du % de perte
- [x] Tests : stats pures, service, moteur ; puis lint + builds + suites API/web
- [x] Docs : API.md, BACKLOG.md (DATA-3, et correction du statut DATA-1/DATA-2)

### Review

- **Le choix de conception qui porte tout le reste** : la statistique ne travaille pas sur la quantité achetée mais sur le **ratio acheté/estimé**, réappliqué au facteur figé sur la ligne d'estimation. Deux conséquences décisives. (1) `ratio = 1` redonne exactement le facteur appliqué : ne rien ajuster est un point fixe, donc l'arrondi au conditionnement — présent des deux côtés du ratio — ne biaise rien, alors qu'une comparaison directe « quantité achetée vs quantité théorique » aurait fait dériver tous les facteurs vers le haut à la première passe, sans qu'aucun utilisateur ait rien fait. (2) La base de référence étant celle appliquée *à l'époque*, une passe suivante réinterprète correctement une observation prise sous un facteur déjà appris : l'estimateur converge au lieu de s'auto-amplifier.
- **Le catalogue DTU n'est pas touché.** Les valeurs apprises vivent dans `learned_waste_factors` et sont superposées au chargement (`overlayLearnedWasteFactors`). ENG-5 avait explicitement laissé les facteurs de perte conformes DTU en ne recalibrant que les rendements : les écraser par un calcul automatique aurait détruit la seule référence auditable du moteur. On peut à tout moment comparer appris/norme (`baseline_percent`, `observed_percent`, `sample_size` conservés) et revenir en arrière en vidant une table.
- **Les lignes non ajustées sont comptées.** Ne garder que les lignes corrigées aurait été un biais de sélection massif — on n'aurait appris que des erreurs. L'utilisateur qui néglige d'ajuster tire vers `ratio = 1`, donc vers le statu quo : biais conservateur, assumé et documenté.
- **Attribution plutôt que remplissage** : une ligne d'achat mutualisée (ENG-2) peut agréger deux pièces posées différemment. Dans ce cas l'écart n'appartient à aucune cellule et l'observation est **écartée** au lieu d'être rangée au hasard dans l'une d'elles. Idem pour un matériau finalement non acheté (`units_needed = 0`) : c'est un changement de périmètre, pas une perte nulle.
- **Retrait des valeurs périmées** : chaque passe supprime les cellules qui ne remplissent plus les critères. Sans ce retrait, une valeur apprise une fois resterait appliquée pour toujours, même désavouée par les données — le pire mode de défaillance possible pour ce genre de mécanisme.
- **Vérifications** : tests API 61 suites / 840 ✓ (dont 35 nouveaux sur DATA-3 : 24 sur les statistiques pures, 11 sur le service) + e2e 14 suites / 174 ✓ ; tests web 44 suites / 298 ✓ ; lint 0 erreur (1 warning préexistant `PhotoUploadItem`) ; `build:api` ✓ ; `build:web` ✓. Migration `…058` jouée sur la base dev, **puis revert, puis rejouée** — réversible. Aller-retour entité ↔ table effectué sur la vraie base (upsert × 2 → 1 seule ligne mise à jour, contrainte unique confirmée, `numeric` relu en `string` → d'où la coercition `Number()` dans la superposition, couverte par un test).
- **Correction de backlog au passage** (leçon n°2) : DATA-1 et DATA-2 étaient livrés (`54c6aac`, `65f884b`) sans être marqués comme tels. Signalé et corrigé dans le tableau.
- **Limite assumée** : aucune donnée réelle à apprendre aujourd'hui — il faut des chantiers finalisés, donc de la production. Le mécanisme est donc **inerte par construction** tant que le volume n'est pas là (`insufficient_volume` partout), ce qui est exactement le comportement voulu : le catalogue DTU reste seul maître jusqu'à preuve statistique du contraire. Les seuils ont été écrits **avant** toute collecte (corollaire de la leçon n°1).
- **Point signalé, hors périmètre** : le backlog fait dépendre DATA-3 de DATA-1, mais les événements funnel ne portent aucune quantité estimée/achetée. La dépendance réelle est le budget tracking (`shopping_lists`), livré bien avant. Livré contre la donnée qui existe ; DATA-4 (benchmark anonymisé) devrait être relié de la même manière.


---

# DATA-4 — Benchmark de coûts anonymisé

**Objectif** : « Votre projet coûte X % de moins que la médiane des projets similaires ».
Agrégation anonymisée (k-anonymat, seuils de volume).

## 0. Vérification des dépendances (leçon n°1)

- [x] COM-1 livré — `42dbe7a`, migration `…046` (`purchase_list_json`, `budget_summary_json`, `total_cost_cents` sur `community_projects`). **Non coché au backlog** → à corriger (leçon n°2).
- [x] DATA-3 livré — `976c9e6`, migration `…058`.
- [x] Source de vérité du coût réel : `shopping_lists.budget_summary_json` (budget finalisé), **pas** `community_projects` — COM-1 n'en est qu'un instantané opt-in, au volume trop faible pour un k-anonymat. Même constat que la note de clôture DATA-3.

## 1. Seuils, écrits AVANT toute collecte (corollaire leçon n°1)

| Paramètre | Valeur | Raison |
|---|---|---|
| `minOrganizations` | **5** | le k du k-anonymat : une médiane publiée agrège ≥ 5 organisations distinctes |
| `minObservations` | **10** | seuil de volume : en deçà, une médiane ne décrit rien |
| `maxObservationsPerOrg` | **3** | aucune organisation ne constitue la cohorte ni ne détermine la médiane |
| Statistiques publiées | **médiane seule** | min/max/quartiles sont des dépenses individuelles réelles → ré-identifiantes |
| Bande neutre d'affichage | **± 3 %** | en deçà, « dans la médiane » plutôt qu'une fausse précision |

## 2. Unité de comparaison

- Observation = (projet × type d'ouvrage) → **coût réel matériaux au m²**.
- Cellule = `work_type_code` × bande de surface (`<10 m²` / `10–30 m²` / `≥30 m²`).
  Sans bande, le conditionnement (un pot entier pour 2 m²) ferait déclarer « trop cher » à tout petit chantier — artefact d'emballage, pas de choix.
- Surface = somme des `surface_m2` **distinctes par (pièce × work item)** — sinon sous-couche + finition compteraient la surface deux fois.
- Coût = `units_needed × real_unit_price` des lignes matériaux. **Consommables exclus** (sans type d'ouvrage rattachable) — des deux côtés de la comparaison, donc équitable ; mentionné dans l'UI.
- Un matériau dont les lignes d'estimation couvrent plusieurs types d'ouvrage rend le projet **inattribuable → écarté** (précédent DATA-3). Le retenir en sous-estimant un ouvrage ferait paraître le projet artificiellement moins cher, c'est-à-dire fausserait précisément le chiffre publié.

## 3. Tâches

- [x] Module pur `cost-benchmark.ts` : bandes, plafonnement par organisation, k-anonymat, médiane, comparaison.
- [x] Migration `…059` : table `cost_benchmarks` (cellule → médiane, `sample_size`, `organization_count`, `computed_at`), unique sur la cellule.
- [x] Migration `…060` : gate `cost_benchmark` au palier Pro, seedée activée.
- [x] Entité `CostBenchmark`.
- [x] `CostBenchmarkService` : collecte (budgets finalisés, projets non supprimés), recalcul hebdomadaire (cron), persistance avec **retrait** des cellules qui ne qualifient plus, comparaison d'un projet.
- [x] `GET /projects/:id/cost-benchmark` derrière la gate ; `GET|POST /admin/cost-benchmarks` pour l'inspection.
- [x] Module Nest + enregistrement dans `app.module.ts`.
- [x] Web : `CostBenchmarkPanel` sous le tableau de bord budget + types + câblage page liste de courses.
- [x] Tests : module pur (k-anonymat, bandes, plafonnement, médiane), service (collecte, écarts, retrait), composant web.
- [x] Backlog : marquer DATA-4 livré **et** corriger COM-1/COM-2/COM-3/PLAT-1 non cochés.
- [x] Vérifications : tests API + web, lint, `build:api`, `build:web`, migration jouée/revert/rejouée.

## 4. Limites assumées (à documenter)

- **Auto-inclusion** : un projet finalisé appartient à la cohorte qu'il interroge. Plafonné à 3/organisation sur ≥ 10 observations, l'influence sur une médiane est bornée à un demi-rang.
- **Attaque par différence** entre deux recalculs hebdomadaires : non traitée (exigerait de la confidentialité différentielle). Risque résiduel nommé, pas masqué.
- **Inerte tant que le volume n'est pas là** — comme DATA-3, et c'est le comportement voulu.

## 5. Review

- **L'anonymat est une propriété du schéma, pas une politesse du code.** Une cellule sous les seuils n'est jamais écrite : `cost_benchmarks` ne contient que du publiable, `median_cost_per_m2` est `NOT NULL`, et une contrainte `CHECK ("organization_count" >= 5 AND "sample_size" >= 10)` refuse l'insertion en base. Vérifié à la main sur `estimate-db` : 4 organisations rejetées, 9 observations rejetées, 12/6 acceptée. Conséquence recherchée — un futur chemin de lecture, même buggé, n'a rien de non-anonyme à divulguer, et **abaisser** le k exigera une migration délibérée alors que le relever ne demande rien.
- **Médiane seule.** Min, max et quartiles sont des dépenses individuelles réelles : publier « le moins cher du panel » désigne un chantier précis, k-anonymat ou non. La promesse produit n'a besoin que de la médiane, la simplicité et la vie privée pointent ici dans le même sens.
- **Le projet est mesuré par la même fonction que la cohorte** (`extractWorkTypeCosts`, appelée des deux côtés). Deux règles d'extraction qui divergent produiraient un écart imputable à la mesure et non au chantier — la panne la plus difficile à voir sur ce genre de fonctionnalité, puisque le chiffre resterait plausible.
- **Bandes de surface plutôt que €/m² à surface libre.** Le conditionnement est indivisible : un pot entier pour 2 m² fait paraître tout petit chantier trop cher. Sans bandes, le produit aurait systématiquement reproché un artefact d'emballage à ses plus petits utilisateurs. Trois bandes seulement — chaque bande de plus divise le volume par cellule et retarde le franchissement du k.
- **Surface dédoublonnée par (pièce × work item).** Sous-couche et finition sont deux lignes d'estimation sur la *même* surface ; les sommer aurait divisé par deux tous les coûts au m², donc annoncé à tout le monde qu'il paye moins que la médiane. Couvert par un test dédié.
- **Attribution plutôt que remplissage** (précédent DATA-3, enjeu supérieur) : un matériau dont les lignes relèvent de deux types d'ouvrage, ou une ligne d'achat sans ligne d'estimation, rend le chantier **inattribuable** et l'écarte. Le retenir en sous-estimant un ouvrage aurait faussé précisément le chiffre publié. En revanche un ouvrage partiellement chiffré est écarté **seul**, sans emporter le reste du chantier.
- **Le total ne moyenne pas des pourcentages** : chaque ouvrage est revalorisé à sa médiane (`médiane × sa surface`) et l'écart est pris sur les totaux, sinon 2 m² de peinture pèseraient autant que 40 m² de carrelage. Test dédié : moyenner aurait donné +37,5 %, la pondération donne −23,5 %.
- **L'effacement se propage** : la collecte ne joint pas les projets supprimés (`withDeleted` volontairement absent, à l'inverse de DATA-3). DATA-3 apprend une physique de matériau, qui ne se rétracte pas ; DATA-4 publie des chiffres tirés de la dépense de gens.
- **Bande neutre de ± 3 %** : en deçà, « dans la médiane ». Annoncer « 0,4 % de moins » sur une médiane de douze chantiers serait une précision que la méthode ne porte pas.
- **Vérifications** : tests API 63 suites / 882 ✓ (dont 42 nouveaux : 24 sur le module pur, 18 sur le service) + e2e 14 suites / 174 ✓ ; tests web 45 suites / 306 ✓ (8 nouveaux) ; lint 0 erreur (1 warning préexistant `PhotoUploadItem`) ; `build:api` ✓ ; `build:web` ✓. Migrations `…059`/`…060` jouées sur la base dev, **revert, puis rejouées** — table et gate bien retirées à la descente. Aller-retour entité ↔ table sur la vraie base : upsert × 2 → 1 seule ligne (contrainte unique confirmée), `numeric` relu en `string` → d'où la coercition `Number()`, couverte par un test qui alimente le mock avec `'15.00'`.
- **Correction de backlog au passage** (leçon n°2) : COM-1, COM-2, COM-3 et PLAT-1 étaient livrés (`42dbe7a`, `847e94d`, `5a520b7`, `40beefa`, tous du 01/08/2026) sans être marqués. Corrigés dans le tableau. La dépendance COM-1 de DATA-4 tenait donc bien, malgré ce que le tableau laissait croire.
- **Limites assumées et nommées, pas masquées** :
  - *Auto-inclusion* — un projet finalisé appartient à la cohorte qu'il interroge. Plafonné à 3 par organisation sur ≥ 10 observations, l'influence sur une médiane est bornée à un demi-rang. Le comportement standard de tout benchmark ; documenté plutôt que corrigé, un exclusion par organisation à la lecture interdirait le pré-calcul.
  - *Attaque par différence* entre deux recalculs hebdomadaires : non traitée, elle exigerait de la confidentialité différentielle. Risque résiduel nommé.
  - *Consommables exclus* du périmètre (aucun type d'ouvrage rattachable). L'exclusion vaut des deux côtés donc ne biaise pas l'écart, mais elle en restreint la portée — l'écran le dit.
- **Inerte tant que le volume n'est pas là**, comme DATA-3 : sans production, aucune cellule ne franchit k = 5 et le panneau ne s'affiche pas. C'est le comportement voulu — mieux vaut ne rien annoncer qu'une médiane bâtie sur trois chantiers.

## SEC-1 — Revue de sécurité externe : 11 constats vérifiés et corrigés (2 août 2026)

Revue reçue sous forme de 11 constats (R1–R11). Chacun a d'abord été **vérifié dans le
code** avant toute correction, et chaque correction est accompagnée d'un test qui échoue
sans elle.

### Vérification des constats

| # | Constat | Verdict | Preuve |
|---|---------|---------|--------|
| R1 | Limiteur `auth` 5 req/15 min appliqué à toutes les routes | **Confirmé** | `throttler.guard.js` boucle sur tous les limiteurs et exige `.every()` ; 27 contrôleurs sans surcharge ; `trust proxy` absent |
| R2 | XSS stockée via JSON-LD sur `/community/[id]` | **Confirmé** | `JSON.stringify` n'échappe ni `<` ni `>` ; `title` validé `@IsString() @MaxLength(255)` |
| R3 | Lien de partage sans expiration | **Confirmé** | `share_token_created_at` écrite, jamais relue ; message d'erreur mentionnant une expiration inexistante |
| R4 | CI sans job widget ni audit | **Confirmé** | 3 jobs, `widget.spec.ts` jamais exécuté |
| R5 | CI cv-service non épinglée | **Confirmé** | `pip install` sans versions vs `requirements.txt` épinglé |
| R6 | Colonnes `numeric` déclarées `number` | **Confirmé, 30 et non 31** | La 31e (`sla_uptime_target`) est déjà déclarée `string` |
| R7 | 500 au lieu de 404 sur projet supprimé | **Confirmé** | `Project` a `@DeleteDateColumn`, pas `ShoppingList` |
| R8 | Filtre MIME faisant confiance au client | **Partiellement confirmé** | Le filtre multer, oui. Mais le `mime_type` stocké **et resservi** vient déjà de `sharp` (`metadata.format`), pas de l'en-tête client — la conclusion « n'importe quelle suite d'octets stockée sous `image/jpeg` » est fausse. Le risque résiduel nommé par le constat (octets bruts atteignant le décodeur natif) est réel |
| R9 | cv-service sans authentification | **Confirmé** | Aucun `Depends` dans `app/` |
| R10 | Migrations dans le `CMD` | **Confirmé** | Ni verrou, ni code de sortie distinct |
| R11 | `persist()` non transactionnel | **Confirmé** | `delete` puis `upsert` hors transaction, à l'identique dans les deux services |

### Décisions de conception

- **R1 — un seul limiteur, pas une parade opt-in.** La cause n'est pas que 27 contrôleurs
  ont oublié la parade : c'est qu'un second limiteur nommé *ne peut pas* être opt-in dans
  cette bibliothèque. Le nombre de limiteurs globaux passe donc à un (100/min), et les
  plafonds stricts deviennent des surcharges de route. Le sens de l'oubli s'inverse : une
  route non décorée hérite du plafond permissif, jamais d'un plafond bloquant.
- **R2 — corriger le puits, pas le cas.** `serializeJsonLd` est appliqué aux **trois**
  pages, y compris les deux qui n'étaient pas exploitables. Le constat notait que rien ne
  distinguait la page dangereuse des autres : une règle uniforme est ce qui le règle.
- **R4 — un seuil que la CI peut tenir.** L'audit bloquant est à `critical` sur les
  dépendances de production, pas à `high` : 41 advisories `high` transitives sont ouvertes,
  et une barrière rouge en permanence n'est pas une barrière. Les 2 advisories critiques
  existantes (`protobufjs`, `websocket-driver`) sont résolues par des `pnpm.overrides` —
  87 vulnérabilités prod contre 102 avant. Un second passage `high` non bloquant rend
  l'état réel visible sans faire du rouge permanent.
- **R5 — dériver, ne pas ressaisir.** Les versions du job CI sont extraites de
  `requirements.txt` par `grep`, avec échec explicite si le sous-ensemble ne résout plus
  5 paquets. Ré-épingler à la main aurait recréé la dérive un cran plus loin.
- **R6 — tenir l'invariant, pas les 30 cas.** Au-delà du transformer partagé, un test
  parcourt les 46 fichiers d'entités et échoue si une colonne `numeric` déclarée `number`
  n'a pas de transformateur. Le compilateur ne peut rien dire ici : le type déclaré ment.
- **R8 — corriger ce qui est vrai.** Vérification des octets de signature **avant** que le
  fichier n'atteigne sharp/libvips, et commentaires corrigeant l'idée que le filtre multer
  serait la validation.

### Vérification

- API : 908 tests unitaires, 177 e2e — verts. Build `nest build` vert.
- Web : 311 tests, build Next vert. Widget : 18 tests, lint, build verts.
- cv-service : `compileall` + 8 tests d'authentification verts.
- R1, R3, R6, R7 : correction prouvée par retrait temporaire du correctif et constat de
  l'échec des tests correspondants.
- R10 : `dist/scripts/migrate.js` et `pnpm migration:run` exécutés contre la base de
  développement réelle — verrou pris, schéma à jour, sortie 0.

### Reste ouvert (hors périmètre de ce lot)

- 41 advisories `high` transitives : le seuil de l'audit bloquant est à relever une fois
  l'arbre assaini.
- R10 : aucun `down` automatisé côté déploiement — c'est une décision de procédure de
  déploiement, pas de code.
- Constats DATA-4 rappelés par la revue (k-anonymat adossé à un `organization_id` gratuit,
  garde de dispersion, collecte non paginée) : non traités ici, ils appellent une reprise
  du module, pas un correctif ponctuel.

---

## Revue de sécurité — lot « suppression de compte » (02/08/2026)

Trois constats soumis. Vérification d'abord, correction ensuite.

### Constats non retenus

- **2.1 — build API cassé (`TS2345` sur le délégué CORS).** Non reproduit :
  `pnpm --filter @chiffreo/api build` sort en 0 et produit `dist/main.js`. Le constat
  portait sur `b733797` ; `2631153` a typé le délégué et documenté le point
  (`main.ts:53-55`).
- **2.3 — XSS persistante via le JSON-LD communautaire.** Déjà corrigé par le même lot :
  `serializeJsonLd` échappe `< > & U+2028 U+2029` et la page l'utilise à la place de
  `JSON.stringify`. La lacune de couverture signalée (« le test ne regarde que l'objet »)
  est elle aussi comblée : `json-ld.spec.ts:57-83` assemble le bloc rendu et vérifie
  l'absence de `</script`.

### Constat 2.2 — retenu, et confirmé sur les quatre scénarios

Cause racine telle que formulée par la revue : PLAT-4 a déplacé la propriété des données
de l'utilisateur vers l'organisation **dans le code et dans les commentaires d'entités**,
sans que les clés étrangères suivent. Elles sont restées écrites pour un monde où
l'utilisateur *était* le propriétaire — toutes en `ON DELETE CASCADE`. Un simple
`DELETE FROM users` suffisait donc à produire trois résultats faux.

Le correctif rend au schéma les invariants que le code croyait tenir, plutôt que d'ajouter
des garde-fous applicatifs par-dessus des cascades intactes.

- **D1 — la facturation d'abord.** `SubscriptionsService.cancelForAccountDeletion` résilie
  chez Stripe *puis* efface la ligne. `FK_subscriptions_user` passe en `RESTRICT` : ce
  chemin devient le seul par lequel un abonné peut être supprimé. L'erreur Stripe n'est pas
  avalée — la traiter en best-effort rétablirait exactement le défaut corrigé.
- **D2 — les données collectives ensuite.** `FK_organizations_owner` passe en `RESTRICT`.
  Une organisation ne disparaît avec son propriétaire que si elle ne concerne que lui ;
  dès qu'un autre membre existe, la suppression est refusée (409) et nomme l'organisation
  bloquante. Décision produit retenue : bloquer plutôt que transférer d'office — un
  transfert automatique imposerait silencieusement une responsabilité, et un palier
  d'abonnement, à quelqu'un qui ne l'a pas demandée.
- **D3 — l'auteur s'efface, la donnée reste.** Les FK d'auteur des 5 tables PLAT-4
  (`projects`, `clients`, `quotes`, `invoices`, `company_profiles`) passent en `SET NULL`,
  colonnes rendues nullables. C'est la seule lecture cohérente avec les commentaires
  d'entités, et le bon geste RGPD : on efface l'identifiant personnel, pas la comptabilité
  de l'entreprise. Une facture ne peut pas disparaître avec son émetteur (art. L102 B LPF).
  Le schéma le faisait déjà là où la question s'était posée — `api_keys` (PLAT-5),
  `organization_invitations` (PLAT-4).
- **D4 — l'identité en dernier.** L'ordre était inversé : une panne SQL après la
  suppression Firebase laissait des données sans principal pour se réauthentifier, donc
  sans reprise possible. En terminant par Firebase, le pire cas est un principal survivant
  à des données déjà effacées — la reconnexion recrée un compte vide et la reprise reste
  ouverte. Strictement moins grave que l'inverse.

**Périmètre volontairement non élargi.** Les FK d'auteur restées en cascade le sont à
raison : `room_log_entries` (carnet du logement, clé sur le seul `user_id`), `community_*`
et `lifecycle_email_sends` sont réellement personnels.

**Conséquences assumées, rendues visibles par le compilateur.** Rendre `user_id` nullable a
fait remonter 6 sites qui postulaient un auteur toujours présent — c'était le but. Deux
fonctionnalités nominatives (relance de devis PRO-3, e-mail « projet abandonné » PLAT-2)
écartent désormais les lignes sans auteur : il n'y a plus personne à relancer. Les faire
retomber sur le propriétaire de l'organisation serait un changement de produit, pas un
correctif.

**Effet de bord traité.** `mergeGuestAccount` supprimait l'invité par la même cascade ; il
passe par le chemin explicite, sans quoi le `RESTRICT` l'aurait cassé. `deleteUser` — la
suppression nue, désormais un piège — est retirée du service.

### Vérification

- Schéma prouvé sur une **copie de la base de dev réelle** (`pg_dump` → `chiffreo_mig_test`) :
  les 7 FK passent de `c` à `n`/`r` comme prévu. La découverte dynamique du nom de
  contrainte s'est avérée nécessaire — `projects` portait `projects_user_id_fkey`
  (généré par PostgreSQL), les quatre autres un `FK_<table>_user` explicite.
- Scénarios prouvés en SQL, pas seulement en test unitaire : facture d'un membre supprimé
  **conservée avec auteur à `NULL`** ; suppression d'un propriétaire d'organisation
  partagée **refusée** ; suppression d'un abonné Stripe non résilié **refusée**.
- Réversibilité : `up` → `down` → `up`. Le `down` restitue l'état d'origine à l'identique,
  y compris le cas limite d'une ligne dont l'auteur avait déjà été effacé — relogée au
  propriétaire de l'organisation plutôt que perdue.
- API : 926 tests unitaires (+18) et 177 e2e verts, `nest build` et `eslint` verts.
  Web : 311 tests verts. Migration appliquée à la base de dev réelle.

---

## Revue externe — constats 2.4 / 2.5 / 2.6 (02/08/2026)

Trois constats reçus, tous vérifiés dans le code avant correction (leçon 6), tous
confirmés. Ordre de travail : un test rouge par risque nommé, puis le correctif (leçon 8).

### 2.4 — Le CV fabrique des dimensions non observées puis les persiste (bloquant)

**Vérifié.** `_calculate_dimensions` substitue des constantes à trois endroits :
`w * 0.8` sans sol, `h * 0.7` sans profondeur de sol, `h * 0.6` sans ligne de mur
horizontale ; puis `max(..., 100/100/200)`, `min(..., 2000/2000/500)` et
`height_cm = 250` hors [200, 400]. Reproduction confirmée à la lecture : 480×640,
sol vide, aucune ligne, 10 px/cm → 100 × 100 × 200 avec `status="success"`.

- [x] Test rouge : sol vide / aucune ligne de mur / profondeur constante → pas de `success`
- [x] `_calculate_dimensions` renvoie `Optional[Dimensions]` : chaque axe vient d'une
      géométrie observée, sinon `None`. Aucune constante de remplissage.
- [x] Les fenêtres de plausibilité deviennent une **validation** (rejet) et non un
      **écrêtage** (fabrication d'une valeur à la borne).
- [x] `process()` retombe sur la branche existante « reference detected but dimensions
      could not be computed » → `status="error"` → job FAILED → l'UI bascule sur la saisie
      manuelle. Pas de nouveau statut, pas de changement de contrat API/web.

### 2.5 — Le cache PWA peut restituer les projets d'un compte à un autre (majeur)

**Vérifié.** `chiffreo-api-v1` est indexé par URL seule, purgé uniquement dans `logout`
et `deleteAccount`. `onIdTokenChanged` ne purge rien : B qui se connecte directement
hérite du cache de A. Caddyfile confirme bien deux domaines (`chiffreo.fr` /
`api.chiffreo.fr`), donc la branche cross-origin est bien active.

- [x] Test rouge : deux identités successives, la seconde ne doit rien lire de la première
- [x] `sw.js` : cache API partitionné par identité — nom `chiffreo-api-v1-<uid>`, uid lu
      dans la charge utile du jeton porté par la requête. Sans jeton exploitable :
      réseau direct, ni lecture ni écriture.
- [x] `AuthContext` : purge sur **changement d'identité**, plus seulement sur `logout`.
      Dernier uid mémorisé en `localStorage` pour survivre à un rechargement.
- [x] `clearOfflineCaches` énumère les caches par préfixe (les partitions par uid ne sont
      plus énumérables en dur).

### 2.6 — Les jobs CV ne sont ni exclusifs, ni durables, ni atomiques (majeur)

**Vérifié.** Les quatre scénarios tiennent : contrôle d'absence puis insert non atomiques
et aucune contrainte d'unicité ; traitement en promesse mémoire sans reprise ni
expiration ; `COMPLETED` écrit **avant** dimensions et ouvertures ; `openings.length > 0`
garde le `removeCvOpenings`, donc une analyse sans ouverture conserve les précédentes.

- [x] Tests rouges : démarrage concurrent, job périmé bloquant, échec après dimensions,
      analyse sans ouverture
- [x] Migration : index unique partiel sur `project_id` où `status IN ('pending','processing')`
      (avec résorption des doublons existants), + violation d'unicité traduite en 409
- [x] Reprise : un job actif sans progression depuis 15 min est marqué `failed` avant
      le contrôle d'absence et à la lecture du statut — plus de projet bloqué à vie
- [x] `ProjectsService.applyCvAnalysis` : dimensions + remplacement intégral des ouvertures
      CV dans **une seule transaction**, et `COMPLETED` écrit seulement après. Le
      remplacement des ouvertures ne dépend plus de la non-vacuité de la liste.

### Revue

**Les trois constats étaient exacts tels qu'écrits.** Chacun a été reproduit par un test
rouge avant correction (leçon 8) ; les six scénarios nommés par le constat 2.6 échouaient
tous, y compris la reproduction chiffrée du 2.4.

**2.4 — la constante de remplissage dégradait aussi les mesures réussies.** Le repli le
plus coûteux n'était pas celui des scènes vides mais `max(hauteur_murs, h * 0.6)`, actif
sur *les deux* scénarios de non-régression CV-7 : il gonflait la hauteur recouvrée bien
au-delà de la géométrie observée. En le retirant, `a4_small_room` passe de 243 cm à 217 cm
pour 220 attendus, et `door_medium_room` tombe à 259 cm pour 260. Le garde-fou à 20 % de
déviation absorbait l'écart et rendait le repli invisible — ce qui explique qu'il ait
survécu à une suite de non-régression verte.

Les fenêtres de plausibilité deviennent une validation : hors fenêtre, le triplet est
rejeté, jamais ramené à la borne. Aucun statut ni contrat n'a été ajouté — la branche
`no dimensions` existait déjà et mène au bon endroit (job `failed`, saisie manuelle).

**Périmètre non élargi, volontairement.** Le constat reproche aussi à l'API d'écrire les
dimensions « avant toute acceptation utilisateur ». Ce n'est pas corrigé : c'est le produit
tel que conçu (source `cv`, score de confiance, incertitude CV-5, correction manuelle qui
efface le tout). La faute était que ces valeurs n'étaient pas mesurées, pas qu'elles soient
écrites. Une validation explicite avant persistance serait un changement de produit.

**2.5 — la purge ne pouvait pas être le mécanisme principal.** Elle dépend d'un événement
facultatif. Deux corrections, l'une structurelle, l'autre de rattrapage :

- le cache API porte désormais l'uid dans son **nom** (`chiffreo-api-v1-<uid>`), lu dans la
  charge utile du jeton de la requête. Un hit ne peut plus traverser deux comptes, quoi
  qu'il arrive au cycle de vie de la session. Sans jeton attribuable : réseau direct, ni
  lecture ni écriture ;
- la purge s'accroche au **changement d'identité** et non à `logout`, avec le dernier uid
  en `localStorage` pour survivre à un onglet fermé. Une identité inconnue purge aussi.

Le cache de pages n'est pas partitionnable de la même façon (une navigation ne porte pas de
jeton) — mais les pages projet sont des composants client : leur HTML ne contient aucune
donnée de compte, qui arrive par les appels API. La purge couvre le reste.

**2.6 — une ligne de statut ne peut pas être à la fois une file et une transaction.** Les
trois contrats sont rendus à qui sait les tenir :

- **exclusivité** → index unique partiel sur `project_id` où le statut est actif. Le
  contrôle applicatif reste, mais pour la lisibilité du 409, pas pour la garantie ; la
  violation d'unicité est traduite en 409 elle aussi ;
- **durabilité** → `reclaimStaleJobs` marque en échec tout job actif sans battement depuis
  15 min, avant un démarrage et avant une lecture de statut. Un client qui interroge un job
  perdu obtient enfin une réponse au lieu de tourner ;
- **atomicité** → `ProjectsService.applyCvAnalysis` écrit dimensions et ouvertures dans une
  seule transaction, et le job ne passe `COMPLETED` qu'après. Le remplacement des ouvertures
  devient inconditionnel : c'est ce qui corrige la liste vide.

`removeCvOpenings` disparaît : plus aucun appelant, et sa forme (supprimer sans remplacer)
était précisément ce qui permettait la fenêtre incohérente.

### Vérification

- **Tests rouges d'abord**, pour chacun des six scénarios nommés. Le test de concurrence a
  d'abord été *intermittent* — la course existe mais ne se produit pas à tous les
  ordonnancements. Une barrière force l'entrelacement : il est maintenant rouge à tous les
  coups sans la contrainte, vert avec.
- **Résorption des doublons de la migration jouée sur une base réelle**, pas seulement
  lue : deux jobs actifs sur un projet plus un job terminé → le plus récent survit, le plus
  ancien passe `failed`, le terminé n'est pas touché, l'index se crée.
- Réversibilité couverte par `schema.int-spec.ts` (up → down → up sur la dernière migration).
- API : 926 unitaires, 177 e2e, 19 intégration verts. Web : 319 verts (+8).
  cv-service : 65 verts (+6). `nest build`, `eslint` API et web, `tsc --noEmit` web verts.

**Défaut préexistant traité à part** (leçon 4) : `persistence.int-spec.ts` était rouge sur
un arbre propre. Le test attendait encore la cascade `users → organizations`, remplacée par
un `RESTRICT` au commit précédent. Réécrit pour attester le contrat réel — la suppression
nue est refusée, et l'effacement passe par l'organisation. Sans rapport avec les trois
constats, donc commit séparé.

Cinq erreurs `tsc` dans des `*.spec.ts` (invoices, org-context, photos, projects) sont
également préexistantes, vérifiées identiques sur un arbre propre. Elles n'atteignent pas
la CI : `nest build` compile via `tsconfig.build.json`, qui exclut les tests. Non traitées
ici — hors périmètre, et à voir avec la question plus large de savoir si les specs doivent
être type-checkées.

## Revue externe — constats 2.7 / 2.8 / 2.9 (02/08/2026)

Trois constats reçus, tous vérifiés dans le code avant correction (leçon 6). Rédigés sur
`b733797`, vérifiés sur `HEAD` (73ff37b) : l'écart compte pour 2.7, dont un volet a déjà
été corrigé entre-temps. Ordre de travail : un test rouge par risque nommé, puis le
correctif (leçon 8).

### 2.7 — La liste d'achats autorise pertes de mises à jour et états « terminés » incomplets

**Partiellement corrigé, le reste confirmé.** Le volet « perte de mise à jour sur `PATCH` »
n'existe plus : `update()` prend un `pessimistic_write` en transaction depuis 2631153,
couvert par `persistence.int-spec.ts`. Les cinq autres volets sont réels.

- [x] `generate()` = `delete` puis `insert` non atomiques → une panne entre les deux perd la liste
- [x] `regenerate()` restaure les prix dans une **écriture séparée**, et sans verrou
- [x] La finalisation ne contrôle que `material_items` : un complémentaire non tarifé produit
      `is_complete: false`, et le résumé est persisté quand même
- [x] Le résumé et le passage `COMPLETED` sont deux écritures indépendantes
- [x] La communauté teste la présence de `budget_summary_json`, jamais son `is_complete`

### 2.8 — Un crash peut rendre un webhook Stripe définitivement « traité »

**Vérifié.** `claimWebhookEvent` insère la ligne avant le traitement ; `releaseWebhookEvent`
n'est appelé que depuis un `catch`. Un arrêt du processus ne l'exécute pas. `processed_at`
est un `@CreateDateColumn` : il date la **réservation**, pas la réussite — un seul marqueur
pour deux états.

- [x] Test rouge : un event réservé puis abandonné doit redevenir rejouable
- [x] Test rouge : un event réellement traité ne doit **jamais** redevenir rejouable

### 2.9 — Des requêtes widget invalides peuvent épuiser le quota mensuel

**Vérifié.** Ordre NestJS : gardes → intercepteurs → **pipes** → handler. Le guard appelle
`consume()` avant que le `ValidationPipe` n'ait vu le corps. La clé `wgt_…` est publique et
`Origin` est forgeable (le doc-comment du guard l'assume déjà). Même défaut sur
`partner/estimate` via `ApiKeyGuard`, et **même compteur mensuel** : à corriger d'un seul geste.

- [x] Test rouge : `POST /widget/:key/estimate` avec `{}` → 400 **et** compteur inchangé

### Plan

- [x] **A.** Liste d'achats : `generate`/`regenerate` fusionnés en une écriture **en place**
      (plus de `delete` + `insert`), sous le même verrou de ligne que `update()`. Prix des
      matériaux **et** des compléments reportés dans la même écriture.
- [x] **A.** `finalizeBudgetSummary` : la postcondition devient le contrôle — refus si
      `!summary.is_complete`, une seule source de vérité (`computeBudgetSummary`). Résumé et
      passage `COMPLETED` dans une seule transaction (`updateStatus` reçoit un `manager?`).
- [x] **A.** Communauté : exiger `budget_summary_json.is_complete`.
- [x] **B.** Séparer « réservé » (`claimed_at`) de « traité » (`processed_at`, désormais
      nullable) ; reprise d'une réservation périmée après 15 min ;
      `markWebhookEventProcessed` appelé après succès.
- [x] **C.** `consume()` → `peek()` dans les deux guards (lecture seule) + nouveau
      `QuotaConsumptionInterceptor` qui consomme sur le **succès** du handler, donc après
      les pipes.

### Ce qui a été fait

**2.7 — le document, son statut et ses effets aval deviennent une seule transition.** La
liste n'est plus détruite puis recréée : `generate` et `regenerate` se rejoignent dans un
`buildAndPersist` qui écrit **en place**, sous le verrou de la ligne existante. Trois
conséquences, dont deux gratuites :

- la fenêtre « ni ancienne ni nouvelle liste » disparaît, et les prix relevés sont écrits
  dans la même instruction que les lignes régénérées au lieu d'un troisième `save` ;
- `update()` verrouillait jusqu'ici une ligne que `regenerate()` s'apprêtait à supprimer —
  un verrou qui ne protégeait rien. Les deux chemins prennent enfin le même ;
- le jeton de partage survit à une régénération. C'était un effet de bord silencieux : le
  lien transmis au client mourait sans que personne ne l'ait demandé.

Les prix des **compléments** sont reportés au même titre que ceux des matériaux — ils ne
l'étaient pas, ce qui devenait intenable dès lors que la finalisation les exige.

`finalizeBudgetSummary` ne duplique plus le contrôle : il décide sur `summary.is_complete`,
c'est-à-dire sur la sortie de `computeBudgetSummary`, la fonction qui compte. La divergence
entre « ce qu'on vérifie » et « ce qu'on compte » — d'où sortait le résumé `is_complete:
false` persisté — n'est plus exprimable. Lecture verrouillée, validation, écriture du résumé
et passage `COMPLETED` tiennent dans une transaction (`ProjectsService.updateStatus` accepte
un `manager`). La communauté exige `is_complete`, pas la seule présence du résumé.

**2.8 — deux faits, deux colonnes.** `processed_at` datait l'insertion, donc la
*réservation*. `claimed_at` la porte désormais, et `processed_at` reste nul jusqu'au succès
réel. `claimWebhookEvent` devient un `INSERT … ON CONFLICT DO UPDATE … WHERE processed_at IS
NULL AND claimed_at < now() - 15 min` : une réservation abandonnée par un processus mort
redevient reprenable, un traitement abouti ne l'est jamais.

**2.9 — comptabiliser après le travail, pas avant la validation.** Les gardes passent en
lecture seule (`peek`, refus à `count >= limit`) : plus rien n'est débité avant le
`ValidationPipe`. Un `QuotaConsumptionInterceptor` débite sur le chemin de retour de
`next.handle()`, donc après les pipes **et** le handler. `consume()` reste l'incrément et la
décision dans la même instruction — la garantie anti-concurrence est intacte, seule sa
position change. Posé sur les deux surfaces : le compteur est partagé avec `partner/*`, le
corriger d'un seul côté aurait laissé la moitié du chemin.

### Vérification

- **Rouge d'abord, à rebours** (leçon 10) : chaque mécanisme corrigé a été temporairement
  remis dans son état d'origine. `ON CONFLICT DO NOTHING` → 1 rouge, `reprend une
  réservation abandonnée`, les 4 anciens verts. Contrôle sur les seuls matériaux → 1 rouge,
  `refuse de finaliser quand un complémentaire n'a pas de prix`. `consume()` dans le garde →
  3 rouges, dont `ne consomme aucun quota sur un corps invalide` sur la vraie pile Nest.
- **Intégration** : régénération et `PATCH` concurrents sur PostgreSQL réel — une seule
  ligne, la même qu'au départ, prix conservé dans les deux ordonnancements. Reprise d'un
  event abandonné, non-reprise d'un event abouti.
- **e2e** : `POST /partner/estimate` avec `{}` → 400 sans consommation ; moteur en panne →
  500 sans consommation ; plafond atteint → 429 **sans faire travailler le moteur**.
- Réversibilité de la migration couverte par `schema.int-spec.ts` (up → down → up sur la
  dernière migration), ainsi que la dérive entités ↔ colonnes.
- API : 946 unitaires, 180 e2e, 22 intégration verts (+18, +5, +3). Web 319, widget 18.
  `nest build` et `eslint` API verts.

### Écarts assumés

- **Le carnet du logement reste hors de la transaction de finalisation.** Il fait ses
  propres lectures et son écriture est un upsert sur `(project_id, room_id)` : une
  ré-finalisation le rejoue sans doublon. L'y faire entrer demanderait de propager le
  manager dans `LogbookService` et `ProjectsService.getRooms`, pour un gain nul.
- **Un crash entre le commit de l'effet métier Stripe et son marquage rejoue l'effet** au
  bout de 15 minutes. C'est le sens de la garantie Stripe (*at-least-once*) et l'inverse du
  défaut corrigé — une perte définitive. L'annuler exigerait de marquer l'event dans la
  transaction de chaque handler.
- **Le compteur mensuel peut dépasser la limite du nombre d'appels en vol** (≤ 120, borné
  par la rafale) : deux requêtes simultanées peuvent lire un `peek` sous le plafond et
  consommer toutes deux. Direction bénigne — jamais un refus de trop, jamais une
  facturation de trop —, et à comparer à l'ancien compteur qui enflait sur chaque rejet.
- **Les events Stripe déjà en base restent « traités ».** Distinguer rétroactivement ceux
  qui auraient été abandonnés est impossible ; les rejouer en masse serait la panne inverse.

---

## Revue externe — « briques intelligentes inertes par construction » (02/08/2026)

Constat reçu : les trois briques de différenciation (facteurs de perte appris, benchmark de
coûts, boucle CV) ne produiront rien avant plusieurs centaines de chantiers finalisés, et ont
été construites avant le premier. Vérifié sur `HEAD` (4db083e), volet par volet (leçon 9).

### Ce qui est exact

- **DATA-3** : `minObservations: 8` (`waste-learning.ts:88`). Le cap par organisation est en
  réalité **3**, pas 5 : `organizationObservationCap` dérive `min(5, ⌈8/2⌉−1)`
  (`waste-learning.ts:147-152`). Il faut donc **≥ 3 organisations distinctes** par cellule.
- **DATA-4** : `minObservations: 10`, `minOrganizations: 5`, `maxObservationsPerOrg: 3`
  (`cost-benchmark.ts:104-109`), doublés d'un `CHECK` en base
  (`1711468800059-CreateCostBenchmarks.ts:30-31`). Rien n'est écrit sous les seuils.
- **CV** : `apps/cv-service/models/` ne contient qu'un README, et `retrain.py:168-171` exige
  une release `cv-model-vN` qui n'a jamais été publiée.

### Ce qui ne l'est pas

- Les poids ne sont **pas censés** être dans `models/` : ils sont gitignorés et publiés en
  artefact de release (`models/README.md:1-6`). Le déploiement est bloquant sur leur présence
  (`.github/workflows/deploy.yml:80-94`, `test -s`). En production, l'absence de modèle ne
  donne pas un repli silencieux : elle donne un déploiement refusé.
- Le bootstrap « aucun modèle → v1 » est documenté et outillé sans baseline
  (`training/README.md:47-72`, `train.py` part du checkpoint COCO). Seul le run GPU manque.

### Le défaut réel, et ce qu'il n'est pas

Les seuils sont justes : sous 8 observations une médiane est du bruit, et sous 5 organisations
publier une médiane trahit une dépense individuelle. **Les baisser serait la mauvaise
correction.** Le défaut est que l'inertie est **invisible et indiscernable d'une panne** :

- [x] DATA-3 — `waste-learning.ts:189-191` promet une ligne par cellule « y compris celles
      écartées, pour que l'admin puisse voir *pourquoi* une cellule n'apprend pas » ; la
      persistance les jette (`waste-learning.service.ts:281`) et aucun endpoint ne les expose.
      Le commentaire ment.
- [x] DATA-3 — le `sample_size` publié est post-plafonnement : le volume **brut** collecté et
      le nombre d'organisations n'apparaissent nulle part. La cause n°1 de blocage (moins de
      3 organisations) est donc structurellement indiagnosticable.
- [x] DATA-4 — même angle mort côté admin : `by_status` donne un compte de cellules, jamais
      lesquelles ni à quelle distance du seuil.
- [x] DATA-4 — côté web, `CostBenchmarkPanel.tsx:76` fait `return null`. Une erreur réseau
      (`page.tsx:102-104`, `catch {}`) produit **exactement le même écran** qu'une cohorte
      insuffisante : rien. Fonction facturée au palier Pro, muette et indiscernable d'un bug.
- [x] CV — le mode réellement utilisé n'est ni dans `AnalyzeResponse`, ni sur l'ouverture
      détectée. Une boîte produite par Canny et une boîte produite par YOLO sortent avec le
      même `confidence` sur la même échelle 0-1, et l'utilisateur lit « Ouvertures détectées »
      dans les deux cas.
- [x] CV — `apps/cv-service/README.md:187` documente des seuils de confiance `high ≥ 0.7 /
      medium ≥ 0.4` alors que le code applique `≥ 0.95 / ≥ 0.85`.

### Plan

1. **DATA-3** — `WasteLearningOutcome` porte `organization_count` et `raw_sample_size` (avant
   plafonnement) ; le résumé de run expose le détail des cellules non apprises ; le log du cron
   nomme le premier obstacle. Aucun changement de seuil, aucune écriture nouvelle en base.
2. **DATA-4** — même détail dans le résumé de run admin, **sans persistance** (la décision
   documentée en `admin-cost-benchmark.controller.ts:20-23` de ne pas conserver la trace des
   cohortes sous le seuil est conservée : le détail reste éphémère et réservé à l'admin).
3. **DATA-4 web** — distinguer trois états : chargement, erreur, pénurie de cohorte. Le
   panneau dit ce qu'il attend au lieu de disparaître.
4. **CV** — `source` sur chaque ouverture détectée + `opening_detector` en champ de premier
   niveau de `AnalyzeResponse` ; propagation API → DTO → écran, sans migration
   (`analysis_jobs.result_json` porte déjà la réponse entière). `raw_output["opening_detector"]`
   est conservé tel quel : `build_user_dataset.py:277` en dépend.
5. **CV doc** — aligner les seuils du README sur le code.

### Écart assumé

Ce lot ne rend aucune des trois briques active : c'est une question de volume de chantiers,
pas de code. Il rend leur inactivité **mesurable** — l'opérateur voit la distance au seuil,
l'utilisateur voit la différence entre « pas encore » et « en panne ».

### Review

**Les seuils n'ont pas bougé d'un point.** `minObservations: 8`, `minOrganizations: 5`,
`maxObservationsPerOrg: 3`, le `CHECK` k-anonymat en base : tout est intact. Ce lot ne rend
aucune brique active — il rend leur inactivité mesurable, et la distingue d'une panne.

**DATA-3.** `WasteLearningOutcome` porte `raw_sample_size` (volume avant plafonnement) et
`organization_count`. `wasteLearningShortfall` traduit une cellule bloquée en deux manques,
et le second est celui qui compte : à 2 organisations, le plafond borne l'échantillon à 6 et
**aucun chantier supplémentaire de ces mêmes clients ne débloquera jamais la cellule**. Le
résumé de `run()` liste les cellules non apprises, les plus proches en tête ; le log du cron
nomme la première. Rien de neuf en base : seules les cellules apprises y entrent, comme avant.

**DATA-4.** Même détail dans le résumé de run, `pending`, éphémère et réservé à l'admin — la
décision de ne pas conserver la trace des cohortes sous le seuil est conservée, et aucun coût
n'apparaît dans ces lignes, seulement des comptages. `benchmarkShortfall` retient le plus
exigeant des deux planchers d'organisations (le k, 5, contre `⌈10/3⌉ = 4`).

**DATA-4 web.** Quatre états distincts au lieu de deux, parce qu'ils appellent quatre gestes
différents : paywall, panne (« rechargez »), attente de cohorte (« pas encore de référence »,
avec les ouvrages nommés et la méthode), publié. `loadBenchmark` remonte son échec au lieu de
l'avaler — un `catch {}` suivi d'un `return null` faisait passer un bug pour une pénurie.

**CV.** `opening_detector` devient un champ de premier niveau d'`AnalyzeResponse`, renseigné
sur les **cinq** points de sortie, chemins d'erreur compris. Il traverse `CvAnalysisResponse`,
`AnalysisStatusDto`, `useAnalysis`, jusqu'à un avertissement à l'écran en mode `heuristic`.
`raw_output["opening_detector"]` est inchangé : `build_user_dataset.py:277` en dépend. Aucune
migration — `analysis_jobs.result_json` porte déjà la réponse entière. Pas de champ par boîte :
le détecteur est choisi une fois au démarrage, une provenance par ouverture répéterait la même
valeur sans rien ajouter.

**Doc.** `cv-service/README.md` annonçait `high ≥ 0.7 / medium ≥ 0.4` là où le code applique
`≥ 0.95 / ≥ 0.85`. Corrigé, et `docs/API.md` documente les deux nouveaux champs.

### Vérification

- **Rouge d'abord, à rebours** (leçon 10) : chaque mécanisme remis dans son état d'origine.
  `pending: []` + volume brut non calculé → **4 rouges**, tous décrivant le défaut
  (`Received length: 0`, `Expected: 10 / Received: 3`, `Expected: 4 / Received: 0`) et non le
  harnais (leçon 12). `opening_detector` retiré des points de sortie → **2 rouges**,
  `assert 'none' == 'heuristic'`. Correctifs rétablis, tout revert.
- API : 968 unitaires verts (70 suites), `nest build` et `eslint` verts.
- Web : 336 tests verts (50 suites), `tsc --noEmit` et `eslint` verts.
- cv-service : 86 tests verts (+7).
- Les erreurs `tsc` résiduelles de l'API (5, toutes dans des `*.spec.ts` : invoices,
  org-context, photos, projects) sont **préexistantes** — vérifiées identiques sur un `main`
  propre par `git stash` (leçon 4). Hors périmètre de ce lot.

### Écarts assumés

- **Aucune des trois briques ne s'allume.** C'est un problème de volume de chantiers, pas de
  code, et le corriger en code voudrait dire publier du bruit statistique ou une médiane
  ré-identifiable. Le lot rend la distance au seuil lisible ; la franchir demande des clients.
- **`CvClientService.healthCheck()` reste sans appelant**, et le healthcheck Docker du
  cv-service ne lit pas le corps de `/health` : un conteneur en repli heuristique est déclaré
  `healthy`. Le rendre `unhealthy` casserait le développement local, où l'absence de poids est
  normale. La barrière réelle reste au déploiement (`deploy.yml`, `test -s` bloquant), et le
  mode est désormais visible jusque dans l'écran utilisateur.
- **`cv-model-v1` n'est toujours pas publié** : le run GPU du runbook CV-1 est un travail
  d'entraînement, pas un correctif. `retrain.py` continue d'échouer proprement en le réclamant.

---

# GTM-7 — Une audience par surface

## Contexte

Constat entrant : « la proposition de valeur s'est dispersée sur quatre produits » —
calculateur gratuit, DIY 9,99 €, artisan 50-200 €, Enterprise (SSO/API/widget) — et la
landing hésite, décrivant le parcours DIY (« votre niveau de bricolage ») avant de basculer
sur un tunnel artisan (« Photo de la pièce chez le client → Devis PDF envoyé sur place »).

Le constat est exact, et la landing n'en était que le symptôme visible. L'offre était
décrite à **trois endroits sans lien** : la prose marketing de `apps/web/src/lib/pricing.ts`,
les prix de `apps/api/src/subscriptions/plans.constants.ts`, et la table `feature_gates` —
seule à être réellement appliquée. Rien ne reliait les trois : la dérive n'était pas un
accident, c'était la conception (même forme que la leçon 5).

Quatre défauts vérifiés sur `HEAD` avant correction :

1. Le palier Standard vendait **deux fonctionnalités qui n'existent pas** (« Modèles de devis
   personnalisés », « Historique clients avancé ») pendant que ses deux vraies gates,
   `site_tracking` et `quote_reminders`, restaient invisibles.
2. **Neuf gates livrées et activées** n'étaient annoncées nulle part.
3. Le palier `enterprise` était **appliqué en base et injoignable** : `min_tier: 'enterprise'`
   accepté par le DTO, gate `enterprise_sso` seedée active, mais `PlanTier` côté web ne
   connaissait que `free | pro | contractor` et `/pricing` ne l'affichait pas.
4. `LANDING_PLANS` était une **seconde copie de l'offre** écrite à la main pour la landing —
   la porte par laquelle la dérive était entrée.

Et la confusion d'audience touchait **trois pages**, pas une : `/calculateurs` et
`/calculateurs/[type]` vendaient « suivi de chantier » (gate `contractor_standard`) à un
visiteur anonyme DIY.

## Décision

Traduction en architecture de l'information de PRODUCT_STRATEGY §4.2 : **une audience, une
surface**. `/` au particulier, `/artisans` (nouvelle) à l'artisan, `/pricing` groupée par
audience avec bandeau Enterprise sur devis. Aucune page ne consacre de section à une autre
audience que la sienne — seulement un lien de bascule dans l'en-tête.

L'audience devient une **donnée** (`audience` sur chaque plan, table `AUDIENCE_DEFINITIONS`),
et chaque ligne d'offre est adossée à sa `feature_key` réelle.

## Réalisation

- **`lib/feature-gates-catalogue.ts`** *(nouveau)* — miroir des 17 gates seedées par les
  migrations, avec leur `min_tier` effectif, plus `GATES_NOT_MARKETED` (les clés
  délibérément écartées, avec leur raison). Un miroir plutôt qu'un appel API : `GET
  /feature-gates` est derrière `FirebaseAuthGuard` et `/pricing` est publique et statique.
- **`lib/pricing.ts`** — refonte : `PlanTier` réaligné sur `SubscriptionTier` de l'API,
  `audience` par plan, features en `{ label, gateKey }`, `nonGateReason` obligatoire quand
  `gateKey` est `null` (ensemble fermé : `quota | socle | heritage | support | contrat`),
  plan `enterprise` ajouté, `LANDING_PLANS` supprimé.
- **`__tests__/offer-catalogue.spec.ts`** *(nouveau, 10 tests)* — garde-fou.
- **`components/marketing/`** *(nouveau)* — `MarketingHeader`, `MarketingFooter`, `PlanCard`.
  `/artisans` aurait été la 5e copie de l'en-tête et la 4e du pied de page (leçon 5).
  Variante `light` ajoutée à `PlanCtaButton` : `dark` sur une carte `stone-950` donnait un
  bouton invisible.
- **`app/page.tsx`** — la section artisan **déménage** vers `/artisans` (déplacée, pas
  dupliquée) ; aperçu tarifaire dérivé de `plansForAudience('diy')`.
- **`app/artisans/page.tsx`** *(nouveau)* — récit devis-minute, 4 preuves métier, 3 paliers
  Contractor avec leurs vraies gates.
- **`app/pricing/page.tsx`** — 3 strates par audience, bandeau Enterprise avec CTA
  `mailto:contact@chiffreo.fr`, JSON-LD excluant l'offre sur devis des agrégats de prix,
  2 questions FAQ ajoutées (Pro vs Contractor, fonctionnement Enterprise).
- **Calculateurs** — CTA recentrés sur des gates `free`/`pro`.
- **Docs** — sitemap (`/artisans`), PRODUCT_STRATEGY §4.2.1, BACKLOG GTM-7, CONTRIBUTING
  (règle de mise à jour du miroir avec toute migration `feature_gates`).

## Vérification

- **Rouge d'abord** (leçon 10) : l'offre a été transcrite fidèlement dans la nouvelle forme
  **avant** correction du contenu. 4 rouges, chacun nommant son défaut et non le harnais
  (leçon 12) : les 2 fonctionnalités sans contrepartie, les 8 gates non décidées,
  `unlimited_projects` vendue par deux paliers, l'audience `enterprise` sans offre.
- Le test de dépassement de palier (§3) étant resté vert de bout en bout, il a été **muté
  délibérément** (`enterprise.tier` → `contractor_premium`) : exactement 1 rouge, message
  « enterprise (contractor_premium) annonce enterprise_sso réservée à enterprise ». Rétabli.
- Web : **346 tests verts** (51 suites, +10), `tsc --noEmit` et `eslint` verts,
  `next build` vert — `/artisans` prérendue en statique (`○`).
- Relecture croisée finale libellé ↔ gate ↔ migration : les 16 lignes adossées à une gate
  correspondent à leur `feature_key` réelle au bon palier ; les 10 lignes sans gate déclarent
  toutes leur catégorie.

## Écarts assumés

- **Aucun prix, price ID Stripe ni `min_tier` modifié.** Ce lot ne touche que la description
  de l'offre, jamais son application.
- **`price_comparison` est vendue sans nommer d'enseigne.** Les adaptateurs ManoMano et
  Leroy Merlin sont réels, mais derrière `MANOMANO_ENABLED` / `LEROY_MERLIN_ENABLED`, à
  `false` par défaut et sans flux configuré dans `.env.example`. Citer les marques
  reproduirait le défaut corrigé ici. **À décider hors de ce lot** : provisionner les flux
  (BUY) ou basculer la gate dans `GATES_NOT_MARKETED`.
- **Pas de page `/enterprise` dédiée** : bandeau de contact sur `/pricing`. L'offre n'a pas
  encore de client ; une troisième landing serait une surface à maintenir sans usage.
- **Le miroir de gates reste maintenu à la main.** Le gain n'est pas de supprimer le risque
  de dérive mais de le concentrer en un fichier nommé, avec un test qui le rend bruyant.
  À revoir si un endpoint public de gates apparaît.
- **`community_gallery` délibérément non vendue** (`GATES_NOT_MARKETED`) : gate `free`, la
  vendre suggérerait qu'elle se débloque.

---

# GTM-8 — Réalignement de l'offre artisan sur le marché et sur le périmètre réel

## Constat

L'offre Contractor demande 50/100/200 €/mois. Le marché français du devis-facture artisan :
Boby 14,99 €, Tolteck 19 €, Obat 29 €, EBP Bâtiment 29,25 €, Costructor gratuit,
BatiChiffrage à partir de 30 € avec une bibliothèque de 80 000 travaux unitaires.

En face, le produit couvre **sept types d'ouvrage, tous de finition**
(`1711468800003-CreateWorkTypesAndProjectWorkItems.ts` : `wall_painting`,
`ceiling_painting`, `floor_tiling`, `wall_tiling`, `parquet_flooring`, `drywall`,
`wall_covering`) et **un seul bloc de main-d'œuvre** (`quote.entity.ts` : `labor_type`
horaire|forfait, taux × heures ou forfait). Ni plomberie, ni électricité, ni isolation, ni
maçonnerie, ni menuiserie. Aucune ligne de MO par corps d'état.

Demander 2 à 10× le prix du marché pour une couverture partielle n'est pas un défaut de
packaging : c'est la thèse « suite artisan généraliste » qui est invalidée.

## Décision

Rétrécir la promesse **et** réaligner le prix, plutôt que baisser le prix en gardant le
récit généraliste. Chiffréo artisan n'est pas un concurrent d'Obat ou d'EBP : c'est un
outil de chiffrage pour les **métiers de finition**. Les trois paliers et leur échelle de
gates sont conservés (impact minimal, aucune migration) ; seuls les montants et le récit
changent.

Grille retenue : **Essentiel 19 € · Standard 29 € · Premium 49 €**.

## Tâches

### A. Prix
- [x] `apps/api/src/subscriptions/plans.constants.ts` : 50/100/200 → 19/29/49
- [x] `apps/web/src/lib/pricing.ts` : `priceLabel` / `priceNumber` alignés
- [x] `ContractorPricingModal.tsx` : dérive de `plansForAudience('artisan')` au lieu de
      redéclarer prix et fonctionnalités (il annonce encore « Modèles de devis
      personnalisés » et « Historique clients avancé », qui n'existent pas)

### B. Périmètre annoncé
- [x] `apps/web/src/lib/work-types.ts` : `COVERED_TRADES` / `TRADES_NOT_COVERED`, adossés
      aux `work_types.code` réellement seedés
- [x] `/artisans` : hero, meta et bloc « Ce que Chiffréo ne chiffre pas »
- [x] `/pricing` : meta, FAQ, mention du périmètre dans la section artisan
- [x] `AUDIENCE_DEFINITIONS.artisan` : titre et accroche
- [x] `/cgv` : « à partir de 50 €/mois » → 19 €

### C. Documentation
- [x] `docs/PRODUCT_STRATEGY.md` : §4.5 (invalidation + table marché), corrections §1, §2.1,
      §3 ligne 9, §4.2, §7.2
- [x] `README.md`, `docs/CONTEXT.md`, `docs/BACKLOG.md`

### D. Garde-fous
- [x] `offer-catalogue.spec.ts` : la table de couverture est exhaustive vs les work types
      connus, sans recouvrement couvert/non couvert ; aucun prix artisan au-dessus du
      plafond du marché généraliste
- [x] Tests web + API, `tsc --noEmit`, `eslint`, `next build`

## Revue

**Résultat** : offre artisan réalignée sur le marché *et* sur le périmètre réellement
chiffrable. 19/29/49 € au lieu de 50/100/200 €, récit recentré sur les métiers de finition,
périmètre couvert et hors périmètre nommés sur les trois surfaces publiques.

### Ce qui a changé

- **Prix** — `plans.constants.ts` est la source (l'API résout le `price_id` Stripe) ;
  `lib/pricing.ts` est le miroir d'affichage. Les deux alignés sur 19/29/49 €.
- **Duplication supprimée** — `ContractorPricingModal` redéclarait prix et fonctionnalités
  en dur. Elle dérive maintenant de `plansForAudience('artisan')`. Cela a fait disparaître
  au passage deux fonctionnalités qui n'ont jamais existé (« Modèles de devis
  personnalisés », « Historique clients avancé ») : elles avaient été retirées de
  `lib/pricing.ts` par GTM-7, mais la modale n'était pas couverte par le garde-fou.
- **Périmètre** — `COVERED_TRADES` / `TRADES_NOT_COVERED` dans `lib/work-types.ts`,
  adossés aux `work_types.code`. Consommés par `/artisans` (section « Ce que Chiffréo
  chiffre, et ce qu'il ne chiffre pas ») et repris en clair sur `/pricing` + FAQ.
- **Aucune migration** — les trois paliers et leur échelle de gates sont inchangés.
  L'erreur était dans les montants et le récit, pas dans la structure.

### Vérification

- API : **968 tests verts** (70 suites), `eslint` vert.
- Web : **352 tests verts** (51 suites, +6), `tsc --noEmit` vert, `eslint --max-warnings=0`
  vert, `next build` vert avec `/artisans` et `/pricing` prérendues en statique.
- **Mutation délibérée** des deux nouveaux garde-fous : `priceNumber` de l'Essentiel
  remis à 50, et `drywall` retiré de `COVERED_TRADES`. Exactement 3 rouges, tous attendus
  (§6 palier d'entrée, §6 palier sans capacité propre, §7 ouvrage orphelin). Rétablis.
- `admin-analytics.service.spec.ts` recopiait les montants (`total_mrr: 229.97`) et est
  tombé au changement de prix. Corrigé à la racine : les attendus se déduisent désormais
  de `PLANS`, puisque ce test porte sur la résolution `price_id` → palier, pas sur la grille.
- Erreurs `tsc` résiduelles côté API : **5, identiques avant et après** (vérifié par
  `git stash`), dans des specs non touchées par ce lot. Dette préexistante, hors périmètre.

### Écarts assumés

- **Aucun produit Stripe modifié.** Les `STRIPE_*_PRICE_ID` pointent toujours vers les
  anciens montants : les prix doivent être mis à jour dans Stripe avant mise en ligne,
  sinon le checkout facturera 50/100/200 € pendant que les pages affichent 19/29/49 €.
  Ce n'est pas faisable depuis le code — c'est une action de provisioning.
- **Aucun abonné existant migré.** Sans client en production, il n'y a pas de bascule à
  écrire ; si cela change, prévoir une migration de prix Stripe avec proration.
- **Le périmètre n'est pas élargi.** Ce lot corrige l'écart prix/promesse ; il n'ajoute
  aucun corps d'état. Rouvrir le segment généraliste suppose des ouvrages hors surfacique
  (plomberie, électricité) et des lignes de main-d'œuvre par ouvrage — un chantier
  moteur, pas un chantier d'offre.
- **`docs/CONTEXT.md` mis à jour mais hors commit** : le fichier est git-ignoré
  (`.gitignore:52`). La note de révision y est locale uniquement.

---

# GTM-9 — Le lead magnet ne se dispute pas sur le terme de tête

## Constat entrant

> Les calculateurs publics (peinture, carrelage, sol) affrontent frontalement les calculettes
> de Leroy Merlin et Castorama : gratuites, indexées depuis des années, adossées à l'autorité
> de domaine d'une enseigne et à un stock réel derrière le bouton. Gagner ce SEO-là est
> possible, mais c'est un combat long sur un mot-clé où la valeur ajoutée de Chiffréo est
> faible — parce que le mètre carré de peinture, tout le monde sait le calculer.

## Vérification sur `HEAD` = `3f24c7a` (leçons 6, 9, 13)

### Volet 1 — « les pages affrontent le terme de tête » : **exact**

| Surface | `title` / `h1` actuels |
|---|---|
| `/calculateurs` | « Calculateurs travaux gratuits » |
| `/calculateurs/peinture` | « Calculateur peinture : quantité de peinture au m² » / « Calculateur de peinture gratuit » |
| `/calculateurs/carrelage` | « Calculateur carrelage : nombre de carreaux au m² » |
| `/calculateurs/sol` | « Calculateur parquet et sol : surface et quantité au m² » |

Ce sont, mot pour mot, les termes que les GSB possèdent.

### Volet 2 — « la valeur ajoutée est faible » : **exact, et par construction**

Ce n'est pas le moteur qui est faible, c'est **ce que la page libre expose**. Les trois
différenciateurs réels sont tous derrière le compte :

- **photo → dimensions (CV)** : `POST /projects/:id/analyze` est sous `FirebaseAuthGuard` +
  `FeatureGateGuard` (`analysis.controller.ts:26,41-42`). La page publique n'a qu'un
  `DimensionsForm` — la saisie manuelle, exactement le formulaire d'une GSB.
- **prix** : la page l'écrit elle-même, « Quantités de matériaux estimées — hors prix »
  (`PublicCalculator.tsx:329`). La GSB, elle, met un prix et un bouton panier.
- **liste d'achats et matériaux complémentaires** : absents de `estimatePublic`, absents de
  `EstimationResults`.

Chiffréo entre donc dans le combat avec la seule brique que tout le monde a, amputée de ses
propres atouts.

### Volet 3 — non dit par le constat, trouvé en le vérifiant : **la page se contredit à l'écran**

`DimensionsForm` rend `ExclusionsSection` sans condition et déduit les exclusions dans son
aperçu en direct (`- 2,4 m²`, `DimensionsForm.tsx:209,523`). Puis :

- `onSave(…, segments, exclusions)` passe **6** arguments (`DimensionsForm.tsx:260`) ;
- `handleCompute` n'en déclare que **5** (`PublicCalculator.tsx:122-128`) ;
- `PublicEstimateRequestDto` ne porte aucun champ `exclusions` ;
- `estimatePublic` construit sa `RoomData` sans `exclusions` (`estimations.service.ts:272-287`).

Le moteur, lui, sait les déduire et les filtre par `surface_target`
(`estimation-engine.ts:159-176`).

**Conséquence** : sur la page dont la promesse est « n'achetez pas 15 à 25 % en trop », un
visiteur qui déclare une crédence voit l'aperçu la déduire et reçoit une estimation qui
l'ignore. Le lead magnet sur-estime, et il est **moins précis que son propre écran**.

### Ce qu'il ne faut pas déduire du constat (leçon 13)

« Supprimer les calculateurs » serait le mauvais remède : c'est la seule surface
d'acquisition qui existe, elle est construite, prérendue en statique et ne coûte rien à
garder. Le mécanisme n'est pas mauvais, **son positionnement l'est**. Et repositionner par la
seule réécriture des titres serait du copywriting sur une page qui ne tient pas sa promesse :
le volet 3 se répare d'abord.

## Décision

Ne pas disputer « calculateur peinture ». Déplacer les quatre surfaces sur ce que le moteur
exécute **sur le chemin public** et qu'une calculette d'enseigne ne fait structurellement pas :

1. **Surface nette réelle** — ouvertures *et* exclusions (crédence, demi-mur, plinthes) *et*
   pièces non rectangulaires (L, T, U) via `segments`, supporté de bout en bout.
2. **Marge de perte selon le niveau et la pose** — 5 → 20 % réellement seedés par
   (`pose_type`, `skill_level`), `SeedMaterialsCatalog.ts:26-87`, là où une calculette
   d'enseigne applique un forfait unique.

Et rendre la promesse **vérifiable** plutôt que rédigée : chaque page déclare ses
différenciateurs par clé, adossés au mécanisme qui les exécute — le motif de GTM-7 pour les
`feature_key`, appliqué au lead magnet (leçon 15).

## Tâches

### A. Réparer la fuite des exclusions (rouge d'abord — leçons 8 et 10)
- [x] Test API rouge : `estimatePublic` déduit une exclusion `wall`
- [x] Test web rouge : `PublicCalculator` transmet les exclusions saisies
- [x] `PublicEstimateRequestDto` : champ `exclusions`, bornes alignées sur `RoomExclusionDto`
- [x] `estimatePublic` : passer `dto.exclusions` dans la `RoomData`
- [x] `PublicCalculator` : accepter et transmettre le 6ᵉ argument

### B. Repositionnement éditorial des 4 surfaces
- [x] Ensemble fermé `CALCULATOR_DIFFERENTIATORS`, chaque clé adossée à son mécanisme public
- [x] `calculators.ts` : titres, meta, h1, intro, FAQ des 3 calculateurs
- [x] `/calculateurs` : hub
- [x] Section « Ce que ce calculateur fait de plus » sur `[type]/page.tsx`

### C. Garde-fou
- [x] `calculators-positioning.spec.ts` : clés fermées, aucune clé morte, aucune promesse de
      prix ni de photo sur une page qui n'en délivre pas

### D. Documentation
- [x] `PRODUCT_STRATEGY.md` §4.6
- [x] `BACKLOG.md` : GTM-4 et GTM-5 marqués livrés (leçon 2), GTM-9 ajouté

### E. Leçons
- [x] `tasks/lessons.md`

## Revue

**Résultat** : le lead magnet quitte le terrain des calculettes d'enseigne. Récit recentré de
« combien de m² » vers « combien acheter », adossé aux deux seuls mécanismes que le chemin
public exécute et qu'une GSB n'a pas — et le défaut qui rendait cette promesse fausse est
réparé.

### Ce qui a changé

- **Le défaut d'abord.** `exclusions` traverse maintenant tout le chemin public :
  `PublicExclusionDto` → `estimatePublic` → `RoomData`, et `PublicCalculator` reçoit le 6ᵉ
  argument de `onSave`. Le moteur savait déjà les déduire et les filtrer par
  `surface_target` ; rien ne les lui donnait.
- **Le même abandon se rejouait deux fois plus loin** : la sauvegarde de projet (authentifiée
  et brouillon invité) et surtout `migrateLocalProjects`, qui recréait le projet d'un invité
  qui s'inscrit **sans ses `segments` ni ses exclusions**. La perte des `segments` y était
  **préexistante** et sans rapport avec ce lot (leçon 4) ; corrigée ici parce que la laisser
  aurait rendu ma propre correction inopérante au bout du même parcours.
- **Les promesses deviennent des données.** `CALCULATOR_DIFFERENTIATORS` : ensemble fermé de
  quatre clés, chacune portant le `proof` du mécanisme qui l'exécute sur le chemin public.
  Rendu par la page dans une section « Ce que ce calculateur fait de plus ».
- **Aucune migration, aucun endpoint nouveau.** L'écart était dans un champ de DTO et dans le
  récit, pas dans la structure.

### Vérification

- **Rouge prouvé avant correctif** (leçons 8 et 10) : côté API, `33,11 m²` chiffrés contre
  `30,11 m²` affichés — un message qui décrit le défaut, pas l'environnement (leçon 12).
  Côté web, exactement 1 rouge sur 9.
- **Mutations délibérées des nouveaux garde-fous**, deux passes : `net_surface` retiré du
  calculateur sol → 1 rouge (§5) ; `proof` vidé + clé `packaging` orpheline → 2 rouges
  (§2, §3). Rétablis.
- API : **970 tests verts** (70 suites, +2), `eslint` vert.
- Web : **363 tests verts** (52 suites, +11), `tsc --noEmit` vert,
  `eslint --max-warnings=0` vert, `next build` vert avec les 4 pages toujours prérendues.

### Écarts assumés

- **Le positionnement n'est pas mesuré.** Aucune donnée Search Console n'existe : le produit
  n'est pas en production. Le choix de la longue traîne est un pari argumenté, pas un
  résultat. Les seuils devront être écrits avant la collecte (leçon 1), pas après.
- **Les anciennes URL sont conservées.** `/calculateurs/peinture` et ses sœurs ne bougent
  pas : seuls les `title`, `h1`, `intro`, FAQ et `metaDescription` changent. Aucune
  redirection à écrire.
- **Le fond reste ce qu'il est.** Ce lot ne met ni photo, ni prix, ni liste d'achats sur la
  page libre : il arrête de prétendre que la page vaut mieux qu'une calculette d'enseigne
  sur *leur* terrain, et la met sur le sien. Ouvrir la CV sans compte est une décision de
  coût et d'abus, pas une réécriture de page — le jour venu, ce sera une clé de plus.
- **Deux mentions périmées repérées et non touchées** dans `PRODUCT_STRATEGY.md` : la ligne 7
  du tableau §3 (« ni landing vendeuse, ni pricing public, ni lead magnet, ni programme de
  parrainage ») et le §2.3 (« pas de calculateur public sans compte »). Elles décrivent un
  audit daté, et leurs autres affirmations relèvent de GTM-2, GTM-3 et COM-3. Seule la
  ligne 13, qui porte sur ce lot, a été corrigée.

---

## DATA-5 — Fermer la boucle par ce qui a été réellement acheté (02/08/2026)

### Correction de prémisse, avant tout le reste

La demande pose que « les enseignes acceptent les retours sous 30 jours » et que la valeur
tient à « une échéance qui court ». **C'est faux pour les deux leaders du marché**, vérifié
sur leurs propres pages :

| Enseigne | Délai annoncé | Fidélité | Source |
|---|---|---|---|
| Castorama | **365 jours** | 3 ans, sans ticket | `castorama.fr/services/retours` |
| Leroy Merlin | **6 mois** | 12 mois (LEROY&MOI) | `leroymerlin.fr/services/service-client/retour-et-remboursement.html` |
| L'Entrepôt du Bricolage | **12 mois** | illimité (Carte Sourire) | `entrepot-du-bricolage.fr/informations-client/retours-et-echanges-facilites` |
| Brico Dépôt | 30 jours *(sources tierces seulement)* | — | **non retenu** |
| Mr Bricolage | pas de délai fixe *(page inaccessible)* | — | **non retenu** |

Conséquences sur la conception :

1. **Le compte à rebours n'est pas le produit.** Afficher « J-12 » à un client Castorama qui
   dispose de 320 jours fabrique une urgence fausse ; pire, un décompte à 30 jours déclarerait
   « délai dépassé » à J+45 alors qu'il lui reste onze mois. C'est exactement l'erreur de
   promesse redoutée par la demande, dans l'autre sens.
2. **Ce qui a de la valeur, ce sont les conditions, pas la date.** Non ouvert, emballage
   d'origine, ticket conservé — dit *au moment où c'est encore actionnable*.
3. **Les exclusions sont le vrai risque, et l'exemple de la demande est le pire cas.** Leroy
   Merlin et Castorama excluent tous deux la peinture teintée en machine et les produits
   descellés. Le « pot de peinture à 45 € » est précisément l'article le moins susceptible
   d'être repris. Le chiffrer dans un total « récupérable » serait la promesse fausse.

La demande reste juste sur l'essentiel : personne ne suit ce qui reste sur les bras, et le
produit ne reçoit jamais l'information. Le lot est livré, avec le volet « retour » recentré
sur les conditions et les exclusions plutôt que sur l'urgence.

### Décisions arbitrées avec l'utilisateur

- **Délais** : catalogue sourcé. Aucune entrée sans `source_url` **et** `verified_on`, test qui
  échoue sinon. Enseigne inconnue → aucun chiffre affiché.
- **Palier** : nouvelle gate `project_closeout` en `free` (déclarer, restes, retours, écart).
  `budget_tracking` reste `pro` et garde l'analyse (tableau de bord, catégories, benchmark).
- **Relance** : un `sweepCloseoutDue` unique, calqué sur `sweepAbandonedProjects`.

### Le défaut structurel que ce lot corrige

`units_needed` porte aujourd'hui **deux sens** : « ce qu'il faut acheter » (la liste) et « ce
que j'ai acheté » (le relevé). Rien ne distingue une ligne *confirmée* d'une ligne *jamais
regardée*. Or `WasteLearningService` admet toute ligne d'une liste finalisée : une ligne
intacte y entre comme `estimated == actual`, c'est-à-dire comme une confirmation du catalogue
par une non-observation. Le volant de données ne serait pas seulement vide, il serait biaisé
vers « l'estimation est exacte ».

→ `purchased_units` (matériaux) et `purchased_quantity` (compléments), `null` par défaut.
**Seule une déclaration explicite alimente DATA-3 et DATA-4.**

### Lots

- [x] **1. `return-policies.ts`** — catalogue (slug, alias, `window_days`, `loyalty_window_days`,
      `requires_receipt`, `conditions_fr[]`, `excluded_fr[]`, `source_url`, `verified_on`) +
      appariement depuis le `store_name` libre (normalisation accents/ponctuation) + spec qui
      exige source et date sur chaque entrée.
- [x] **2. `closeout.ts`** — module pur : surplus d'unités, montant récupérable, `returnability`
      (`likely` / `conditional` / `unknown`), perte implicite **et** plancher de conditionnement
      (pour ne pas imputer l'arrondi à la marge de l'utilisateur), échéance.
- [x] **3. Entité + migration `…064`** — `purchased_units`, `purchased_quantity`,
      `shopping_lists.purchased_on`, seed de la gate `project_closeout` (free).
- [x] **4. API** — `GET/POST /projects/:id/shopping-list/closeout`. La contrainte « tout doit
      être tarifé » de `finalizeBudgetSummary` saute : les quantités ferment la boucle, les prix
      sont un bonus. `is_complete` garde son sens ; la communauté continue de l'exiger.
- [x] **5. DATA-3 / DATA-4** — n'admettre que les lignes déclarées (repli legacy :
      `is_manually_adjusted === true`).
- [x] **6. Correctif carnet du logement** — `logbook.controller.ts:39` passe
      `scope.organizationId` à un filtre `user_id`. `GET /logbook` renvoie `[]` pour tout le
      monde depuis PLAT-1 : la quatrième fonctionnalité n'était pas en attente de données, elle
      était cassée.
- [x] **7. Relance** — `LifecycleEmailType.CLOSEOUT_DUE` + sweep idempotent, sans recouvrement
      avec `project_abandoned`.
- [x] **8. Web** — écran `/projects/[id]/shopping-list/closeout`.
- [x] **9. Vérification** — rouge prouvé avant correctif (leçons 8/10/12), suites API + web,
      `tsc`, `eslint`, `next build`.
- [x] **10. Docs** — `API.md`, `BACKLOG.md`, catalogue de gates web, section revue ici.


### Revue

**Ce que le lot change vraiment.** Pas l'ajout d'un écran, mais la séparation de
deux sens confondus dans un même champ. `units_needed` disait à la fois « ce
qu'il faut acheter » et « ce que j'ai acheté ». Conséquence invisible :
`WasteLearningService` admettait toute ligne d'une liste finalisée, donc une
ligne **jamais regardée** y entrait comme `estimated == actual` et confirmait le
catalogue DTU par une non-observation — un biais d'autant plus fort que
l'utilisateur était passif. `purchased_units` rend la déclaration explicite ;
seule une déclaration alimente DATA-3 et DATA-4.

**La prémisse de la demande était fausse, et c'était le risque le plus sérieux.**
« Retours sous 30 jours, une échéance qui court » : Castorama publie **365
jours** (3 ans avec la carte), Leroy Merlin **6 mois** (12 avec LEROY&MOI),
L'Entrepôt du Bricolage **12 mois**. Un compte à rebours à 30 jours aurait
annoncé « délai dépassé » à J+45 à quelqu'un disposant encore de onze mois. Le
volet retour a donc été recentré sur les **conditions** (non ouvert, emballage
d'origine, ticket) et surtout sur les **exclusions** : Leroy Merlin comme
Castorama excluent la peinture teintée en machine et les produits descellés —
c'est-à-dire que le « pot de peinture à 45 € » de la demande est l'article le
moins reprenable de son propre exemple. Il n'entre jamais dans le montant
annoncé comme récupérable, il part dans un total « sous réserve » distinct.

**Trois montants disjoints plutôt qu'un.** « Ce qui me reste sur les bras »
(`surplus_value_total`) et « ce que je peux rendre » (`recoverable_amount`) sont
deux questions différentes ; les additionner promettrait une reprise que ni
l'enseigne ni la catégorie ne garantissent. `restricted_amount` et
`unknown_amount` complètent la partition, et un test vérifie que la somme des
trois vaut le total.

**Le contrôle qui bloquait tout est tombé — pas l'invariant qu'il protégeait.**
`finalizeBudgetSummary` refusait de clôturer tant qu'un seul article n'avait pas
de prix réel. Un sachet de croisillons bloquait le carnet, le benchmark, les
facteurs appris et le partage communauté. La clôture se fait désormais sur les
quantités ; `is_complete` continue de dire la vérité sur le tarifage et reste
exigé par `CommunityService.submitProject`. Un budget partiel est persistable,
il reste impubliable.

**Un défaut trouvé en route (leçon 8 : couvrir trouve des bugs).**
`logbook.controller.ts:39` passait `scope.organizationId` à un filtre `user_id`.
Deux UUID de deux tables : `GET /logbook` renvoyait `[]` à **tout le monde**
depuis PLAT-1. Le carnet du logement n'attendait pas des données, il était
cassé. `logbook.service.spec.ts` passait parce qu'il teste le service seul, à
qui l'on passe un `userId` correct — l'erreur était dans le contrôleur, que rien
n'exerçait. Corrigé, avec le premier `logbook.e2e-spec.ts`.

### Vérification

- **Rouge prouvé avant correctif** (leçons 8/10/12) : `logbook.e2e-spec.ts` →
  exactement **1 rouge**, avec un message décrivant le défaut
  (`Expected "123e4567…" / Received "00000000-…-aa"`), pas l'environnement.
- **Mutation délibérée du nouveau garde-fou** : admission DATA-3 restaurée à
  `item.units_needed` sans filtre → **1 rouge**, le bon (le test de repli
  historique reste vert, ce qui est correct : une ligne corrigée à la main était
  déjà admise). Rétabli, 18 verts.
- **Migration `…064` exercée sur un vrai Postgres** : `schema.int-spec.ts`
  applique `up()`, `undoLastMigration()` puis ré-applique — `down()` est donc
  couvert — et le test de dérive entités ↔ migrations valide `purchased_on`.
  22 tests d'intégration verts.
- API : **1 001 tests verts** (72 suites, +31), **186 e2e verts** (16 suites,
  +5), `eslint` vert.
- Web : **374 tests verts** (53 suites, +11), `tsc --noEmit` vert, `eslint`
  vert, `next build` vert avec `/projects/[id]/shopping-list/closeout` enregistrée.
- **Préexistant et distinct** (leçon 4, vérifié par `git stash`) : 5 erreurs
  `tsc` dans des specs API non touchées (`invoices`, `org-context`, `photos`,
  `projects`). Identiques sur un arbre propre, aucune introduite par ce lot.

### Écarts assumés

- **Deux enseignes volontairement absentes du catalogue.** Brico Dépôt
  (30 jours) et Mr.Bricolage (pas de délai fixe) ne circulent que sur des sites
  tiers ; leurs pages officielles renvoient 403. Une donnée de seconde main sur
  un délai de retour n'a pas sa place dans le fichier — elles tombent donc dans
  le chemin « enseigne inconnue », qui est aussi le cas majoritaire en
  production et se trouve ainsi exercé pour de vrai.
- **Une seule date d'achat par chantier, pas par ligne.** L'acheteur qui étale
  ses courses sur plusieurs semaines est hors périmètre, comme l'examen
  sceptique le nommait. Lui donner une date par ligne ferait payer à tout le
  monde la précision qui ne sert qu'à lui.
- **Le montant récupérable n'est pas recalculé côté client.** Il ne bouge qu'au
  retour du serveur : l'afficher en direct demanderait de dupliquer les
  conditions de reprise dans le web, c'est-à-dire de recréer la seconde source
  que la leçon 15 interdit.
- **La cohorte DATA-3/DATA-4 se restreint.** Les listes finalisées avant ce lot
  n'entrent plus, sauf ligne corrigée à la main. C'est une perte nominale : le
  produit n'est pas en production, il n'existe aucune observation réelle. Ce que
  le filtre supprime, ce sont des non-observations.
- **L'hypothèse fragile reste une hypothèse.** `closeout_due` prévient
  l'utilisateur, mais aucun chiffre ne dit encore qu'il revient. Les deux
  événements (`closeout_due_email_sent`, `project_closed_out`) sont posés pour
  que le taux soit mesurable — les seuils devront être écrits avant la collecte
  (leçon 1), pas après.
- **L'OCR de ticket n'est pas fait**, comme demandé. La saisie est de trente
  secondes ; l'accélérer n'était pas le sujet.
