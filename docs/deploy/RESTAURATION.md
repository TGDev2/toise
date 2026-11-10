# Restauration — procédure éprouvée

Ce document décrit ce qu'il faut taper pour remonter Toisé à partir de ses
sauvegardes, ce que ça coûte en temps, ce qui est perdu, et les pièges qui ont
été trouvés **en le faisant réellement** le 2026-08-06.

La mise en place des sauvegardes (clé GPG, cron, copie hors-site) est dans
[`BACKUP.md`](BACKUP.md). Le retour arrière d'un déploiement est dans
[`../DEPLOY.md`](../DEPLOY.md) § Retour arrière. Ici : la restauration elle-même.

> **Ce document décrit un cycle qui a tourné.** Le script
> [`restore-drill.sh`](restore-drill.sh) déroule *peupler → sauvegarder →
> détruire → restaurer → vérifier → démarrer l'application*, et la CI le rejoue
> chaque lundi (`.github/workflows/backup-drill.yml`). Trois défauts en sont
> sortis, dont deux qui rendaient la restauration muette sur son propre échec
> — voir § Pièges.

---

## 1. Procédure — reprise sur sinistre (VPS perdu)

À exécuter **depuis le poste qui détient la clé privée GPG**, jamais depuis le
VPS : celui-ci n'a que la clé publique, par construction (`BACKUP.md` §2).

```bash
# 0. Récupérer les artefacts. Si le disque du VPS est perdu, c'est la copie
#    hors-site qui les porte — et s'il n'y en a pas, il n'y a rien à restaurer.
rclone copy b2:toise-backups/vps . --include 'toise-*.gpg' --max-age 48h

# 1. Provisionner le nouveau VPS (DEPLOY.md : provision.sh, DNS, .env).

# 2. Démarrer Postgres seul, base vide.
docker compose -f docker-compose.prod.yml up -d postgres

# 3. Restaurer base + fichiers. Aucune attente à intercaler : restore.sh
#    attend lui-même que Postgres soit réellement joignable (piège nº 2).
DB_PASSWORD='<celui du .env>' bash docs/deploy/restore.sh \
  --db-backup   toise-db-<horodatage>.dump.gpg \
  --uploads-backup toise-uploads-<horodatage>.tar.gz.gpg \
  --mode prod \
  --db-target toise-db --uploads-target toise_uploads \
  --yes-i-know-this-is-production
#    → confirmation interactive : taper le nom exact de la cible.

# 4. Démarrer le reste de la pile.
docker compose -f docker-compose.prod.yml up -d --wait --wait-timeout 180

# 5. Prouver que ça sert la bonne version avant de rouvrir le trafic.
bash docs/deploy/smoke-test.sh --expect-version <tag attendu>
```

**Puis, à la main, hors de portée du script** : rapprocher les abonnements
Stripe et les e-mails déjà partis. Le tableau de `DEPLOY.md` § « Ce qui n'est
PAS réversible » vaut mot pour mot ici.

## 2. Procédure — drill de vérification (routine, non destructif)

Le contrôle mensuel. Il ne touche aucune ressource réelle : cible jetable,
créée puis détruite.

```bash
bash docs/deploy/restore.sh \
  --db-backup toise-db-<horodatage>.dump.gpg \
  --uploads-backup toise-uploads-<horodatage>.tar.gz.gpg
# --keep pour inspecter la cible avant destruction.
```

Consigner le résultat dans le journal de `BACKUP.md` §8.

## 3. Cycle complet, sur poste

Ce que la CI rejoue, et ce qu'il faut lancer après toute modification de
`backup.sh` ou `restore.sh` :

```bash
docker build -f apps/api/Dockerfile -t toise-api:drill .
bash docs/deploy/restore-drill.sh          # DRILL_KEEP=1 pour garder la pile
```

Il génère sa propre clé GPG jetable, ses propres conteneurs et volumes, tous
préfixés `toise-drill-`. Il ne peut pas atteindre une ressource de
production, même lancé sur le VPS.

---

## 4. Temps constaté

Mesuré le 2026-08-06, dans un hôte Docker Linux (`docker:27-dind`), jeu de
données du drill : 45 tables, 6 fichiers d'`uploads` pour 2,3 Mo.

| Étape | Temps |
|---|---|
| Sauvegarde complète (`backup.sh`) | **2 s** |
| Restauration base + uploads (`restore.sh`) | **6 s** |
| Démarrage de l'API sur la base restaurée, `/health` à `ok` | **4 s** |
| Cycle complet du drill, destruction comprise | **35 s** |

Ces chiffres ne se transposent pas tels quels : ils décrivent une base presque
vide. **Ce qui dimensionne une restauration réelle, c'est le volume `uploads`**,
pas la base. Débit mesuré séparément sur 501 Mo de données incompressibles
(le bon modèle pour des JPEG) :

| Chaîne | Débit | Détail |
|---|---|---|
| Sauvegarde `tar → gzip → gpg` | **~27 Mo/s** | 18 s pour 501 Mo — dont **17 s de `gzip`** |
| Restauration `gpg → gunzip + tar` | **~55 Mo/s** | 9 s pour 501 Mo |

Ordre de grandeur à retenir : **~40 s de sauvegarde et ~20 s de restauration par
gigaoctet de photos**, plus quelques secondes pour la base.

### Deux conséquences de dimensionnement

- **`gzip` ne sert à rien sur ce volume et coûte l'essentiel du temps.** 501 Mo
  de photos donnent une archive de 501 Mo : des JPEG sont déjà compressés.
  `gzip -1` ne rattrape rien (mesuré : 10,0 s contre 9,8 s pour `-6` — sur des
  données incompressibles, deflate passe son temps à constater qu'il ne peut
  rien faire). Le format est **conservé quand même** : le supprimer obligerait
  `restore.sh` à savoir lire deux formats pour toujours, sous peine de rendre
  illisibles les artefacts déjà produits. Le coût est du temps CPU nocturne,
  pas une perte de donnée — c'est un arbitrage, pas un oubli.
- **Prévoir ~15 fois le volume `uploads` sur `/var/backups`.** La rétention est
  de 14 jours (`RETENTION_DAYS`) et chaque nuit produit une archive de la
  taille du volume, sans gain de compression : 5 Go de photos demandent ~70 Go
  de disque de sauvegarde. Ajouter le pic transitoire de la sauvegarde
  elle-même, qui matérialise le `.tar` puis le `.tar.gz` puis le chiffré, soit
  **~2× le volume en plus** dans `/var/backups/.tmp` pendant le run. Un disque
  plein à 3 h 15 est une panne silencieuse tant que `BACKUP_MONITOR_URL` n'est
  pas renseigné.

---

## 5. Ce qui est perdu, au pire cas

Le cron tourne à **3 h 15 UTC** (`BACKUP.md` §4), soit 5 h 15 à Paris l'été.
La sauvegarde nocturne est le seul filet hors déploiement : il n'y a **pas** de
journalisation continue (pas de WAL archiving, pas de PITR).

| Moment du sinistre | Perte |
|---|---|
| 3 h 20 UTC (juste après le run) | quelques minutes |
| 20 h 00 UTC (fin de journée) | **~17 h de saisies** |
| 3 h 14 UTC (juste avant le run suivant) | **~23 h 59 — le pire cas** |

En clair : **une journée de travail entière peut disparaître**, et c'est la
journée qui vient de s'écouler — devis émis, factures numérotées, photos de
chantier, comptes créés. Pour un artisan qui a facturé l'après-midi, c'est sa
facturation du jour.

Trois nuances qui ne réduisent pas ce chiffre mais le rendent lisible :

- **Un déploiement resserre la fenêtre, mais lui seul.** La CD prend un point
  de restauration juste avant chaque mise en production (`BACKUP.md` §4.1). Il
  ne couvre que la base, et seulement les jours où l'on déploie.
- **Les fichiers, eux, ne sont jamais perdus « en avance ».** L'archive des
  photos est un sur-ensemble de ce que le dump référence (`BACKUP.md` §1) : on
  peut avoir un fichier sans ligne, jamais une ligne sans fichier.
- **Sans `BACKUP_REMOTE`, le pire cas n'est pas 24 h : c'est tout.** Les
  sauvegardes vivent sur le disque qu'elles protègent. Une perte de disque, un
  vol de machine ou un chiffrement du VPS emporte la production *et* ses
  sauvegardes. Tant que cette variable n'est pas renseignée, ce tableau décrit
  un scénario optimiste.

**Réduire le pire cas** demanderait de passer à l'archivage WAL (PITR) ou à une
réplique en attente. Ni l'un ni l'autre n'est en place, et aucun n'est
nécessaire tant que la perte acceptable est « la journée en cours » — mais
c'est une décision, pas un état de fait, et elle se reprend le jour où un
client facture au fil de l'eau.

---

## 6. Pièges découverts en déroulant le cycle

Les trois premiers sont corrigés à la racine ; les deux derniers sont des
propriétés à connaître avant de taper la commande.

### 6.1 `restore.sh` n'attendait pas que Postgres soit prêt — dans le mode qui en avait le plus besoin

**Constaté :** `pg_restore` échouant sur
`FATAL: the database system is shutting down`, en plein milieu de la
restauration.

Un conteneur Postgres neuf démarre une instance temporaire pour exécuter ses
scripts d'initialisation, l'arrête, puis lance l'instance définitive. Pendant
cette fenêtre, `pg_isready` sur le socket unix répond déjà « accepting
connections ». La procédure de reprise sur sinistre enchaîne
`up -d postgres` et `restore.sh` : elle tombe pile dedans.

L'attente existait dans le script — mais n'était appelée que pour la cible
jetable du mode `verify`, celle qui ne risquait rien. Le mode `prod`, seul
utilisé en situation réelle, n'attendait rien.

**Corrigé** : l'attente est commune aux deux modes, et sonde en **TCP**.
L'entrypoint de l'image `postgres` démarre l'instance temporaire avec, dans ses
propres mots, « does not listen on external TCP/IP » : une sonde sur `127.0.0.1`
ne peut donc réussir que contre l'instance définitive. Cela remplace aussi
l'ancien repère — compter deux occurrences d'un message dans `docker logs` —
qui ne valait que pour un conteneur venant de naître : sur une base démarrée
depuis des semaines, la boucle n'aurait jamais rendu la main.

### 6.2 Une restauration laissait en place tout ce qui était né après la sauvegarde

**Le plus grave des trois.** `pg_restore --clean` ne supprime que les objets
que le dump connaît. Tout ce qui a été créé depuis survivait donc à la
« restauration » — pendant que la table `migrations`, elle, revenait en arrière,
puisqu'elle *est* dans le dump. Schéma et registre se retrouvaient en
désaccord, et `restore.sh` affichait `RESTAURATION: PASS`.

**Mesuré, pas supposé.** Restauration d'un dump antérieur à la migration 078
sur une base où elle avait tourné :

```
migrations : 78          (la ligne de la 078 a disparu)
table data_export_requests : 1   (elle, non)

=== démarrage du runner de migrations de production ===
… routine: 'heap_create_with_catalog'
CODE DE SORTIE = 3
```

Le runner rejoue la 078, `CREATE TABLE` tombe sur *relation already exists*,
`migrate.js` sort en 3, le conteneur API boucle en `Restarting`. **C'est
exactement le chemin de recours d'un retour arrière** (`DEPLOY.md`), celui
qu'on emprunte quand tout va déjà mal.

**Corrigé** : en `--mode prod`, la base cible est **détruite et recréée** avant
la restauration. Rien de postérieur à la sauvegarde ne peut survivre.
Contrepartie assumée : la cible disparaît avant que la restauration n'ait fait
ses preuves. Ce n'est pas une régression — `--clean` la démolissait déjà objet
par objet — et le dump reste en main. Le mode `verify` n'est pas concerné : sa
cible est créée vide par le script lui-même.

### 6.3 « Arrêter l'API avant de restaurer » n'était qu'une phrase

`DEPLOY.md` le demandait, `BACKUP.md` le supposait, le script ne vérifiait
rien. Lancé sur une base vivante, il restaurait et annonçait `PASS` pendant que
l'API continuait de servir un schéma qu'on remplaçait sous ses pieds.

**Corrigé** : en `--mode prod`, `restore.sh` compte les connexions ouvertes sur
la base cible et refuse de commencer s'il y en a, en affichant la commande à
lancer :

```
ERREUR: 1 connexion(s) encore ouverte(s) sur « toise ».
        Arrêter l'application avant de restaurer :
          docker compose -f docker-compose.prod.yml stop api web
```

À noter, parce que c'est contre-intuitif : une API **au repos** ne tient
aucune connexion (le pool TypeORM les relâche). Le garde-fou ne se déclenche
donc pas toujours sur une pile démarrée — il attrape le cas dangereux, celui
où l'application travaille. L'arrêter reste la procédure, pas une option.

### 6.4 `pg_restore` sort bien en erreur — vérifié, pas supposé

Il était tentant de croire que `pg_restore` continue vaillamment et sort en 0
sur une restauration partielle, ce qui aurait rendu le `PASS` du script sans
valeur. **Mesuré : c'est faux.** Une restauration dont tous les objets échouent
(rôle sans droit sur le schéma) affiche `errors ignored on restore: 5` et sort
en **1** ; `set -e` fait donc échouer `restore.sh`. Aucun correctif n'était
nécessaire, et `--exit-on-error` n'a pas été ajouté : il aurait durci un
comportement déjà correct.

### 6.5 Sur un poste Windows, les scripts peuvent arriver en CRLF

`backup.sh` était en CRLF dans la copie de travail de ce poste, alors que son
objet git est en LF. Un `set -euo pipefail` suivi d'un CR devient
`pipefail\r` : *invalid option name*, à la dixième ligne, sur une différence
invisible à l'écran.

Le VPS n'est pas concerné — il clone sur Linux. **Le poste de l'opérateur, si.**
`restore.sh` est fait pour tourner depuis la machine qui détient la clé privée,
et cette machine peut très bien être un Windows avec `core.autocrlf=true`. La
restauration échouerait alors au pire moment, sur un message qui ne nomme pas
sa cause.

**Corrigé à la racine** : `*.sh text eol=lf` dans `.gitattributes`, à côté de la
même règle déjà en place pour les instantanés jest.

### 6.6 Une extension existe en base sans qu'aucune migration ne la crée

La base réelle porte `uuid-ossp`. **Aucune migration du dépôt ne la crée** —
zéro `CREATE EXTENSION` dans `apps/api` — et plus rien ne s'en sert : le schéma
s'appuie partout sur `gen_random_uuid()`, natif depuis Postgres 13. Elle a été
posée à la main, un jour, et elle est restée.

Sans conséquence aujourd'hui, mais deux choses à en retenir :

- **Une base reconstruite depuis les seules migrations n'est pas identique à la
  base de production.** Un VPS fraîchement provisionné n'aura pas cette
  extension. Ce n'est un problème que le jour où du code s'en sert — mais alors
  il marchera en production et cassera partout ailleurs, ce qui est le pire
  ordre pour découvrir la chose.
- **Le dump, lui, la transporte.** `pg_restore` émet donc un
  `CREATE EXTENSION "uuid-ossp"`, qui exige que l'image Postgres cible embarque
  le contrib correspondant (c'est le cas de `postgres:16-alpine`) et des droits
  superutilisateur (c'est le cas de `POSTGRES_USER`). Restaurer vers une image
  Postgres différente demanderait de le vérifier.

Le drill la crée donc explicitement dans son jeu de données, et affirme sa
présence après restauration. Sans cela le contrôle « les extensions sont
restaurées » se serait exercé sur `plpgsql` seul — présent d'office dans tout
template Postgres, donc restauré même si la chaîne était entièrement cassée.
Un contrôle qui passe parce que l'objet surveillé est partout ne surveille rien.

---

## 7. Ce que le drill ne couvre pas

Un angle mort nommé n'est plus un piège ; celui qu'on tait le reste.

- **La copie hors-site.** `BACKUP_REMOTE` est vide dans le drill : `rclone` et
  ses identifiants ne peuvent pas vivre dans le dépôt. Le chemin `push_offsite`
  n'est donc **jamais exercé**, ni localement ni en CI — c'est aussi le seul
  chemin qui distingue « sauvegarde » de « copie sur le même disque ».
- **La confirmation interactive** des cibles protégées (`toise-db`,
  `toise_uploads`) : le drill utilise des noms préfixés `toise-drill-`,
  qui ne la déclenchent pas. Ce chemin a été exercé à la main lors du pilote de
  retour arrière (E6-5).
- **Le ping de supervision** (`BACKUP_MONITOR_URL`), pour la même raison.
- **La course base ↔ fichiers.** Le drill sauvegarde une base au repos. La
  propriété de sur-ensemble décrite dans `BACKUP.md` §1 n'est donc pas mise à
  l'épreuve par des écritures concurrentes.
- **Le volume réel.** Le drill porte sur 2,3 Mo. Les débits du §4 ont été
  mesurés séparément et ne sont pas rejoués par la CI.
