import express from 'express';
import { 
    getCities, getAllCities, addCity, updateCity, deleteCity,
    getCommunesByCity, getAllCommunes, addCommune, updateCommune, deleteCommune
} from '../controllers/locationController.js';
import authSeller from '../middlewares/authSeller.js';

const locationRouter = express.Router();

// ==================== VILLES ====================
locationRouter.get('/cities', getCities);
locationRouter.get('/admin/cities', authSeller, getAllCities);
locationRouter.post('/city/add', authSeller, addCity);
locationRouter.post('/city/update', authSeller, updateCity);
locationRouter.post('/city/delete', authSeller, deleteCity);

// ==================== COMMUNES ====================
locationRouter.get('/communes/:cityId', getCommunesByCity);
locationRouter.get('/admin/communes', authSeller, getAllCommunes);
locationRouter.post('/commune/add', authSeller, addCommune);
locationRouter.post('/commune/update', authSeller, updateCommune);
locationRouter.post('/commune/delete', authSeller, deleteCommune);

export default locationRouter;