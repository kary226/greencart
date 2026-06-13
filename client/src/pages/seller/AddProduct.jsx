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
            startImageIndex: Number(startImageIndexInput)
        }

        if (editingVariantIndex !== null) {
            const updatedVariants = [...variants]
            updatedVariants[editingVariantIndex] = newVariant
            setVariants(updatedVariants)
            setEditingVariantIndex(null)
        } else {
            setVariants([...variants, newVariant])
        }

        setColorInput('')
        setColorCodeInput('#000000')
        setSizeInput('')
        setStockInput('')
        setVariantPriceInput('')
        setVariantOfferPriceInput('')
        setStartImageIndexInput(0)
    }

    const editVariant = (index) => {
        const variant = variants[index]
        setColorInput(variant.color)
        setColorCodeInput(variant.colorCode || '#000000')
        setSizeInput(variant.size || '')
        setStockInput(variant.stock.toString())
        setVariantPriceInput(variant.price?.toString() || '')
        setVariantOfferPriceInput(variant.offerPrice?.toString() || '')
        setStartImageIndexInput(variant.startImageIndex || 0)
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
            setStartImageIndexInput(0)
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

        const productData = {
            name,
            description: description.split('\n'),
            categories: selectedCategories,
            price,
            offerPrice,
            variants: variants,
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

                {/* Images principales du produit - UPLOAD ILLIMITÉ */}
                <div>
                    <p className="text-base font-medium">Images du produit (dans l'ordre)</p>
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
                        <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:border-primary">
                            <input 
                                onChange={(e) => {
                                    if (e.target.files[0]) {
                                        setFiles([...files, e.target.files[0]])
                                    }
                                }}
                                type="file" 
                                accept="image/*"
                                className="hidden" 
                            />
                            <span className="text-2xl text-gray-400">+</span>
                        </label>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">💡 Cliquez sur le + pour ajouter des images. L'ordre est important.</p>
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

                {/* VARIANTES PAR COULEUR */}
                <div className="flex flex-col gap-3 max-w-md border-t pt-4">
                    <label className="text-base font-medium text-primary">✨ Variantes par couleur</label>

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

                        <div>
                            <label className="text-xs text-gray-600 mb-1 block">
                                Position de départ (0 = première photo)
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
                                💡 Exemple: Rouge commence à 0, Bleu commence à 3
                            </p>
                        </div>

                        <button type="button" onClick={addVariant}
                            className="w-full py-2 bg-primary text-white rounded text-sm font-medium">
                            {editingVariantIndex !== null ? 'Mettre à jour' : '+ Ajouter cette couleur'}
                        </button>
                    </div>

                    {variants.length > 0 && (
                        <div className="mt-2 border border-gray-200 rounded overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Couleur</th>
                                        <th className="px-3 py-2 text-left">Taille</th>
                                        <th className="px-3 py-2 text-left">Prix</th>
                                        <th className="px-3 py-2 text-left">Stock</th>
                                        <th className="px-3 py-2 text-left">Départ</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {variants.map((v, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: v.colorCode }}></div>
                                                    {v.color}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">{v.size || '—'}</td>
                                            <td className="px-3 py-2">{v.price ? `${v.price} FCFA` : '—'}</td>
                                            <td className="px-3 py-2 font-medium text-green-600">{v.stock}</td>
                                            <td className="px-3 py-2 font-medium text-blue-600">{v.startImageIndex || 0}</td>
                                            <td className="px-3 py-2">
                                                <button type="button" onClick={() => editVariant(i)} className="text-blue-400 mr-2">✏️</button>
                                                <button type="button" onClick={() => removeVariant(i)} className="text-red-400">✕</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <button type="submit" className="px-8 py-2.5 bg-primary text-white font-medium rounded cursor-pointer">
                    AJOUTER LE PRODUIT
                </button>
            </form>
        </div>
    )
}

export default AddProduct