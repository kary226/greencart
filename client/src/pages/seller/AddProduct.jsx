import React, { useState, useEffect } from 'react'
import { assets } from '../../assets/assets';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';

const AddProduct = () => {

    const [files, setFiles] = useState([]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [price, setPrice] = useState('');
    const [offerPrice, setOfferPrice] = useState('');
    const [categoriesList, setCategoriesList] = useState([]);

    // Variants améliorés avec prix, stock et images
    const [variants, setVariants] = useState([])
    const [colorInput, setColorInput] = useState('')
    const [colorCodeInput, setColorCodeInput] = useState('#000000')
    const [sizeInput, setSizeInput] = useState('')
    const [stockInput, setStockInput] = useState('')
    const [variantPriceInput, setVariantPriceInput] = useState('')
    const [variantOfferPriceInput, setVariantOfferPriceInput] = useState('')
    const [variantImages, setVariantImages] = useState([])
    const [editingVariantIndex, setEditingVariantIndex] = useState(null)

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

    const handleVariantImageUpload = (e) => {
        const newFiles = Array.from(e.target.files)
        setVariantImages([...variantImages, ...newFiles])
    }

    const removeVariantImage = (index) => {
        setVariantImages(variantImages.filter((_, i) => i !== index))
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

        const newVariant = {
            color: colorInput.trim(),
            colorCode: colorCodeInput,
            size: sizeInput.trim().toUpperCase() || null,
            stock: Number(stockInput),
            price: variantPriceInput ? Number(variantPriceInput) : 0,
            offerPrice: variantOfferPriceInput ? Number(variantOfferPriceInput) : 0,
            images: variantImages.map(img => img) // Stockage temporaire, sera uploadé plus tard
        }

        if (editingVariantIndex !== null) {
            const updatedVariants = [...variants]
            updatedVariants[editingVariantIndex] = newVariant
            setVariants(updatedVariants)
            setEditingVariantIndex(null)
        } else {
            setVariants([...variants, newVariant])
        }

        // Reset du formulaire
        setColorInput('')
        setColorCodeInput('#000000')
        setSizeInput('')
        setStockInput('')
        setVariantPriceInput('')
        setVariantOfferPriceInput('')
        setVariantImages([])
    }

    const editVariant = (index) => {
        const variant = variants[index]
        setColorInput(variant.color)
        setColorCodeInput(variant.colorCode || '#000000')
        setSizeInput(variant.size || '')
        setStockInput(variant.stock.toString())
        setVariantPriceInput(variant.price?.toString() || '')
        setVariantOfferPriceInput(variant.offerPrice?.toString() || '')
        setVariantImages([])
        setEditingVariantIndex(index)
    }

    const removeVariant = (index) => {
        setVariants(variants.filter((_, i) => i !== index))
        if (editingVariantIndex === index) {
            setEditingVariantIndex(null)
            setColorInput('')
            setColorCodeInput('#000000')
            setSizeInput('')
            setStockInput('')
            setVariantPriceInput('')
            setVariantOfferPriceInput('')
            setVariantImages([])
        }
    }

    const handleCategoryToggle = (categorySlug) => {
        if (selectedCategories.includes(categorySlug)) {
            setSelectedCategories(selectedCategories.filter(c => c !== categorySlug));
        } else {
            setSelectedCategories([...selectedCategories, categorySlug]);
        }
    };

    const onSubmitHandler = async (event) => {
        event.preventDefault();

        if (selectedCategories.length === 0) {
            toast.error('Veuillez sélectionner au moins une catégorie');
            return;
        }

        // Upload des images des variantes
        const variantImagesUrls = []
        for (const variant of variants) {
            const variantImageUrls = []
            for (const img of variant.images) {
                if (img instanceof File) {
                    const formData = new FormData()
                    formData.append('image', img)
                    try {
                        const { data } = await axios.post('/api/upload/image', formData)
                        if (data.success) {
                            variantImageUrls.push(data.url)
                        }
                    } catch (error) {
                        console.error('Upload failed:', error)
                    }
                } else {
                    variantImageUrls.push(img)
                }
            }
            variantImagesUrls.push(variantImageUrls)
        }

        // Construire les variantes avec les URLs des images
        const processedVariants = variants.map((variant, idx) => ({
            ...variant,
            images: variantImagesUrls[idx] || []
        }))

        const productData = {
            name,
            description: description.split('\n'),
            categories: selectedCategories,
            price,
            offerPrice,
            variants: processedVariants,
            imagesPerVariant: 1 // Nombre d'images par variante
        }

        const formData = new FormData();
        formData.append('productData', JSON.stringify(productData));
        
        // Ajouter toutes les images (principales + variantes)
        for (let i = 0; i < files.length; i++) {
            formData.append('images', files[i])
        }
        
        // Ajouter les images des variantes
        for (const variant of variants) {
            for (const img of variant.images) {
                if (img instanceof File) {
                    formData.append('images', img)
                }
            }
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
                setEditingVariantIndex(null);
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
                    <p className="text-base font-medium">Images principales du produit</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                        {Array(4).fill('').map((_, index) => (
                            <label key={index} htmlFor={`image${index}`}>
                                <input onChange={(e) => {
                                    const updatedFiles = [...files];
                                    updatedFiles[index] = e.target.files[0]
                                    setFiles(updatedFiles)
                                }}
                                    type="file" id={`image${index}`} hidden />
                                <img className="max-w-24 cursor-pointer" src={files[index] ? URL.createObjectURL(files[index]) : assets.upload_area} alt="uploadArea" width={100} height={100} />
                            </label>
                        ))}
                    </div>
                </div>

                {/* Nom du produit */}
                <div className="flex flex-col gap-1 max-w-md">
                    <label className="text-base font-medium" htmlFor="product-name">Nom du produit</label>
                    <input onChange={(e) => setName(e.target.value)} value={name}
                        id="product-name" type="text" placeholder="Type here" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1 max-w-md">
                    <label className="text-base font-medium" htmlFor="product-description">Description</label>
                    <textarea onChange={(e) => setDescription(e.target.value)} value={description}
                        id="product-description" rows={4} className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40 resize-none" placeholder="Type here"></textarea>
                </div>

                {/* Catégories multiples */}
                <div className="w-full flex flex-col gap-2">
                    <label className="text-base font-medium">Catégories (sélection multiple)</label>
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
                    <p className="text-xs text-gray-400">
                        {selectedCategories.length} catégorie(s) sélectionnée(s)
                    </p>
                </div>

                {/* Prix par défaut */}
                <div className="flex items-center gap-5 flex-wrap">
                    <div className="flex-1 flex flex-col gap-1 w-32">
                        <label className="text-base font-medium" htmlFor="product-price">Prix par défaut</label>
                        <input onChange={(e) => setPrice(e.target.value)} value={price}
                            id="product-price" type="number" placeholder="0" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                    </div>
                    <div className="flex-1 flex flex-col gap-1 w-32">
                        <label className="text-base font-medium" htmlFor="offer-price">Prix promo défaut</label>
                        <input onChange={(e) => setOfferPrice(e.target.value)} value={offerPrice}
                            id="offer-price" type="number" placeholder="0" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                    </div>
                </div>

                {/* AJOUT VARIANTE PAR COULEUR */}
                <div className="flex flex-col gap-3 max-w-md border-t pt-4">
                    <label className="text-base font-medium text-primary">
                        ✨ Variantes par couleur
                    </label>

                    {/* Formulaire d'ajout de variante */}
                    <div className="bg-gray-50 p-3 rounded-lg space-y-3">
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
                                type="number" placeholder="Stock"
                                className="w-24 outline-none py-2 px-3 rounded border border-gray-300 text-sm" />
                        </div>

                        <div className="flex gap-2">
                            <input value={variantPriceInput} onChange={e => setVariantPriceInput(e.target.value)}
                                type="number" placeholder="Prix (optionnel)"
                                className="flex-1 outline-none py-2 px-3 rounded border border-gray-300 text-sm" />
                            <input value={variantOfferPriceInput} onChange={e => setVariantOfferPriceInput(e.target.value)}
                                type="number" placeholder="Prix promo (optionnel)"
                                className="flex-1 outline-none py-2 px-3 rounded border border-gray-300 text-sm" />
                        </div>

                        {/* Upload images pour cette couleur */}
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Images pour cette couleur</p>
                            <div className="flex flex-wrap gap-2">
                                {variantImages.map((img, idx) => (
                                    <div key={idx} className="relative">
                                        <img src={URL.createObjectURL(img)} alt={`variant-${idx}`} className="w-12 h-12 object-cover rounded" />
                                        <button type="button" onClick={() => removeVariantImage(idx)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs">×</button>
                                    </div>
                                ))}
                                <label className="w-12 h-12 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:border-primary">
                                    <input type="file" multiple accept="image/*" onChange={handleVariantImageUpload} className="hidden" />
                                    <span className="text-xl text-gray-400">+</span>
                                </label>
                            </div>
                        </div>

                        <button type="button" onClick={addVariant}
                            className="w-full py-2 bg-primary text-white rounded text-sm font-medium">
                            {editingVariantIndex !== null ? 'Mettre à jour la variante' : '+ Ajouter cette couleur'}
                        </button>
                    </div>

                    {/* Liste des variantes existantes */}
                    {variants.length > 0 && (
                        <div className="mt-2 border border-gray-200 rounded overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Couleur</th>
                                        <th className="px-3 py-2 text-left">Taille</th>
                                        <th className="px-3 py-2 text-left">Prix</th>
                                        <th className="px-3 py-2 text-left">Stock</th>
                                        <th className="px-3 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {variants.map((v, i) => (
                                        <tr key={i} className="border-t border-gray-100">
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: v.colorCode }}></div>
                                                    {v.color}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">{v.size || '—'}</td>
                                            <td className="px-3 py-2">
                                                {v.price ? `${v.price} FCFA` : '—'}
                                                {v.offerPrice && <span className="text-xs text-green-500 ml-1">promo</span>}
                                            </td>
                                            <td className="px-3 py-2 font-medium text-green-600">{v.stock}</td>
                                            <td className="px-3 py-2 space-x-2">
                                                <button type="button" onClick={() => editVariant(i)} className="text-blue-400 hover:text-blue-600 text-xs">✏️</button>
                                                <button type="button" onClick={() => removeVariant(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <p className="text-xs text-gray-400">
                        💡 Chaque couleur peut avoir son propre prix, stock et images.
                    </p>
                </div>

                <button type="submit" className="px-8 py-2.5 bg-primary text-white font-medium rounded cursor-pointer">
                    AJOUTER LE PRODUIT
                </button>
            </form>
        </div>
    )
}

export default AddProduct