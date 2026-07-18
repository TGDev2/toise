# Sauvegardes et restauration — OPS-3

Procédure complète de sauvegarde chiffrée (base Postgres + volume `uploads`)
et de restauration, testée sur une base jetable. Référencée depuis
[`docs/DEPLOY.md`](../DEPLOY.md) §5.

## 1. Vue d'ensemble

- **Quoi** : la base Postgres (`pg_dump -Fc`, format custom) et le volume
  `uploads` (photos des projets), chacun chiffré individuellement.
- **Où** : `/var/backups/chiffreo` sur le VPS (configurable), fichiers
  `chiffreo-db-<horodatage>.dump.gpg` et `chiffreo-uploads-<horodatage>.tar.gz.gpg`.
- **Fréquence** : quotidienne, via cron (§4).
- **Rétention** : 14 jours par défaut, configurable (`RETENTION_DAYS`) — les
  fichiers plus anciens sont supprimés à chaque run (rotation simple par âge,
  pas de schéma journalier/hebdomadaire différencié pour l'instant).
- **Scripts** : [`backup.sh`](backup.sh) (cron) et [`restore.sh`](restore.sh)
  (drill de vérification et reprise sur sinistre — même script, deux modes).

## 2. Modèle de menace et choix du chiffrement

Chiffréo héberge des données personnelles (RGPD) ; le VPS lui-même est un
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
# Nom : Chiffréo Backup — e-mail : backup@chiffreo.fr (ou équivalent)

gpg --armor --export backup@chiffreo.fr > docs/deploy/chiffreo-backup-pub.asc
```

Committer `chiffreo-backup-pub.asc` dans le repo (une clé **publique** n'est
pas un secret). Sauvegarder la clé **privée** hors ligne — gestionnaire de
mots de passe, clé USB chiffrée, ou export papier (`paperkey`). Ne jamais la
copier sur le VPS.

**Sur le VPS** :

```bash
sudo gpg --import docs/deploy/chiffreo-backup-pub.asc
sudo gpg --edit-key backup@chiffreo.fr trust   # niveau 5 (ultimate) —
                                                 # évite les avertissements
                                                 # "clé non certifiée" au chiffrement
sudo mkdir -p /etc/chiffreo
sudo cp docs/deploy/backup.env.example /etc/chiffreo/backup.env
sudo chmod 600 /etc/chiffreo/backup.env && sudo chown root:root /etc/chiffreo/backup.env
# éditer /etc/chiffreo/backup.env : renseigner GPG_RECIPIENT=backup@chiffreo.fr
```

(`backup.sh` passe déjà `--trust-model always` à `gpg --encrypt`, donc l'étape
`trust` ci-dessus est une défense en profondeur, pas un blocant strict.)

## 4. Installation du cron

```bash
sudo crontab -e
# ajouter (sauvegarde quotidienne à 3h15 UTC) :
15 3 * * * bash /opt/chiffreo/docs/deploy/backup.sh >> /var/log/chiffreo-backup.log 2>&1
```

`backup.sh` échoue bruyamment (`set -euo pipefail`, code de sortie non nul)
en cas de problème — mais un VPS standard n'a pas de MTA local configuré par
défaut, donc **aucune alerte e-mail n'est envoyée aujourd'hui** en cas
d'échec cron : le seul signal est `/var/log/chiffreo-backup.log`. Une
alerte réelle (webhook, Sentry…) est prévue par OPS-5, pas par cette tâche —
en attendant, vérifier le log périodiquement ou après tout incident VPS.

Alternative non retenue : un timer systemd (`chiffreo-backup.service` +
`.timer`) offrirait un journal structuré (`journalctl`) et un
`OnFailure=` natif — à envisager si cron s'avère insuffisant.

## 5. Politique de rétention

Rétention plate par âge (`RETENTION_DAYS`, 14 par défaut) : simple, prévisible,
suffisant pour un premier niveau de sauvegarde. Un schéma différencié
(ex. 7 quotidiennes + 4 hebdomadaires) est une amélioration possible plus
tard, pas construite ici.

**Limite connue, assumée** : les sauvegardes restent sur le même VPS que la
donnée qu'elles protègent. Une panne disque du VPS emporterait la prod *et*
ses sauvegardes ensemble. Une copie hors-site (rsync/rclone vers un stockage
objet) n'est pas dans le périmètre de cette tâche — à traiter en suivi.

## 6. Restauration — drill de vérification (routine, non destructif)

À exécuter régulièrement (recommandé : mensuellement) pour prouver que les
sauvegardes sont réellement restaurables, pas seulement produites.

```bash
# Depuis un poste qui détient la clé privée (jamais depuis le VPS lui-même)
scp vps:/var/backups/chiffreo/chiffreo-db-<horodatage>.dump.gpg .
scp vps:/var/backups/chiffreo/chiffreo-uploads-<horodatage>.tar.gz.gpg .

bash docs/deploy/restore.sh \
  --db-backup chiffreo-db-<horodatage>.dump.gpg \
  --uploads-backup chiffreo-uploads-<horodatage>.tar.gz.gpg
```

Par défaut (`--mode verify`) : crée un conteneur Postgres et un volume
jetables, restaure dedans, vérifie (nombre de tables + `SANITY_CHECK_SQL` si
configuré), affiche `RESTAURATION: PASS` ou échoue bruyamment, puis détruit
la cible jetable. Ajouter `--keep` pour l'inspecter avant destruction.

Consigner chaque drill dans le tableau §8.

## 7. Restauration — reprise sur sinistre (VPS perdu)

1. Provisionner un nouveau VPS : suivre [`DEPLOY.md`](../DEPLOY.md)
   (`provision.sh`, DNS, `.env`).
2. Démarrer uniquement Postgres, base vide :
   `docker compose -f docker-compose.prod.yml up -d postgres`
3. Restaurer depuis la dernière sauvegarde récupérée **avant** la perte du
   VPS mort (ou depuis un stockage hors-site si disponible) :
   ```bash
   bash docs/deploy/restore.sh \
     --db-backup chiffreo-db-<dernier-horodatage>.dump.gpg \
     --uploads-backup chiffreo-uploads-<dernier-horodatage>.tar.gz.gpg \
     --mode prod --db-target chiffreo-db --uploads-target chiffreo_uploads \
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

À compléter à chaque drill réel sur le VPS une fois OPS-1 fait.

## 9. Non-goals / limites connues

- **Pas de copie hors-site** des sauvegardes (disque VPS = point de défaillance
  unique pour prod + sauvegardes). Suivi possible : rsync/rclone vers un
  stockage objet (Hetzner Storage Box, Backblaze B2…).
- **Pas d'alerting** sur échec cron (OPS-5). `backup.sh` échoue bruyamment et
  logue, mais rien ne pousse activement une alerte aujourd'hui.
- **Rétention plate**, pas de schéma différencié quotidien/hebdomadaire/mensuel.
- **Clé unique**, pas d'escrow — perte de la clé privée = sauvegardes
  définitivement perdues (assumé, voir §2).
