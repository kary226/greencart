import express from 'express';
import { upload } from '../configs/multer.js';
import authSeller from '../middlewares/authSeller.js';
import { addProduct, addProductImages, changeStock, productList, productById, updateProduct, deleteProduct, getBestSellers, getVariantDetails } from '../controllers/productController.js';

const productRouter = express.Router();

productRouter.post('/add', authSeller, upload.array("images"), addProduct);
productRouter.post('/add-images', authSeller, upload.array("images", 10), addProductImages);
productRouter.get('/list', productList);
productRouter.get('/id', productById);
productRouter.post('/stock', authSeller, changeStock);
productRouter.post('/update', authSeller, updateProduct);
productRouter.post('/delete', authSeller, deleteProduct);
productRouter.get('/bestsellers', getBestSellers);
productRouter.post('/variant', getVariantDetails);

export default productRouter;