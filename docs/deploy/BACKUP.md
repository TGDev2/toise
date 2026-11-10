# Sauvegardes et restauration — OPS-3

Procédure complète de sauvegarde chiffrée (base Postgres + volume `uploads`)
et de restauration, testée sur une base jetable. Référencée depuis
[`docs/DEPLOY.md`](../DEPLOY.md) §5.

## 1. Vue d'ensemble

- **Quoi** : la base Postgres (`pg_dump -Fc`, format custom) et le volume
  `uploads` (photos des projets), chacun chiffré individuellement.
- **Où** : `/var/backups/toise` sur le VPS (configurable), fichiers
  `toise-db-<horodatage>.dump.gpg` et `toise-uploads-<horodatage>.tar.gz.gpg`,
  plus une copie hors-site si `BACKUP_REMOTE` est configuré (§5).
- **Fréquence** : quotidienne, via cron (§4), **plus un point de restauration
  avant chaque déploiement** (§4.1).
- **Rétention** : 14 jours par défaut, configurable (`RETENTION_DAYS`) — les
  fichiers plus anciens sont supprimés à chaque run (rotation simple par âge,
  pas de schéma journalier/hebdomadaire différencié pour l'instant).
- **Signalement** : ping de supervision au succès, `/fail` à l'échec, si
  `BACKUP_MONITOR_URL` est configuré (§4).
- **Scripts** : [`backup.sh`](backup.sh) (cron) et [`restore.sh`](restore.sh)
  (drill de vérification et reprise sur sinistre — même script, deux modes),
  plus [`restore-drill.sh`](restore-drill.sh), qui déroule le cycle entier.
- **Restauration** : la procédure exacte, le temps constaté, ce qui est perdu
  au pire cas et les pièges découverts en la déroulant réellement sont dans
  [`RESTAURATION.md`](RESTAURATION.md). **À lire avant de restaurer.**

### Cohérence entre la base et les fichiers

Le dump et l'archive portent sur des données vivantes : rien ne les fige
ensemble. Un `pg_dump` suivi d'un simple `tar` produit donc une restauration où
une photo supprimée entre les deux laisse une **référence sans fichier**.

`backup.sh` garantit à la place une propriété unique et vérifiable — *le jeu de
fichiers archivé est un sur-ensemble de ce que le dump référence* — en
encadrant le dump :

1. **t0**, avant le dump : archive complète du volume. Tout fichier existant à
   t0 est capturé, y compris ceux qu'une suppression fera disparaître ensuite.
2. **t1** : `pg_dump`.
3. **t2**, après le dump : `find -newermt` ajoute à la *même* archive tout ce
   qui est apparu ou a changé depuis t0. Une entrée en double est résolue par
   la plus récente à l'extraction.

Toute ligne du dump référence un fichier qui existait à t1 : soit il existait
déjà à t0 (passe 1), soit il est né dans (t0, t1] et son mtime le place dans la
passe 3. Le seul défaut restant possible est un fichier *sans* ligne — un
orphelin bénin.

Deux compléments rendent cette propriété utile plutôt que théorique :

- les photos sont écrites de façon atomique par l'API (fichier temporaire puis
  `rename`, cf. `local-storage.service.ts`) : `tar` ne peut jamais archiver un
  fichier à moitié écrit ;
- l'archivage exige **GNU tar et GNU find** (`--append`, `-newermt`), que
  BusyBox ne fournit pas — d'où `HELPER_IMAGE=debian:12-slim` et non `alpine`.

**Limite assumée** : un fichier créé *et* supprimé à l'intérieur de la fenêtre
alors que le dump le référence encore échappe aux deux passes. Fermer cette
course-là demanderait un instantané de système de fichiers (LVM/ZFS), pas un
`tar`.

## 2. Modèle de menace et choix du chiffrement

Toisé héberge des données personnelles (RGPD) ; le VPS lui-même est un
actif qui peut être compromis. Deux options de chiffrement ont été
comparées :

- **GPG symétrique** (une passphrase unique, stockée dans un fichier
  root-only sur le VPS) : plus simple, mais un VPS compromis peut alors
  déchiffrer ses propres sauvegardes — protection nulle en cas d'intrusion.
- **GPG asymétrique** (retenu) : seule la clé **publique** vit sur le VPS
  (chiffrement uniquement, `gpg --encrypt --recipient ...`). La clé
  **privée**, nécessaire pour déchiffrer/restaurer, est générée hors du VPS
  et gardée hors ligne (gestionnaire de mots de passe, clé USB chiffrée). Un
  VPS compromis ne peut pas lire ses propres sauvegardes.

**Contrepartie assumée** : si la clé privée est perdue, toutes les
sauvegardes deviennent définitivement indéchiffrables (aucune porte
dérobée), et la restauration ne peut se faire que depuis une machine qui
détient cette clé — jamais depuis le VPS lui-même. Une seule paire de clés
est utilisée pour l'instant (pas de clé de secours/escrow) ; en ajouter une
plus tard ne casse rien (`gpg --recipient A --recipient B` sur les futures
sauvegardes uniquement).

## 3. Mise en place initiale (une fois)

**Sur un poste de confiance, hors du VPS** :

```bash
gpg --full-generate-key
# RSA and RSA, 4096 bits, pas d'expiration (0)
# Nom : Toisé Backup — e-mail : backup@toise.fr (ou équivalent)

gpg --armor --export backup@toise.fr > docs/deploy/toise-backup-pub.asc
```

Committer `toise-backup-pub.asc` dans le repo (une clé **publique** n'est
pas un secret). Sauvegarder la clé **privée** hors ligne — gestionnaire de
mots de passe, clé USB chiffrée, ou export papier (`paperkey`). Ne jamais la
copier sur le VPS.

**Sur le VPS** :

```bash
sudo gpg --import docs/deploy/toise-backup-pub.asc
sudo gpg --edit-key backup@toise.fr trust   # niveau 5 (ultimate) —
                                                 # évite les avertissements
                                                 # "clé non certifiée" au chiffrement
sudo mkdir -p /etc/toise
sudo cp docs/deploy/backup.env.example /etc/toise/backup.env
sudo chmod 600 /etc/toise/backup.env && sudo chown root:root /etc/toise/backup.env
# éditer /etc/toise/backup.env : renseigner GPG_RECIPIENT=backup@toise.fr
```

(`backup.sh` passe déjà `--trust-model always` à `gpg --encrypt`, donc l'étape
`trust` ci-dessus est une défense en profondeur, pas un blocant strict.)

## 4. Installation du cron

```bash
sudo crontab -e
# ajouter (sauvegarde quotidienne à 3h15 UTC) :
15 3 * * * bash /opt/toise/docs/deploy/backup.sh >> /var/log/toise-backup.log 2>&1
```

`backup.sh` échoue bruyamment (`set -euo pipefail`, code de sortie non nul),
mais un VPS standard n'a pas de MTA local : sans configuration supplémentaire,
un échec cron ne produit aucun signal sortant.

### 4.1 Deuxième déclencheur : avant chaque déploiement

Le cron couvre la perte du VPS. Il ne couvre pas le déploiement : entre 3h15 et
la mise en production d'une version, il peut s'être écoulé vingt heures de
saisies. La CD prend donc son propre point de restauration, juste avant de
changer quoi que ce soit :

```bash
bash docs/deploy/backup.sh --pre-deploy v1.2.0
# → toise-db-20260806T101500Z-predeploy-v1.2.0.dump.gpg
```

Ce mode diffère du run nocturne sur trois points, portés par ce **seul**
drapeau plutôt que par trois options à combiner :

1. l'artefact porte le tag dans son nom, pour que la procédure de retour
   arrière puisse le désigner sans ambiguïté ;
2. **base seule** : une migration ne touche pas le volume `uploads`, et les
   fichiers restent alors un sur-ensemble de ce que le dump référence — le sens
   bénin décrit au §1. Faire attendre chaque déploiement derrière une archive de
   photos coûterait des minutes pour rien ;
3. **aucun ping de supervision** : `BACKUP_MONITOR_URL` surveille le *cron*, et
   un ping émis par un déploiement masquerait un run nocturne manquant. Un échec
   est de toute façon signalé bruyamment — la CD s'arrête là (`DEPLOY.md` §6).

Il n'y a **pas** de rotation dans ce mode : supprimer est le seul geste
irréversible du script, et un déploiement n'a rien à effacer.

Conséquence à ne pas manquer : la mise en place du §3 (clé GPG et
`/etc/toise/backup.env`) devient un **prérequis du déploiement continu**.
Sans elle, chaque déploiement échoue à cette étape — délibérément.

### Alerte sur échec — et sur absence de run

Renseigner `BACKUP_MONITOR_URL` dans `/etc/toise/backup.env` avec une URL de
type [healthchecks.io](https://healthchecks.io) (offre gratuite suffisante, ou
instance auto-hébergée) :

```bash
BACKUP_MONITOR_URL=https://hc-ping.com/<uuid>
```

Le script pinge cette URL à la fin d'un run réussi, et `<url>/fail` à l'échec.
Régler la période du check sur 1 jour avec une marge de quelques heures.

Ce choix couvre le cas qu'une alerte purement « sur échec » ne voit jamais :
**le cron qui n'a pas tourné du tout** (service désactivé, VPS éteint, disque
plein empêchant même le démarrage du script). Le silence devient alors lui-même
un signal, ce qu'aucun code embarqué dans le script ne peut produire.

Sans cette variable, le seul signal reste `/var/log/toise-backup.log` — à
vérifier périodiquement et après tout incident VPS.

Alternative non retenue : un timer systemd (`toise-backup.service` +
`.timer`) offrirait un journal structuré (`journalctl`) et un
`OnFailure=` natif — à envisager si cron s'avère insuffisant.

## 5. Rétention et copie hors-site

Rétention locale plate par âge (`RETENTION_DAYS`, 14 par défaut) : simple,
prévisible, suffisant pour un premier niveau de sauvegarde. Un schéma
différencié (ex. 7 quotidiennes + 4 hebdomadaires) est une amélioration
possible plus tard, pas construite ici.

**Dimensionner `/var/backups` à ~15 × le volume `uploads`.** Chaque nuit
produit une archive de la taille du volume — des JPEG sont déjà compressés,
`gzip` ne gagne rien dessus (mesuré : 501 Mo → 501 Mo) — et 14 jours sont
conservés. 5 Go de photos demandent donc ~70 Go, plus ~2 × le volume en pic
transitoire dans `/var/backups/.tmp` pendant le run. Un disque plein à 3 h 15
est une panne silencieuse tant que `BACKUP_MONITOR_URL` n'est pas renseignée.
Détail et débits mesurés : [`RESTAURATION.md`](RESTAURATION.md) §4.

### Copie hors-site

Des sauvegardes qui vivent sur le disque qu'elles protègent ne protègent de
rien face à une panne disque, un vol de machine ou un chiffrement du VPS : la
prod et ses sauvegardes disparaissent ensemble. `backup.sh` pousse donc les
fichiers chiffrés vers une destination distante à la fin de chaque run, dès que
`BACKUP_REMOTE` est renseigné.

```bash
sudo apt install rclone
sudo rclone config          # une fois, en root : créer un remote (B2, S3, SFTP…)
# puis dans /etc/toise/backup.env :
BACKUP_REMOTE=b2:toise-backups/vps
```

Les fichiers partent **déjà chiffrés** par GPG (§2) : le fournisseur de
stockage n'est jamais un tiers de confiance, et un compte de stockage compromis
ne donne accès à rien de lisible.

Le script fait `rclone copy`, jamais `sync` — délibérément. Une copie distante
qui reflète les suppressions locales n'est pas une sauvegarde : un VPS
compromis effacerait la copie distante en même temps que la sienne. La
conséquence est que la rétention distante doit être réglée **côté fournisseur**
(règle de cycle de vie sur le bucket), hors d'atteinte du VPS. Utiliser si
possible une clé d'application en écriture seule, sans droit de suppression.

Sans `BACKUP_REMOTE`, le script le signale à chaque run (`AVERTISSEMENT`) — une
absence de protection qui reste visible plutôt que tacite.

## 6. Restauration — drill de vérification (routine, non destructif)

À exécuter régulièrement (recommandé : mensuellement) pour prouver que les
sauvegardes sont réellement restaurables, pas seulement produites.

```bash
# Depuis un poste qui détient la clé privée (jamais depuis le VPS lui-même)
scp vps:/var/backups/toise/toise-db-<horodatage>.dump.gpg .
scp vps:/var/backups/toise/toise-uploads-<horodatage>.tar.gz.gpg .

bash docs/deploy/restore.sh \
  --db-backup toise-db-<horodatage>.dump.gpg \
  --uploads-backup toise-uploads-<horodatage>.tar.gz.gpg
```

Par défaut (`--mode verify`) : crée un conteneur Postgres et un volume
jetables, restaure dedans, vérifie (nombre de tables + `SANITY_CHECK_SQL` si
configuré), affiche `RESTAURATION: PASS` ou échoue bruyamment, puis détruit
la cible jetable. Ajouter `--keep` pour l'inspecter avant destruction.

Consigner chaque drill dans le tableau §8.

## 7. Restauration — reprise sur sinistre (VPS perdu)

> Procédure détaillée, temps constaté et pièges : [`RESTAURATION.md`](RESTAURATION.md).
>
> Deux propriétés du mode `--mode prod` à connaître avant de lancer la commande,
> toutes deux acquises en éprouvant le cycle (RESTAURATION.md §6) :
>
> - **la base cible est détruite et recréée**, pour que rien de postérieur à la
>   sauvegarde ne survive à la restauration ;
> - **le script refuse de démarrer si l'application est encore branchée** sur la
>   base. Arrêter `api` et `web` d'abord, comme le demandait déjà `DEPLOY.md`.

1. Provisionner un nouveau VPS : suivre [`DEPLOY.md`](../DEPLOY.md)
   (`provision.sh`, DNS, `.env`).
2. Démarrer uniquement Postgres, base vide :
   `docker compose -f docker-compose.prod.yml up -d postgres`
   (aucune attente à intercaler : `restore.sh` attend lui-même que l'instance
   définitive accepte les connexions TCP.)
3. Récupérer la dernière sauvegarde. Si `BACKUP_REMOTE` était configuré (§5),
   c'est la source à utiliser — le disque du VPS mort n'est plus accessible :
   ```bash
   # Depuis le poste qui détient la clé privée
   rclone copy b2:toise-backups/vps . --include 'toise-*.gpg' --max-age 48h
   ```
   Puis restaurer :
   ```bash
   bash docs/deploy/restore.sh \
     --db-backup toise-db-<dernier-horodatage>.dump.gpg \
     --uploads-backup toise-uploads-<dernier-horodatage>.tar.gz.gpg \
     --mode prod --db-target toise-db --uploads-target toise_uploads \
     --yes-i-know-this-is-production
   ```
   (Confirmation interactive demandée : taper le nom exact de la cible.)
4. Démarrer le reste de la stack :
   `docker compose -f docker-compose.prod.yml up -d --build`
5. Vérifier `/api/v1/health` et un parcours applicatif de base avant de
   rouvrir le DNS/trafic public.

## 8. Journal des tests de restauration

| Date | Opérateur | Mode | Résultat | Notes |
|---|---|---|---|---|
| 2026-07-18 | Dry-run local (agent) | verify, cibles jetables `postgres:16-alpine` | PASS | Voir `tasks/todo.md` OPS-3 pour la transcription complète (empreinte contenu DB + manifeste fichiers uploads identiques avant/après) |
| 2026-08-06 | Pilote de retour arrière (E6-5) | **prod**, base réelle du pilote, dump `--pre-deploy` | PASS | Restauration en **3 s** (45 tables) sur une base qu'une migration contractante venait d'amputer. Schéma et données rétablis, écriture postérieure au point de restauration perdue — conformément à `DEPLOY.md` § Retour arrière. Premier exercice du mode `--mode prod`. |
| 2026-08-06 | Cycle complet (OPS-4), `restore-drill.sh` | **prod**, base **et volume `uploads`** détruits puis restaurés | PASS | Premier cycle de bout en bout : jeu de données représentatif (compte, organisation, projets, photos sur disque, estimation, liste, devis et facture numérotés) → sauvegarde → destruction du conteneur **et des deux volumes** → restauration → **démarrage de l'API de production sur la base restaurée**. Sauvegarde 2 s, restauration 6 s, cycle complet 35 s. Trois défauts trouvés et corrigés, voir [`RESTAURATION.md`](RESTAURATION.md) §6. Rejoué chaque lundi par la CI. |

À compléter à chaque drill réel sur le VPS une fois OPS-1 fait. Le cycle
automatisé, lui, tourne chaque semaine
(`.github/workflows/backup-drill.yml`) — mais sur des cibles jetables : il ne
remplace pas un drill sur les artefacts réellement produits par le VPS, qui
seuls exercent la clé GPG de production et la copie hors-site.

## 9. Non-goals / limites connues

- **Copie hors-site et alerting sont opt-in** : le mécanisme existe et le script
  avertit à chaque run tant que `BACKUP_REMOTE` / `BACKUP_MONITOR_URL` ne sont
  pas renseignés (§4, §5). Tant qu'ils ne le sont pas, le VPS reste un point de
  défaillance unique pour la prod *et* ses sauvegardes, et un échec cron reste
  muet. Ces deux valeurs demandent des identifiants qui ne peuvent pas vivre
  dans le dépôt.
- **Rétention distante non gérée par le script** : `rclone copy` n'efface
  jamais rien à distance (§5). À régler par une règle de cycle de vie côté
  fournisseur, sans quoi le stockage distant croît indéfiniment.
- **Pas d'instantané de système de fichiers** : la cohérence base ↔ fichiers
  repose sur l'encadrement du dump (§1). Un fichier créé *et* supprimé pendant
  la fenêtre, encore référencé par le dump, y échappe.
- **Rétention locale plate**, pas de schéma différencié quotidien/hebdomadaire/
  mensuel.
- **Clé unique**, pas d'escrow — perte de la clé privée = sauvegardes
  définitivement perdues (assumé, voir §2).
