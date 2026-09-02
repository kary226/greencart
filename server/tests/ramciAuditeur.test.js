import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { permissionsDuRole, PERMISSIONS } from '../configs/roles.js';
import { aUnDesDroits } from '../middlewares/permission.js';

/**
 * L'AUDITEUR NE MODIFIE RIEN  —  Guide RAMCI §3, §16
 * ==================================================
 *
 * Le test de ramciRoles.test.js vérifie que le rôle ne PORTE aucune
 * permission d'écriture. Il passait, et pourtant l'Auditeur pouvait créer
 * un dossier de retour : le trou n'était pas dans le rôle mais dans la
 * ROUTE, qui acceptait `returns.view` — une permission de lecture — pour
 * une action d'écriture.
 *
 * Vérifier un rôle ne suffit donc pas : il faut vérifier ce que les routes
 * acceptent réellement. C'est ce que fait ce fichier, en lisant les
 * fichiers de routes plutôt qu'en faisant confiance à une liste tenue à la
 * main — une route ajoutée demain est couverte sans qu'on y pense.
 */

/** Permissions de LECTURE : elles ne doivent jamais ouvrir une écriture. */
const LECTURE_SEULE = [
    PERMISSIONS.AUDIT_VIEW, PERMISSIONS.AUDIT_EXPORT,
    PERMISSIONS.WALLET_VIEW, PERMISSIONS.WALLET_TRANSACTIONS,
    PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_VIEW_OWN,
    PERMISSIONS.CATALOG_VIEW, PERMISSIONS.RETURNS_VIEW,
    PERMISSIONS.REFUNDS_VIEW, PERMISSIONS.WITHDRAWALS_VIEW,
    PERMISSIONS.EXCEPTIONS_VIEW, PERMISSIONS.CLIENTS_VIEW,
    PERMISSIONS.DISPUTES_VIEW, PERMISSIONS.DELIVERIES_VIEW,
    PERMISSIONS.DELIVERY_ZONES_VIEW, PERMISSIONS.RCOINS_VIEW,
    PERMISSIONS.COMMISSION_VIEW, PERMISSIONS.SHOP_VIEW,
    PERMISSIONS.SHEIN_VIEW, PERMISSIONS.ADMIN_DASHBOARD,
];

const dossierRoutes = new URL('../routes/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/**
 * Relève les routes d'écriture et les permissions qu'elles acceptent.
 * Analyse volontairement simple : on lit chaque appel `router.post|patch|
 * put|delete(...)` jusqu'à sa parenthèse fermante, et on y cherche les
 * permissions citées.
 */
const routesDEcriture = () => {
    const trouvees = [];

    for (const fichier of readdirSync(dossierRoutes).filter((f) => f.endsWith('.js'))) {
        const source = readFileSync(join(dossierRoutes, fichier), 'utf8');
        const motif = /(\w+)\.(post|patch|put|delete)\s*\(([\s\S]*?)\n\)/g;
        let m;

        while ((m = motif.exec(source)) !== null) {
            const [, , methode, corps] = m;

            // Permissions citées littéralement ('x.y') ou via P.CONSTANTE.
            const litterales = [...corps.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map((x) => x[1]);
            const constantes = [...corps.matchAll(/\bP\.([A-Z_]+)\b/g)]
                .map((x) => PERMISSIONS[x[1]])
                .filter(Boolean);

            const acceptees = [...new Set([...litterales, ...constantes])];
            if (acceptees.length === 0) continue;

            const chemin = (corps.match(/'([^']*)'/) || [])[1] || '?';
            trouvees.push({ fichier, methode: methode.toUpperCase(), chemin, acceptees });
        }
    }

    return trouvees;
};

describe('RAMCI §3 — l’Auditeur ne modifie rien', () => {

    it('le rôle ne porte aucune permission d’écriture', () => {
        const ecriture = /\.(adjust|create|edit|delete|approve|decide|process|reject|assign|configure|scan|inspect|ship|receive|request|respond|open|all)$/;
        for (const permission of permissionsDuRole('read_only_auditor')) {
            assert.ok(!ecriture.test(permission), `L'Auditeur ne devrait pas avoir « ${permission} »`);
        }
    });

    it('aucune route d’écriture n’est ouverte par une permission de lecture seule', () => {
        // LE test qui manquait. Une route qui accepte `returns.view` pour un
        // POST laisse écrire quiconque a le droit de lire — ce qui inclut
        // l'Auditeur, dont c'est exactement ce qu'il ne doit pas pouvoir.
        const fautives = [];

        for (const route of routesDEcriture()) {
            const lectureSeule = route.acceptees.filter((p) => LECTURE_SEULE.includes(p));
            // Une route est fautive si TOUTES ses permissions sont de lecture :
            // il suffit alors d'un droit de lecture pour y accéder.
            if (lectureSeule.length === route.acceptees.length) {
                fautives.push(`${route.methode} ${route.chemin} (${route.fichier}) accepte ${lectureSeule.join(', ')}`);
            }
        }

        assert.deepStrictEqual(fautives, [], `Routes d'écriture ouvertes par une permission de lecture :\n  ${fautives.join('\n  ')}`);
    });

    it('l’Auditeur ne peut pas ouvrir un dossier de retour', () => {
        // Le cas concret qui a révélé le trou.
        const auditeur = { role: 'read_only_auditor', permissions: permissionsDuRole('read_only_auditor') };
        const requisParLaRoute = ['disputes.open', 'clients.edit', 'returns.decide'];
        assert.strictEqual(aUnDesDroits(auditeur, requisParLaRoute), false);
    });

    it('l’Auditeur ne peut ni traiter un retrait ni trancher une exception', () => {
        const auditeur = { role: 'read_only_auditor', permissions: permissionsDuRole('read_only_auditor') };
        assert.strictEqual(aUnDesDroits(auditeur, ['withdrawals.process', 'withdrawals.approve']), false);
        assert.strictEqual(aUnDesDroits(auditeur, ['exceptions.decide']), false);
    });

    it('mais il peut toujours tout consulter', () => {
        const auditeur = { role: 'read_only_auditor', permissions: permissionsDuRole('read_only_auditor') };
        for (const lecture of ['audit.view', 'wallet.view', 'orders.view', 'returns.view', 'withdrawals.view']) {
            assert.strictEqual(aUnDesDroits(auditeur, [lecture]), true, `devrait pouvoir ${lecture}`);
        }
    });
});
