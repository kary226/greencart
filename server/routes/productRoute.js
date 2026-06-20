import express from 'express';
import { upload } from '../configs/multer.js';
import authSeller from '../middlewares/authSeller.js';
import { addProduct, changeStock, productList, productById, updateProduct, deleteProduct, getBestSellers, getVariantDetails } from '../controllers/productController.js';

const productRouter = express.Router();

// [FIX H1] authSeller AVANT upload : un appelant non authentifié ne peut
// plus déclencher l'écriture de fichiers (auparavant multer s'exécutait
// avant la vérification d'authentification).
productRouter.post('/add', authSeller, upload.array("images"), addProduct);
productRouter.get('/list', productList);
productRouter.get('/id', productById);
productRouter.post('/stock', authSeller, changeStock);
productRouter.post('/update', authSeller, updateProduct);
productRouter.post('/delete', authSeller, deleteProduct);
productRouter.get('/bestsellers', getBestSellers);
productRouter.post('/variant', getVariantDetails);

export default productRouter;