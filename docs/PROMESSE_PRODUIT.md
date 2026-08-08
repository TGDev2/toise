# Promesse produit — ce que Chiffréo dit, et ce qu'il ne dit pas

> Ce document n'est pas un conseil juridique. Il décrit une ligne de rédaction
> et le raisonnement qui la fonde. La rédaction contractuelle qui en découle
> (CGU art. 10, CGV art. 11) doit être relue par un juriste avant la mise en
> vente — un bandeau le rappelle en tête des deux pages.

## 1. La promesse, en une phrase

> Chiffréo calcule une **base de commande** à partir de la géométrie réelle de
> la pièce et de ratios sourcés, et affiche le détail de ce calcul. **L'artisan
> la valide** avant d'acheter.

Ce qui est promis : le calcul, sa traçabilité, sa vitesse. Ce qui ne l'est
jamais : le résultat.

## 2. Pourquoi ce n'est pas une question de style

Deux règles de droit français se combinent, et leur combinaison se referme sur
nous à mesure que le marketing promet davantage.

**Le devoir de conseil ne s'éteint pas par la remise d'une documentation.**
Afficher la fiche fabricant d'un rendement ne transfère pas la décision au
client, y compris quand ce client est un professionnel. C'est nous qui avons
choisi la source, choisi le ratio et fait le calcul ; c'est donc nous qui
répondons de cette chaîne de choix. Un lien vers une fiche technique est une
preuve de diligence, pas une décharge.

**L'article 1170 du Code civil répute non écrite toute clause qui prive de sa
substance l'obligation essentielle du contrat.** Il codifie la jurisprudence
Chronopost (Com. 22 oct. 1996) puis Faurecia (Com. 29 juin 2010). Le mécanisme,
appliqué ici :

1. Le marketing désigne l'obligation essentielle. Plus il promet l'exactitude
   du calcul, plus « le calcul juste » *devient* l'obligation essentielle du
   contrat aux yeux du juge.
2. La clause de limitation de responsabilité est ensuite lue à l'aune de cette
   obligation. Si elle exclut la responsabilité sur les écarts de quantités, et
   que l'obligation essentielle est de donner la quantité juste, elle vide le
   contrat de sa substance.
3. Elle est alors **réputée non écrite** — pas réduite, pas plafonnée :
   supprimée. Nous nous retrouvons sans limitation du tout, sur le risque le
   plus coûteux du produit.

**Conséquence pratique** : chaque adjectif d'exactitude ajouté à une page
d'accueil affaiblit une clause écrite ailleurs. Les deux textes ne sont pas
indépendants, et c'est le plus flatteur des deux qui décide.

`docs/ASSURANCE_ET_RISQUE.md` §« Engagements disproportionnés » écrit la même
contrainte du côté assurantiel : les CGV doivent qualifier le quantitatif
d'estimation à valider par l'artisan, jamais de résultat garanti — une
exactitude promise contractuellement, a fortiori assortie de pénalités, ne
serait pas couverte.

## 3. La liste interdite

Elle vit dans `docs/promesse-lexique.json` — un fichier, lu à l'exécution par
les deux garde-fous. Sept familles :

| id | ce qui est visé | pourquoi |
| --- | --- | --- |
| `exactitude` | exact, exacte, exactes, exactitude, exactement | fait du calcul juste l'obligation essentielle (§2) |
| `precision` | précis, précise, précision, précisément | même mécanisme, sous un mot plus doux |
| `unicite` | « le seul outil », « la seule dont », « l'unique logiciel » | factuellement faux, et un superlatif reste invérifiable par le lecteur |
| `zero-perte` | « n'achetez plus », « zéro perte », « la juste quantité » | le moteur retient un conditionnement vendu en rayon : il reste toujours un surplus |
| `infaillibilite` | « infaillible », « au centimètre près », « résultat garanti » | déplace une obligation de moyens vers une obligation de résultat |
| `economie-promise` | « économisez », « jusqu'à X % » | promesse chiffrée tournée vers l'avenir |
| `surplus-chiffre` | « 15 à 25 % de matériaux » | chiffre un gain que rien ne mesure sur le chantier de l'utilisateur |

### Le cas de l'unicité

« Le seul outil qui calcule les quantités de matériaux » est faux depuis
ArtisanSmart, ChantierFlow, JLogiciels et Obat — `docs/VEILLE_CONCURRENTIELLE.md`
§5.2 le documente concurrent par concurrent. Une affirmation fausse est un
risque en soi, indépendamment du risque contractuel : elle relève de la pratique
commerciale trompeuse (art. L121-2 C. conso).

La variante atténuée — « parmi les neuf offres étudiées, Chiffréo est **la
seule** dont le calcul est géométrique et traçable » — a été retirée elle aussi
en août 2026. Elle était bornée et sourcée, donc défendable sur le fond ; elle
restait invérifiable par le lecteur, périssable au premier mouvement d'un
concurrent, et elle transformait une **constatation d'absence** (« aucune des
neuf ne le documente ») en **affirmation d'unicité** qu'il aurait fallu prouver.
La forme retenue dit ce que le produit fait, puis ce que la veille a constaté
chez les autres.

## 4. Ce qui reste autorisé, et pourquoi

La ligne n'est pas « ne rien affirmer ». Elle est : **n'affirmer que ce qu'un
écran peut montrer.**

- **La géométrie.** « Portes et fenêtres sont soustraites, pièce par pièce » est
  vrai, vérifiable dans le détail du calcul, et c'est un argument fort.
- **La traçabilité.** « Le rendement vient de la fiche technique X, consultée le
  jj/mm » est vrai et opposable — c'est même la preuve de diligence que le
  devoir de conseil attend de nous.
- **Les valeurs du catalogue.** « De 5 % pour une pose droite experte à 20 % en
  diagonale débutant » décrit ce que le moteur applique, pas ce que
  l'utilisateur obtiendra.
- **Un montant d'économie constaté**, calculé sur les données réelles de
  l'utilisateur, reste affichable : « Économie de mutualisation : 42 € » dit ce
  que *ses* achats ont coûté par rapport à un achat pièce par pièce, à
  quantités et prix identiques. Ce n'est pas une promesse tournée vers l'avenir,
  c'est une mesure — et l'écran affiche la méthode à côté du chiffre.
- **La vitesse.** « Le chiffrage tient dans la visite » porte sur le parcours,
  qui est chronométré (`apps/web/e2e/parcours-chrono.spec.ts`), pas sur la
  justesse du résultat.

La frontière tient en une question : *si ce chiffre est faux chez ce client,
qu'ai-je promis ?* Une mesure de son propre chantier ne peut pas être « fausse »
au sens contractuel. Un pourcentage de gain annoncé avant qu'il ne mesure quoi
que ce soit, si.

## 5. Le garde-fou

Deux suites appliquent la liste :

- `apps/web/src/__tests__/promise-wording.spec.ts` — balaie `apps/web/src`
- `apps/api/src/common/__tests__/promise-wording.spec.ts` — balaie
  `apps/api/src`, migrations comprises (elles portent les `description_fr` des
  feature gates, affichées telles quelles)

Trois choix de conception méritent d'être connus avant de les modifier.

**Le balayage passe par l'AST TypeScript, pas par une expression régulière sur
le fichier.** Une trentaine de commentaires du dépôt emploient légitimement
« exactement » ou « précisément » pour décrire un mécanisme interne. Un scan
textuel aurait imposé de les réécrire, c'est-à-dire de dégrader la
documentation du code pour satisfaire un test. L'AST ne retient que ce qui peut
atteindre un écran : littéraux de chaîne, gabarits, texte JSX. Les commentaires
et les messages d'exception techniques ne sont pas concernés.

**Le balayage part de l'arborescence entière**, jamais d'une liste de fichiers
« sensibles » : un fichier neuf est couvert d'office. C'est la seule forme où
l'oubli est sûr. Une assertion distincte vérifie que le scan visite bien plus de
cent fichiers et qu'il contient les surfaces marketing connues — un scanner qui
ne visite rien serait vert pour toujours.

**Les exemptions sont nommées, situées et motivées.** Une entrée de `allowed`
porte la phrase exacte, la liste des fichiers où elle est tolérée, et sa raison.
Reformuler la phrase lui fait perdre son exemption ; la déplacer dans un autre
fichier aussi. Un test refuse par ailleurs toute exemption qui désigne un
fichier disparu — une exemption qui survit à son fichier est une porte laissée
ouverte sur un chemin que plus personne ne relit.

**Ce que le garde-fou ne couvre pas**, et qu'il faut donc relire à la main :
`docs/` (ce document et la veille concurrentielle portent les règles, pas le
produit), les chaînes construites à l'exécution depuis la base
(`feature_gates.description_fr` déjà en production), et les textes des supports
externes — site vitrine tiers, campagnes, argumentaires commerciaux.

## 6. Où la promesse est écrite

| Surface | Fichier |
| --- | --- |
| Landing particulier | `apps/web/src/app/page.tsx` |
| Landing artisan | `apps/web/src/app/artisans/page.tsx` |
| Calculateurs publics + JSON-LD FAQ | `apps/web/src/lib/calculators.ts` |
| Vérificateur de devis | `apps/web/src/lib/quote-check.ts` |
| Offre et paliers | `apps/web/src/lib/pricing.ts` |
| Métadonnées globales, OG | `apps/web/src/app/layout.tsx` |
| Manifeste PWA | `apps/web/src/app/manifest.ts` |
| Fiches communauté (SEO) | `apps/web/src/lib/community-seo.ts` |
| E-mails de cycle de vie | `apps/api/src/email/templates/` |
| Clause de responsabilité (CGU + CGV) | `apps/web/src/components/legal/LegalLayout.tsx` (`LiabilityClause`) |

La clause de responsabilité est **un seul texte monté à deux endroits**. Les CGV
renvoyaient auparavant aux CGU pour les limites de responsabilité, et un
utilisateur gratuit n'a que les CGU : deux rédactions concurrentes de la même
limite auraient divergé, et c'est la plus faible des deux qu'un juge aurait lue.

## 7. Ce que la clause dit, et pourquoi dans cet ordre

Elle ne commence pas par exclure. Elle commence par **définir l'obligation
essentielle pour ce qu'elle est réellement** : mettre à disposition un calcul
documenté et traçable, avec diligence sur le choix et la mise à jour des
données. Une clause qui limiterait la responsabilité *sur cette obligation-là*
tomberait sous l'article 1170 ; une clause qui limite le reste, après avoir dit
que le résultat n'a jamais été promis, ne prive rien de sa substance.

Puis, dans l'ordre : la validation par l'utilisateur, l'exclusion des dommages
indirects, le plafond, les réserves.

**Le plafond n'est opposable qu'aux professionnels.** Opposé à un consommateur,
il tomberait sous l'article R212-1 6° du Code de la consommation, qui répute
irréfragablement abusive toute clause supprimant ou réduisant le droit à
réparation du consommateur. Le plafonner « pour tout le monde » aurait été la
faute symétrique de celle que ce lot corrige : une clause plus large qui protège
moins.

**Restent hors de toute limitation** : le dommage corporel, la faute lourde ou
dolosive, les garanties légales, et ce que la loi interdit d'exclure.
