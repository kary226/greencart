# Rapport de sécurité — RAMCI

**Date** : 12 août 2026
**Périmètre** : dépôt `greencart` — API Express/MongoDB (`server/`) et front React/Vite (`client/`)
**Méthode** : revue de code exhaustive (SAST manuel), analyse de dépendances, tests de non-régression sur les correctifs. Aucun test actif contre l'infrastructure de production.
**Commit de référence** : `87bf8d97`

---

## Synthèse

**11 constats, tous corrigés.**

| Gravité | Constat | État |
|---|---|---|
| 🔴 **Critique** | Conversations clients accessibles sans authentification | ✅ Corrigé |
| 🟠 Haute | Dépendances vulnérables (nodemailer, undici) | ✅ Corrigé |
| 🟡 Moyenne | SSRF via l'import de produit par URL | ✅ Corrigé |
| 🟡 Moyenne | Aucun en-tête de sécurité côté front | ✅ Corrigé |
| 🟡 Moyenne | Upload traité avant l'authentification | ✅ Corrigé |
| 🔵 Basse | Aucun contrôle des secrets au démarrage | ✅ Corrigé |
| 🔵 Basse | Jeton de réinitialisation stocké en clair | ✅ Corrigé |
| 🔵 Basse | **Jeton d'invitation staff stocké en clair** | ✅ Corrigé |
| 🔵 Basse | `node_modules` versionné (11 555 fichiers) | ✅ Corrigé |
| 🔵 Basse | Payload de paiement intégralement journalisé | ✅ Corrigé |
| 🔵 Basse | Secret JWT unique pour trois types de session | ✅ Corrigé |
| 🔵 Basse | **`authSeller` : refus en HTTP 200 + message JWT brut** | ✅ Corrigé |

Le onzième constat (jetons d'invitation staff) a été découvert **en corrigeant** le jeton de réinitialisation : `Invitation.findOne({ token })` souffrait exactement de la même faiblesse, avec un enjeu supérieur — un lien d'invitation vaut la création d'un compte staff, potentiellement administrateur.

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

## 🔵 BASSE — Jetons de réinitialisation et d'invitation stockés en clair

**Fichiers** : `server/controllers/userController.js`, `server/controllers/staffController.js`

Les deux jetons étaient générés correctement (`crypto.randomBytes(32)`, expiration à 1 h et 48 h) mais **stockés tels quels** en base. Une fuite de la base rendait les jetons non expirés directement utilisables :

- jeton de réinitialisation → prise de contrôle d'un compte client ;
- jeton d'invitation → **création d'un compte staff**, avec le rôle porté par l'invitation, potentiellement `admin`.

Le second n'était pas dans le rapport initial : il a été découvert en corrigeant le premier, `Invitation.findOne({ token })` présentant exactement le même motif.

### Correctif appliqué

Seule l'empreinte `sha256(jeton)` est désormais stockée. Le jeton en clair ne vit que dans l'e-mail envoyé.

SHA-256 nu, sans sel ni itérations — contrairement à un mot de passe. Ces jetons portent 256 bits d'aléa cryptographique et vivent quelques heures : ils ne sont pas devinables par force brute, un hachage lent n'apporterait rien et ralentirait chaque vérification.

**Effet de bord** : les liens de réinitialisation et d'invitation **déjà envoyés cessent de fonctionner**. Ils expiraient de toute façon sous 1 h et 48 h ; il suffit d'en redemander un.

---

## 🔵 BASSE — Secret JWT unique pour trois types de session

**Fichiers** : `server/utils/jwtTypes.js` (nouveau), les trois middlewares, `metricsRoute.js`

`token` (client), `sellerToken` (vendeur technique) et `staffToken` étaient signés avec le même `JWT_SECRET`, sans rien qui distingue leur espace d'origine.

Ce n'était **pas exploitable en l'état** : `authStaff` recherche l'identifiant dans la collection `StaffUser`, si bien qu'un jeton client présenté comme jeton staff échouait. Mais la séparation tenait à cette recherche, pas au jeton — une protection de fait, pas de conception.

### Correctif appliqué

Un claim `typ` (`user` / `seller` / `staff`) est ajouté à la signature aux six points d'émission, et vérifié dans les trois middlewares plus la route de métriques.

**Vérification stricte d'emblée** : tout jeton dépourvu de `typ` est refusé.

Ce point méritait une décision. Un jeton sans claim ne peut être qu'un jeton émis *avant* ce changement ; les refuser déconnecte donc toutes les sessions ouvertes au moment du déploiement. La règle de l'art aurait été de tolérer ces jetons pendant une semaine, le temps qu'ils expirent d'eux-mêmes (durée de vie : 7 jours).

Le site n'ayant **aucun utilisateur en production**, il n'y a aucune session à ménager — et la version tolérante n'aurait fait qu'affaiblir la vérification sans contrepartie. La tolérance a donc été retirée.

---

## 🔵 BASSE — Payload de paiement intégralement journalisé

**Fichier** : `server/controllers/jekoController.js`

```js
console.log(JSON.stringify(payload));  // avant
```

Données de transaction et de clients (téléphone, opérateur, montants) recopiées telles quelles dans les logs Vercel : lisibles par quiconque a accès au tableau de bord, conservées bien au-delà de leur utilité, et hors de portée d'une demande de suppression de données personnelles.

### Correctif appliqué

Résumé expurgé : statut, référence de commande, identifiant de transaction — de quoi diagnostiquer et retrouver la trace complète côté Jèko.

La **liste des clés** du payload (`champsRecus`) reste journalisée, sans les valeurs : c'était l'autre utilité du log brut, confirmer les noms de champs réels au premier vrai paiement.

---

## 🔵 BASSE — `node_modules` versionné

11 555 fichiers de dépendances étaient suivis par git, contre 472 pour le projet réel.

Ce n'était pas une faille exploitable, mais une faiblesse de chaîne d'approvisionnement : une dépendance modifiée localement partait en production sans que rien ne le signale, et les mises à jour de sécurité produisaient des diffs où une modification malveillante serait passée inaperçue.

### Correctif appliqué

`.gitignore` réécrit (`node_modules/`, sorties de build, logs — et les règles `.env` nettoyées de leurs espaces en fin de ligne), puis `git rm -r --cached node_modules server/node_modules`.

Vérifié avant l'opération : les trois `package-lock.json` sont versionnés, aucun `.vercelignore` ni `installCommand` personnalisé ne dépend des modules commités, aucune dépendance manquante. Vercel exécutera son `npm install` normalement.

Les fichiers restent **présents sur le disque** — rien n'est cassé en local.

⚠️ **La suppression est mise en attente (*staged*), pas commitée** : le prochain commit contiendra 11 555 suppressions. C'est voulu, mais il faut le savoir avant de le passer.

---

## 🔵 BASSE — `authSeller` refusait en HTTP 200 avec le message JWT brut

**Fichier** : `server/middlewares/authSeller.js`

Découvert pendant la **vérification en ligne** (voir plus bas). Une requête sans jeton vers `/api/order/seller` renvoyait `HTTP 200 OK` — alors que le corps était bien un refus `{"success":false,"message":"Not Authorized - Token manquant"}`.

**Ce n'était pas une fuite de données** : aucune donnée vendeur ne sortait, la requête était bien bloquée. Mais deux défauts réels :

1. Un code `200 OK` sur un refus casse la sémantique HTTP — il trompe les caches, la supervision et tout client d'API qui se fie au code plutôt qu'au corps.
2. Le bloc `catch` renvoyait `error.message` brut (« invalid signature », « jwt malformed »…), ce qui renseigne un attaquant sur le mécanisme d'authentification.

### Correctif appliqué

`401` sur jeton manquant ou invalide, `403` sur mauvais type de compte, message générique dans le `catch`. Comportement aligné sur `authUser`, qui renvoyait déjà `401` partout — le front gère donc déjà ce cas, aucune régression.

---

## 🌐 Vérification en ligne (non intrusive) — production

En complément de l'audit de code, une vérification **en ligne** a été menée contre `www.ramci.ci` et `api.ramci.ci`, avec l'accord du propriétaire. **Uniquement des requêtes de lecture** — en-têtes, redirection, comportement CORS, codes de statut sur des identifiants bidon. Aucune attaque, aucune écriture, aucune donnée réelle touchée.

| Vérification | Résultat |
|---|---|
| Front — les 6 en-têtes de sécurité | ✅ présents et conformes |
| Front — redirection HTTP → HTTPS | ✅ 308 |
| API — en-têtes helmet | ✅ présents (`X-Frame-Options`, `nosniff`, HSTS, `Referrer-Policy`, DNS-prefetch off) |
| API — techno masquée | ✅ pas de `X-Powered-By` |
| API — liste blanche CORS | ✅ origine légitime acceptée, origine pirate → `403` |
| **API — faille critique (route de chat)** | ✅ **corrigée en production** : la route supprimée renvoie le 404 par défaut d'Express, plus le JSON de l'ancien contrôleur |
| API — routes protégées (chat, staff) | ✅ refusées sans jeton |

**Constat de déploiement** : la correction critique et les en-têtes sont **déjà en ligne**. En revanche, le dernier lot de durcissement de cette session (hachage des jetons, typage JWT, correctif `authSeller` ci-dessus) est encore **local** — il faut redéployer pour l'activer. Ces éléments-là ne sont pas vérifiables de l'extérieur.

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
server/routes/metricsRoute.js        contrôle du type de jeton
server/services/scraper.js           garde anti-SSRF branché
server/utils/urlGuard.js             NOUVEAU — validation des URL sortantes
server/utils/jwtTypes.js             NOUVEAU — typage des jetons JWT
server/middlewares/authUser.js       contrôle du type de jeton
server/middlewares/authSeller.js     contrôle du type de jeton
server/middlewares/authStaff.js      contrôle du type de jeton
server/controllers/userController.js jeton de reset haché + claim typ
server/controllers/staffController.js jeton d'invitation haché + claim typ
server/controllers/sellerController.js claim typ
server/controllers/jekoController.js  logs de paiement expurgés
server/server.js                     garde-fou sur les secrets au démarrage
server/package.json                  nodemailer 9.0.5, undici 7.29.0
client/vercel.json                   6 en-têtes de sécurité
.gitignore                           node_modules, builds, logs
```

## Vérifications effectuées

```
node --check           14 fichiers serveur — OK
Imports résolus        3 middlewares + jwtTypes se chargent réellement
JSON vercel.json       valide, 6 en-têtes
npm audit              found 0 vulnerabilities
Tests anti-SSRF        28/28 (dont contournement DNS bloqué)
Tests de durcissement  19/19 (typage des jetons, mode strict, hachage)
Garde-fou démarrage    refuse de démarrer sans secret (code de sortie 1)
Compatibilité v9       verify(callback) confirmé présent dans la source
Dé-versionnage         0 fichier node_modules dans l'index, tous sur le disque
```

## À faire de ton côté

1. **Redéployer** — aucun correctif ne prend effet avant.
2. **Se reconnecter** à l'espace vendeur et à l'espace staff après le déploiement : les jetons émis avant le typage ne sont plus acceptés.
3. **Prévenir l'équipe staff** : les liens d'invitation et de réinitialisation déjà envoyés ne fonctionnent plus, il faut en redemander.
4. **Vérifier `JWT_SECRET`** — au moins 32 caractères (`openssl rand -hex 32`). Le serveur avertit au démarrage si c'est trop court.
5. **Affiner la CSP** à partir des violations remontées en console, puis retirer le suffixe `-Report-Only`.
6. **Commiter la suppression de `node_modules`** en connaissance de cause (11 555 suppressions en attente).
