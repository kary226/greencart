import test from 'node:test';
import assert from 'node:assert/strict';

// Test de fumée : chaque routeur doit se charger, donc tout son graphe
// d'imports (contrôleurs, middlewares, modèles, services) doit être
// résoluble. Un `export` renommé ou un fichier déplacé casse ici, en une
// seconde, plutôt qu'au premier appel en production.
//
// Aucune connexion à MongoDB n'est nécessaire : définir un modèle Mongoose
// ne demande pas de connexion.

// Les modules lisent l'environnement au chargement ; on fournit des valeurs
// factices plutôt que d'exiger un vrai .env en CI.
process.env.JWT_SECRET ||= 'secret-de-test-suffisamment-long-pour-passer';
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';

const ROUTEURS = [
    '../routes/productRoute.js',
    '../routes/staffRoute.js',
    '../routes/boutiqueRoute.js',
    '../routes/couponRoute.js',
    '../routes/retraitRoute.js',
    '../routes/orderRoute.js',
    '../routes/userRoute.js',
    '../routes/walletRoute.js',
];

for (const chemin of ROUTEURS) {
    const nom = chemin.split('/').pop();

    test(`chargement | ${nom} | expose un routeur Express utilisable`, async () => {
        // Act
        const module = await import(chemin);

        // Assert
        assert.ok(module.default, `${nom} doit avoir un export par défaut`);
        assert.equal(typeof module.default, 'function', 'un routeur Express est une fonction middleware');
    });
}

test('chargement | middlewares d_authentification | exposent leurs fonctions', async () => {
    // Act
    // [RAMCI §2, §17.2] authSeller.js a disparu avec la migration
    // Seller -> staff, mais ce test l'importait encore : la suite était
    // rouge en permanence, donc plus personne ne lisait ses échecs. Un
    // vestige de nommage qui coûtait la confiance dans les tests entiers.
    const [staff, acteur, permission, boutiqueActive] = await Promise.all([
        import('../middlewares/authStaff.js'),
        import('../middlewares/authActeur.js'),
        import('../middlewares/permission.js'),
        import('../middlewares/requireBoutiqueActive.js'),
    ]);

    // Assert
    assert.equal(typeof staff.default, 'function');
    assert.equal(typeof staff.requireRole, 'function');
    assert.equal(typeof acteur.default, 'function');
    assert.equal(typeof acteur.requireRoleActeur, 'function');
    assert.equal(typeof permission.requirePermission, 'function');
    assert.equal(typeof permission.requireArbitre, 'function');
    assert.equal(typeof boutiqueActive.default, 'function');
});

test('chargement | AppError | distingue erreur métier et bug', async () => {
    // Arrange
    const { AppError, estOperationnelle, erreurAcces } = await import('../utils/AppError.js');

    // Act
    const metier = new AppError('Boutique suspendue', 403);
    const bug = new TypeError('lecture de undefined');

    // Assert
    assert.equal(estOperationnelle(metier), true);
    assert.equal(estOperationnelle(bug), false, 'un bug ne doit jamais être renvoyé tel quel au client');
    assert.equal(erreurAcces().statusCode, 403);
});
