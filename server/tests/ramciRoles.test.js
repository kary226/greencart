import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
    ROLES,
    NOMS_ROLES,
    PERMISSIONS,
    TOUTES_PERMISSIONS,
    ROLES_ARBITRE,
    permissionsDuRole,
    libelleDuRole,
    domaineDuRole,
    roleADroit,
} from '../configs/roles.js';
import { aLeDroit, aUnDesDroits } from '../middlewares/permission.js';

/**
 * Guide RAMCI §3, §16 — rôles et permissions.
 *
 * Ce fichier protège trois choses qui, si elles cassent, ne se voient qu'en
 * production sous la forme d'un 403 inexplicable :
 *   - aucune permission inventée dans un rôle ;
 *   - le Super Admin passe partout, l'Auditeur ne modifie rien ;
 *   - trancher une exception reste un droit rare.
 */

describe('RAMCI §3/§16 — rôles et permissions', () => {

    describe('catalogue de permissions', () => {
        it('toute permission listée dans un rôle existe dans le catalogue', () => {
            for (const nom of NOMS_ROLES) {
                for (const permission of permissionsDuRole(nom)) {
                    assert.ok(
                        TOUTES_PERMISSIONS.includes(permission),
                        `Le rôle « ${nom} » référence une permission inconnue : ${permission}`
                    );
                }
            }
        });

        it('aucune permission dupliquée à l’intérieur d’un rôle', () => {
            for (const nom of NOMS_ROLES) {
                const perms = permissionsDuRole(nom);
                assert.strictEqual(
                    new Set(perms).size, perms.length,
                    `Le rôle « ${nom} » contient des doublons`
                );
            }
        });

        it('chaque rôle a un libellé et un domaine', () => {
            for (const nom of NOMS_ROLES) {
                assert.ok(libelleDuRole(nom), `« ${nom} » n'a pas de libellé`);
                assert.notStrictEqual(domaineDuRole(nom), 'inconnu', `« ${nom} » n'a pas de domaine`);
            }
        });
    });

    describe('§0 — le terme « Seller » a disparu de l’interface', () => {
        it('aucun libellé de rôle ne contient « Seller »', () => {
            for (const nom of NOMS_ROLES) {
                assert.ok(
                    !/seller/i.test(libelleDuRole(nom)),
                    `Le rôle « ${nom} » s'affiche encore comme « ${libelleDuRole(nom)} »`
                );
            }
        });

        it('le compte historique « admin » s’affiche comme Super Admin', () => {
            assert.strictEqual(libelleDuRole('admin'), 'Super Admin');
        });
    });

    describe('§1 — le Super Admin a l’autorité finale', () => {
        it('possède admin.all', () => {
            assert.ok(permissionsDuRole('super_admin').includes(PERMISSIONS.ADMIN_ALL));
        });

        it('a le droit de faire tout ce que les autres rôles peuvent faire', () => {
            for (const nom of NOMS_ROLES) {
                for (const permission of permissionsDuRole(nom)) {
                    assert.ok(
                        roleADroit('super_admin', permission),
                        `Le Super Admin devrait pouvoir ${permission}`
                    );
                }
            }
        });

        it('passe les middlewares même sans la permission listée', () => {
            const superAdmin = { role: 'super_admin', permissions: ['admin.all'] };
            assert.strictEqual(aLeDroit(superAdmin, PERMISSIONS.RETURNS_DECIDE), true);
            assert.strictEqual(aUnDesDroits(superAdmin, [PERMISSIONS.SHEIN_UPDATE]), true);
        });
    });

    describe('§3 — chaque rôle reste dans son domaine', () => {
        it('Finance ne réceptionne pas les colis', () => {
            assert.strictEqual(roleADroit('finance_admin', PERMISSIONS.ORDERS_RECEIVE), false);
        });

        it('Opérations ne touche pas aux portefeuilles', () => {
            assert.strictEqual(roleADroit('operations_admin', PERMISSIONS.WALLET_ADJUST), false);
        });

        it('Support n’ajuste pas seul la finance', () => {
            assert.strictEqual(roleADroit('support_admin', PERMISSIONS.WALLET_ADJUST), false);
            assert.strictEqual(roleADroit('support_admin', PERMISSIONS.REFUNDS_APPROVE), false);
        });

        it('l’Auditeur ne modifie rien : aucune permission d’écriture', () => {
            const ecriture = /\.(adjust|create|edit|delete|approve|decide|process|reject|assign|configure|scan|inspect|ship|receive|request|respond|open|all)$/;
            for (const permission of permissionsDuRole('read_only_auditor')) {
                assert.ok(
                    !ecriture.test(permission),
                    `L'Auditeur ne devrait pas avoir « ${permission} »`
                );
            }
        });
    });

    describe('§13 — trancher une exception est un droit rare', () => {
        it('aucun rôle de domaine ne possède exceptions.decide', () => {
            const domaines = ['finance_admin', 'operations_admin', 'support_admin', 'catalog_admin', 'read_only_auditor'];
            for (const nom of domaines) {
                assert.ok(
                    !permissionsDuRole(nom).includes(PERMISSIONS.EXCEPTIONS_DECIDE),
                    `« ${nom} » ne doit pas pouvoir trancher une exception`
                );
            }
        });

        it('les domaines peuvent en revanche DEMANDER une exception', () => {
            for (const nom of ['finance_admin', 'operations_admin', 'support_admin']) {
                assert.ok(
                    permissionsDuRole(nom).includes(PERMISSIONS.EXCEPTIONS_REQUEST),
                    `« ${nom} » doit pouvoir remonter un dossier`
                );
            }
        });

        it('la liste des arbitres reste courte', () => {
            assert.ok(ROLES_ARBITRE.length <= 2, 'trop de rôles peuvent trancher');
            assert.ok(ROLES_ARBITRE.includes('super_admin'));
        });
    });

    describe('§3 — Admin Opérations couvre entrepôt ET logistique', () => {
        it('reprend toutes les permissions de warehouse_admin', () => {
            for (const permission of permissionsDuRole('warehouse_admin')) {
                assert.ok(
                    permissionsDuRole('operations_admin').includes(permission),
                    `operations_admin devrait couvrir ${permission}`
                );
            }
        });

        it('reprend toutes les permissions de logistics_admin', () => {
            for (const permission of permissionsDuRole('logistics_admin')) {
                assert.ok(
                    permissionsDuRole('operations_admin').includes(permission),
                    `operations_admin devrait couvrir ${permission}`
                );
            }
        });

        it('les deux anciens rôles pointent vers leur remplaçant', () => {
            assert.strictEqual(ROLES.warehouse_admin.deprecie, 'operations_admin');
            assert.strictEqual(ROLES.logistics_admin.deprecie, 'operations_admin');
        });
    });
});
