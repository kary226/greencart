import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

/**
 * GARDE-FOU ANTI-RÉGRESSION — RAMCI §5/§15, point 3 de l'audit "guichet unique"
 * ================================================================================
 * Ce test ne vérifie AUCUNE règle métier — orderWorkflowService.test.js s'en
 * charge déjà. Il vérifie une seule chose, au niveau du CODE SOURCE lui-même :
 * que personne n'a réintroduit une écriture directe du statut d'une commande
 * en dehors de transitionner() / transitionnerAtomique().
 *
 * Pourquoi un test sur le texte du code, et pas sur son comportement : le
 * risque identifié n'est pas "la logique de transition est fausse", c'est
 * "quelqu'un, dans six mois, ajoute un order.status = '...' ou un
 * findOneAndUpdate({$set:{status:...}}) tout neuf sans savoir qu'un guichet
 * existe déjà". Aucun test de comportement ne peut détecter ça — seul un
 * scan du texte le peut, à chaque exécution de la suite.
 *
 * Si ce test casse : soit le nouveau code doit passer par
 * transitionner()/transitionnerAtomique(), soit — cas rarissime, comme
 * Disputed — il faut l'ajouter explicitement à EXCEPTIONS_AUTORISEES
 * ci-dessous, avec une justification écrite, pas juste pour faire taire
 * le test.
 */

// Dossiers où une commande peut légitimement être manipulée.
const DOSSIERS_SURVEILLES = ['controllers', 'services'];

// Seul ce fichier a le droit d'écrire order.status directement — c'est
// littéralement le guichet.
const FICHIER_GUICHET = 'orderWorkflowService.js';

// Exceptions nommées et justifiées — PAS un échappatoire générique.
// Disputed est un chemin d'exception qui interrompt le flux normal (§12),
// pas une étape dedans : il ne passe pas par la table TRANSITIONS, par
// construction (voir le commentaire sur TRANSITIONS dans
// orderWorkflowService.js). declarerLitige/résoudreLitige sont les deux
// seules fonctions autorisées à toucher order.status hors du guichet.
const EXCEPTIONS_AUTORISEES = [
    { fichier: 'orderController.js', extrait: "order.status = 'Disputed'" },
    { fichier: 'orderController.js', extrait: 'order.status = order.litige.statutAvant' },
];

// Écriture directe : order.status = '...', commande.status = "...", etc.
// (property access suivi d'une affectation à une chaîne littérale — ne
// matche jamais une comparaison ===, qui a un caractère non-espace/non-quote
// juste après le premier "=").
const REGEX_AFFECTATION_DIRECTE = /\.status\s*=\s*(['"a-zA-Z_.])/;

// Écriture via requête Mongo : { $set: { ... status: '...' ... } } — même
// approximativement, sur une ou plusieurs lignes.
const REGEX_SET_STATUS = /\$set\s*:\s*\{[^}]*\bstatus\s*:/s;

// [FIX] Le premier passage de ce garde-fou ne voyait QUE $set explicite —
// or Mongoose traite un objet passé tel quel à findByIdAndUpdate/
// findOneAndUpdate/updateOne/updateMany comme un $set implicite. C'est
// exactement ce qui a laissé passer updateLivraisonStatus() : un
// `Order.findByIdAndUpdate(orderId, { status })` sans jamais écrire le
// mot "$set". On se limite volontairement aux appels sur le modèle
// `Order` (et pas toute méthode `updateOne` du fichier, quel que soit le
// modèle) : Refund, ColisShein, etc. ont leur propre champ "statut" et
// n'ont rien à voir avec le guichet unique des commandes.
const METHODES_UPDATE_MONGO = ['findByIdAndUpdate', 'findOneAndUpdate', 'updateOne', 'updateMany'];
const REGEX_APPEL_UPDATE_ORDER = new RegExp(`\\bOrder\\.(?:${METHODES_UPDATE_MONGO.join('|')})\\s*\\(`, 'g');
// "status" comme clé d'objet — sous ses deux formes : explicite
// (`status: ...`) et raccourcie ES6 (`{ status }`, `{ status, autre }`).
// La forme raccourcie n'a pas de ":", donc chercher seulement "status:"
// la manque — et c'est justement la syntaxe du bug d'origine
// (`const updateData = { status };`).
const REGEX_STATUS_CLE_OBJET = /\bstatus\s*:|[{,]\s*status\s*[,}]/;
// L'objet de mise à jour est parfois construit AVANT l'appel puis passé
// par une variable (c'est exactement ce qui a caché le bug d'origine :
// `const updateData = { status }` sur une ligne, `findByIdAndUpdate(id,
// updateData)` quelques lignes plus bas) — donc la fenêtre regarde dans
// les deux sens, pas seulement après l'appel.
const FENETRE_AVANT_APPEL = 300;
const FENETRE_APRES_APPEL = 400;

const listerFichiersJs = (dir) => {
    let resultats = [];
    for (const entree of fs.readdirSync(dir, { withFileTypes: true })) {
        const chemin = path.join(dir, entree.name);
        if (entree.isDirectory()) {
            resultats = resultats.concat(listerFichiersJs(chemin));
        } else if (entree.name.endsWith('.js')) {
            resultats.push(chemin);
        }
    }
    return resultats;
};

const estUneExceptionAutorisee = (nomFichier, ligneTexte) =>
    EXCEPTIONS_AUTORISEES.some(
        (exception) => exception.fichier === nomFichier && ligneTexte.includes(exception.extrait)
    );

// Même mécanisme, pour la boucle $set implicite (findOneAndUpdate/etc.) :
// un appel peut légitimement avoir "status" dans son FILTRE
// (ex: { status: 'Shipped', livreurId: null }) sans jamais l'écrire —
// seul un autre champ est modifié. La fenêtre de recherche ne distingue
// pas filtre et écriture, donc on nomme les cas vérifiés à la main.
const EXCEPTIONS_SET_IMPLICITE = [
    {
        fichier: 'orderController.js',
        // prendreEnChargeLivraison() : "status: 'Shipped'" est la condition
        // de la requête (le colis doit être encore Expédié pour être pris),
        // pas l'écriture — seul livreurId est modifié dans le $set.
        extrait: "{ _id: orderId, status: 'Shipped', livreurId: null }",
    },
];

const estUneExceptionSetImplicite = (nomFichier, fenetre) =>
    EXCEPTIONS_SET_IMPLICITE.some((e) => e.fichier === nomFichier && fenetre.includes(e.extrait));

describe('Guichet unique — garde-fou anti-régression (audit, point 3)', () => {
    for (const dossier of DOSSIERS_SURVEILLES) {
        const dossierAbsolu = path.join(SERVER_ROOT, dossier);
        if (!fs.existsSync(dossierAbsolu)) continue;

        for (const fichier of listerFichiersJs(dossierAbsolu)) {
            const nomFichier = path.basename(fichier);
            if (nomFichier === FICHIER_GUICHET) continue;

            it(`${path.relative(SERVER_ROOT, fichier)} ne modifie pas order.status directement`, () => {
                const source = fs.readFileSync(fichier, 'utf8');
                const lignes = source.split('\n');

                const violationsAffectation = [];
                lignes.forEach((ligne, index) => {
                    if (REGEX_AFFECTATION_DIRECTE.test(ligne) && !estUneExceptionAutorisee(nomFichier, ligne)) {
                        violationsAffectation.push(`  ligne ${index + 1}: ${ligne.trim()}`);
                    }
                });

                assert.strictEqual(
                    violationsAffectation.length,
                    0,
                    `Écriture directe de order.status détectée dans ${nomFichier} — passe par ` +
                        `transitionner()/transitionnerAtomique(), ou ajoute une exception justifiée ` +
                        `si c'est un cas comme Disputed :\n${violationsAffectation.join('\n')}`
                );

                const violationsSet = REGEX_SET_STATUS.test(source);
                assert.strictEqual(
                    violationsSet,
                    false,
                    `${nomFichier} contient un $set { status: ... } écrit à la main — ` +
                        `transitionnerAtomique() existe déjà pour ça, voir orderWorkflowService.js`
                );

                // [FIX] Même mécanisme d'exception que EXCEPTIONS_AUTORISEES ci-dessus,
                // mais pour la boucle $set implicite : un appel peut légitimement avoir
                // "status" dans son FILTRE (ex: { status: 'Shipped', livreurId: null })
                // sans jamais l'écrire — seul un autre champ (livreurId) est modifié. La
                // fenêtre de recherche ne distingue pas filtre et écriture, donc on
                // nomme explicitement les cas vérifiés à la main, comme pour Disputed.
                const violationsImplicites = [];
                for (const appel of source.matchAll(REGEX_APPEL_UPDATE_ORDER)) {
                    const debutFenetre = Math.max(0, appel.index - FENETRE_AVANT_APPEL);
                    const finFenetre = Math.min(source.length, appel.index + appel[0].length + FENETRE_APRES_APPEL);
                    const fenetre = source.slice(debutFenetre, finFenetre);
                    if (REGEX_STATUS_CLE_OBJET.test(fenetre) && !estUneExceptionSetImplicite(nomFichier, fenetre)) {
                        const ligneNo = source.slice(0, appel.index).split('\n').length;
                        violationsImplicites.push(`  ligne ${ligneNo}: ${appel[0]}...`);
                    }
                }

                assert.strictEqual(
                    violationsImplicites.length,
                    0,
                    `${nomFichier} modifie order.status via un $set IMPLICITE (objet passé tel quel à ` +
                        `Order.findByIdAndUpdate/findOneAndUpdate/updateOne/updateMany) — ` +
                        `transitionnerAtomique() existe déjà pour ça :\n${violationsImplicites.join('\n')}`
                );
            });
        }
    }
});