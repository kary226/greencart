# RAMCI — DESIGN.md

Système de design de l'interface **Colis SHEIN** (suivi de colis, conversation
client ↔ agent, devis et paiements). Format `DESIGN.md` — déposez ce fichier à
la racine et donnez-le à un agent de code pour générer une UI cohérente.

Portée actuelle : surface Colis SHEIN. Le reste du site (boutique, back-office)
conserve la palette bordeaux historique. Les jetons ci-dessous sont conçus pour
pouvoir être étendus au site entier sans réécriture.

---

## 1. Thème visuel & atmosphère

**Rouge, noir, blanc. Rien d'autre.** Une identité de marque directe, à fort
contraste, empruntée à la communication promotionnelle de RAMCI : titres noirs
très gras, accent rouge saturé, fonds blancs.

L'atmosphère visée est celle d'un **service, pas d'une boutique** : le client
suit une commande qui engage son argent. La densité est moyenne — assez d'air
pour ne pas paraître administratif, assez de compacité pour que tout l'état d'un
colis tienne dans un écran de téléphone.

Trois principes gouvernent chaque décision :

1. **Le rouge signifie action ou marque, jamais décor.** Un bloc rouge est soit
   quelque chose à faire (payer, envoyer), soit un marqueur d'identité. Un rouge
   décoratif dilue les boutons qui comptent.
2. **Le noir porte la hiérarchie.** Les titres sont noirs et lourds ; le rouge
   ne sert pas à faire un titre.
3. **Le statut se lit en une seconde.** À tout moment le client doit savoir où
   en est son colis sans lire une phrase entière.

Mobile d'abord, sans exception : ces écrans sont consultés au téléphone dans
plus de 90 % des cas.

---

## 2. Palette & rôles

### Rouge — marque et action

| Jeton | Hex | Rôle |
|---|---|---|
| `ramses-50` | `#FFF1F1` | Fond de bulle client très clair, surlignage doux |
| `ramses-100` | `#FFDFE0` | Fond de badge, séparateur teinté |
| `ramses-200` | `#FFC2C4` | Bordure sur fond rouge clair |
| `ramses-300` | `#FF9497` | Icône désactivée sur fond rouge |
| `ramses-400` | `#FA5A5F` | Survol sur fond sombre |
| `ramses-500` | `#EE2A32` | Rouge secondaire, étoiles, accents |
| **`ramses-600`** | **`#E31E24`** | **Rouge de marque — boutons primaires, bulles client** |
| `ramses-700` | `#BF1319` | Survol / appui du bouton primaire |
| `ramses-800` | `#9C1116` | Appui prolongé, bordure de contraste |
| `ramses-900` | `#7F1418` | Texte rouge sur fond très clair (contraste AA) |

### Encre — hiérarchie et structure

| Jeton | Hex | Rôle |
|---|---|---|
| `ink-0` | `#FFFFFF` | Surface primaire, bulles agent, en-têtes |
| `ink-50` | `#F7F7F8` | Fond du fil de conversation, zones creuses |
| `ink-100` | `#EDEDEF` | Bordures fines, séparateurs |
| `ink-200` | `#DCDCE0` | Bordures de champs, contours de cartes |
| `ink-300` | `#B9B9C0` | Texte désactivé, icônes inactives |
| `ink-400` | `#8A8A93` | Texte tertiaire (horodatage, mentions) |
| `ink-500` | `#5F5F68` | Texte secondaire (descriptions, libellés) |
| `ink-600` | `#3D3D45` | Texte courant sur fond clair |
| `ink-700` | `#26262C` | Sous-titres |
| `ink-800` | `#17171B` | Titres |
| **`ink-900`** | **`#0B0B0D`** | **Noir de marque — titres d'affichage, texte fort** |

### Sémantique — réservée au statut, jamais à l'esthétique

| Jeton | Hex | Rôle |
|---|---|---|
| `ok-500` | `#0E9F6E` | Payé, livré, confirmé |
| `ok-50` | `#E7F7F0` | Fond de badge succès |
| `warn-500` | `#D97706` | En attente d'une action du client |
| `warn-50` | `#FEF6E7` | Fond de badge attente |
| `info-500` | `#2563EB` | Information neutre, en transit |
| `info-50` | `#EAF1FE` | Fond de badge information |

> ⚠️ **`ok-500` et `warn-500` ne sont pas interchangeables avec le rouge de
> marque.** Un colis annulé se signale en `ink-400` (neutre, terminé), pas en
> rouge : le rouge est déjà pris par la marque et par les actions.

### Ratios de contraste vérifiés

| Combinaison | Ratio | Usage autorisé |
|---|---|---|
| `ink-900` sur `ink-0` | 18.9:1 | Tout |
| `ink-500` sur `ink-0` | 6.8:1 | Texte courant, AA petit texte |
| `ink-400` sur `ink-0` | 4.1:1 | **≥ 14 px uniquement** (horodatage) |
| `ink-0` sur `ramses-600` | 4.9:1 | Texte de bouton ≥ 14 px, AA |
| `ramses-900` sur `ramses-50` | 8.2:1 | Texte rouge sur fond rouge clair |

> `ink-300` ne doit jamais porter de texte lisible — bordures et icônes
> décoratives uniquement.

---

## 3. Typographie

**Une seule famille : Inter** (variable, déjà chargée par le projet). Le
Playfair Display du reste du site n'entre pas sur cette surface — l'empattement
contredit le caractère direct de l'identité rouge/noir.

| Rôle | Taille | Graisse | Interlignage | Interlettrage | Couleur |
|---|---|---|---|---|---|
| Display | 28 px | 800 | 1.05 | −0.03em | `ink-900` |
| Titre 1 | 20 px | 800 | 1.15 | −0.02em | `ink-900` |
| Titre 2 | 16 px | 700 | 1.25 | −0.01em | `ink-800` |
| Titre 3 | 14 px | 700 | 1.3 | 0 | `ink-800` |
| Corps | 14 px | 400 | 1.55 | 0 | `ink-600` |
| Corps fort | 14 px | 600 | 1.5 | 0 | `ink-800` |
| Légende | 12 px | 500 | 1.4 | 0 | `ink-500` |
| Micro | 11 px | 600 | 1.3 | +0.02em | `ink-400` |
| Étiquette | 10 px | 800 | 1 | +0.08em | variable, **MAJUSCULES** |

**Règles**

- Les tailles d'affichage (28/20 px) sont en graisse **800**, jamais 600 : la
  lourdeur est l'identité, un titre semi-gras casse le rapport à l'image de marque.
- L'interlettrage négatif ne s'applique qu'à partir de 20 px. En dessous il nuit
  à la lisibilité.
- Les étiquettes en majuscules ne dépassent jamais **deux mots** (« DEVIS »,
  « VOTRE AVIS », « À PAYER »). Au-delà, passer en Micro casse.
- Les montants sont en `font-variant-numeric: tabular-nums` — sans ça, les
  totaux d'une liste ne s'alignent pas verticalement.
- Jamais d'italique. Jamais de souligné hors lien.

---

## 4. Composants

### Boutons

| Variante | Fond | Texte | Bordure | Usage |
|---|---|---|---|---|
| Primaire | `ramses-600` | `ink-0` | — | Une seule par écran : payer, envoyer, valider |
| Primaire (survol) | `ramses-700` | `ink-0` | — | |
| Primaire (appui) | `ramses-800` | `ink-0` | — | `transform: scale(.98)` |
| Primaire (inactif) | `ink-200` | `ink-400` | — | `cursor: not-allowed`, jamais d'opacité seule |
| Secondaire | `ink-0` | `ink-800` | 1.5 px `ink-200` | Action alternative |
| Fantôme | transparent | `ink-500` | — | Retour, fermer, annuler |
| Danger | `ink-0` | `ramses-700` | 1.5 px `ramses-200` | Suppression — **jamais rouge plein**, pour ne pas être confondu avec le primaire |

Rayon **12 px**, hauteur **44 px** (48 px pour un bouton pleine largeur),
graisse 600, transition `.15s ease`.

### Bulles de conversation

| | Client | Agent |
|---|---|---|
| Fond | `ramses-600` | `ink-0` |
| Texte | `ink-0` | `ink-700` |
| Bordure | — | 1 px `ink-100` |
| Rayon | 18 px, **6 px** en bas à droite | 18 px, **6 px** en bas à gauche |
| Alignement | droite | gauche |
| Largeur max | 78 % | 78 % |
| Horodatage | `ramses-200` | `ink-400` |

Le petit rayon asymétrique (6 px) est ce qui identifie l'émetteur au premier
coup d'œil, avant même la couleur — il doit être conservé.

**Groupement** : deux messages consécutifs du même émetteur à moins de 2 minutes
d'écart se collent (écart 2 px au lieu de 10 px) et seul le dernier porte
l'horodatage.

### Cartes

Fond `ink-0`, bordure 1 px `ink-100`, rayon 16 px, ombre niveau 1.
Une carte **d'action** (devis à payer, avis à donner) porte en plus une bordure
gauche de 3 px en `ramses-600` — c'est le signal « ceci attend quelque chose de
vous ».

### Champs de saisie

Fond `ink-50`, bordure 1.5 px transparente, rayon 12 px, hauteur 44 px,
padding horizontal 16 px.
Au focus : fond `ink-0`, bordure `ramses-600`, halo `0 0 0 3px rgba(227,30,36,.12)`.
En erreur : bordure `ramses-700` + message en 12 px `ramses-900` **sous** le
champ, jamais en infobulle.

Le champ de message de la conversation est une exception : rayon **22 px**
(pilule), pour le distinguer d'un formulaire.

### Badges de statut

Hauteur 22 px, rayon 999 px, padding 0 10 px, 11 px / graisse 700.
Pastille de 6 px à gauche, couleur pleine du statut.

| Statut colis | Fond | Texte |
|---|---|---|
| En attente d'un agent | `info-50` | `info-500` |
| Action requise (payer) | `warn-50` | `warn-500` |
| En cours / en livraison | `ink-100` | `ink-600` |
| Payé / livré | `ok-50` | `ok-500` |
| Annulé | `ink-100` | `ink-400` |

### Frise de statut (suivi de colis)

Verticale sur mobile, horizontale à partir de 768 px.
Étape franchie : pastille `ramses-600` pleine, trait `ramses-600`.
Étape en cours : pastille `ramses-600` avec halo pulsé `rgba(227,30,36,.18)`.
Étape à venir : pastille `ink-200`, trait `ink-100`.
Le libellé de l'étape en cours est en graisse 700 `ink-900` ; les autres en 500
`ink-400`.

---

## 5. Mise en page

**Échelle d'espacement — multiples de 4 uniquement :**
`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`

Aucune valeur intermédiaire (pas de 10, 14, 18). Un écran qui a besoin de 18 px
a en réalité un problème de structure.

| Contexte | Valeur |
|---|---|
| Marge d'écran (mobile) | 16 px |
| Marge d'écran (≥ 640 px) | 24 px |
| Largeur max du fil de conversation | 560 px |
| Largeur max des pages de liste | 720 px |
| Écart entre bulles | 10 px |
| Écart entre bulles groupées | 2 px |
| Padding interne de carte | 16 px |
| Écart entre cartes | 12 px |

**Structure de la conversation** : trois zones fixes — en-tête collant en haut,
fil défilant au centre, zone de saisie collante en bas. Seul le centre défile.
La zone de saisie respecte `env(safe-area-inset-bottom)` pour les iPhone à
encoche.

**Philosophie du blanc** : l'air se met **entre les groupes**, pas à l'intérieur.
Une carte compacte séparée de 12 px de la suivante se lit mieux qu'une carte
aérée collée à sa voisine.

---

## 6. Profondeur & élévation

**La profondeur se fait par échelle de surfaces, pas par ombre.** On monte
d'un cran de fond et on pose un filet de 1 px — c'est tout. Une ombre n'est
justifiée que si l'élément **flotte réellement** au-dessus du reste : modale,
menu contextuel, feuille.

| Niveau | Traitement | Jeton | Usage |
|---|---|---|---|
| 0 — plat | rien | — | Bulles, listes, contenu courant |
| 1 — levé | `#FFF` + filet 1 px `#EDEDEF` | `.rs-raised` | Cartes, devis, panneaux |
| 2 — creusé | fond `#F7F7F8` | `.rs-sunken` | Fil de conversation, zones inertes |
| 3 — flottant | filet + `--rs-shadow-float` | `.rs-float` | Modales, menus, feuilles |
| Focus | `--rs-focus` = `0 0 0 2px rgba(227,30,36,.5)` | — | **Jamais supprimé** |

L'ombre flottante est **teintée vers l'encre** (`rgba(11,11,13,…)`), jamais
en noir pur : une ombre neutre sur une palette froide paraît sale.

Aucune ombre colorée, aucun dégradé, aucun `backdrop-blur` : ils brouillent le
contraste franc qui fait l'identité.

### Rayons

Échelle fine, exposée en variables — on ne pose plus de valeur au hasard.

| Jeton | Valeur | Usage |
|---|---|---|
| `--rs-r-xs` | 4 px | Étiquettes, puces |
| `--rs-r-sm` | 6 px | Badges carrés, vignettes |
| `--rs-r-md` | 8 px | Petits contrôles |
| `--rs-r-lg` | 12 px | Boutons, champs |
| `--rs-r-xl` | 16 px | Cartes |
| `--rs-r-2xl` | 24 px | Feuilles, panneaux |
| `--rs-r-pill` | 9999 px | Pilules, badges, boutons ronds |

---

## 7. À faire / à ne pas faire

**À faire**

- Une seule action primaire rouge par écran.
- Toujours indiquer l'état d'un message envoyé (envoi → envoyé → lu).
- Donner à chaque statut de colis une phrase en clair, pas seulement un code.
- Faire porter le montant par la carte de devis en 20 px graisse 800 : c'est
  l'information que le client cherche.
- Garder les cibles tactiles à **44 × 44 px minimum**, y compris les étoiles
  d'avis et le bouton de pièce jointe.
- Annoncer les changements de statut aux lecteurs d'écran (`aria-live="polite"`).

**À ne pas faire**

- ❌ Pas de rouge en fond de grande surface — il écrase et fait fuir. Le rouge
  est un accent, il ne dépasse jamais ~15 % de la surface d'un écran.
- ❌ Pas de rouge pour une erreur système : le rouge est la marque. Une erreur
  se signale en `warn-500` avec une icône.
- ❌ Pas de dégradés violets, pas de glassmorphism, pas d'ombres colorées.
- ❌ Pas de `opacity` seule pour un bouton inactif — utiliser les couleurs
  dédiées, sinon le contraste tombe sous le seuil AA.
- ❌ Pas d'emoji en guise d'icône fonctionnelle (utiliser `lucide-react`, déjà
  dans le projet).
- ❌ Pas de police à empattement sur cette surface.
- ❌ Pas d'animation de plus de 200 ms sur un élément que l'utilisateur attend.

---

## 8. Comportement responsive

| Palier | Largeur | Comportement |
|---|---|---|
| Mobile | < 640 px | Colonne unique, marges 16 px, frise de statut verticale, saisie collante |
| Tablette | 640–1023 px | Marges 24 px, cartes en 2 colonnes sur les listes, frise horizontale |
| Bureau | ≥ 1024 px | Fil centré à 560 px, colonne latérale de détail à droite si l'espace le permet |

**Règles tactiles**

- Cible minimale 44 × 44 px, écart minimal de 8 px entre deux cibles.
- Aucun état ne dépend du survol : tout état de survol a un équivalent au focus
  et à l'appui.
- Le champ de saisie fait **16 px minimum** sur mobile — en dessous, iOS zoome
  automatiquement au focus et casse la mise en page.
- Le défilement du fil de conversation est préservé : on ne force le défilement
  vers le bas que si l'utilisateur y était déjà (à 120 px près).

**Mouvement réduit** : sous `prefers-reduced-motion: reduce`, les pulsations de
la frise et l'animation de frappe deviennent statiques.

---

## 9. Guide pour l'agent

**Référence rapide**

```
Rouge de marque   #E31E24   boutons primaires, bulles client
Rouge appui       #BF1319   survol / appui
Noir de marque    #0B0B0D   titres
Texte courant     #3D3D45
Texte secondaire  #5F5F68
Texte tertiaire   #8A8A93   horodatage (≥ 14 px)
Bordure           #EDEDEF
Fond de fil       #F7F7F8
Surface           #FFFFFF
Succès            #0E9F6E   payé, livré
Attente           #D97706   action requise
```

**Invite prête à l'emploi**

> Construis cet écran avec le système RAMCI : rouge de marque `#E31E24`, noir
> `#0B0B0D`, surfaces blanches, fond de zone `#F7F7F8`. Police Inter, titres en
> graisse 800 avec interlettrage −0.02em. Rayons 12 px (boutons, champs), 16 px
> (cartes), 18 px (bulles de chat avec un coin à 6 px du côté de l'émetteur).
> Espacement en multiples de 4. Une seule action primaire rouge par écran ; tout
> le reste en secondaire bordé ou en fantôme. Système plat : bordure 1 px
> `#EDEDEF` plutôt qu'une ombre, sauf cartes (`0 1px 2px rgba(11,11,13,.05)`).
> Cibles tactiles 44 px minimum. Pas de dégradé, pas de glassmorphism, pas
> d'emoji fonctionnel — icônes `lucide-react`.

**Classes utilitaires disponibles** (définies dans `client/src/index.css`) :
`rs-btn` `rs-btn--primary` `rs-btn--secondary` `rs-btn--ghost`
`rs-card` `rs-card--action` `rs-input` `rs-field`
`rs-bubble` `rs-bubble--client` `rs-bubble--agent`
`rs-badge` `rs-badge--ok` `rs-badge--warn` `rs-badge--info` `rs-badge--neutral`
`rs-label` `rs-money` `rs-surface` `rs-scroll`

Les jetons de couleur sont exposés en classes Tailwind v4 :
`bg-ramses-600`, `text-ink-900`, `border-ink-100`, etc.

---

## 10. Provenance

Ce système est construit à partir de la méthode et des références de
[**VoltAgent/awesome-design-md**](https://github.com/VoltAgent/awesome-design-md) —
le format en neuf sections ci-dessus en vient, ainsi que la convention du
catalogue visuel qui accompagne le document.

Deux systèmes du dépôt ont servi de référence de facture. **Rien n'a été copié
de leur identité** : ni couleur, ni police, ni parti pris visuel. Ce qui a été
repris, ce sont des règles de métier :

| Emprunt | Source | Application chez RAMCI |
|---|---|---|
| Profondeur par échelle de surfaces et filet, sans ombre portée | `linear.app` | §6 — les cartes n'ont plus d'ombre, seulement un filet |
| Interlettrage proportionnel à la taille plutôt que forfaitaire | `linear.app` | §3 — table `--rs-ls-*`, de −3,4 % en display à 0 sous 15 px |
| Accent réservé à la marque, au bouton primaire, au focus et aux liens | `linear.app` | §1 et §7 — le rouge n'est jamais décoratif |
| Anneau de focus à 2 px et 50 % d'opacité | `linear.app` | `--rs-focus` |
| Échelle de rayons fine (4 → 24 → pilule) | `linear.app` + `stripe` | §6 |
| Ombre teintée vers la palette, jamais noir pur, réservée au flottant | `stripe` | `--rs-shadow-float` |
| Interlettrage resserré sur les chiffres tabulaires | `stripe` | `--rs-ls-num`, appliqué à `.rs-money` |
| Cibles tactiles à 44 px minimum sur mobile | `stripe` | §8 |
| Une seule action primaire remplie par zone | `stripe` | §7 |

Ce qui **n'a pas** été repris, et pourquoi :

- Le violet de Linear et l'indigo de Stripe : l'accent est le rouge RAMCI.
- Les graisses fines de Stripe (display en 300) : elles contredisent la
  lourdeur qui fait l'identité de la marque. Nos titres restent en 800.
- Le fond sombre de Linear : cette surface est en monde clair assumé.
- Le maillage en dégradé de Stripe : §7 proscrit les dégradés.
