import test from 'node:test';
import assert from 'node:assert/strict';
import { repartirParBoutique, etatConfirmations } from '../services/walletService.js';

// Répartition de l'argent d'une commande entre plusieurs boutiques, et suivi
// des confirmations. C'est de la logique pure — donc testable sans base — et
// c'est celle où une erreur se paie en argent réel.

test('repartirParBoutique | commande multi-boutiques | sépare les montants par boutique', () => {
    // Arrange : une robe chez A, des chaussures chez B
    const items = [
        { product: 'p1', boutiqueId: 'A', priceAtOrder: 22000, quantity: 1 },
        { product: 'p2', boutiqueId: 'B', priceAtOrder: 15000, quantity: 1 },
    ];

    // Act
    const r = repartirParBoutique(items);

    // Assert
    assert.equal(r.get('A').montant, 22000);
    assert.equal(r.get('B').montant, 15000);
    assert.equal(r.size, 2);
});

test('repartirParBoutique | quantité multiple | multiplie le prix unitaire', () => {
    const r = repartirParBoutique([{ product: 'p1', boutiqueId: 'A', priceAtOrder: 5000, quantity: 3 }]);
    assert.equal(r.get('A').montant, 15000);
});

test('repartirParBoutique | plusieurs articles de la MÊME boutique | sont cumulés', () => {
    // Arrange
    const items = [
        { product: 'p1', boutiqueId: 'A', priceAtOrder: 10000, quantity: 1 },
        { product: 'p2', boutiqueId: 'A', priceAtOrder: 4000, quantity: 2 },
    ];

    // Act
    const r = repartirParBoutique(items);

    // Assert
    assert.equal(r.size, 1, 'une seule boutique concernée');
    assert.equal(r.get('A').montant, 18000);
    assert.equal(r.get('A').nombreArticles, 2);
});

test('repartirParBoutique | article du catalogue principal | ne crédite aucune boutique', () => {
    // Sans boutique, l'article appartient à la plateforme.
    const items = [
        { product: 'p1', boutiqueId: null, priceAtOrder: 10000, quantity: 1 },
        { product: 'p2', boutiqueId: 'A', priceAtOrder: 5000, quantity: 1 },
    ];

    const r = repartirParBoutique(items);

    assert.equal(r.size, 1);
    assert.equal(r.get('A').montant, 5000);
});

test('repartirParBoutique | boutique absente de la ligne | retombe sur celle du produit', () => {
    // Cas des commandes anciennes, sans boutiqueId figé sur l'article.
    const items = [{ product: 'p1', priceAtOrder: 8000, quantity: 1 }];
    const parProduit = new Map([['p1', 'A']]);

    const r = repartirParBoutique(items, parProduit);

    assert.equal(r.get('A').montant, 8000);
});

test('repartirParBoutique | boutique figée sur la ligne | prime sur celle du produit', () => {
    // Si le vendeur réaffecte l'article APRÈS la vente, la vente reste due
    // à la boutique d'origine.
    const items = [{ product: 'p1', boutiqueId: 'ORIGINE', priceAtOrder: 8000, quantity: 1 }];
    const parProduit = new Map([['p1', 'NOUVELLE']]);

    const r = repartirParBoutique(items, parProduit);

    assert.equal(r.get('ORIGINE').montant, 8000);
    assert.equal(r.has('NOUVELLE'), false);
});

test('repartirParBoutique | données manquantes ou aberrantes | ne produit pas de NaN', () => {
    const r = repartirParBoutique([
        { product: 'p1', boutiqueId: 'A', priceAtOrder: undefined, quantity: 2 },
        { product: 'p2', boutiqueId: 'A', priceAtOrder: 'abc', quantity: 1 },
    ]);
    assert.equal(r.get('A').montant, 0);
});

test('repartirParBoutique | commande vide | renvoie une répartition vide', () => {
    assert.equal(repartirParBoutique([]).size, 0);
    assert.equal(repartirParBoutique(undefined).size, 0);
});

// ---- Suivi des confirmations ----------------------------------------- //

test('etatConfirmations | aucune boutique n_a confirmé | les liste toutes comme manquantes', () => {
    // Arrange
    const order = {
        items: [{ boutiqueId: 'A' }, { boutiqueId: 'B' }],
        confirmationsBoutiques: [],
    };

    // Act
    const e = etatConfirmations(order);

    // Assert
    assert.deepEqual(e.attendues.sort(), ['A', 'B']);
    assert.deepEqual(e.manquantes.sort(), ['A', 'B']);
    assert.equal(e.toutesConfirmees, false);
});

test('etatConfirmations | une seule boutique sur deux a confirmé | reste incomplet', () => {
    const order = {
        items: [{ boutiqueId: 'A' }, { boutiqueId: 'B' }],
        confirmationsBoutiques: [{ boutiqueId: 'A' }],
    };

    const e = etatConfirmations(order);

    assert.deepEqual(e.confirmees, ['A']);
    assert.deepEqual(e.manquantes, ['B']);
    assert.equal(e.toutesConfirmees, false);
});

test('etatConfirmations | toutes les boutiques ont confirmé | la commande est prête', () => {
    const order = {
        items: [{ boutiqueId: 'A' }, { boutiqueId: 'B' }],
        confirmationsBoutiques: [{ boutiqueId: 'B' }, { boutiqueId: 'A' }],
    };

    assert.equal(etatConfirmations(order).toutesConfirmees, true);
});

test('etatConfirmations | plusieurs articles d_une même boutique | une seule confirmation suffit', () => {
    // Le commerçant confirme SA part, pas chaque ligne.
    const order = {
        items: [{ boutiqueId: 'A' }, { boutiqueId: 'A' }, { boutiqueId: 'A' }],
        confirmationsBoutiques: [{ boutiqueId: 'A' }],
    };

    const e = etatConfirmations(order);

    assert.deepEqual(e.attendues, ['A']);
    assert.equal(e.toutesConfirmees, true);
});

test('etatConfirmations | commande sans boutique | est prête sans attendre personne', () => {
    // Catalogue principal uniquement : aucun commerçant à attendre.
    const order = { items: [{ boutiqueId: null }], confirmationsBoutiques: [] };
    assert.equal(etatConfirmations(order).toutesConfirmees, true);
});

test('etatConfirmations | confirmation d_une boutique hors commande | est ignorée', () => {
    // Garde-fou : une confirmation parasite ne doit pas rendre prête une
    // commande dont la vraie boutique n'a rien confirmé.
    const order = {
        items: [{ boutiqueId: 'A' }],
        confirmationsBoutiques: [{ boutiqueId: 'INTRUS' }],
    };

    const e = etatConfirmations(order);

    assert.deepEqual(e.manquantes, ['A']);
    assert.equal(e.toutesConfirmees, false);
});
