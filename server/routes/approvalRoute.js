import express from 'express';
import authStaff from '../middlewares/authStaff.js';
import { requireAnyPermission, requireArbitre } from '../middlewares/permission.js';
import { PERMISSIONS as P } from '../configs/roles.js';
import {
    listApprovals,
    approuverApproval,
    rejeterApproval,
} from '../controllers/approvalController.js';

/**
 * §1, §12, §20 : « Qui tranche une exception ou un conflit ? Le Super Admin. »
 *
 * Ces routes étaient protégées par `wallet.adjust` — la permission de
 * Finance. Finance pouvait donc trancher les exceptions qu'elle-même
 * remonte, ce qui vide l'arbitrage de son sens (§3 : « Finance ne décide pas
 * seule d'une exception majeure »). La décision passe désormais par
 * requireArbitre ; la consultation reste ouverte à tous les domaines
 * concernés, qui doivent pouvoir suivre leur dossier.
 */
const approvalRouter = express.Router();

approvalRouter.get(
    '/',
    authStaff,
    requireAnyPermission([P.EXCEPTIONS_VIEW, P.AUDIT_VIEW, P.WALLET_VIEW]),
    listApprovals
);

approvalRouter.post('/:id/approuver', authStaff, requireArbitre, approuverApproval);
approvalRouter.post('/:id/rejeter', authStaff, requireArbitre, rejeterApproval);

export default approvalRouter;
