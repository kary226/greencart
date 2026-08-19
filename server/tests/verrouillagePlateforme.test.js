import test from 'node:test';
import assert from 'node:assert/strict';
import {
    estArticlePlateforme,
    appliquerVerrouillagePlateforme,
} from '../services/productService.js';

// Un article saisi par la plateforme puis confié à une boutique : le
// commerçant en gère les quantités et les caractéristiques, la plateforme
// garde la main sur le prix et les médias. C'est une règle d'autorisation —
// elle mérite d'être verrouillée par des tests, pas seulement relue.

test('estArticlePlateforme | article saisi par la plateforme et rattaché | est reconnu', () => {
    assert.equal(estArticlePlateforme({ origine: 'plateforme', boutiqueId: 'b1' }), true);
});

test('estArticlePlateforme | article saisi par le commerçant | n_est pas verrouillé', () => {
    // Il garde la main complète sur ce qu'il a créé lui-même.
    assert.equal(estArticlePlateforme({ origine: 'commercant', boutiqueId: 'b1' }), false);
});

test('estArticlePlateforme | article du catalogue principal | n_est pas concerné', () => {
    // Sans boutique, aucun commerçant ne peut l'éditer de toute façon.
    assert.equal(estArticlePlateforme({ origine: 'plateforme', boutiqueId: null }), false);
});

test('estArticlePlateforme | article existant sans champ origine | reste modifiable', () => {
    // Les articles antérieurs à cette règle appartiennent à leur commerçant :
    // leur appliquer le verrou rétroactivement retirerait des droits acquis.
    assert.equal(estArticlePlateforme({ boutiqueId: 'b1' }), false);
});

test('appliquerVerrouillagePlateforme | tentative de changer le prix | le champ est retiré et signalé', () => {
    // Arrange
    const existant = { price: 10000, offerPrice: 8000, image: ['a.jpg'] };
    const demande = { price: 1, offerPrice: 1, name: 'Nouveau nom' };

    // Act
    const { miseAJour, champsRefuses } = appliquerVerrouillagePlateforme(demande, existant);

    // Assert
    assert.equal(miseAJour.price, undefined, 'le prix ne doit pas être écrit');
    assert.equal(miseAJour.offerPrice, undefined);
    assert.equal(miseAJour.name, 'Nouveau nom', 'le reste de la modification doit aboutir');
    assert.deepEqual(champsRefuses, ['price', 'offerPrice']);
});

test('appliquerVerrouillagePlateforme | valeurs inchangées renvoyées par le formulaire | ne sont pas signalées', () => {
    // Un formulaire renvoie toujours tous ses champs : renvoyer le prix
    // existant n'est pas une tentative de fraude.
    const existant = { price: 10000, offerPrice: 8000 };
    const { champsRefuses } = appliquerVerrouillagePlateforme({ price: 10000, offerPrice: 8000 }, existant);

    assert.deepEqual(champsRefuses, []);
});

test('appliquerVerrouillagePlateforme | tentative de remplacer les photos | est écartée', () => {
    // Arrange
    const existant = { image: ['officielle.jpg'], video: 'clip.mp4' };
    const demande = { image: ['perso.jpg'], video: 'autre.mp4', description: 'Nouvelle description' };

    // Act
    const { miseAJour, champsRefuses } = appliquerVerrouillagePlateforme(demande, existant);

    // Assert
    assert.equal(miseAJour.image, undefined);
    assert.equal(miseAJour.video, undefined);
    assert.equal(miseAJour.description, 'Nouvelle description');
    assert.ok(champsRefuses.includes('image'));
    assert.ok(champsRefuses.includes('video'));
});

test('appliquerVerrouillagePlateforme | coût d_achat envoyé par un commerçant | n_est jamais écrit', () => {
    // purchasePrice est une donnée interne de marge.
    const { miseAJour } = appliquerVerrouillagePlateforme(
        { purchasePrice: 1 },
        { purchasePrice: 5000 }
    );
    assert.equal(miseAJour.purchasePrice, undefined);
});

test('appliquerVerrouillagePlateforme | quantités de variantes | passent, mais pas leurs prix', () => {
    // Arrange : le commerçant réapprovisionne et tente de baisser le prix
    const existant = {
        variants: [{ color: 'Rouge', size: 'M', price: 12000, offerPrice: 10000, stock: 0 }],
    };
    const demande = {
        variants: [{ color: 'Rouge', size: 'M', price: 1, offerPrice: 1, stock: 25 }],
    };

    // Act
    const { miseAJour, champsRefuses } = appliquerVerrouillagePlateforme(demande, existant);

    // Assert
    assert.equal(miseAJour.variants[0].stock, 25, 'la quantité doit être appliquée');
    assert.equal(miseAJour.variants[0].price, 12000, 'le prix de variante doit être réimposé');
    assert.equal(miseAJour.variants[0].offerPrice, 10000);
    assert.ok(champsRefuses.includes('variants.price'));
});

test('appliquerVerrouillagePlateforme | nouvelle variante ajoutée | conserve le prix saisi', () => {
    // Ajouter une couleur est une caractéristique, pas un changement de prix
    // sur l'existant : on ne peut rien réimposer, la variante est nouvelle.
    const existant = { variants: [{ color: 'Rouge', size: 'M', price: 12000, offerPrice: 10000 }] };
    const demande = {
        variants: [
            { color: 'Rouge', size: 'M', price: 12000, offerPrice: 10000, stock: 2 },
            { color: 'Bleu', size: 'M', price: 12000, offerPrice: 10000, stock: 5 },
        ],
    };

    const { miseAJour, champsRefuses } = appliquerVerrouillagePlateforme(demande, existant);

    assert.equal(miseAJour.variants.length, 2);
    assert.equal(miseAJour.variants[1].color, 'Bleu');
    assert.deepEqual(champsRefuses, []);
});

test('appliquerVerrouillagePlateforme | mise à jour sans champ verrouillé | est renvoyée intacte', () => {
    const demande = { name: 'X', categories: ['robes'], stock: 3 };
    const { miseAJour, champsRefuses } = appliquerVerrouillagePlateforme(demande, {});

    assert.deepEqual(miseAJour, demande);
    assert.deepEqual(champsRefuses, []);
});
