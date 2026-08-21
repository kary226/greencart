import test from 'node:test';
import assert from 'node:assert/strict';
import {
    repartirCommission,
    partCommercant,
    partPlateforme,
    prixAffichePourNet,
    TAUX_COMMISSION,
} from '../services/commissionService.js';

// La commission décide de ce que touche réellement chaque commerçant sur
// chaque vente. Une erreur ici ne se voit pas à l'œil nu et se répète sur
// toutes les transactions — d'où le niveau de détail de ces tests.

test('repartirCommission | cas de référence 11 000 | le commerçant touche 10 000', () => {
    // Arrange : l'exemple métier de référence — 10 000 + 10 % = 11 000
    const encaisse = 11000;

    // Act
    const r = repartirCommission(encaisse);

    // Assert
    assert.equal(r.net, 10000);
    assert.equal(r.commission, 1000);
});

test('repartirCommission | taux appliqué EN PLUS du prix, pas prélevé dessus', () => {
    // Le piège : 10 % DE 11 000 donnerait 9 900 au commerçant. Le modèle
    // retenu est « marge ajoutée », donc 10 000.
    assert.equal(partCommercant(11000), 10000);
    assert.notEqual(partCommercant(11000), 9900);
});

test('repartirCommission | net + commission | retombe toujours sur le montant encaissé', () => {
    // Propriété essentielle : aucun franc ne doit apparaître ni disparaître.
    for (const montant of [1, 7, 99, 333, 1000, 4999, 10000, 11000, 12345, 99999, 1000000]) {
        const r = repartirCommission(montant);
        assert.equal(r.net + r.commission, montant, `échec sur ${montant}`);
    }
});

test('repartirCommission | montant non divisible | arrondit sans perdre de franc', () => {
    // 10 000 / 1,1 = 9090,909… : on arrondit le net, la commission absorbe
    // le reste.
    const r = repartirCommission(10000);
    assert.equal(r.net, 9091);
    assert.equal(r.commission, 909);
    assert.equal(r.net + r.commission, 10000);
});

test('repartirCommission | montant nul | ne produit ni net ni commission', () => {
    const r = repartirCommission(0);
    assert.deepEqual(r, { net: 0, commission: 0, brut: 0 });
});

test('repartirCommission | valeur absurde ou manquante | est ramenée à zéro', () => {
    assert.equal(repartirCommission(undefined).net, 0);
    assert.equal(repartirCommission('abc').net, 0);
    assert.equal(repartirCommission(-5000).net, 0, 'un montant négatif ne crédite jamais');
});

test('repartirCommission | la plateforme garde environ 9 % du prix affiché', () => {
    // 1 000 / 11 000 = 9,09 % — la formulation « 10 % » porte sur le prix
    // du commerçant, pas sur le prix affiché. Vérification explicite pour
    // que personne ne « corrige » la formule un jour par erreur.
    const r = repartirCommission(11000);
    const partAffichee = r.commission / r.brut;
    assert.ok(partAffichee > 0.09 && partAffichee < 0.0910, `part=${partAffichee}`);
});

test('partPlateforme | complète exactement la part du commerçant', () => {
    assert.equal(partCommercant(50000) + partPlateforme(50000), 50000);
});

test('prixAffichePourNet | montant souhaité par le commerçant | donne le prix client', () => {
    // Le commerçant veut toucher 10 000 : l'article doit être affiché 11 000.
    assert.equal(prixAffichePourNet(10000), 11000);
    assert.equal(prixAffichePourNet(25000), 27500);
});

test('prixAffichePourNet | aller-retour | reste cohérent', () => {
    // Ce qu'il veut toucher -> prix affiché -> ce qu'il touche vraiment.
    for (const souhaite of [1000, 5000, 10000, 22000, 137000]) {
        const affiche = prixAffichePourNet(souhaite);
        assert.equal(partCommercant(affiche), souhaite, `échec sur ${souhaite}`);
    }
});

test('TAUX_COMMISSION | vaut bien 10 %', () => {
    assert.equal(TAUX_COMMISSION, 0.10);
});
