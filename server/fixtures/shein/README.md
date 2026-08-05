# Jeu de cas — extraction des paniers SHEIN

Ce dossier contient la **vérité terrain** utilisée par `scripts/evalSheinExtraction.js`
pour mesurer la qualité de l'extraction. Chaque `.json` décrit un cas : les
captures à charger et le résultat exact attendu.

C'est ce qui remplace « l'entraînement du modèle » : on ne modifie pas le
modèle, on mesure chaque changement de prompt, de modèle ou d'effort contre ce
jeu de cas. Sans mesure, toute retouche du prompt est un pari.

---

## ⚠️ Les images ne sont pas dans le dépôt — à ajouter une fois

Les fichiers `.json` référencent des images qui doivent être placées **ici même**.
Voici comment identifier chacune parmi les 4 captures d'origine :

| Fichier à créer | Capture à y placer — repère visuel |
|---|---|
| `panier-non-coche.png` | Total en bas à **`$0.00`**, bouton noir « Checkout », aucune bannière de coupon, cases à gauche **vides**. Boutiques visibles : WOSEN, WERTSDF, YSD, SHGuan. |
| `panier-non-coche-bis.png` | **Le duplicata exact** de la précédente (les deux captures identiques). Sert à vérifier que la déduplication tient. Si vous n'avez qu'un exemplaire, copiez simplement le fichier. |
| `panier-coupon-haut.png` | Bannière « 30% OFF coupon applied », haut du panier (WOSEN en premier), total **`$12.72`**, bouton « Checkout with Coupon(4) ». |
| `panier-coupon-bas.png` | Bannière « 30% OFF coupon applied », bas du panier, boutiques Kingsley et JUTIANKUO, bloc « You Might Like to Fill it With », total **`$24.60`**, bouton « Checkout with Coupon(7) ». |

Formats acceptés : `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`.
Si un fichier manque, le cas est **ignoré** avec un message explicite — le banc
tourne quand même sur les autres.

> Ces captures contiennent le panier d'un vrai client. Ne les commitez pas dans
> un dépôt public : `.gitignore` de ce dossier les exclut déjà.

---

## Lancer l'évaluation

```bash
node server/scripts/evalSheinExtraction.js
```

Un seul cas :

```bash
node server/scripts/evalSheinExtraction.js --cas=panier-coupon-haut
```

Comparer deux réglages (le point de tout ce dossier) :

```bash
SHEIN_VISION_EFFORT=medium node server/scripts/evalSheinExtraction.js
```

```bash
SHEIN_VISION_MODEL=claude-sonnet-5 node server/scripts/evalSheinExtraction.js
```

Le script sort en code 1 dès qu'un cas n'est pas parfait — utilisable en CI.

---

## Ajouter un cas

Le meilleur usage de ce dossier : **chaque fois qu'un client envoie un panier
mal lu**, ajoutez-le ici avec le résultat correct. Le jeu de cas grandit avec
les vrais échecs, et une retouche du prompt qui corrige ce cas sans casser les
autres devient vérifiable en une commande.

```json
{
  "nom": "Nom lisible du cas",
  "note": "Ce que ce cas vérifie en particulier (optionnel)",
  "captures": ["mon-panier.png"],
  "attendu": {
    "devise": "USD",
    "coupon_applique": false,
    "total_affiche": 12.34,
    "nb_articles_panier": 3,
    "articles": [
      {
        "boutique": "NOM BOUTIQUE",
        "nom": "Nom exact affiché, troncature « ... » comprise",
        "variante": "Couleur / Taille",
        "prix_unitaire": 4.56,
        "prix_original": 7.89,
        "quantite": 1
      }
    ]
  }
}
```

Règles de rédaction :

- **`nom`** est comparé sur un préfixe normalisé — la troncature exacte n'a pas
  à correspondre au caractère près.
- **`variante`** à `null` désactive la vérification de ce champ (utile quand la
  variante est elle-même tronquée à l'écran).
- **`prix_original`** à `null` signifie « aucun prix barré affiché ».
- N'inscrivez que les articles dont le nom **et** le prix sont lisibles : c'est
  la règle que suit l'extraction, un article coupé en bord d'écran ne doit pas
  être attendu.
