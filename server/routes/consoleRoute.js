import express from 'express';
import authStaff from '../middlewares/authStaff.js';
import { maConsole, listerRoles, mesDroits } from '../controllers/consoleController.js';

/**
 * §14 : « Chaque acteur doit d'abord voir ce qu'il doit faire maintenant. »
 *
 * Aucune permission particulière ici : la console ne montre à chacun que ce
 * que ses propres droits lui donnent déjà. Un compte sans droit voit une
 * liste vide, jamais les tâches d'un autre domaine.
 */
const consoleRouter = express.Router();

consoleRouter.get('/', authStaff, maConsole);
consoleRouter.get('/mes-droits', authStaff, mesDroits);
consoleRouter.get('/roles', authStaff, listerRoles);

export default consoleRouter;
