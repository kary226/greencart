import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { permissionsDuRole, libelleDuRole, TOUTES_PERMISSIONS } from '../configs/roles.js';
import { aUnDesDroits } from '../middlewares/permission.js';

/**
 * LES ROUTES PROTÈGENT DES ACTIONS, PAS DES PERSONNES  —  Guide §16
 * =================================================================
 *
 * 42 routes d'administration exigeaient littéralement le rôle
 * `admin` ou `super_admin`. Conséquences constatées :
 *
 *   · un Admin Finance avec `orders.approve` ne pouvait pas libérer les
 *     fonds d'une commande — la route ne regardait pas ses permissions ;
 *   · sept routes SHEIN listaient `admin` SANS `super_admin` : migrer le
 *     compte principal vers super_admin, ce que le guide recommande, lui
 *     aurait fait perdre ces écrans du jour au lendemain.
 *
 * Ce test lit les fichiers de routes et vérifie qu'aucune route
 * d'administration n'est revenue à un contrôle par rôle.
 */

const dossierRoutes = new URL('../routes/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Relève chaque route et ce qu'elle exige. */
const routes = () => {
    const trouvees = [];
    for (const fichier of readdirSync(dossierRoutes).filter((f) => f.endsWith('.js'))) {
        const source = readFileSync(join(dossierRoutes, fichier), 'utf8');
        for (const ligne of source.split('\n')) {
            const appel = ligne.match(/\.(get|post|patch|put|delete)\(\s*'([^']+)'/);
            if (!appel) continue;

            const role = ligne.match(/requireRole\(([^)]*)\)/);
            const perms = [...ligne.matchAll(/require(?:Any)?Permission\(\[?([^\])]*)\]?\)/g)]
                .flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));

            trouvees.push({
                fichier,
                methode: appel[1].toUpperCase(),
                chemin: appel[2],
                roles: role ? [...role[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : null,
                permissions: perms.length ? perms : null,
            });
        }
    }
    return trouvees;
};

const TOUTES = routes();

describe('Routes — protéger des actions, pas des personnes', () => {

    it('l’analyse a bien relu les fichiers de routes', () => {
        assert.ok(TOUTES.length > 150, `seulement ${TOUTES.length} route(s) relue(s)`);
    });

    it('aucune route d’administration n’est gardée par un rôle', () => {
        // Les rôles `commercant` et `livreur` restent contrôlés par rôle :
        // ce sont des acteurs externes dont les routes filtrent sur LEURS
        // données (leur boutique, leurs livraisons), pas sur une capacité.
        const ACTEURS_EXTERNES = ['commercant', 'livreur'];

        const fautives = TOUTES
            .filter((r) => r.roles)
            .filter((r) => !r.roles.every((role) => ACTEURS_EXTERNES.includes(role)))
            .map((r) => `${r.methode} ${r.chemin} (${r.fichier}) → requireRole(${r.roles.join(', ')})`);

        assert.deepStrictEqual(fautives, [],
            `Ces routes vérifient un rôle au lieu d'une permission :\n  ${fautives.join('\n  ')}`);
    });

    it('aucune route n’exige une permission qui n’existe pas', () => {
        // Une permission mal orthographiée ne se voit qu'en production, sous
        // la forme d'un 403 que personne ne sait expliquer.
        const inventees = [];
        for (const r of TOUTES) {
            for (const p of r.permissions || []) {
                if (!TOUTES_PERMISSIONS.includes(p)) {
                    inventees.push(`${r.methode} ${r.chemin} (${r.fichier}) → ${p}`);
                }
            }
        }
        assert.deepStrictEqual(inventees, [], `Permissions inconnues :\n  ${inventees.join('\n  ')}`);
    });

    it('le Super Admin passe toutes les routes d’administration', () => {
        const perms = permissionsDuRole('super_admin');
        const bloque = TOUTES
            .filter((r) => r.permissions)
            .filter((r) => !aUnDesDroits({ role: 'super_admin', permissions: perms }, r.permissions))
            .map((r) => `${r.methode} ${r.chemin}`);

        assert.deepStrictEqual(bloque, [], `Le Super Admin est bloqué sur :\n  ${bloque.join('\n  ')}`);
    });

    it('le rôle historique « admin » passe exactement les mêmes routes', () => {
        // Le piège corrigé : sept routes listaient `admin` sans
        // `super_admin`. Les deux comptes doivent voir le même système,
        // sinon la migration de l'un vers l'autre casse quelque chose.
        const sa = permissionsDuRole('super_admin');
        const an = permissionsDuRole('admin');
        const ecarts = TOUTES
            .filter((r) => r.permissions)
            .filter((r) =>
                aUnDesDroits({ role: 'super_admin', permissions: sa }, r.permissions)
                !== aUnDesDroits({ role: 'admin', permissions: an }, r.permissions))
            .map((r) => `${r.methode} ${r.chemin}`);

        assert.deepStrictEqual(ecarts, [], `Écart entre admin et super_admin :\n  ${ecarts.join('\n  ')}`);
    });

    describe('chaque domaine atteint ce qui le concerne', () => {
        const CAS = [
            ['finance_admin', '/admin/a-valider', 'orders.approve', true],
            ['finance_admin', '/admin/confirmer', 'orders.approve', true],
            ['operations_admin', '/admin/assigner-livreur', 'deliveries.assign', true],
            ['catalog_admin', '/staff/update', 'catalog.edit', true],
            ['catalog_admin', '/staff/delete', 'catalog.delete', true],
            ['read_only_auditor', '/journal', 'audit.view', true],
            ['assistant_shein', '/all', 'shein.view', true],
            ['assistant_shein', '/:id/statut', 'shein.update', true],
        ];
        for (const [role, libelle, permission, attendu] of CAS) {
            it(`${libelleDuRole(role)} → ${libelle}`, () => {
                const perms = permissionsDuRole(role);
                assert.strictEqual(
                    aUnDesDroits({ role, permissions: perms }, [permission]), attendu,
                    `${role} devrait ${attendu ? '' : 'ne pas '}avoir ${permission}`
                );
            });
        }
    });

    describe('et personne ne déborde de son domaine', () => {
        const INTERDITS = [
            ['finance_admin', 'catalog.delete'],
            ['finance_admin', 'admin.configure'],
            ['finance_admin', 'exceptions.decide'],
            ['operations_admin', 'wallet.adjust'],
            ['operations_admin', 'admin.configure'],
            ['operations_admin', 'exceptions.decide'],
            ['catalog_admin', 'orders.approve'],
            ['catalog_admin', 'wallet.view'],
            ['read_only_auditor', 'admin.configure'],
            ['read_only_auditor', 'exceptions.decide'],
            ['assistant_shein', 'admin.configure'],
            ['assistant_shein', 'catalog.edit'],
        ];
        for (const [role, permission] of INTERDITS) {
            it(`${libelleDuRole(role)} n’a pas ${permission}`, () => {
                const perms = permissionsDuRole(role);
                assert.strictEqual(aUnDesDroits({ role, permissions: perms }, [permission]), false);
            });
        }
    });

    it('résoudre un litige reste un arbitrage', () => {
        // §12 : « Le Super Admin décide ; les équipes exécutent. » Résoudre
        // un litige crée une dette commerçant ou un remboursement
        // exceptionnel — ce n'est pas une opération courante.
        const route = TOUTES.find((r) => r.chemin === '/admin/litige/resoudre');
        assert.ok(route, 'route de résolution de litige introuvable');
        assert.deepStrictEqual(route.permissions, ['exceptions.decide']);

        for (const role of ['finance_admin', 'operations_admin', 'read_only_auditor']) {
            assert.strictEqual(
                aUnDesDroits({ role, permissions: permissionsDuRole(role) }, route.permissions), false,
                `${role} ne doit pas pouvoir résoudre un litige`
            );
        }
    });
});
