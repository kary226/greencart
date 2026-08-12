# Rapport de sécurité — RAMCI

**Date** : 12 août 2026
**Périmètre** : dépôt `greencart` — API Express/MongoDB (`server/`) et front React/Vite (`client/`)
**Méthode** : revue de code exhaustive (SAST manuel), analyse de dépendances, tests de non-régression sur les correctifs. Aucun test actif contre l'infrastructure de production.
**Commit de référence** : `87bf8d97`

---

## Synthèse

**10 constats.** 6 corrigés, 4 laissés en recommandation (voir la justification de chacun).

| Gravité | Constat | État |
|---|---|---|
| 🔴 **Critique** | Conversations clients accessibles sans authentification | ✅ Corrigé |
| 🟠 Haute | Dépendances vulnérables (nodemailer, undici) | ✅ Corrigé |
| 🟡 Moyenne | SSRF via l'import de produit par URL | ✅ Corrigé |
| 🟡 Moyenne | Aucun en-tête de sécurité côté front | ✅ Corrigé |
| 🟡 Moyenne | Upload traité avant l'authentification | ✅ Corrigé |
| 🔵 Basse | Aucun contrôle des secrets au démarrage | ✅ Corrigé |
| 🔵 Basse | Jeton de réinitialisation stocké en clair | ⚠️ Recommandé |
| 🔵 Basse | `node_modules` versionné (11 555 fichiers) | ⚠️ Recommandé |
| 🔵 Basse | Payload de paiement intégralement journalisé | ⚠️ Recommandé |
| 🔵 Basse | Secret JWT unique pour trois types de session | ⚠️ Recommandé |

Le niveau général est **bon**. Le code porte les traces d'une passe sécurité antérieure (marqueurs `[FIX C2]`, `[FIX M3]`, migration vers des cookies `httpOnly`), et l'essentiel des fondamentaux est en place. Le constat critique est une **route oubliée**, pas une faiblesse de conception.

---

## 🔴 CRITIQUE — Conversations clients accessibles sans authentification

**Fichier** : `server/routes/messageColisRoute.js` (lignes 18-20 avant correctif)

### Le problème

Trois routes étaient montées **sans aucun middleware d'authentification** :

```js
router.get('/:id/messages', getMessages);        // aucune auth
router.post('/:id/messages', sendMessageClient); // aucune auth
router.post('/:id/typing', setClientTyping);     // aucune auth
```

Or leurs contrôleurs identifient le propriétaire du colis ainsi :

```js
// server/controllers/messageColisController.js:23
const colis = await verifierProprietaire(req.params.id, req.body.userId);
```

`req.body.userId` est normalement **posé par `authUser`** depuis le JWT vérifié :

```js
// server/middlewares/authUser.js:25
req.body.userId = tokenDecode.id;
```

Sans ce middleware, la valeur venait directement du corps de la requête, donc **entièrement contrôlée par l'appelant**.

### Impact

Avec un `colisId` et l'identifiant d'un client, un attaquant non authentifié pouvait :

- **lire l'intégralité d'une conversation privée** — messages, images, devis, montants ;
- **écrire dans cette conversation en se faisant passer pour le client** (`expediteurRole: "client"`, `expediteurId: <victime>`).

Il s'agit d'une rupture de contrôle d'accès (OWASP A01:2021), avec exposition de données personnelles.

### Preuve

```
POST /api/message-colis/<colisId>/messages
Content-Type: application/json

{"userId": "<identifiant de la victime>", "texte": "message usurpé"}
```

Aucun cookie, aucun en-tête `Authorization` requis.

Vérification complémentaire effectuée sur Mongoose 8.24 : sans corps de requête, `userId` reste `undefined` dans le filtre et le driver le sérialise en `null`, si bien que la requête ne renvoie rien. **L'exploitation nécessitait donc de connaître l'identifiant de la victime** — ce qui limite l'exploitation opportuniste, mais ne constitue en rien un contrôle d'accès.

### Correctif appliqué

Les trois routes ont été **supprimées**. Elles faisaient doublon : les mêmes contrôleurs sont déjà exposés, correctement protégés, dans `sheinCartRoute.js` :

```js
sheinCartRouter.get("/:id/messages", authUser, getMessages);
sheinCartRouter.post("/:id/messages", authUser, uploadChatImage.single("image"), sendMessageClient);
sheinCartRouter.post("/:id/typing", authUser, setClientTyping);
```

Et c'est bien `/api/shein-cart/...` que le front appelle (`ColisSheinConversation.jsx:105`). Les routes staff du même fichier (`/:colisId`, protégées par `authStaff` + `requireRole`) sont conservées telles quelles — ce sont celles qu'utilise `ChatDetail.jsx`.

**Aucune perte de fonctionnalité.**

---

## 🟠 HAUTE — Dépendances vulnérables

**Fichier** : `server/package.json`

| Paquet | Version | Faille |
|---|---|---|
| `nodemailer` | 8.0.11 | [GHSA-p6gq-j5cr-w38f](https://github.com/advisories/GHSA-p6gq-j5cr-w38f) — l'option `raw` contourne `disableFileAccess`/`disableUrlAccess` : lecture de fichier arbitraire et SSRF |
| `undici` | 7.28.0 | 5 avis : désynchronisation de réponse, divulgation d'informations inter-utilisateurs, injection CRLF, injection d'attributs de cookie |

`undici` arrive de façon transitive via `cheerio`, utilisé par le scraper.

**Nuance importante** : la faille `nodemailer` **n'est pas atteignable** dans ce code. `configs/email.js` n'utilise que `createTransport` et `sendMail({from, to, subject, html})`, jamais l'option `raw`. La mise à jour reste la bonne décision, mais il n'y avait pas d'exposition réelle.

### Correctif appliqué

```
nodemailer  8.0.11 → 9.0.5
undici      7.28.0 → 7.29.0
npm audit : found 0 vulnerabilities
```

Compatibilité vérifiée avant de valider : `verify(callback)` existe toujours en v9 (`node_modules/nodemailer/lib/smtp-transport/index.js:304`), donc `configs/email.js:32` fonctionne inchangé. Ce point méritait vérification — une régression ici aurait cassé les réinitialisations de mot de passe et les activations de comptes staff.

---

## 🟡 MOYENNE — SSRF via l'import de produit par URL

**Fichiers** : `server/services/scraper.js`, `server/controllers/productController.js`

### Le problème

`scrapeImport` accepte une URL et va la chercher côté serveur. La validation ne portait que sur le protocole :

```js
if (!["http:", "https:"].includes(parsedUrl.protocol)) { ... }
```

Aucun contrôle de l'hôte. De plus, axios suit les redirections par défaut : une URL publique anodine pouvait rediriger vers une adresse interne.

### Impact

Requêtes sortantes vers l'intérieur de l'infrastructure : `http://127.0.0.1:6379` (Redis), plages privées `10.x`/`192.168.x`, et surtout `169.254.169.254` — l'endpoint de métadonnées des fournisseurs cloud, qui distribue des jetons d'identité.

**Facteur atténuant** : la route est protégée par `authSeller`, donc réservée au compte technique administrateur. L'exploitation suppose un compte admin compromis, ou un administrateur amené à coller un lien piégé.

### Correctif appliqué

Nouveau garde `server/utils/urlGuard.js`, branché sur la page **et** sur le téléchargement des images (ces URL viennent de la page scrapée, donc d'un tiers, et sont tout aussi hostiles) :

- résolution DNS de l'hôte et vérification de **toutes** les adresses retournées — un domaine public peut parfaitement pointer vers `127.0.0.1` ;
- blocage des plages loopback, privées, link-local, CGNAT, multicast, en IPv4 comme en IPv6, y compris la forme encapsulée `::ffff:127.0.0.1` ;
- redirections limitées à 3 et revalidées une par une via `beforeRedirect`.

**28 tests unitaires passent**, dont le contournement par DNS (`localtest.me` → `127.0.0.1`, bloqué) et la non-régression sur des URL légitimes (`example.com`, `jumia.ci`, autorisées).

---

## 🟡 MOYENNE — Aucun en-tête de sécurité côté front

**Fichier** : `client/vercel.json`

`helmet` est bien monté sur l'API, mais il n'y protège que des réponses JSON. Le front, servi séparément par Vercel, ne renvoyait **aucun** en-tête de sécurité : ni `X-Frame-Options` (clickjacking), ni `X-Content-Type-Options`, ni HSTS, ni CSP.

### Correctif appliqué

Six en-têtes ajoutés sur `/(.*)` : `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`, et une CSP.

**La CSP est délibérément posée en `Content-Security-Policy-Report-Only`.** Une politique stricte écrite à l'aveugle casse une application — ici Google OAuth, Cloudinary, Tawk.to, Google Fonts et Vercel Analytics sont tous concernés. En mode rapport, elle ne bloque rien et signale les violations dans la console du navigateur.

**Action requise de ta part** : après quelques jours de navigation normale, relever les violations en console, ajuster la politique, puis renommer l'en-tête en `Content-Security-Policy` pour qu'elle prenne effet.

---

## 🟡 MOYENNE — Upload traité avant l'authentification

**Fichier** : `server/routes/sheinCartRoute.js` (lignes 58 et 64 avant correctif)

```js
sheinCartRouter.post("/:id/messages", uploadChatImage.single("image"), authUser, sendMessageClient);
//                                    ^^^^ Multer s'exécute AVANT authUser
```

Multer lit et met le fichier **intégralement en mémoire** avant que `authUser` ne rejette la requête : un anonyme pouvait faire consommer 8 Mo de RAM par requête, sans compte.

**Correctif appliqué** : ordre inversé sur les deux routes concernées. L'authentification passe désormais en premier.

---

## 🔵 BASSE — Aucun contrôle des secrets au démarrage

**Fichier** : `server/server.js`

Aucune vérification de `JWT_SECRET` au démarrage. Son absence ne se manifestait qu'au premier appel authentifié, sous forme d'une erreur 500 opaque.

**Correctif appliqué** : le serveur refuse de démarrer si `JWT_SECRET` ou `MONGODB_URI` manque (`process.exit(1)`), et avertit si `JWT_SECRET` fait moins de 32 caractères — un secret court est brute-forçable hors ligne à partir d'un seul jeton capté.

---

## ⚠️ Recommandations non appliquées

Ces quatre points ne sont **pas** corrigés, volontairement.

### Jeton de réinitialisation stocké en clair — `userController.js:385`

`crypto.randomBytes(32)` est un bon générateur, l'expiration à 1 h est correcte, mais le jeton est stocké tel quel en base. Une fuite de la base rendrait les jetons non expirés directement utilisables.

**Correctif recommandé** : stocker `sha256(token)` et comparer le haché. Non appliqué parce que cela invalide les jetons en circulation — à déployer à un moment choisi.

### `node_modules` versionné — 11 555 fichiers dans git

Ce n'est pas une faille, mais une faiblesse de chaîne d'approvisionnement : une dépendance modifiée localement part en production sans que rien ne le signale, et les mises à jour de sécurité produisent des diffs illisibles où une modification malveillante passerait inaperçue.

**Correctif recommandé** : ajouter `node_modules/` au `.gitignore` et `git rm -r --cached`. Non appliqué car cela touche l'ensemble de l'historique de travail et mérite d'être fait sur une branche dédiée, à un moment calme.

### Payload de paiement intégralement journalisé — `jekoController.js:602`

```js
console.log(JSON.stringify(payload));
```

Le commentaire indique que c'est temporaire, le temps du premier vrai paiement. À retirer une fois l'intégration stabilisée : ces logs contiennent des données de transaction et de clients.

### Secret JWT unique pour trois types de session

`token` (client), `sellerToken` (admin technique) et `staffToken` sont signés avec le même `JWT_SECRET`, sans claim distinguant le type de jeton.

**Non exploitable en l'état** : `authStaff` recherche l'identifiant dans la collection `StaffUser`, si bien qu'un jeton client présenté comme jeton staff échoue. Mais la séparation ne tient qu'à cette recherche, pas au jeton lui-même.

**Correctif recommandé** : ajouter un claim `typ: 'user' | 'seller' | 'staff'` à la signature et le vérifier dans chaque middleware. Défense en profondeur, sans urgence.

---

## Ce qui est déjà bien fait

Il serait malhonnête de ne lister que les problèmes. Les points suivants ont été vérifiés et sont **solides** :

- **Webhook de paiement Jèko** — HMAC-SHA256, comparaison en temps constant (`crypto.timingSafeEqual`), rejet par défaut si le secret manque (*fail-closed*), anti-rejeu par fenêtre de 5 minutes sur `executedAt`. C'est un webhook correctement implémenté.
- **Intégrité des montants** — le prix et le total sont **recalculés côté serveur** depuis la base, aussi bien pour `placeOrderCOD` que pour `initiateJeko`. Aucune confiance accordée à un montant envoyé par le client.
- **Cookies d'authentification** — `httpOnly`, `secure`, `sameSite: 'lax'` sur les trois types de session. `sameSite: lax` bloque l'essentiel des attaques CSRF sur les requêtes mutantes.
- **XSS** — les deux seuls `dangerouslySetInnerHTML` du projet passent par `DOMPurify.sanitize()`.
- **Injection NoSQL** — `express-mongo-sanitize` monté globalement, sur une version d'Express (4.21) où il fonctionne réellement.
- **Contrôles d'accès horizontaux** — les routes commande et colis filtrent bien par `userId` (`Order.findOne({_id, userId})`), pas d'IDOR trouvé en dehors du constat critique.
- **Force brute** — limiteurs de débit sur toutes les routes d'authentification, plus des limiteurs dédiés au paiement, aux commandes et aux coupons.
- **2FA TOTP** sur le compte vendeur, avec comparaison en temps constant sur les secrets.
- **Secrets** — aucun fichier `.env` n'a **jamais** été commité sur l'ensemble de l'historique. Seul `.env.example` est versionné.
- **CORS** — liste blanche explicite d'origines, pas de réflexion automatique.

---

## Fichiers modifiés

```
server/routes/messageColisRoute.js   suppression des 3 routes non authentifiées
server/routes/sheinCartRoute.js      ordre des middlewares corrigé (2 routes)
server/services/scraper.js           garde anti-SSRF branché
server/utils/urlGuard.js             NOUVEAU — validation des URL sortantes
server/server.js                     garde-fou sur les secrets au démarrage
server/package.json                  nodemailer 9.0.5, undici 7.29.0
client/vercel.json                   6 en-têtes de sécurité
```

## Vérifications effectuées

```
node --check          5 fichiers serveur — OK
JSON vercel.json      valide, 6 en-têtes
npm audit             found 0 vulnerabilities
Tests anti-SSRF       28/28
Garde-fou démarrage   refuse de démarrer sans secret (code de sortie 1)
Compatibilité v9      verify(callback) confirmé présent
```

## À faire de ton côté

1. **Redéployer** — le correctif critique ne prend effet qu'une fois en production.
2. **Affiner la CSP** puis passer `Content-Security-Policy-Report-Only` en `Content-Security-Policy`.
3. **Vérifier `JWT_SECRET`** — au moins 32 caractères (`openssl rand -hex 32`).
4. **Retirer le log du payload Jèko** une fois l'intégration confirmée.
5. Envisager les trois autres recommandations à un moment choisi.
