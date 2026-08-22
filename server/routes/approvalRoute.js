import express from 'express';
import authStaff from '../middlewares/authStaff.js';
import { requirePermission } from '../middlewares/permission.js';
import {
    listApprovals,
    approuverApproval,
    rejeterApproval,
} from '../controllers/approvalController.js';

const approvalRouter = express.Router();

// Routes admin / finance
approvalRouter.get(
    '/',
    authStaff,
    requirePermission('wallet.view'),
    listApprovals
);

approvalRouter.post(
    '/:id/approuver',
    authStaff,
    requirePermission('wallet.adjust'),
    approuverApproval
);

approvalRouter.post(
    '/:id/rejeter',
    authStaff,
    requirePermission('wallet.adjust'),
    rejeterApproval
);

export default approvalRouter;