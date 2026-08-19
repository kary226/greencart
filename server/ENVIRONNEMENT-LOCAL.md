# Environnement local isolé

Un MongoDB **embarqué**, propre à cette machine, qui remplace la base de
production pendant le développement et les tests.

## Pourquoi

Le `.env` du projet pointe sur le cluster Atlas **de production**. Tant que
c'était la seule base disponible, tout test qui écrit — un scénario de bout
en bout, un agent de test de sécurité, une simple manipulation — risquait de
détruire des données réelles. D'où cet environnement, qui n'existe que
localement et n'est joignable depuis nulle part ailleurs.

## Utilisation

```bash
cd server
npm run local
```

Au premier lancement, le binaire MongoDB (~780 Mo) est téléchargé une fois
pour toutes, la base est créée puis remplie. Ensuite, démarrage immédiat et
**les données sont conservées** d'une session à l'autre.

| Commande | Effet |
|---|---|
| `npm run local` | Démarre la base locale + le serveur sur `:4000` |
| `npm run local:reset` | Remet la base à son état de départ |
| `npm test` | Tests unitaires (aucune base nécessaire) |
| `node scripts/verifierLocal.js` | Vérifications de bout en bout, serveur démarré |

La base reste accessible à `mongodb://127.0.0.1:27018/ramci_local` — utilisable
avec MongoDB Compass pour inspecter les données à la main.

## Comptes de démonstration

Mot de passe commun : `MotDePasseLocal123`

| Compte | Rôle | Particularité |
|---|---|---|
| `admin@local.test` | Admin staff | Secret 2FA fixe : `JBSWY3DPEHPK3PXP` |
| `boutique-ouverte@local.test` | Commerçant | **Peut** créer des articles |
| `boutique-fermee@local.test` | Commerçant | Ne peut **pas** créer d'articles |
| `client@local.test` | Client boutique | — |

Les secrets 2FA des commerçants sont tirés au hasard à chaque remplissage et
affichés dans la console. Pour obtenir un code sans téléphone :

```bash
node -e "import('otplib').then(m=>console.log(m.authenticator.generate('VOTRE_SECRET')))"
```

Ces identifiants n'ouvrent qu'une base locale. **Aucun ne doit être réutilisé
ailleurs.**

## Données de départ

Le jeu de données ne cherche pas à imiter la production : il couvre les cas
qui se cassent.

- 14 articles au catalogue principal — assez pour dépasser la pagination par
  défaut, ce qui est précisément ce qui masquait le défaut du catalogue tronqué ;
- une boutique **Chez Awa** avec deux articles d'origines différentes : un
  qu'elle a saisi (modifiable en entier) et un fourni par la plateforme
  (prix et médias verrouillés) ;
- une boutique **Bakary Shop** sans droit de création, pour vérifier le refus.

## Garde-fou

Les scripts qui écrivent massivement (`semisLocal.js`, `resetLocal.js`)
refusent de s'exécuter sur une URI qui n'est pas `127.0.0.1`. Se tromper de
`.env` ne peut donc pas vider la production.

## Pour un test de sécurité automatisé

C'est cet environnement qu'il faut viser — jamais `ramci.ci`, jamais un
serveur local branché sur Atlas :

```bash
npm run local          # dans un terminal
# puis pointer l'outil sur http://localhost:4000
npm run local:reset    # pour repartir propre après coup
```
