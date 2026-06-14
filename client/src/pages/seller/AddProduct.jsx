import React, { useState, useEffect } from 'react'
import { assets } from '../../assets/assets';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import ImageCropper from '../../components/ImageCropper';

const AddProduct = () => {

    const [files, setFiles] = useState([]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [price, setPrice] = useState('');
    const [offerPrice, setOfferPrice] = useState('');
    const [categoriesList, setCategoriesList] = useState([]);

    // Mode produit : 'simple' ou 'variants'
    const [productMode, setProductMode] = useState('simple');
    // Stock pour un produit simple (sans variantes)
    const [simpleStock, setSimpleStock] = useState('');

    // Crop state
    const [showCropper, setShowCropper] = useState(false);
    const [tempImageFile, setTempImageFile] = useState(null);
    const [cropAspectRatio, setCropAspectRatio] = useState(16 / 9);
    const [cropShape, setCropShape] = useState('rect');

    // Variants
    const [variants, setVariants] = useState([])
    const [colorInput, setColorInput] = useState('')
    const [colorCodeInput, setColorCodeInput] = useState('#000000')
    const [sizeInput, setSizeInput] = useState('')
    const [stockInput, setStockInput] = useState('')
    const [variantPriceInput, setVariantPriceInput] = useState('')
    const [variantOfferPriceInput, setVariantOfferPriceInput] = useState('')
    const [startImageIndexInput, setStartImageIndexInput] = useState(0)
    const [editingVariantIndex, setEditingVariantIndex] = useState(null)
    // Index de la variante actuellement dépliée (accordéon)
    const [openVariantIndex, setOpenVariantIndex] = useState(null)
    // Affiche/cache le formulaire d'ajout de variante
    const [showVariantForm, setShowVariantForm] = useState(false)

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

    const resetVariantForm = () => {
        setColorInput('')
        setColorCodeInput('#000000')
        setSizeInput('')
        setStockInput('')
        setVariantPriceInput('')
        setVariantOfferPriceInput('')
        setStartImageIndexInput(0)
        setEditingVariantIndex(null)
    }

    const addVariant = () => {
        if (!colorInput.trim()) {
            toast.error('Entrez une couleur')
            return
        }
        if (!stockInput || Number(stockInput) < 0) {
            toast.error('Entrez un stock valide')
            return
        }

        // Si le prix n'est pas renseigné, on garde "null" : le produit utilisera
        // le prix par défaut au moment de l'affichage / de la vente.
        const newVariant = {
            color: colorInput.trim(),
            colorCode: colorCodeInput,
            size: sizeInput.trim().toUpperCase() || null,
            stock: Number(stockInput),
            price: variantPriceInput !== '' ? Number(variantPriceInput) : null,
            offerPrice: variantOfferPriceInput !== '' ? Number(variantOfferPriceInput) : null,
            startImageIndex: Number(startImageIndexInput)
        }

        if (editingVariantIndex !== null) {
            const updatedVariants = [...variants]
            updatedVariants[editingVariantIndex] = newVariant
            setVariants(updatedVariants)
        } else {
            setVariants([...variants, newVariant])
        }

        resetVariantForm()
        setShowVariantForm(false)
    }

    const editVariant = (index) => {
        const variant = variants[index]
        setColorInput(variant.color)
        setColorCodeInput(variant.colorCode || '#000000')
        setSizeInput(variant.size || '')
        setStockInput(variant.stock.toString())
        setVariantPriceInput(variant.price !== null && variant.price !== undefined ? variant.price.toString() : '')
        setVariantOfferPriceInput(variant.offerPrice !== null && variant.offerPrice !== undefined ? variant.offerPrice.toString() : '')
        setStartImageIndexInput(variant.startImageIndex || 0)
        setEditingVariantIndex(index)
        setShowVariantForm(true)
        setOpenVariantIndex(null)
    }

    const removeVariant = (index) => {
        setVariants(variants.filter((_, i) => i !== index))
        if (editingVariantIndex === index) {
            resetVariantForm()
            setShowVariantForm(false)
        }
        if (openVariantIndex === index) {
            setOpenVariantIndex(null)
        }
    }

    const cancelVariantForm = () => {
        resetVariantForm()
        setShowVariantForm(false)
    }

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

    const handleCropComplete = (croppedFile) => {
        setFiles([...files, croppedFile]);
        setShowCropper(false);
        setTempImageFile(null);
    };

    const onSubmitHandler = async (event) => {
        event.preventDefault();

        if (selectedCategories.length === 0) {
            toast.error('Veuillez sélectionner au moins une catégorie');
            return;
        }

        if (productMode === 'variants' && variants.length === 0) {
            toast.error('Ajoutez au moins une variante, ou passez en mode "Produit simple"');
            return;
        }

        const productData = {
            name,
            description: description.split('\n'),
            categories: selectedCategories,
            price,
            offerPrice,
            // En mode simple : pas de variantes, le stock est géré directement sur le produit.
            // En mode variantes : le stock global n'est pas utilisé, chaque variante a le sien.
            variants: productMode === 'variants' ? variants : [],
            ...(productMode === 'simple' ? { stock: Number(simpleStock) } : {})
        }

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
                setVariants([]);
                setSimpleStock('');
                setProductMode('simple');
                resetVariantForm();
                setShowVariantForm(false);
                setOpenVariantIndex(null);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    }

    return (
        <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll flex flex-col justify-between">
            <form onSubmit={onSubmitHandler} className="md:p-10 p-4 space-y-5 max-w-lg">

                {/* Images principales du produit */}
                <div>
                    <p className="text-base font-medium">Images du produit (dans l'ordre)</p>

                    <div className="mt-2 mb-3 flex flex-wrap gap-3 items-center">
                        <span className="text-xs text-gray-600">Format recommandé :</span>
                        <button
                            type="button"
                            onClick={() => { setCropAspectRatio(16/9); setCropShape('rect'); }}
                            className={`text-xs px-3 py-1 rounded-full ${cropAspectRatio === 16/9 ? 'bg-primary text-white' : 'bg-gray-200'}`}
                        >
                            16:9 (Large)
                        </button>
                        <button
                            type="button"
                            onClick={() => { setCropAspectRatio(1/1); setCropShape('rect'); }}
                            className={`text-xs px-3 py-1 rounded-full ${cropAspectRatio === 1/1 ? 'bg-primary text-white' : 'bg-gray-200'}`}
                        >
                            1:1 (Carré)
                        </button>
                        <button
                            type="button"
                            onClick={() => { setCropAspectRatio(4/3); setCropShape('rect'); }}
                            className={`text-xs px-3 py-1 rounded-full ${cropAspectRatio === 4/3 ? 'bg-primary text-white' : 'bg-gray-200'}`}
                        >
                            4:3 (Standard)
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowCropper(false)}
                            className="text-xs px-3 py-1 rounded-full bg-gray-200"
                        >
                            🔄 Réinitialiser
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-2">
                        {files.map((file, index) => (
                            <div key={index} className="relative">
                                <img
                                    className="w-20 h-20 cursor-pointer border rounded object-cover"
                                    src={URL.createObjectURL(file)}
                                    alt="uploadArea"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newFiles = [...files];
                                        newFiles.splice(index, 1);
                                        setFiles(newFiles);
                                    }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:border-primary">
                            <input
                                onChange={handleImageSelect}
                                type="file"
                                accept="image/*"
                                className="hidden"
                            />
                            <span className="text-2xl text-gray-400">+</span>
                            <span className="text-[10px] text-gray-400">Ajouter</span>
                        </label>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        💡 Cliquez sur l'image pour la recadrer avant import. L'ordre est important.
                    </p>
                </div>

                {/* Nom */}
                <div className="flex flex-col gap-1 max-w-md">
                    <label className="text-base font-medium">Nom du produit</label>
                    <input onChange={(e) => setName(e.target.value)} value={name}
                        type="text" placeholder="Type here" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1 max-w-md">
                    <label className="text-base font-medium">Description</label>
                    <textarea onChange={(e) => setDescription(e.target.value)} value={description}
                        rows={4} className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40 resize-none"></textarea>
                </div>

                {/* Catégories */}
                <div className="w-full flex flex-col gap-2">
                    <label className="text-base font-medium">Catégories</label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-500/40 rounded">
                        {categoriesList.map((item) => (
                            <button
                                key={item._id}
                                type="button"
                                onClick={() => handleCategoryToggle(item.slug)}
                                className={`px-3 py-1.5 rounded-full text-sm transition ${selectedCategories.includes(item.slug)
                                        ? 'bg-primary text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Prix par défaut */}
                <div className="flex items-center gap-5 flex-wrap">
                    <div className="flex-1 flex flex-col gap-1">
                        <label className="text-base font-medium">Prix par défaut</label>
                        <input onChange={(e) => setPrice(e.target.value)} value={price}
                            type="number" placeholder="0" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                        <label className="text-base font-medium">Prix promo défaut</label>
                        <input onChange={(e) => setOfferPrice(e.target.value)} value={offerPrice}
                            type="number" placeholder="0" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                    </div>
                </div>
                <p className="text-xs text-gray-400 -mt-3">
                    💡 Ces prix s'appliquent par défaut. Une variante peut avoir son propre prix, sinon elle utilise ceux-ci.
                </p>

                {/* ── MODE DU PRODUIT : SIMPLE OU AVEC VARIANTES ── */}
                <div className="border-t pt-4">
                    <label className="text-base font-medium block mb-2">Type de produit</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setProductMode('simple')}
                            className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition ${
                                productMode === 'simple'
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                            }`}
                        >
                            Produit simple
                        </button>
                        <button
                            type="button"
                            onClick={() => setProductMode('variants')}
                            className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition ${
                                productMode === 'variants'
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                            }`}
                        >
                            Produit avec variantes
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        {productMode === 'simple'
                            ? "Un seul prix et un seul stock pour ce produit, sans déclinaison couleur/taille."
                            : "Ce produit existe en plusieurs couleurs et/ou tailles, chacune avec son propre stock."}
                    </p>
                </div>

                {/* ── MODE SIMPLE : juste le stock ── */}
                {productMode === 'simple' && (
                    <div className="flex flex-col gap-1 max-w-md">
                        <label className="text-base font-medium">Stock</label>
                        <input
                            onChange={(e) => setSimpleStock(e.target.value)}
                            value={simpleStock}
                            type="number"
                            min="0"
                            placeholder="Quantité disponible"
                            className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40"
                            required
                        />
                    </div>
                )}

                {/* ── MODE VARIANTES ── */}
                {productMode === 'variants' && (
                    <div className="flex flex-col gap-3 max-w-md">

                        {/* Liste des variantes en accordéon */}
                        {variants.length > 0 && (
                            <div className="flex flex-col gap-2">
                                {variants.map((v, i) => {
                                    const isOpen = openVariantIndex === i
                                    return (
                                        <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                                            {/* En-tête cliquable : résumé de la variante */}
                                            <button
                                                type="button"
                                                onClick={() => setOpenVariantIndex(isOpen ? null : i)}
                                                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-left"
                                            >
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span
                                                        className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                                                        style={{ backgroundColor: v.colorCode }}
                                                    ></span>
                                                    <span className="font-medium">{v.color}</span>
                                                    {v.size && <span className="text-gray-400">· {v.size}</span>}
                                                    <span className="text-green-600 font-medium">· Stock {v.stock}</span>
                                                    {(v.price === null || v.price === undefined) && (
                                                        <span className="text-[10px] text-gray-400 italic">(prix par défaut)</span>
                                                    )}
                                                </div>
                                                <svg
                                                    className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>

                                            {/* Détail dépliable */}
                                            {isOpen && (
                                                <div className="px-3 py-3 border-t border-gray-200 bg-white text-sm space-y-2">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span className="text-gray-400 text-xs block">Couleur</span>
                                                            <span className="font-medium">{v.color}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 text-xs block">Taille</span>
                                                            <span className="font-medium">{v.size || '—'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 text-xs block">Stock</span>
                                                            <span className="font-medium">{v.stock}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 text-xs block">Position photo</span>
                                                            <span className="font-medium">{v.startImageIndex || 0}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 text-xs block">Prix</span>
                                                            <span className="font-medium">
                                                                {v.price !== null && v.price !== undefined ? `${v.price} FCFA` : 'Prix par défaut'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 text-xs block">Prix promo</span>
                                                            <span className="font-medium">
                                                                {v.offerPrice !== null && v.offerPrice !== undefined ? `${v.offerPrice} FCFA` : 'Promo par défaut'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => editVariant(i)}
                                                            className="flex-1 py-1.5 rounded border border-gray-300 text-xs font-medium hover:bg-gray-50"
                                                        >
                                                            ✏️ Modifier
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeVariant(i)}
                                                            className="flex-1 py-1.5 rounded border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50"
                                                        >
                                                            ✕ Supprimer
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Bouton pour afficher le formulaire d'ajout */}
                        {!showVariantForm && (
                            <button
                                type="button"
                                onClick={() => setShowVariantForm(true)}
                                className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-500 hover:border-primary hover:text-primary transition"
                            >
                                + Ajouter une variante
                            </button>
                        )}

                        {/* Formulaire d'ajout / édition de variante */}
                        {showVariantForm && (
                            <div className="bg-gray-50 p-3 rounded-lg space-y-3 border border-gray-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-primary">
                                        {editingVariantIndex !== null ? 'Modifier la variante' : 'Nouvelle variante'}
                                    </span>
                                    <button type="button" onClick={cancelVariantForm} className="text-xs text-gray-400 hover:text-gray-600">
                                        Annuler
                                    </button>
                                </div>

                                <div className="flex gap-2 items-center">
                                    <input value={colorInput} onChange={e => setColorInput(e.target.value)}
                                        type="text" placeholder="Couleur (ex: Rouge)"
                                        className="flex-1 outline-none py-2 px-3 rounded border border-gray-300 text-sm" />
                                    <input value={colorCodeInput} onChange={e => setColorCodeInput(e.target.value)}
                                        type="color" className="w-12 h-10 rounded border border-gray-300 cursor-pointer" />
                                </div>

                                <div className="flex gap-2">
                                    <input value={sizeInput} onChange={e => setSizeInput(e.target.value)}
                                        type="text" placeholder="Taille (optionnel)"
                                        className="flex-1 outline-none py-2 px-3 rounded border border-gray-300 text-sm" />
                                    <input value={stockInput} onChange={e => setStockInput(e.target.value)}
                                        type="number" min="0" placeholder="Stock"
                                        className="w-24 outline-none py-2 px-3 rounded border border-gray-300 text-sm" />
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500 mb-1">
                                        Prix spécifiques (laisser vide = utiliser le prix par défaut)
                                    </p>
                                    <div className="flex gap-2">
                                        <input value={variantPriceInput} onChange={e => setVariantPriceInput(e.target.value)}
                                            type="number" placeholder={`Prix (déf. ${price || '—'})`}
                                            className="flex-1 outline-none py-2 px-3 rounded border border-gray-300 text-sm" />
                                        <input value={variantOfferPriceInput} onChange={e => setVariantOfferPriceInput(e.target.value)}
                                            type="number" placeholder={`Promo (déf. ${offerPrice || '—'})`}
                                            className="flex-1 outline-none py-2 px-3 rounded border border-gray-300 text-sm" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-600 mb-1 block">
                                        Position de départ dans les photos (0 = première photo)
                                    </label>
                                    <input
                                        value={startImageIndexInput}
                                        onChange={e => setStartImageIndexInput(Number(e.target.value))}
                                        type="number"
                                        min="0"
                                        placeholder="Ex: 0 pour Rouge, 3 pour Bleu"
                                        className="w-full outline-none py-2 px-3 rounded border border-gray-300 text-sm"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        💡 Permet d'afficher d'abord les photos correspondant à cette couleur.
                                    </p>
                                </div>

                                <button type="button" onClick={addVariant}
                                    className="w-full py-2 bg-primary text-white rounded text-sm font-medium">
                                    {editingVariantIndex !== null ? 'Mettre à jour la variante' : 'Ajouter cette variante'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <button type="submit" className="px-8 py-2.5 bg-primary text-white font-medium rounded cursor-pointer">
                    AJOUTER LE PRODUIT
                </button>
            </form>

            {/* Modal de crop */}
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