import express from 'express';
import { getSetting, updateSetting, getAllSettings } from '../controllers/settingController.js';
import authStaff from '../middlewares/authStaff.js';
import { requireAnyPermission } from '../middlewares/permission.js';

const router = express.Router();

// Routes publiques
router.get('/:key', getSetting);
router.get('/all', getAllSettings);

// Routes protégées (admin seulement)
//
// [PHASE 3 — migration authSeller → RBAC, 23 août 2026] Deux appelants
// vivants, tous deux sous SuperAdminLayout (staffToken) :
//   - pages/admin/Settings.jsx (paramètres généraux, gaté par
//     admin.configure côté menu)
//   - pages/seller/ColisSheinManager.jsx, montée sous /admin/colis-shein
//     (taux de change, horaires, messages SHEIN — gaté par shein.view côté
//     menu, mais la MUTATION doit exiger shein.update, pas seulement la
//     lecture qui gate juste l'affichage du menu)
// requireAnyPermission couvre les deux profils sans forcer un
// admin.configure sur un simple assistant_shein qui n'a que shein.*.
router.post('/update', authStaff, requireAnyPermission(['admin.configure', 'shein.update']), updateSetting);

export default router;