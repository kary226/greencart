import React, { useState, useEffect } from 'react'
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import ImageCropper from '../../components/ImageCropper';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { resizeAndConvertToWebP } from '../../utils/resizeImage';

const AddProduct = () => {

    const [files, setFiles] = useState([]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [price, setPrice] = useState('');
    const [offerPrice, setOfferPrice] = useState('');
    const [categoriesList, setCategoriesList] = useState([]);

    const [productMode, setProductMode] = useState('simple');
    
    const [simpleStock, setSimpleStock] = useState('');
    const [simpleSize, setSimpleSize] = useState('');

    const [sizesList, setSizesList] = useState([]);
    const [sizeInput, setSizeInput] = useState('');
    const [stockInput, setStockInput] = useState('');
    const [sizePriceInput, setSizePriceInput] = useState('');
    const [sizeOfferPriceInput, setSizeOfferPriceInput] = useState('');
    const [editingSizeIndex, setEditingSizeIndex] = useState(null);
    const [openSizesPanel, setOpenSizesPanel] = useState(true);

    const [colors, setColors] = useState([]);
    const [colorInput, setColorInput] = useState('');
    const [colorCodeInput, setColorCodeInput] = useState('#000000');
    const [startImageIndexInput, setStartImageIndexInput] = useState(0);
    const [editingColorIndex, setEditingColorIndex] = useState(null);
    const [openColorIndex, setOpenColorIndex] = useState(null);
    const [showColorForm, setShowColorForm] = useState(false);
    
    const [variantSizeInput, setVariantSizeInput] = useState('');
    const [variantStockInput, setVariantStockInput] = useState('');
    const [variantPriceInput, setVariantPriceInput] = useState('');
    const [variantOfferPriceInput, setVariantOfferPriceInput] = useState('');
    const [editingSizeIndexInColor, setEditingSizeIndexInColor] = useState(null);
    const [editingColorForSize, setEditingColorForSize] = useState(null);

    const [showCropper, setShowCropper] = useState(false);
    const [tempImageFile, setTempImageFile] = useState(null);
    const [cropAspectRatio, setCropAspectRatio] = useState(16 / 9);
    const [cropShape, setCropShape] = useState('rect');
    const [isConverting, setIsConverting] = useState(false);

    const { axios } = useAppContext()

    const fetchCategories = async () => {
        try {
            const { data } = await axios.get('/api/category/list');
            if (data.success) {
                setCategoriesList(data.categories);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const resetSizeForm = () => {
        setSizeInput('');
        setStockInput('');
        setSizePriceInput('');
        setSizeOfferPriceInput('');
        setEditingSizeIndex(null);
    };

    const addSize = () => {
        if (!sizeInput.trim()) {
            toast.error('Entrez une taille');
            return;
        }
        if (!stockInput || Number(stockInput) < 0) {
            toast.error('Entrez un stock valide');
            return;
        }

        const newSize = {
            size: sizeInput.trim().toUpperCase(),
            stock: Number(stockInput),
            price: sizePriceInput !== '' ? Number(sizePriceInput) : null,
            offerPrice: sizeOfferPriceInput !== '' ? Number(sizeOfferPriceInput) : null
        };

        if (editingSizeIndex !== null) {
            const updatedSizes = [...sizesList];
            updatedSizes[editingSizeIndex] = newSize;
            setSizesList(updatedSizes);
        } else {
            setSizesList([...sizesList, newSize]);
        }
        resetSizeForm();
    };

    const editSize = (index) => {
        const size = sizesList[index];
        setSizeInput(size.size);
        setStockInput(size.stock.toString());
        setSizePriceInput(size.price !== null ? size.price.toString() : '');
        setSizeOfferPriceInput(size.offerPrice !== null ? size.offerPrice.toString() : '');
        setEditingSizeIndex(index);
    };

    const removeSize = (index) => {
        setSizesList(sizesList.filter((_, i) => i !== index));
        if (editingSizeIndex === index) {
            resetSizeForm();
        }
    };

    const convertSizesToVariants = () => {
        return sizesList.map(size => ({
            color: null,
            colorCode: null,
            size: size.size,
            stock: size.stock,
            price: size.price,
            offerPrice: size.offerPrice,
            startImageIndex: 0
        }));
    };

    const resetColorForm = () => {
        setColorInput('');
        setColorCodeInput('#000000');
        setStartImageIndexInput(0);
        setEditingColorIndex(null);
    };

    const resetVariantSizeForm = () => {
        setVariantSizeInput('');
        setVariantStockInput('');
        setVariantPriceInput('');
        setVariantOfferPriceInput('');
        setEditingSizeIndexInColor(null);
        setEditingColorForSize(null);
    };

    const addColor = () => {
        if (!colorInput.trim()) {
            toast.error('Entrez une couleur');
            return;
        }

        const newColor = {
            color: colorInput.trim(),
            colorCode: colorCodeInput,
            startImageIndex: Number(startImageIndexInput),
            sizes: []
        };

        if (editingColorIndex !== null) {
            const updatedColors = [...colors];
            updatedColors[editingColorIndex] = { ...updatedColors[editingColorIndex], ...newColor, sizes: updatedColors[editingColorIndex].sizes };
            setColors(updatedColors);
        } else {
            setColors([...colors, newColor]);
        }

        resetColorForm();
        setShowColorForm(false);
    };

    const addSizeToColor = (colorIndex) => {
        if (!variantSizeInput.trim()) {
            toast.error('Entrez une taille');
            return;
        }
        if (!variantStockInput || Number(variantStockInput) < 0) {
            toast.error('Entrez un stock valide');
            return;
        }

        const newSize = {
            size: variantSizeInput.trim().toUpperCase(),
            stock: Number(variantStockInput),
            price: variantPriceInput !== '' ? Number(variantPriceInput) : null,
            offerPrice: variantOfferPriceInput !== '' ? Number(variantOfferPriceInput) : null
        };

        const updatedColors = [...colors];
        if (editingSizeIndexInColor !== null && editingColorForSize === colorIndex) {
            updatedColors[colorIndex].sizes[editingSizeIndexInColor] = newSize;
        } else {
            updatedColors[colorIndex].sizes.push(newSize);
        }
        setColors(updatedColors);
        resetVariantSizeForm();
    };

    const editSizeInColor = (colorIndex, sizeIndex) => {
        const size = colors[colorIndex].sizes[sizeIndex];
        setVariantSizeInput(size.size);
        setVariantStockInput(size.stock.toString());
        setVariantPriceInput(size.price !== null ? size.price.toString() : '');
        setVariantOfferPriceInput(size.offerPrice !== null ? size.offerPrice.toString() : '');
        setEditingSizeIndexInColor(sizeIndex);
        setEditingColorForSize(colorIndex);
    };

    const removeSizeFromColor = (colorIndex, sizeIndex) => {
        const updatedColors = [...colors];
        updatedColors[colorIndex].sizes = updatedColors[colorIndex].sizes.filter((_, i) => i !== sizeIndex);
        setColors(updatedColors);
        if (editingSizeIndexInColor === sizeIndex && editingColorForSize === colorIndex) {
            resetVariantSizeForm();
        }
    };

    const removeColor = (index) => {
        setColors(colors.filter((_, i) => i !== index));
        if (editingColorIndex === index) {
            resetColorForm();
            setShowColorForm(false);
        }
        if (openColorIndex === index) {
            setOpenColorIndex(null);
        }
    };

    const editColor = (index) => {
        const color = colors[index];
        setColorInput(color.color);
        setColorCodeInput(color.colorCode);
        setStartImageIndexInput(color.startImageIndex);
        setEditingColorIndex(index);
        setShowColorForm(true);
        setOpenColorIndex(null);
    };

    const cancelColorForm = () => {
        resetColorForm();
        setShowColorForm(false);
    };

    const convertVariantsToApi = () => {
        const variants = [];
        colors.forEach(color => {
            color.sizes.forEach(size => {
                variants.push({
                    color: color.color,
                    colorCode: color.colorCode,
                    size: size.size,
                    stock: size.stock,
                    price: size.price,
                    offerPrice: size.offerPrice,
                    startImageIndex: color.startImageIndex
                });
            });
        });
        return variants;
    };

    const handleCategoryToggle = (categorySlug) => {
        if (selectedCategories.includes(categorySlug)) {
            setSelectedCategories(selectedCategories.filter(c => c !== categorySlug));
        } else {
            setSelectedCategories([...selectedCategories, categorySlug]);
        }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setTempImageFile(file);
            setShowCropper(true);
        }
    };

    const handleCropComplete = async (croppedFile) => {
        setIsConverting(true);
        try {
            const webpFile = await resizeAndConvertToWebP(croppedFile);
            setFiles(prevFiles => [...prevFiles, webpFile]);
            toast.success('Image optimisée en WebP ✓');
        } catch (error) {
            console.error("Erreur lors de la conversion en WebP :", error);
            toast.error("Erreur lors de l'optimisation de l'image");
            setFiles(prevFiles => [...prevFiles, croppedFile]);
        } finally {
            setIsConverting(false);
            setShowCropper(false);
            setTempImageFile(null);
        }
    };

    const onSubmitHandler = async (event) => {
        event.preventDefault();

        if (selectedCategories.length === 0) {
            toast.error('Veuillez sélectionner au moins une catégorie');
            return;
        }

        // ✅ Vérification minimale : au moins un nom
        if (!name.trim()) {
            toast.error('Veuillez entrer un nom de produit');
            return;
        }

        let variants = [];
        
        if (productMode === 'simple') {
            variants = [];
        } else if (productMode === 'multi-sizes') {
            if (sizesList.length === 0) {
                toast.error('Ajoutez au moins une taille');
                return;
            }
            variants = convertSizesToVariants();
        } else if (productMode === 'variants') {
            if (colors.length === 0) {
                toast.error('Ajoutez au moins une couleur');
                return;
            }
            variants = convertVariantsToApi();
        }

        const productData = {
            name,
            description,
            categories: selectedCategories,
            price: price ? Number(price) : 0,
            offerPrice: offerPrice ? Number(offerPrice) : 0,
            variants,
        };

        // ✅ Stock et taille seulement pour le mode simple
        if (productMode === 'simple') {
            if (simpleStock) {
                productData.stock = Number(simpleStock);
            }
            if (simpleSize) {
                productData.size = simpleSize;
            }
        }

        console.log('📤 Envoi du produit :', productData);

        const formData = new FormData();
        formData.append('productData', JSON.stringify(productData));

        for (let i = 0; i < files.length; i++) {
            formData.append('images', files[i])
        }

        try {
            const { data } = await axios.post('/api/product/add', formData)

            if (data.success) {
                toast.success(data.message);
                setName('');
                setDescription('');
                setSelectedCategories([]);
                setPrice('');
                setOfferPrice('');
                setFiles([]);
                setSimpleStock('');
                setSimpleSize('');
                setSizesList([]);
                setColors([]);
                setProductMode('simple');
                resetSizeForm();
                resetColorForm();
                resetVariantSizeForm();
                setShowColorForm(false);
                setOpenColorIndex(null);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    return (
        <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll flex flex-col justify-between">
            <form onSubmit={onSubmitHandler} className="md:p-10 p-4 space-y-5 max-w-lg">

                <div>
                    <p className="text-base font-medium">Images du produit (dans l'ordre)</p>
                    <div className="mt-2 mb-3 flex flex-wrap gap-3 items-center">
                        <span className="text-xs text-gray-600">Format recommandé :</span>
                        <button type="button" onClick={() => { setCropAspectRatio(16/9); setCropShape('rect'); }} className={`text-xs px-3 py-1 rounded-full ${cropAspectRatio === 16/9 ? 'bg-primary text-white' : 'bg-gray-200'}`}>16:9 (Large)</button>
                        <button type="button" onClick={() => { setCropAspectRatio(1/1); setCropShape('rect'); }} className={`text-xs px-3 py-1 rounded-full ${cropAspectRatio === 1/1 ? 'bg-primary text-white' : 'bg-gray-200'}`}>1:1 (Carré)</button>
                        <button type="button" onClick={() => { setCropAspectRatio(4/3); setCropShape('rect'); }} className={`text-xs px-3 py-1 rounded-full ${cropAspectRatio === 4/3 ? 'bg-primary text-white' : 'bg-gray-200'}`}>4:3 (Standard)</button>
                        <button type="button" onClick={() => setShowCropper(false)} className="text-xs px-3 py-1 rounded-full bg-gray-200">🔄 Réinitialiser</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                        {files.map((file, index) => (
                            <div key={index} className="relative">
                                <img className="w-20 h-20 cursor-pointer border rounded object-cover" src={URL.createObjectURL(file)} alt="uploadArea" />
                                <button type="button" onClick={() => { const newFiles = [...files]; newFiles.splice(index, 1); setFiles(newFiles); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">✕</button>
                            </div>
                        ))}
                        <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:border-primary">
                            <input onChange={handleImageSelect} type="file" accept="image/*" className="hidden" />
                            <span className="text-2xl text-gray-400">+</span>
                            <span className="text-[10px] text-gray-400">Ajouter</span>
                        </label>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        💡 Les images sont automatiquement optimisées en WebP (qualité identique, poids réduit de 70%)
                        {isConverting && <span className="text-blue-500 ml-2">⏳ Conversion en cours...</span>}
                    </p>
                </div>

                <div className="flex flex-col gap-1 max-w-md">
                    <label className="text-base font-medium">Nom du produit</label>
                    <input onChange={(e) => setName(e.target.value)} value={name} type="text" placeholder="Type here" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                </div>

                <div className="flex flex-col gap-1 max-w-md">
                    <label className="text-base font-medium">Description</label>
                    <ReactQuill
                        value={description}
                        onChange={setDescription}
                        theme="snow"
                        placeholder="Décrivez votre produit..."
                        className="bg-white rounded-lg"
                        style={{ minHeight: '150px' }}
                    />
                </div>

                <div className="w-full flex flex-col gap-2">
                    <label className="text-base font-medium">Catégories</label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-500/40 rounded">
                        {categoriesList.map((item) => (
                            <button key={item._id} type="button" onClick={() => handleCategoryToggle(item.slug)} className={`px-3 py-1.5 rounded-full text-sm transition ${selectedCategories.includes(item.slug) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{item.name}</button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-5 flex-wrap">
                    <div className="flex-1 flex flex-col gap-1">
                        <label className="text-base font-medium">Prix par défaut</label>
                        <input onChange={(e) => setPrice(e.target.value)} value={price} type="number" placeholder="0" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                        <label className="text-base font-medium">Prix promo défaut</label>
                        <input onChange={(e) => setOfferPrice(e.target.value)} value={offerPrice} type="number" placeholder="0" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                    </div>
                </div>
                <p className="text-xs text-gray-400 -mt-3">💡 Ces prix s'appliquent par défaut. Une variante peut avoir son propre prix, sinon elle utilise ceux-ci.</p>

                <div className="border-t pt-4">
                    <label className="text-base font-medium block mb-2">Type de produit</label>
                    <div className="grid grid-cols-3 gap-2">
                        <button type="button" onClick={() => setProductMode('simple')} className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition ${productMode === 'simple' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>Produit simple</button>
                        <button type="button" onClick={() => setProductMode('multi-sizes')} className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition ${productMode === 'multi-sizes' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>Multi-tailles</button>
                        <button type="button" onClick={() => setProductMode('variants')} className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition ${productMode === 'variants' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>Couleurs + Tailles</button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        {productMode === 'simple' && "Un seul prix, un seul stock, une taille optionnelle."}
                        {productMode === 'multi-sizes' && "Plusieurs tailles (S, M, L...), chacune avec son propre stock, sans couleurs."}
                        {productMode === 'variants' && "Plusieurs couleurs, chaque couleur peut avoir plusieurs tailles avec leurs stocks."}
                    </p>
                </div>

                {productMode === 'simple' && (
                    <div className="flex flex-col gap-3 max-w-md">
                        <div className="flex flex-col gap-1">
                            <label className="text-base font-medium">Stock (optionnel)</label>
                            <input onChange={(e) => setSimpleStock(e.target.value)} value={simpleStock} type="number" min="0" placeholder="Quantité disponible" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" />
                            <p className="text-xs text-gray-400">💡 Laissez vide si vous ne voulez pas définir de stock</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-base font-medium">Taille (optionnel)</label>
                            <input onChange={(e) => setSimpleSize(e.target.value)} value={simpleSize} type="text" placeholder="Ex: S, M, L, XL, ou laissez vide" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" />
                            <p className="text-xs text-gray-400">💡 Laissez vide si ce produit n'a pas de taille spécifique</p>
                        </div>
                    </div>
                )}

                {productMode === 'multi-sizes' && (
                    <div className="flex flex-col gap-3 max-w-md">
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <button type="button" onClick={() => setOpenSizesPanel(!openSizesPanel)} className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition">
                                <span className="font-medium text-gray-900">📏 Tailles disponibles ({sizesList.length})</span>
                                <svg className={`w-4 h-4 text-gray-400 transition-transform ${openSizesPanel ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {openSizesPanel && (
                                <div className="px-3 py-3 border-t border-gray-200">
                                    {sizesList.length > 0 && (
                                        <div className="space-y-2 mb-3">
                                            {sizesList.map((size, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                                    <div><span className="font-medium text-gray-800">{size.size}</span><span className="text-xs text-green-600 ml-2">Stock: {size.stock}</span>{size.price && <span className="text-xs text-gray-400 ml-2">{size.price} FCFA</span>}</div>
                                                    <div className="flex gap-1"><button type="button" onClick={() => editSize(idx)} className="text-blue-400 hover:text-blue-600 text-xs px-2 py-1">✏️</button><button type="button" onClick={() => removeSize(idx)} className="text-red-400 hover:text-red-600 text-xs px-2 py-1">✕</button></div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-2 mb-2"><input value={sizeInput} onChange={e => setSizeInput(e.target.value)} type="text" placeholder="Taille (S, M, L...)" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /><input value={stockInput} onChange={e => setStockInput(e.target.value)} type="number" placeholder="Stock" className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></div>
                                    <div className="flex gap-2 mb-2"><input value={sizePriceInput} onChange={e => setSizePriceInput(e.target.value)} type="number" placeholder="Prix (optionnel)" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /><input value={sizeOfferPriceInput} onChange={e => setSizeOfferPriceInput(e.target.value)} type="number" placeholder="Promo (optionnel)" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></div>
                                    <button type="button" onClick={addSize} className="w-full py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition">{editingSizeIndex !== null ? 'Mettre à jour la taille' : '+ Ajouter une taille'}</button>
                                    {editingSizeIndex !== null && <button type="button" onClick={resetSizeForm} className="w-full mt-1 py-1 text-xs text-gray-400 hover:text-gray-600">Annuler</button>}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {productMode === 'variants' && (
                    <div className="flex flex-col gap-3 max-w-md">
                        {colors.length > 0 && (
                            <div className="flex flex-col gap-2">
                                {colors.map((color, colorIndex) => {
                                    const isOpen = openColorIndex === colorIndex;
                                    const totalStock = color.sizes.reduce((sum, s) => sum + s.stock, 0);
                                    return (
                                        <div key={colorIndex} className="border border-gray-200 rounded-lg overflow-hidden">
                                            <button type="button" onClick={() => setOpenColorIndex(isOpen ? null : colorIndex)} className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition">
                                                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: color.colorCode }}></div><span className="font-medium text-gray-900">{color.color}</span><span className="text-xs text-gray-400">({color.sizes.length} taille(s))</span><span className="text-xs text-green-600 ml-1">Stock total: {totalStock}</span></div>
                                                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                            {isOpen && (
                                                <div className="px-3 py-3 border-t border-gray-200 bg-white">
                                                    {color.sizes.length > 0 && (<div className="space-y-2 mb-3">{color.sizes.map((size, sizeIndex) => (<div key={sizeIndex} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"><div><span className="font-medium text-gray-800">{size.size}</span><span className="text-xs text-green-600 ml-2">Stock: {size.stock}</span>{size.price && <span className="text-xs text-gray-400 ml-2">{size.price} FCFA</span>}</div><div className="flex gap-1"><button type="button" onClick={() => editSizeInColor(colorIndex, sizeIndex)} className="text-blue-400 hover:text-blue-600 text-xs px-2 py-1">✏️</button><button type="button" onClick={() => removeSizeFromColor(colorIndex, sizeIndex)} className="text-red-400 hover:text-red-600 text-xs px-2 py-1">✕</button></div></div>))}</div>)}
                                                    <div className="flex gap-2 mb-2"><input value={variantSizeInput} onChange={e => setVariantSizeInput(e.target.value)} type="text" placeholder="Taille" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /><input value={variantStockInput} onChange={e => setVariantStockInput(e.target.value)} type="number" placeholder="Stock" className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></div>
                                                    <div className="flex gap-2 mb-2"><input value={variantPriceInput} onChange={e => setVariantPriceInput(e.target.value)} type="number" placeholder="Prix (optionnel)" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /><input value={variantOfferPriceInput} onChange={e => setVariantOfferPriceInput(e.target.value)} type="number" placeholder="Promo (optionnel)" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></div>
                                                    <button type="button" onClick={() => addSizeToColor(colorIndex)} className="w-full py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition">{editingSizeIndexInColor !== null && editingColorForSize === colorIndex ? 'Mettre à jour la taille' : '+ Ajouter une taille'}</button>
                                                    {editingSizeIndexInColor !== null && editingColorForSize === colorIndex && <button type="button" onClick={resetVariantSizeForm} className="w-full mt-1 py-1 text-xs text-gray-400 hover:text-gray-600">Annuler</button>}
                                                    <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100"><button type="button" onClick={() => editColor(colorIndex)} className="flex-1 py-1.5 text-blue-600 bg-blue-50 rounded-lg text-xs hover:bg-blue-100 transition">Modifier la couleur</button><button type="button" onClick={() => removeColor(colorIndex)} className="flex-1 py-1.5 text-red-600 bg-red-50 rounded-lg text-xs hover:bg-red-100 transition">Supprimer la couleur</button></div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {!showColorForm && (<button type="button" onClick={() => setShowColorForm(true)} className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-500 hover:border-primary hover:text-primary transition">+ Ajouter une couleur</button>)}
                        {showColorForm && (
                            <div className="bg-gray-50 p-3 rounded-lg space-y-3 border border-gray-200">
                                <div className="flex items-center justify-between"><span className="text-sm font-medium text-primary">{editingColorIndex !== null ? 'Modifier la couleur' : 'Nouvelle couleur'}</span><button type="button" onClick={cancelColorForm} className="text-xs text-gray-400 hover:text-gray-600">Annuler</button></div>
                                <div className="flex gap-2 items-center"><input value={colorInput} onChange={e => setColorInput(e.target.value)} type="text" placeholder="Couleur (ex: Rouge)" className="flex-1 outline-none py-2 px-3 rounded border border-gray-300 text-sm" /><input value={colorCodeInput} onChange={e => setColorCodeInput(e.target.value)} type="color" className="w-12 h-10 rounded border border-gray-300 cursor-pointer" /></div>
                                <div><label className="text-xs text-gray-600 mb-1 block">Position de départ dans les photos (0 = première photo)</label><input value={startImageIndexInput} onChange={e => setStartImageIndexInput(Number(e.target.value))} type="number" min="0" placeholder="Ex: 0 pour Rouge, 3 pour Bleu" className="w-full outline-none py-2 px-3 rounded border border-gray-300 text-sm" /><p className="text-xs text-gray-400 mt-1">💡 Permet d'afficher d'abord les photos correspondant à cette couleur.</p></div>
                                <button type="button" onClick={addColor} className="w-full py-2 bg-primary text-white rounded text-sm font-medium">{editingColorIndex !== null ? 'Mettre à jour la couleur' : 'Ajouter cette couleur'}</button>
                            </div>
                        )}
                    </div>
                )}

                <button type="submit" className="px-8 py-2.5 bg-primary text-white font-medium rounded cursor-pointer">AJOUTER LE PRODUIT</button>
            </form>

            {showCropper && (
                <ImageCropper 
                    imageFile={tempImageFile} 
                    onCropComplete={handleCropComplete} 
                    onCancel={() => { 
                        setShowCropper(false); 
                        setTempImageFile(null); 
                    }} 
                    aspectRatio={cropAspectRatio} 
                    cropShape={cropShape} 
                />
            )}
        </div>
    )
}

export default AddProduct