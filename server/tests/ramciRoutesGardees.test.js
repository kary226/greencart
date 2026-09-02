import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

import { permissionsDuRole, libelleDuRole } from '../configs/roles.js';

/**
 * TAPER L'URL NE SUFFIT PAS À ENTRER
 * ==================================
 *
 * Masquer une rubrique du menu ne protège rien : l'adresse reste tapable, et
 * l'écran s'affichait — vide ou en erreur, puisque le serveur refusait ses
 * données, mais affiché. Un Auditeur pouvait ouvrir /admin/settings.
 *
 * La garde vit dans client/src/utils/espaces.js. Ce test la relit
 * directement depuis ce fichier, plutôt que d'en recopier la table : une
 * route ajoutée là-bas est couverte ici sans qu'on y pense.
 *
 * Rappel : la vraie protection reste le serveur
 * (middlewares/permission.js). Ce test vérifie la cohérence de l'affichage,
 * pas la sécurité — qui est couverte par ramciAuditeur.test.js et
 * permission.test.js.
 */

const CHEMIN_ESPACES = new URL('../../client/src/utils/espaces.js', import.meta.url);

/** Relit la table DROITS_PAR_ROUTE du module client. */
const lireTableDesRoutes = () => {
    const source = readFileSync(CHEMIN_ESPACES, 'utf8');
    const bloc = source.slice(
        source.indexOf('const DROITS_PAR_ROUTE = ['),
        source.indexOf('];', source.indexOf('const DROITS_PAR_ROUTE = ['))
    );

    const routes = [];
    // ['/admin/x', ['a.b', 'c.d']]  ou  ['/admin/x', null]
    const motif = /\['(\/admin[^']*)',\s*(null|\[[^\]]*\])\]/g;
    let m;
    while ((m = motif.exec(bloc)) !== null) {
        const droits = m[2] === 'null'
            ? null
            : [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
        routes.push([m[1], droits]);
    }
    return routes;
};

/** Relit ROUTES_OUVERTES — les seules adresses ouvertes à tout le staff. */
const lireRoutesOuvertes = () => {
    const source = readFileSync(CHEMIN_ESPACES, 'utf8');
    const ligne = source.match(/const ROUTES_OUVERTES = \[([^\]]*)\]/);
    return ligne ? [...ligne[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
};

const TABLE = lireTableDesRoutes();
const OUVERTES = lireRoutesOuvertes();

/** Reproduit droitsPourChemin() du module client. */
const droitsPourChemin = (chemin) => {
    const propre = chemin.split('?')[0].replace(/\/+$/, '') || '/admin';
    // Comparaison EXACTE : une correspondance par préfixe sur '/admin'
    // rouvrirait toutes les routes inconnues.
    if (OUVERTES.includes(propre)) return null;
    const trouve = TABLE.find(([p]) => propre === p || propre.startsWith(p + '/'));
    return trouve ? trouve[1] : ['admin.all'];
};

const aLeDroit = (role, perms, droits) => {
    if (!droits) return true;
    if (role === 'super_admin' || role === 'admin') return true;
    if (perms.includes('admin.all')) return true;
    return droits.some((d) => perms.includes(d));
};

const ROLES = ['super_admin', 'finance_admin', 'operations_admin', 'catalog_admin', 'read_only_auditor'];

describe('Console — taper l’URL ne suffit pas à entrer', () => {

    it('la table des routes a bien été relue depuis le module client', () => {
        assert.ok(TABLE.length >= 20, `seulement ${TABLE.length} route(s) relue(s) — l'analyse a dû échouer`);
        assert.ok(TABLE.some(([p]) => p === '/admin/settings'), '/admin/settings absent de la table');
    });

    it('la liste des routes ouvertes à tous reste minimale', () => {
        // Chaque entrée ici est un écran que TOUT compte staff peut ouvrir.
        // La liste doit rester courte et se limiter à la page d'accueil.
        assert.ok(OUVERTES.length <= 2, `trop de routes ouvertes : ${OUVERTES.join(', ')}`);
        assert.ok(OUVERTES.includes('/admin/console'));
    });

    it('une route inconnue est refusée, jamais ouverte par défaut', () => {
        // Un écran ajouté demain sans être déclaré doit se signaler tout de
        // suite, pas s'ouvrir discrètement à tout le monde.
        const droits = droitsPourChemin('/admin/un-ecran-jamais-declare');
        assert.deepStrictEqual(droits, ['admin.all']);

        const auditeur = permissionsDuRole('read_only_auditor');
        assert.strictEqual(aLeDroit('read_only_auditor', auditeur, droits), false);
    });

    describe('l’Auditeur est tenu hors des écrans qui ne le concernent pas', () => {
        const perms = permissionsDuRole('read_only_auditor');
        const interdits = [
            '/admin/settings', '/admin/staff', '/admin/products/add',
            '/admin/categories', '/admin/coupons', '/admin/locations',
            '/admin/deliveries', '/admin/commandes', '/admin/colis-shein',
        ];
        for (const chemin of interdits) {
            it(chemin, () => {
                assert.strictEqual(
                    aLeDroit('read_only_auditor', perms, droitsPourChemin(chemin)), false,
                    `${chemin} devrait lui être refusé`
                );
            });
        }
    });

    describe('mais il garde ce qui est son métier', () => {
        const perms = permissionsDuRole('read_only_auditor');
        for (const chemin of ['/admin/audit', '/admin/console', '/admin/approvals', '/admin/orders', '/admin/wallets']) {
            it(chemin, () => {
                assert.strictEqual(
                    aLeDroit('read_only_auditor', perms, droitsPourChemin(chemin)), true,
                    `${chemin} devrait lui rester ouvert`
                );
            });
        }
    });

    it('Finance n’entre pas dans l’entrepôt ni le catalogue', () => {
        const perms = permissionsDuRole('finance_admin');
        for (const chemin of ['/admin/warehouse', '/admin/products/add', '/admin/locations', '/admin/settings']) {
            assert.strictEqual(aLeDroit('finance_admin', perms, droitsPourChemin(chemin)), false, chemin);
        }
    });

    it('Opérations n’entre pas dans la finance', () => {
        const perms = permissionsDuRole('operations_admin');
        for (const chemin of ['/admin/wallets', '/admin/withdrawals', '/admin/refunds', '/admin/reconciliation']) {
            assert.strictEqual(aLeDroit('operations_admin', perms, droitsPourChemin(chemin)), false, chemin);
        }
    });

    it('Catalogue reste dans le catalogue', () => {
        const perms = permissionsDuRole('catalog_admin');
        for (const chemin of ['/admin/orders', '/admin/wallets', '/admin/warehouse', '/admin/clients', '/admin/audit']) {
            assert.strictEqual(aLeDroit('catalog_admin', perms, droitsPourChemin(chemin)), false, chemin);
        }
        for (const chemin of ['/admin/products', '/admin/products/add', '/admin/categories', '/admin/banners', '/admin/coupons']) {
            assert.strictEqual(aLeDroit('catalog_admin', perms, droitsPourChemin(chemin)), true, chemin);
        }
    });

    it('le Super Admin entre partout', () => {
        const perms = permissionsDuRole('super_admin');
        for (const [chemin] of TABLE) {
            assert.strictEqual(aLeDroit('super_admin', perms, droitsPourChemin(chemin)), true, chemin);
        }
    });

    it('chaque rôle garde au moins sa page d’accueil', () => {
        for (const role of ROLES) {
            const perms = permissionsDuRole(role);
            assert.strictEqual(
                aLeDroit(role, perms, droitsPourChemin('/admin/console')), true,
                `${libelleDuRole(role)} ne peut pas ouvrir sa propre console`
            );
        }
    });

    it('l’alias /admin/retraits exige le même droit que /admin/withdrawals', () => {
        assert.deepStrictEqual(
            droitsPourChemin('/admin/retraits'),
            droitsPourChemin('/admin/withdrawals')
        );
    });

    it('les sous-pages héritent du droit de leur écran', () => {
        assert.deepStrictEqual(droitsPourChemin('/admin/returns/abc123'), droitsPourChemin('/admin/returns'));
        assert.deepStrictEqual(droitsPourChemin('/admin/rcoins/transactions'), droitsPourChemin('/admin/rcoins'));
        assert.deepStrictEqual(droitsPourChemin('/admin/warehouse/scans'), droitsPourChemin('/admin/warehouse'));
    });
});
