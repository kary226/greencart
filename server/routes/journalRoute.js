import express from 'express';
import authStaff from '../middlewares/authStaff.js';
import { listJournal, listBoutiquesJournal } from '../controllers/journalController.js';
import { requirePermission } from '../middlewares/permission.js';

const journalRouter = express.Router();

// Réservé à l'admin : le journal dit qui a fait quoi, y compris sur les
// boutiques des autres. Ce n'est pas une information qu'un commerçant a à
// consulter.
journalRouter.get('/', authStaff, requirePermission('audit.view'), listJournal);
journalRouter.get('/boutiques', authStaff, requirePermission('audit.view'), listBoutiquesJournal);

export default journalRouter;