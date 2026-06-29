import express from 'express';
import { getSetting, updateSetting, getAllSettings } from '../controllers/settingController.js';
import authSeller from '../middlewares/authSeller.js';

const router = express.Router();

// Routes publiques
router.get('/:key', getSetting);
router.get('/all', getAllSettings);

// Routes protégées (admin seulement)
router.post('/update', authSeller, updateSetting);

export default router;