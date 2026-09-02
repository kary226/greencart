import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

/**
 * LE CLIENT PAIE CE QU'IL VOIT
 * ============================
 *
 * Une taxe de 2 % était ajoutée au total dans `placeOrderCOD`, et nulle part
 * ailleurs. Trois écarts en découlaient :
 *
 *   · les deux chemins de commande ne calculaient pas le même total pour le
 *     même panier — 48 000 F d'un côté, 47 000 F de l'autre ;
 *   · le panier du client, qui fait la simple somme prix × quantité,
 *     annonçait un montant que le serveur ne retenait pas ;
 *   · rien, dans l'interface, ne mentionnait cette taxe.
 *
 * Elle venait du code d'origine du projet et n'a jamais été prélevée : aucun
 * bouton ne met `paymentOption` à « COD », donc cette route n'est pas
 * atteignable. Elle aurait resurgi le jour où le paiement à la livraison
 * serait rebranché.
 *
 * Ce test relit les deux contrôleurs pour que le total reste une somme, sans
 * pourcentage surprise.
 */

const lire = (nom) =>
    readFileSync(new URL(`../controllers/${nom}`, import.meta.url), 'utf8');

/** Isole le corps d'une fonction exportée, pour ne pas fouiller tout le fichier. */
const corpsDe = (source, nomFonction) => {
    const debut = source.indexOf(`export const ${nomFonction}`);
    if (debut === -1) return null;
    // Jusqu'à l'export suivant, ou la fin.
    const suivant = source.indexOf('\nexport const ', debut + 10);
    return source.slice(debut, suivant === -1 ? source.length : suivant);
};

const CHEMINS = [
    ['paiement à la livraison', 'orderController.js', 'placeOrderCOD'],
    ['paiement en ligne (Jèko)', 'jekoController.js', 'initiateJeko'],
];

describe('Montant d’une commande — le client paie ce qu’il voit', () => {

    for (const [libelle, fichier, fonction] of CHEMINS) {
        describe(libelle, () => {
            const corps = corpsDe(lire(fichier), fonction);

            it('la fonction de création de commande a bien été trouvée', () => {
                assert.ok(corps, `${fonction} introuvable dans ${fichier}`);
                assert.ok(corps.length > 500, `${fonction} paraît tronquée`);
            });

            it('n’applique aucun pourcentage au total', () => {
                // On cherche un montant multiplié par un facteur décimal :
                // `amount * 0.02`, `total *= 1.02`, etc.
                const pourcentages = [...corps.matchAll(
                    /\b(amount|total|itemsSubtotal|sousTotal)\b\s*\*=?\s*\(?\s*(0?\.\d+|1\.\d+)/gi
                )].map((m) => m[0].trim());

                assert.deepStrictEqual(pourcentages, [],
                    `${fonction} applique un pourcentage au montant : ${pourcentages.join(', ')}`);
            });

            it('calcule le total comme une somme : articles + livraison − remise', () => {
                const formule = corps.match(
                    /amount\s*=\s*itemsSubtotal\s*\+\s*deliveryPrice\s*-\s*discountAmount/
                );
                assert.ok(formule,
                    `${fonction} ne calcule plus le total avec la formule attendue ` +
                    `(articles + livraison − remise)`);
            });
        });
    }

    it('les deux chemins utilisent la même formule', () => {
        // C'est l'écart qui comptait : deux totaux différents pour le même
        // panier selon le mode de paiement.
        const formules = CHEMINS.map(([, fichier, fonction]) => {
            const corps = corpsDe(lire(fichier), fonction);
            const m = corps.match(/amount\s*=\s*itemsSubtotal[^;]*/);
            return m ? m[0].replace(/\s+/g, ' ').trim() : null;
        });

        assert.ok(formules[0], 'formule introuvable côté paiement à la livraison');
        assert.strictEqual(formules[0], formules[1],
            `Les deux chemins calculent différemment :\n  COD  : ${formules[0]}\n  Jèko : ${formules[1]}`);
    });

    it('aucune taxe résiduelle dans les contrôleurs de commande', () => {
        // Filet large : une variable nommée `tax` réintroduite ailleurs dans
        // ces fichiers doit se signaler, même hors des deux fonctions ci-dessus.
        const restes = [];
        for (const [, fichier] of CHEMINS) {
            const source = lire(fichier);
            for (const ligne of source.split('\n')) {
                // On ignore les commentaires : celui qui explique le retrait
                // mentionne légitimement le mot.
                const nue = ligne.trim();
                if (nue.startsWith('//') || nue.startsWith('*')) continue;
                if (/\bconst\s+tax\b|\btax\s*=/.test(ligne)) {
                    restes.push(`${fichier} : ${nue}`);
                }
            }
        }
        assert.deepStrictEqual(restes, [], `Taxe réintroduite :\n  ${restes.join('\n  ')}`);
    });
});
