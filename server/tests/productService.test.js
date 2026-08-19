import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normaliserVariantes,
    calculerStockTotal,
    determinerDisponibilite,
    appliquerQuantites,
    cleVariante,
} from '../services/productService.js';

// Règles de stock : c'est ici qu'une erreur coûte le plus cher (vendre un
// article qui n'existe plus, ou masquer un article disponible).

test('calculerStockTotal | article sans variante | renvoie le stock simple', () => {
    // Arrange
    const article = { variants: [], stock: 7 };

    // Act
    const total = calculerStockTotal(article);

    // Assert
    assert.equal(total, 7);
});

test('calculerStockTotal | article avec variantes | renvoie la somme des variantes et ignore le champ stock', () => {
    // Arrange : un champ `stock` volontairement incohérent avec les variantes
    const article = { variants: [{ stock: 2 }, { stock: 3 }, { stock: 0 }], stock: 999 };

    // Act
    const total = calculerStockTotal(article);

    // Assert
    assert.equal(total, 5);
});

test('calculerStockTotal | quantité négative ou absurde | est ramenée à zéro', () => {
    // Arrange
    const article = { variants: [{ stock: -5 }, { stock: 'abc' }, { stock: 4 }] };

    // Act
    const total = calculerStockTotal(article);

    // Assert
    assert.equal(total, 4);
});

test('determinerDisponibilite | stock positif sans forçage | article disponible', () => {
    assert.equal(determinerDisponibilite(3), true);
});

test('determinerDisponibilite | stock nul | article indisponible', () => {
    assert.equal(determinerDisponibilite(0), false);
});

test('determinerDisponibilite | stock positif mais rupture forcée | article indisponible', () => {
    // Le commerçant retire de la vente un article qui a encore du stock.
    assert.equal(determinerDisponibilite(12, true), false);
});

test('normaliserVariantes | champs manquants | applique les valeurs par défaut', () => {
    // Arrange
    const brut = [{ color: 'Rouge' }];

    // Act
    const [variante] = normaliserVariantes(brut);

    // Assert
    assert.equal(variante.color, 'Rouge');
    assert.equal(variante.colorCode, '#000000');
    assert.equal(variante.size, null);
    assert.equal(variante.stock, 0);
    assert.equal(variante.price, 0);
});

test('normaliserVariantes | clé surnuméraire envoyée par le client | est écartée', () => {
    // Arrange : un client malveillant tente de glisser un champ interne
    const brut = [{ color: 'Bleu', stock: 2, isArchived: true, purchasePrice: 1 }];

    // Act
    const [variante] = normaliserVariantes(brut);

    // Assert
    assert.equal(variante.isArchived, undefined);
    assert.equal(variante.purchasePrice, undefined);
});

test('appliquerQuantites | variante reconnue | met à jour la quantité sans toucher au prix', () => {
    // Arrange
    const existantes = [{ color: 'Rouge', size: 'M', stock: 1, offerPrice: 5000 }];

    // Act
    const { variantes, appliquees } = appliquerQuantites(existantes, [
        { color: 'Rouge', size: 'M', stock: 9 },
    ]);

    // Assert
    assert.equal(appliquees, 1);
    assert.equal(variantes[0].stock, 9);
    assert.equal(variantes[0].offerPrice, 5000, 'le prix saisi par le vendeur doit être préservé');
});

test('appliquerQuantites | variante inconnue | est ignorée et signalée', () => {
    // Arrange
    const existantes = [{ color: 'Rouge', size: 'M', stock: 1 }];

    // Act
    const { variantes, appliquees, ignorees } = appliquerQuantites(existantes, [
        { color: 'Vert', size: 'XL', stock: 50 },
    ]);

    // Assert
    assert.equal(appliquees, 0);
    assert.equal(ignorees, 1);
    assert.equal(variantes[0].stock, 1, 'aucune variante existante ne doit bouger');
});

test('appliquerQuantites | variante sans taille | est identifiée par la seule couleur', () => {
    // Arrange
    const existantes = [{ color: 'Noir', size: null, stock: 0 }];

    // Act
    const { variantes } = appliquerQuantites(existantes, [{ color: 'Noir', size: null, stock: 3 }]);

    // Assert
    assert.equal(variantes[0].stock, 3);
});

test('cleVariante | couleur ou taille absente | produit une clé stable', () => {
    assert.equal(cleVariante({ color: 'Rouge', size: 'M' }), 'Rouge|M');
    assert.equal(cleVariante({ color: 'Rouge' }), 'Rouge|');
    assert.equal(cleVariante({}), '|');
});
