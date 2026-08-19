import test from 'node:test';
import assert from 'node:assert/strict';
import {
    schemaStock,
    schemaInvitation,
    schemaConnexionStaff,
    schemaStatutBoutique,
    schemaAffectationBoutique,
} from '../schemas/index.js';

// Les schémas font office de liste blanche à la frontière HTTP : ce qui
// n'est pas déclaré n'atteint jamais le contrôleur. Ces tests vérifient
// surtout ce qui doit être REFUSÉ.

const ID_VALIDE = '507f1f77bcf86cd799439011';

test('schemaStock | quantité négative | est refusée', () => {
    // Arrange & Act
    const resultat = schemaStock.safeParse({ id: ID_VALIDE, stock: -3 });

    // Assert
    assert.equal(resultat.success, false);
});

test('schemaStock | identifiant qui n_est pas un ObjectId | est refusé', () => {
    const resultat = schemaStock.safeParse({ id: 'pas-un-id', stock: 1 });
    assert.equal(resultat.success, false);
});

test('schemaStock | champ non déclaré | est retiré de la requête', () => {
    // Arrange : tentative d'écrire un champ interne via l'endpoint de stock
    const entree = { id: ID_VALIDE, stock: 2, isArchived: true, price: 1 };

    // Act
    const resultat = schemaStock.safeParse(entree);

    // Assert
    assert.equal(resultat.success, true);
    assert.equal(resultat.data.isArchived, undefined);
    assert.equal(resultat.data.price, undefined);
});

test('schemaStock | quantités de variantes valides | sont acceptées', () => {
    const resultat = schemaStock.safeParse({
        id: ID_VALIDE,
        variants: [{ color: 'Rouge', size: 'M', stock: 4 }],
    });
    assert.equal(resultat.success, true);
    assert.equal(resultat.data.variants[0].stock, 4);
});

test('schemaInvitation | rôle inventé | est refusé', () => {
    // Sans ça, un rôle inconnu se retrouvait en base et n_était contrôlé nulle part.
    const resultat = schemaInvitation.safeParse({ email: 'a@b.ci', role: 'superadmin' });
    assert.equal(resultat.success, false);
});

test('schemaInvitation | e-mail avec majuscules et espaces | est normalisé', () => {
    const resultat = schemaInvitation.safeParse({ email: '  Admin@Ramci.CI ', role: 'commercant' });
    assert.equal(resultat.success, true);
    assert.equal(resultat.data.email, 'admin@ramci.ci');
});

test('schemaConnexionStaff | code 2FA non numérique | est refusé', () => {
    const resultat = schemaConnexionStaff.safeParse({
        email: 'a@b.ci', password: 'x', totpCode: 'abcdef',
    });
    assert.equal(resultat.success, false);
});

test('schemaConnexionStaff | injection NoSQL dans le mot de passe | est refusée', () => {
    // { $ne: null } comme mot de passe est l_attaque classique sur Mongo.
    const resultat = schemaConnexionStaff.safeParse({
        email: 'a@b.ci', password: { $ne: null }, totpCode: '123456',
    });
    assert.equal(resultat.success, false);
});

test('schemaStatutBoutique | statut hors liste | est refusé', () => {
    assert.equal(schemaStatutBoutique.safeParse({ statut: 'fermee' }).success, false);
    assert.equal(schemaStatutBoutique.safeParse({ statut: 'suspendue' }).success, true);
});

test('schemaAffectationBoutique | boutique vide | vaut retour au catalogue principal', () => {
    const resultat = schemaAffectationBoutique.safeParse({ id: ID_VALIDE, boutiqueId: '' });
    assert.equal(resultat.success, true);
    assert.equal(resultat.data.boutiqueId, '');
});
