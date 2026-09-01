import express from 'express';
import authStaff from '../middlewares/authStaff.js';
import { requirePermission, requireAnyPermission } from '../middlewares/permission.js';
import requireBoutiqueActive from '../middlewares/requireBoutiqueActive.js';
import { PERMISSIONS as P } from '../configs/roles.js';
import {
    createRetrait,
    getMesRetraits,
    listOperateurs,
    listAllRetraits,
    traiterRetrait,
    escaladerRetrait,
} from '../controllers/retraitController.js';

/**
 * §16 : « Le rôle décrit la personne ; la permission décrit l'action. »
 * Ces routes ne demandent plus « êtes-vous commerçant / admin ? » mais
 * « avez-vous le droit de demander / traiter un retrait ? ». Le Super Admin
 * passe partout via admin.all, sans être listé (§1).
 */
const retraitRouter = express.Router();

// ── Commerçant ──────────────────────────────────────────────────────────
retraitRouter.post(
    '/',
    authStaff,
    requirePermission(P.WITHDRAWALS_REQUEST),
    requireBoutiqueActive,
    createRetrait
);
retraitRouter.get('/moi', authStaff, requirePermission(P.WALLET_VIEW_OWN), getMesRetraits);
retraitRouter.get(
    '/operateurs',
    authStaff,
    requireAnyPermission([P.WITHDRAWALS_REQUEST, P.WITHDRAWALS_VIEW]),
    listOperateurs
);

// ── Finance (§9, §13 : une personne autorisée suffit) ───────────────────
retraitRouter.get(
    '/',
    authStaff,
    requireAnyPermission([P.WITHDRAWALS_VIEW, P.WALLET_VIEW]),
    listAllRetraits
);
retraitRouter.patch(
    '/:id',
    authStaff,
    requireAnyPermission([P.WITHDRAWALS_PROCESS, P.WITHDRAWALS_APPROVE, P.WALLET_ADJUST]),
    traiterRetrait
);

// ── Escalade au Super Admin (§9) ────────────────────────────────────────
//
// Demander une escalade n'est pas trancher : tout domaine qui voit passer
// un dossier douteux doit pouvoir le remonter, sinon il le traite quand
// même. C'est le Super Admin qui décide ensuite (voir approvalRoute).
retraitRouter.post(
    '/:id/escalader',
    authStaff,
    requireAnyPermission([P.EXCEPTIONS_REQUEST, P.WITHDRAWALS_PROCESS, P.WITHDRAWALS_APPROVE]),
    escaladerRetrait
);

export default retraitRouter;
