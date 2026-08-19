import test from 'node:test';
import assert from 'node:assert/strict';
import { echapperRegex, construireFiltreRecherche } from '../utils/recherche.js';

// Ce module reçoit directement de la saisie utilisateur non authentifiée et
// la transmet au moteur de base de données : c'est un point de sécurité,
// pas seulement de confort.

test('echapperRegex | motif à explosion combinatoire | est neutralisé en texte littéral', () => {
    // Arrange : motif ReDoS classique
    const saisie = '(a+)+$';

    // Act
    const echappe = echapperRegex(saisie);

    // Assert : plus aucun quantificateur actif, et le motif ne matche que
    // lui-même — donc aucune explosion possible.
    assert.equal(echappe, '\\(a\\+\\)\\+\\$');
    assert.ok(new RegExp(echappe).test('(a+)$') === false);
    assert.ok(new RegExp(echappe).test('(a+)+$'));
});

test('echapperRegex | joker saisi par un visiteur | ne devient pas un joker actif', () => {
    // Arrange
    const echappe = echapperRegex('.*');

    // Act & Assert : « .* » ne doit plus matcher n'importe quoi
    assert.equal(new RegExp(echappe).test('robe rouge'), false);
    assert.equal(new RegExp(echappe).test('.*'), true);
});

test('construireFiltreRecherche | recherche simple | cherche sur le nom et le code article', () => {
    // Arrange & Act
    const filtre = construireFiltreRecherche({ search: 'robe' });

    // Assert
    assert.equal(filtre.$or.length, 2);
    assert.equal(filtre.$or[0].name.$regex, 'robe');
    assert.equal(filtre.$or[1].sku.$regex, 'robe');
    assert.equal(filtre.$or[0].name.$options, 'i');
});

test('construireFiltreRecherche | recherche vide ou espaces | n_ajoute aucun critère', () => {
    assert.deepEqual(construireFiltreRecherche({ search: '   ' }), {});
    assert.deepEqual(construireFiltreRecherche({}), {});
});

test('construireFiltreRecherche | recherche très longue | est tronquée à 100 caractères', () => {
    // Arrange
    const saisie = 'a'.repeat(500);

    // Act
    const filtre = construireFiltreRecherche({ search: saisie });

    // Assert
    assert.equal(filtre.$or[0].name.$regex.length, 100);
});

test('construireFiltreRecherche | fourchette de prix | borne le prix promotionnel', () => {
    // Arrange & Act
    const filtre = construireFiltreRecherche({ minPrice: '1000', maxPrice: '5000' });

    // Assert
    assert.deepEqual(filtre.offerPrice, { $gte: 1000, $lte: 5000 });
});

test('construireFiltreRecherche | prix non numérique | est ignoré plutôt que compté zéro', () => {
    // Un « abc » converti en 0 aurait silencieusement filtré tout le catalogue.
    const filtre = construireFiltreRecherche({ minPrice: 'abc' });
    assert.equal(filtre.offerPrice, undefined);
});

test('construireFiltreRecherche | prix négatif | est ignoré', () => {
    const filtre = construireFiltreRecherche({ minPrice: '-100' });
    assert.equal(filtre.offerPrice, undefined);
});

test('construireFiltreRecherche | catégorie fournie | filtre sur les catégories', () => {
    const filtre = construireFiltreRecherche({ category: 'robes' });
    assert.equal(filtre.categories, 'robes');
});

test('construireFiltreRecherche | search non textuel | est ignoré sans lever d_erreur', () => {
    // Un client peut envoyer ?search[$ne]= — Express produit alors un objet.
    assert.deepEqual(construireFiltreRecherche({ search: { $ne: null } }), {});
});
