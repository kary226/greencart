import React, { useState, useEffect } from 'react'
import { assets } from '../../assets/assets';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';

const AddProduct = () => {

    const [files, setFiles] = useState([]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]); // ← MODIFIÉ : tableau
    const [price, setPrice] = useState('');
    const [offerPrice, setOfferPrice] = useState('');
    const [categoriesList, setCategoriesList] = useState([]);

    // Variants
    const [variants, setVariants] = useState([])
    const [colorInput, setColorInput] = useState('')
    const [sizeInput, setSizeInput] = useState('')
    const [stockInput, setStockInput] = useState('')

    const {axios} = useAppContext()

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
        if (!colorInput.trim() && !sizeInput.trim()) {
            toast.error('Entrez au moins une couleur ou une taille')
            return
        }
        if (!stockInput || Number(stockInput) < 0) {
            toast.error('Entrez un stock valide')
            return
        }
        const newVariant = {
            color: colorInput.trim() || null,
            size: sizeInput.trim().toUpperCase() || null,
            stock: Number(stockInput)
        }
        setVariants([...variants, newVariant])
        setColorInput('')
        setSizeInput('')
        setStockInput('')
    }

    const removeVariant = (index) => {
        setVariants(variants.filter((_, i) => i !== index))
    }

    // Gestion des catégories multiples
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
            categories: selectedCategories, // ← MODIFIÉ : tableau au lieu d'une seule catégorie
            price,
            offerPrice,
            variants,
        }

        const formData = new FormData();
        formData.append('productData', JSON.stringify(productData));
        for (let i = 0; i < files.length; i++) {
            formData.append('images', files[i])
        }

        try {
            const {data} = await axios.post('/api/product/add', formData)

            if (data.success){
                toast.success(data.message);
                setName('');
                setDescription('');
                setSelectedCategories([]);
                setPrice('');
                setOfferPrice('');
                setFiles([]);
                setVariants([]);
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

                {/* Images */}
                <div>
                    <p className="text-base font-medium">Product Image</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                        {Array(4).fill('').map((_, index) => (
                            <label key={index} htmlFor={`image${index}`}>
                                <input onChange={(e)=>{
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

                {/* Nom */}
                <div className="flex flex-col gap-1 max-w-md">
                    <label className="text-base font-medium" htmlFor="product-name">Product Name</label>
                    <input onChange={(e)=> setName(e.target.value)} value={name}
                     id="product-name" type="text" placeholder="Type here" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1 max-w-md">
                    <label className="text-base font-medium" htmlFor="product-description">Product Description</label>
                    <textarea onChange={(e)=> setDescription(e.target.value)} value={description}
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
                                className={`px-3 py-1.5 rounded-full text-sm transition ${
                                    selectedCategories.includes(item.slug)
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

                {/* Prix */}
                <div className="flex items-center gap-5 flex-wrap">
                    <div className="flex-1 flex flex-col gap-1 w-32">
                        <label className="text-base font-medium" htmlFor="product-price">Product Price</label>
                        <input onChange={(e)=> setPrice(e.target.value)} value={price}
                         id="product-price" type="number" placeholder="0" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                    </div>
                    <div className="flex-1 flex flex-col gap-1 w-32">
                        <label className="text-base font-medium" htmlFor="offer-price">Offer Price</label>
                        <input onChange={(e)=> setOfferPrice(e.target.value)} value={offerPrice}
                        id="offer-price" type="number" placeholder="0" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                    </div>
                </div>

                {/* Variants */}
                <div className="flex flex-col gap-2 max-w-md">
                    <label className="text-base font-medium">
                        Variantes <span className="text-gray-400 text-sm font-normal">(couleur + taille + stock)</span>
                    </label>

                    <div className="flex gap-2 flex-wrap">
                        <input value={colorInput} onChange={e => setColorInput(e.target.value)}
                        type="text" placeholder="Couleur (ex: Rouge)"
                        className="flex-1 min-w-24 outline-none py-2 px-3 rounded border border-gray-500/40 text-sm" />
                        <input value={sizeInput} onChange={e => setSizeInput(e.target.value)}
                        type="text" placeholder="Taille (ex: XL)"
                        className="flex-1 min-w-24 outline-none py-2 px-3 rounded border border-gray-500/40 text-sm" />
                        <input value={stockInput} onChange={e => setStockInput(e.target.value)}
                        type="number" placeholder="Stock"
                        className="w-20 outline-none py-2 px-3 rounded border border-gray-500/40 text-sm" />
                        <button type="button" onClick={addVariant}
                        className="px-4 py-2 bg-primary text-white rounded text-sm">
                            + Ajouter
                        </button>
                    </div>

                    {variants.length > 0 && (
                        <div className="mt-2 border border-gray-200 rounded overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Couleur</th>
                                        <th className="px-3 py-2 text-left">Taille</th>
                                        <th className="px-3 py-2 text-left">Stock</th>
                                        <th className="px-3 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {variants.map((v, i) => (
                                        <tr key={i} className="border-t border-gray-100">
                                            <td className="px-3 py-2">{v.color || '—'}</td>
                                            <td className="px-3 py-2">{v.size || '—'}</td>
                                            <td className="px-3 py-2 font-medium text-green-600">{v.stock}</td>
                                            <td className="px-3 py-2">
                                                <button type="button" onClick={() => removeVariant(i)}
                                                className="text-red-400 hover:text-red-600 text-xs">✕</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <button type="submit" className="px-8 py-2.5 bg-primary text-white font-medium rounded cursor-pointer">
                    AJOUTER
                </button>
            </form>
        </div>
    )
}

export default AddProduct