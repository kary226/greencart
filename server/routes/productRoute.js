import express from 'express';
import { upload } from '../configs/multer.js';
import authSeller from '../middlewares/authSeller.js';
import { addProduct, changeStock, productList, productById, updateProduct, deleteProduct, getBestSellers } from '../controllers/productController.js';

const productRouter = express.Router();

productRouter.post('/add', upload.array(["images"]), authSeller, addProduct);
productRouter.get('/list', productList);
productRouter.get('/id', productById);
productRouter.post('/stock', authSeller, changeStock);
productRouter.post('/update', authSeller, updateProduct);
productRouter.post('/delete', authSeller, deleteProduct);
productRouter.get('/bestsellers', getBestSellers);

export default productRouter;