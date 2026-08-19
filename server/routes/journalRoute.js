import express from 'express';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import { listJournal, listBoutiquesJournal } from '../controllers/journalController.js';

const journalRouter = express.Router();

// Réservé à l'admin : le journal dit qui a fait quoi, y compris sur les
// boutiques des autres. Ce n'est pas une information qu'un commerçant a à
// consulter.
journalRouter.get('/', authStaff, requireRole('admin'), listJournal);
journalRouter.get('/boutiques', authStaff, requireRole('admin'), listBoutiquesJournal);

export default journalRouter;
