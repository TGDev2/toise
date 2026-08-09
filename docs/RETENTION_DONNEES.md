# Politique de rétention et effacement des données

> BACKLOG V1 E6-1. Décrit ce que Chiffréo conserve après une suppression, pendant
> combien de temps, et ce qui l'efface. La version destinée aux utilisateurs est
> la section « Conservation et suppression » de `/privacy`.

---

## 1. La durée : 30 jours après suppression logique

Un projet supprimé depuis l'application n'est pas effacé sur-le-champ : sa ligne
porte un `deleted_at` et il disparaît de toutes les lectures. **30 jours** plus
tard, une tâche planifiée efface définitivement ses lignes en base **et ses
fichiers sur le volume**.

`DATA_RETENTION_DAYS`, défaut `30`. Quatre raisons, dans l'ordre où elles
contraignent.

### 1.1 La sauvegarde fixe le plancher — c'est elle qui décide du nombre

`docs/deploy/backup.sh` conserve `RETENTION_DAYS=14` jours d'archives chiffrées
(base + volume `uploads`).

Si la rétention était **plus courte** que cette fenêtre, une restauration
ramènerait des projets déjà effacés : la donnée reviendrait après que
l'utilisateur en a obtenu l'effacement, et il faudrait attendre la passe suivante
pour qu'elle reparte — en ayant existé entre-temps.

À 30 > 14, toute archive encore sur l'étagère ne contient que des projets **encore
dans leur fenêtre de rétention**. Une restauration ne peut donc jamais annuler un
effacement.

> **Invariant à tenir : `DATA_RETENTION_DAYS` > `RETENTION_DAYS` de `backup.sh`.**
> Raccourcir l'un sans regarder l'autre casse la garantie ci-dessus en silence.

### 1.2 Un délai borné, au sens de l'article 17

Le RGPD (art. 17 §1) exige l'effacement « dans les meilleurs délais ». La doctrine
admet une conservation en base intermédiaire pendant une durée **définie et
documentée** ; elle n'admet pas une durée indéterminée. 30 jours est une durée
qu'on peut nommer, tenir et prouver — ce document et la page de confidentialité
l'énoncent, la tâche planifiée l'applique, et le test d'intégration
`test/integration/data-retention.int-spec.ts` en atteste.

### 1.3 La suppression accidentelle est le risque symétrique

L'application supprime un projet sur une seule confirmation, sans annulation. Ce
projet porte l'estimation, la liste d'achats, le budget réel saisi article par
article et les photos du chantier d'un client. 30 jours couvrent un cycle de
travail mensuel : un chantier interrompu puis repris le mois suivant reste
récupérable — par une intervention en base aujourd'hui, l'écran de corbeille
n'existant pas encore.

### 1.4 Le plafond

Au-delà, le délai ne sert plus la reprise et devient de la conservation sans
finalité, ce qu'interdit l'art. 5 §1 e). C'est pourquoi la valeur ne doit pas
être allongée « par prudence ».

### 1.5 Garde-fou

Une valeur nulle ou négative placerait la date de coupure à maintenant ou plus
tard, donc emporterait **tout** le stock supprimé logiquement — y compris le
projet effacé par erreur il y a une minute. La passe refuse alors de s'exécuter
et journalise l'erreur, plutôt que d'élargir une opération destructive.

---

## 2. Ce que chaque chemin efface

| Geste | Effet immédiat | Effet différé |
| --- | --- | --- |
| **Supprimer une photo** | ligne + fichier + vignette, tout de suite | — |
| **Supprimer un projet** | `deleted_at` posé ; publication communautaire retirée ; le projet sort de toutes les lectures | à J+30 : lignes (cascade) **et** fichiers |
| **Supprimer son compte** | résiliation Stripe, **puis effacement de tous les fichiers**, puis lignes, puis identité Firebase | — |
| **Fusionner un compte invité** | idem, pour l'espace personnel de l'invité | — |

### 2.1 L'ordre : fichiers d'abord, lignes ensuite

C'est la propriété structurante de l'implémentation, et la raison d'être du
correctif.

`project_photos` part en cascade avec `projects`, qui part en cascade avec le
compte (`users`) — depuis E4-1, la propriété n'est plus portée par une
organisation. La colonne `storage_url` est le **seul** lien entre une ligne et
un fichier du volume : une fois la ligne partie, plus rien ne permet de nommer le
fichier, et aucune passe future ne peut le retrouver. C'est exactement ce qui se
produisait avant E6-1 — chaque suppression de compte transformait les photos en
déchets permanents du volume `uploads`, repris à chaque sauvegarde nocturne.

Les fichiers partent donc **avant** les lignes. Une panne entre les deux laisse un
projet encore marqué supprimé, que la passe suivante reprend ; l'effacement de
fichiers tolérant l'absence, la reprise ne coûte rien. C'est ce qui rend
l'opération rejouable.

À la suppression de compte, une erreur d'effacement **interrompt** l'opération :
les lignes restent, la reprise est possible, et rien n'est annoncé qui n'ait été
fait. Dans la passe nocturne au contraire, un projet en échec est journalisé et
la passe continue sur les autres — elle est là pour faire baisser le stock, et le
projet en échec reste marqué supprimé donc repris le lendemain.

### 2.2 L'effacement par préfixe

Toutes les photos d'un projet vivent sous `uploads/<projectId>/`. L'effacement
porte sur ce répertoire entier, pas sur les chemins connus en base. C'est
strictement plus complet : il emporte aussi ce qu'aucune ligne ne référence — les
`.part` orphelins qu'un crash entre l'écriture et le `rename` laisse derrière lui
(cf. `local-storage.service.ts`), et les vignettes dont l'enregistrement de
`thumbnail_url` a échoué.

---

## 3. Le cas des projets partagés en communauté

Un projet terminé peut être publié dans la galerie : `community_projects` référence
les photos du projet par identifiant (`before_photo_ids`, `after_photo_ids`) et le
service sert ces fichiers **publiquement**.

**Supprimer le projet retire la publication**, dans la même transaction. La
suppression est une révocation du consentement qui avait permis la publication
(`gdpr_consent` / `gdpr_consent_at`). Sans ce geste, les photos d'un intérieur de
client restaient visibles de tous après que leur propriétaire a supprimé le
projet : ni la liste de la galerie ni le service des photos ne consultent
`projects.deleted_at`.

Le retrait est placé côté écriture, en un seul endroit, plutôt qu'en filtre ajouté
aux quatre lectures communautaires — un garde-fou qu'il faut penser à répéter est
un garde-fou qu'on oubliera.

La purge refait ce retrait avant d'effacer quoi que ce soit, pour deux raisons :
les publications écrites avant ce correctif, et l'absence de fenêtre pendant
laquelle une page publique référencerait des fichiers déjà partis.

Publier ne prolonge **pas** la rétention : à J+30 le projet est effacé et
`community_projects` part avec lui (`ON DELETE CASCADE`).

---

## 4. Ce qui survit, et pourquoi

- **Les factures.** Elles ne sont pas rattachées au projet : `invoices.project_id`
  et `invoices.quote_id` sont en `ON DELETE SET NULL`, et une facture est un
  document autoportant (identités, lignes et TVA figées en JSON à l'émission,
  `source_quote_number` conservé). Elle se réimprime à l'identique après la
  disparition du projet. Conservation obligatoire : 10 ans au titre de l'art.
  L123-22 du code de commerce, 6 ans au titre de l'art. L102 B du LPF
  (`docs/CONFORMITE_FACTURATION.md` §5).
- **Les devis** partent, eux, avec leur projet (`ON DELETE CASCADE`) : un devis
  n'est soumis à aucune exigence légale de conservation ni de continuité de
  numérotation (*ibid.*, note du §4), et il est reproduit dans la facture qu'il a
  produite.
- **Rien à propager côté benchmark de coûts ni apprentissage des facteurs de
  perte.** Les deux modules (DATA-3, DATA-4) ont été supprimés — code métier et
  routes d'administration — par E4-2 : plus aucun service ne lit ni n'écrit
  dans `cost_benchmarks` ni `learned_waste_factors`, conservées vides en base.
  Une suppression de compte n'a donc rien à y propager.

**Limite énoncée plutôt que découverte.** La clé étrangère `invoices.user_id`
est en `ON DELETE CASCADE` : supprimer son compte emporte les factures émises,
dont la conservation s'impose pourtant (art. L102 B LPF,
`docs/CONFORMITE_FACTURATION.md`). C'est le comportement effectif depuis
l'origine — avant E4-1 la cascade passait par l'organisation détruite avec son
propriétaire, `organization_id` étant alors `NOT NULL` — et E4-1 le reconduit
sans l'aggraver (voir le commentaire de `Invoice.user_id`,
`apps/api/src/invoices/entities/invoice.entity.ts`). L'obligation de
conservation comptable pèse sur l'artisan, pas sur l'hébergeur, et refuser la
suppression du compte pour la faire respecter serait opposer un obstacle à
l'exercice de l'art. 17. À reprendre si le produit se met à émettre des
factures pour le compte de tiers.

---

## 5. Exploitation

### Tâche planifiée

`DataRetentionService.runDailyPurge` — tous les jours à **3 h (Europe/Paris)**,
après la sauvegarde nocturne. Un verrou consultatif PostgreSQL empêche une passe
et un lancement manuel de se chevaucher : le travail étant idempotent, ce verrou
protège la lisibilité du journal, pas l'intégrité des données.

### Déclenchement manuel — simulation par défaut

```bash
cd apps/api
pnpm purge:retention           # SIMULATION : recense et journalise, n'efface rien
pnpm purge:retention --apply   # efface réellement
```

Le défaut est la simulation parce que c'est la seule valeur par défaut qu'une
faute de frappe rend inoffensive. Le script n'utilise pas `AppModule` : la purge
n'a besoin que de la base et du volume, quand `AppModule` exigerait des
identifiants Firebase, Stripe et Brevo qu'aucune console d'exploitation ne devrait
détenir pour effacer des photos.

### Mise en service

`DATA_RETENTION_DRY_RUN=true` met la **tâche planifiée** en observation : elle
journalise chaque nuit ce qu'elle effacerait, sans rien effacer. Laisser un cycle
passer sous ce réglage avant de basculer sur `false` est la manière recommandée de
mettre la purge en production sur une base existante — le premier passage y trouve
tout l'historique accumulé depuis l'origine.

### Journal

Une ligne par projet — identifiant, compte, date de suppression, nombre de
fichiers, volume, retrait communautaire éventuel — puis un récapitulatif de passe
avec la coupure appliquée. Les lignes de simulation sont préfixées
`[SIMULATION]`. C'est la preuve d'effacement : elle doit rester lisible, d'où le
verrou du §5.

---

## 6. Sauvegardes

Les sauvegardes chiffrées (`docs/deploy/backup.sh`) contiennent la base **et** le
volume `uploads`. Un fichier effacé disparaît des sauvegardes par rotation, au
plus tard 14 jours après la purge — soit **44 jours au pire cas** après la
demande de suppression d'un projet, et 14 jours après une suppression de compte.
Ces deux chiffres sont ceux que la page de confidentialité annonce.

---

## 7. Vérification

- `apps/api/test/integration/data-retention.int-spec.ts` — PostgreSQL réel et
  volume réel : un compte avec des photos sur disque est supprimé, et le test
  constate par `readdir` qu'aucun fichier ne subsiste. Couvre aussi la fenêtre de
  rétention, la simulation, l'idempotence, les fichiers orphelins et le projet
  publié en communauté.
- `apps/api/src/data-retention/data-retention.service.spec.ts` — coupure, ordre
  fichiers → base, refus sur rétention invalide, verrou, tolérance aux échecs.
- `apps/api/src/photos/storage/local-storage.service.spec.ts` — effacement par
  préfixe, orphelins emportés, préfixes hors volume refusés.
