import test from 'node:test';
import assert from 'node:assert/strict';
import { acteurDepuisRequete } from '../middlewares/authActeur.js';

// L'acteur porte le rôle qui décide de TOUS les droits en aval (publier un
// article, l'attribuer à une boutique, en changer le stock). Sa construction
// est donc de la logique de sécurité, et mérite d'être verrouillée par des
// tests plutôt que vérifiée à la lecture.

test('acteurDepuisRequete | requête non authentifiée | renvoie null', () => {
    // Arrange
    const req = {};

    // Act & Assert
    assert.equal(acteurDepuisRequete(req), null);
});

test('acteurDepuisRequete | session staff commerçant | conserve le rôle et la boutique', () => {
    // Arrange
    const req = {
        staffUser: { _id: 'abc', role: 'commercant', boutiqueId: 'boutique-1', nom: 'Mariette' },
    };

    // Act
    const acteur = acteurDepuisRequete(req);

    // Assert
    assert.equal(acteur.type, 'staff');
    assert.equal(acteur.role, 'commercant');
    assert.equal(acteur.boutiqueId, 'boutique-1');
});

test('acteurDepuisRequete | staff sans boutique | expose boutiqueId à null et non undefined', () => {
    // La distinction compte : `undefined` traverse silencieusement un test
    // de vérité, `null` est explicite dans les comparaisons en aval.
    const acteur = acteurDepuisRequete({ staffUser: { _id: 'a', role: 'admin', nom: 'Admin' } });
    assert.equal(acteur.boutiqueId, null);
});

test('acteurDepuisRequete | compte technique vendeur | est traité comme un admin sans boutique', () => {
    // Arrange
    const req = { isTechnicalSeller: true };

    // Act
    const acteur = acteurDepuisRequete(req);

    // Assert
    assert.equal(acteur.role, 'admin', 'le compte vendeur a les pouvoirs d_un admin');
    assert.equal(acteur.type, 'vendeur_technique', 'mais son origine reste traçable');
    assert.equal(acteur.boutiqueId, null);
});

test('acteurDepuisRequete | acteur déjà normalisé | est renvoyé tel quel', () => {
    // Arrange : requête passée par le nouveau middleware
    const acteur = { type: 'staff', id: '1', role: 'livreur', boutiqueId: null, nom: 'Livreur' };

    // Act & Assert
    assert.equal(acteurDepuisRequete({ acteur }), acteur);
});

test('acteurDepuisRequete | session staff ET drapeau vendeur | la session staff prime', () => {
    // Un navigateur peut porter les deux cookies. Le staff est le système
    // cible : c'est lui qui doit l'emporter, avec son rôle réel.
    const req = {
        staffUser: { _id: 'x', role: 'commercant', boutiqueId: 'b1', nom: 'X' },
        isTechnicalSeller: true,
    };

    const acteur = acteurDepuisRequete(req);

    assert.equal(acteur.role, 'commercant', 'le rôle ne doit pas être élargi à admin');
});
