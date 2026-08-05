# Tests de charge — Phase 3 (audit de performance RAMCI)

Objectif de cette phase : **arrêter de deviner**. Les Phases 0 à 2 ont corrigé
des points identifiés par lecture de code (N+1, cache, images, bundle). Sans
mesure avant/après sur les mêmes scénarios, personne ne peut dire ce qu'elles
ont réellement rapporté.

Trois scénarios, correspondant aux parcours critiques listés dans l'audit :

| Fichier | Parcours | Écrit en base ? |
|---|---|---|
| `catalogue.js` | Accueil → listing → fiche produit | Non |
| `panier.js` | Fiche produit → mise à jour panier → préparation checkout | Oui (panier du compte de test) |
| `commande.js` | Passage de commande COD | **Oui — crée de vraies commandes** |

---

## 1. Installer k6

k6 est un binaire autonome, il n'y a **rien à ajouter au `package.json`**.

```bash
winget install k6 --source winget
```

Vérification :

```bash
k6 version
```

---

## 2. Préparer le serveur cible

Deux variables d'environnement côté serveur rendent les mesures exploitables.
Ajoutez-les dans le `.env` du serveur (ou dans les variables du projet Vercel
de **préproduction**) :

```
METRICS_TOKEN=<chaîne aléatoire longue>
LOADTEST_TOKEN=<chaîne aléatoire longue, différente>
```

- `METRICS_TOKEN` autorise la lecture de `GET /api/metrics` (P50/P95/P99 par
  route) et la remise à zéro entre deux runs.
- `LOADTEST_TOKEN` fait sauter les limiteurs de débit applicatifs pour les
  requêtes portant l'en-tête `x-loadtest-token`. Sans lui, un test à 100
  utilisateurs simultanés depuis une seule machine se ferait limiter dès la
  première seconde et ne mesurerait plus que le rate limiter.

> ⚠️ **Ne définissez jamais `LOADTEST_TOKEN` sur le projet de production.**
> La variable n'a de sens que sur un environnement dédié aux tests. Les
> limiteurs d'authentification (login, activation, mot de passe oublié) ne
> sont volontairement **pas** concernés par cette dérogation, quelle que soit
> la configuration.

Pour générer une valeur :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Lancer un test

Toujours commencer par le profil `smoke` (5 utilisateurs, 20 s) : il valide que
le scénario fonctionne avant de lancer une vraie charge.

### Catalogue (sans risque, à faire en premier)

```bash
k6 run -e BASE_URL=http://localhost:4000 -e PROFILE=smoke loadtest/catalogue.js
```

Puis la charge nominale (100 utilisateurs simultanés) :

```bash
k6 run -e BASE_URL=http://localhost:4000 -e PROFILE=load -e LOADTEST_TOKEN=xxx -e METRICS_TOKEN=yyy loadtest/catalogue.js
```

Et la recherche du point de rupture (500 utilisateurs) :

```bash
k6 run -e BASE_URL=http://localhost:4000 -e PROFILE=stress -e LOADTEST_TOKEN=xxx -e METRICS_TOKEN=yyy loadtest/catalogue.js
```

### Panier (écrit — jamais sur la production)

Nécessite un **compte de test dédié**, jamais un compte client réel :

```bash
k6 run -e BASE_URL=http://localhost:4000 -e PROFILE=load -e TEST_EMAIL=test@example.com -e TEST_PASSWORD=motdepasse -e LOADTEST_TOKEN=xxx -e METRICS_TOKEN=yyy loadtest/panier.js
```

### Commande (crée de vraies commandes)

Le compte de test doit avoir **au moins une adresse enregistrée**. Le scénario
refuse de démarrer sans `CONFIRM_WRITES=oui` :

```bash
k6 run -e BASE_URL=http://localhost:4000 -e PROFILE=smoke -e CONFIRM_WRITES=oui -e TEST_EMAIL=test@example.com -e TEST_PASSWORD=motdepasse -e LOADTEST_TOKEN=xxx -e METRICS_TOKEN=yyy loadtest/commande.js
```

---

## 4. Variables disponibles

| Variable | Défaut | Rôle |
|---|---|---|
| `BASE_URL` | `http://localhost:4000` | Serveur visé |
| `PROFILE` | `smoke` | `smoke` (5 VU) · `load` (100 VU) · `stress` (500 VU) |
| `LOADTEST_TOKEN` | — | Dérogation aux limiteurs de débit |
| `METRICS_TOKEN` | — | Relevé serveur P50/P95/P99 en fin de run |
| `TEST_EMAIL` / `TEST_PASSWORD` | — | Compte de test (panier, commande) |
| `TEST_ADDRESS_ID` | 1ʳᵉ adresse du compte | Adresse de livraison (commande) |
| `TEST_DELIVERY_TYPE` | 1ᵉʳ type actif | Nom du type de livraison (commande) |
| `CONFIRM_WRITES` | — | Doit valoir `oui` pour `commande.js` |

---

## 5. Lire les résultats

k6 affiche en fin de run :

```
http_req_duration..............: avg=142ms min=31ms med=118ms max=2.1s p(90)=245ms p(95)=380ms
http_req_failed................: 0.12% ✓ 4    ✗ 3316
parcours_fiche_produit_ms......: avg=88ms  ... p(95)=210ms
```

Les chiffres qui comptent :

- **`http_req_failed`** — au-dessus de 1 %, le seuil casse et le run sort en
  code 1. Sous charge, c'est souvent le premier signal d'une saturation du
  pool de connexions MongoDB.
- **`p(95)` de `http_req_duration`** — la latence vue par le 20ᵉ utilisateur le
  plus malchanceux sur 20. C'est la métrique à comparer avant/après, bien plus
  parlante que la moyenne.
- **Les `Trend` par parcours** (`parcours_accueil_ms`, `panier_maj_ms`,
  `commande_creation_ms`) — isolent chaque étape du tunnel.

Si `METRICS_TOKEN` est fourni, le run se termine par une **vue serveur** triée
par P95 décroissant : les routes les plus lentes d'abord. Cette vue exclut la
latence réseau depuis votre machine, donc l'écart entre les deux mesures vous
dit combien coûte le trajet réseau.

> Sur un déploiement Vercel, `/api/metrics` ne reflète que **l'instance
> serverless qui a répondu**, pas l'ensemble du trafic — chaque invocation a sa
> propre mémoire. La réponse le rappelle dans son champ `scope`. Pour une vue
> complète en production, utilisez les logs structurés (section 7).

---

## 6. Méthode avant/après

C'est le point que l'audit insistait à ne pas rater : mesurer sur les **mêmes**
scénarios, avec le **même** profil, sur le **même** environnement.

1. Se placer sur le commit d'avant l'optimisation, lancer les 3 scénarios en
   `PROFILE=load`, sauvegarder les résultats :

   ```bash
   k6 run --summary-export=avant-catalogue.json -e PROFILE=load loadtest/catalogue.js
   ```

2. Appliquer l'optimisation.

3. Relancer à l'identique avec `--summary-export=apres-catalogue.json`.

4. Comparer les `p(95)`, pas les moyennes.

Ne changez qu'une chose à la fois entre deux mesures. Un run où l'on a modifié
le code **et** la région du cluster ne dit rien sur l'origine du gain.

---

## 7. Ce qui est mesuré en continu (hors tests de charge)

En plus des tests ponctuels, trois choses tournent en permanence :

- **Logs structurés serveur** — une ligne JSON par requête
  (`{"type":"http","route":"/api/product/list","status":200,"ms":42}`), émise
  par `server/middlewares/requestMetrics.js`. Sur Vercel, ces lignes sont
  filtrables dans les logs de la fonction. Les requêtes dépassant
  `SLOW_REQUEST_MS` (1000 ms par défaut) sortent en `warn`. Les erreurs 500
  sortent en `{"type":"error",...}` avec la stack.
  Désactivable avec `METRICS_LOG=off`.

- **`GET /api/metrics`** — instantané P50/P95/P99 par route, protégé par
  `METRICS_TOKEN` ou une session vendeur valide.

- **Vercel Speed Insights + Analytics** (côté client, `client/src/main.jsx`) —
  Core Web Vitals réels (LCP, CLS, INP, TTFB) par page, sur le vrai trafic.
  C'est la seule mesure qui reflète ce que vit un utilisateur sur un téléphone
  en 3G, et donc la seule qui valide vraiment la Phase 1 (code splitting,
  images Cloudinary, lazy loading). **À activer dans le dashboard Vercel** :
  projet → onglet Analytics, puis onglet Speed Insights.

---

## 8. Nettoyage après un run de `commande.js`

Le scénario crée de vraies commandes sur le compte de test. Pour les
supprimer, dans `mongosh` sur la base de **préproduction** :

```javascript
// 1. Retrouver l'id du compte de test
const u = db.users.findOne({ email: "test@example.com" }, { _id: 1 });

// 2. Vérifier ce qui va être supprimé AVANT de supprimer
db.orders.find({ userId: u._id.toString() }).count();

// 3. Supprimer
db.orders.deleteMany({ userId: u._id.toString() });
```

Le stock décrémenté pendant le test n'est **pas** restauré automatiquement :
sur un environnement de préproduction, le plus simple est de remettre les
stocks à une valeur haute depuis l'espace vendeur après un gros run.
