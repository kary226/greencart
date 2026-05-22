import React, { useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import { categories } from '../../assets/assets'
import toast from 'react-hot-toast'

const ProductList = () => {
    const {products, currency, axios, fetchProducts} = useAppContext()
    const [editProduct, setEditProduct] = useState(null)
    const [colorInput, setColorInput] = useState('')
    const [sizeInput, setSizeInput] = useState('')
    const [stockInput, setStockInput] = useState('')

    const toggleStock = async (id, inStock)=>{
        try {
            const { data } = await axios.post('/api/product/stock', {id, inStock});
            if (data.success){
                fetchProducts();
                toast.success(data.message)
            }else{
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const handleEdit = (product) => {
        setEditProduct({
            ...product,
            description: Array.isArray(product.description) ? product.description.join('\n') : product.description,
            variants: product.variants || [],
        })
        setColorInput('')
        setSizeInput('')
        setStockInput('')
    }

    const handleUpdate = async () => {
        try {
            const { data } = await axios.post('/api/product/update', {
                id: editProduct._id,
                name: editProduct.name,
                description: editProduct.description,
                category: editProduct.category,
                price: editProduct.price,
                offerPrice: editProduct.offerPrice,
                variants: editProduct.variants,
            })
            if (data.success){
                toast.success(data.message)
                fetchProducts()
                setEditProduct(null)
            }else{
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer ce produit ?')) return
        try {
            const { data } = await axios.post('/api/product/delete', {id})
            if (data.success){
                toast.success(data.message)
                fetchProducts()
            }else{
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

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
        setEditProduct({...editProduct, variants: [...editProduct.variants, newVariant]})
        setColorInput('')
        setSizeInput('')
        setStockInput('')
    }

    const removeVariant = (index) => {
        setEditProduct({
            ...editProduct,
            variants: editProduct.variants.filter((_, i) => i !== index)
        })
    }

    const updateVariantStock = (index, stock) => {
        const updated = [...editProduct.variants]
        updated[index].stock = Number(stock)
        setEditProduct({...editProduct, variants: updated})
    }

    return (
        <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll flex flex-col justify-between">
            <div className="w-full md:p-10 p-4">
                <h2 className="pb-4 text-lg font-medium">All Products</h2>
                {products.length === 0 ? (
                    <p className="text-gray-500 text-sm">Aucun produit trouvé.</p>
                ) : (
                <div className="flex flex-col items-center max-w-4xl w-full overflow-hidden rounded-md bg-white border border-gray-500/20">
                    <table className="md:table-auto table-fixed w-full overflow-hidden">
                        <thead className="text-gray-900 text-sm text-left">
                            <tr>
                                <th className="px-4 py-3 font-semibold truncate">Produit</th>
                                <th className="px-4 py-3 font-semibold truncate">Catégorie</th>
                                <th className="px-4 py-3 font-semibold truncate hidden md:block">Prix</th>
                                <th className="px-4 py-3 font-semibold truncate">Stock</th>
                                <th className="px-4 py-3 font-semibold truncate">En vente</th>
                                <th className="px-4 py-3 font-semibold truncate">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-gray-500">
                            {products.map((product) => (
                                <tr key={product._id} className="border-t border-gray-500/20">
                                    <td className="md:px-4 pl-2 md:pl-4 py-3 flex items-center space-x-3 truncate">
                                        <div className="border border-gray-300 rounded p-2">
                                            <img src={product.image[0]} alt="Product" className="w-16" />
                                        </div>
                                        <span className="truncate max-sm:hidden w-full">{product.name}</span>
                                    </td>
                                    <td className="px-4 py-3">{product.category}</td>
                                    <td className="px-4 py-3 max-sm:hidden">{product.offerPrice} {currency}</td>
                                    <td className="px-4 py-3">
                                        {product.variants?.length > 0 ? (
                                            <div className="flex flex-col gap-0.5">
                                                {product.variants.map((v, i) => (
                                                    <span key={i} className={`text-xs font-medium ${
                                                        v.stock === 0 ? 'text-red-500' :
                                                        v.stock <= 5 ? 'text-orange-500' :
                                                        'text-green-600'
                                                    }`}>
                                                        {v.color || ''}{v.color && v.size ? ' / ' : ''}{v.size || ''} : {v.stock === 0 ? 'Épuisé' : `${v.stock} restants`}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <label className="relative inline-flex items-center cursor-pointer text-gray-900 gap-3">
                                            <input onClick={()=> toggleStock(product._id, !product.inStock)} checked={product.inStock} type="checkbox" className="sr-only peer" readOnly />
                                            <div className="w-12 h-7 bg-slate-300 rounded-full peer peer-checked:bg-blue-600 transition-colors duration-200"></div>
                                            <span className="dot absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-5"></span>
                                        </label>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <button onClick={() => handleEdit(product)}
                                            className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded transition">
                                                ✏️ Modifier
                                            </button>
                                            <button onClick={() => handleDelete(product._id)}
                                            className="text-xs bg-red-50 text-red-500 hover:bg-red-100 px-3 py-1.5 rounded transition">
                                                🗑️ Supprimer
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                )}
            </div>

            {/* Modal de modification */}
            {editProduct && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium">Modifier le produit</h3>
                            <button onClick={() => setEditProduct(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>

                        {/* Nom */}
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium">Nom</label>
                            <input value={editProduct.name} onChange={e => setEditProduct({...editProduct, name: e.target.value})}
                            className="border border-gray-300 rounded px-3 py-2 outline-none text-sm" />
                        </div>

                        {/* Description */}
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium">Description</label>
                            <textarea value={editProduct.description} onChange={e => setEditProduct({...editProduct, description: e.target.value})}
                            rows={3} className="border border-gray-300 rounded px-3 py-2 outline-none text-sm resize-none" />
                        </div>

                        {/* Catégorie */}
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium">Catégorie</label>
                            <select value={editProduct.category} onChange={e => setEditProduct({...editProduct, category: e.target.value})}
                            className="border border-gray-300 rounded px-3 py-2 outline-none text-sm">
                                {categories.map((item, index) => (
                                    <option key={index} value={item.path}>{item.path}</option>
                                ))}
                            </select>
                        </div>

                        {/* Prix */}
                        <div className="flex gap-4">
                            <div className="flex-1 flex flex-col gap-1">
                                <label className="text-sm font-medium">Prix original</label>
                                <input type="number" value={editProduct.price} onChange={e => setEditProduct({...editProduct, price: e.target.value})}
                                className="border border-gray-300 rounded px-3 py-2 outline-none text-sm" />
                            </div>
                            <div className="flex-1 flex flex-col gap-1">
                                <label className="text-sm font-medium">Prix promo</label>
                                <input type="number" value={editProduct.offerPrice} onChange={e => setEditProduct({...editProduct, offerPrice: e.target.value})}
                                className="border border-gray-300 rounded px-3 py-2 outline-none text-sm" />
                            </div>
                        </div>

                        {/* Variantes */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium">Variantes</label>

                            {/* Ajouter une variante */}
                            <div className="flex gap-2 flex-wrap">
                                <input value={colorInput} onChange={e => setColorInput(e.target.value)}
                                type="text" placeholder="Couleur"
                                className="flex-1 min-w-20 border border-gray-300 rounded px-3 py-2 outline-none text-sm" />
                                <input value={sizeInput} onChange={e => setSizeInput(e.target.value)}
                                type="text" placeholder="Taille"
                                className="flex-1 min-w-20 border border-gray-300 rounded px-3 py-2 outline-none text-sm" />
                                <input value={stockInput} onChange={e => setStockInput(e.target.value)}
                                type="number" placeholder="Stock"
                                className="w-20 border border-gray-300 rounded px-3 py-2 outline-none text-sm" />
                                <button type="button" onClick={addVariant}
                                className="px-3 py-2 bg-primary text-white rounded text-sm">+</button>
                            </div>

                            {/* Liste variantes modifiables */}
                            {editProduct.variants.length > 0 && (
                                <div className="border border-gray-200 rounded overflow-hidden">
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
                                            {editProduct.variants.map((v, i) => (
                                                <tr key={i} className="border-t border-gray-100">
                                                    <td className="px-3 py-2">{v.color || '—'}</td>
                                                    <td className="px-3 py-2">{v.size || '—'}</td>
                                                    <td className="px-3 py-2">
                                                        <input type="number" value={v.stock}
                                                        onChange={e => updateVariantStock(i, e.target.value)}
                                                        className="w-16 border border-gray-300 rounded px-2 py-1 outline-none text-sm" />
                                                    </td>
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

                        {/* Boutons */}
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setEditProduct(null)}
                            className="flex-1 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition">
                                Annuler
                            </button>
                            <button onClick={handleUpdate}
                            className="flex-1 py-2 bg-primary text-white rounded text-sm hover:bg-primary-dull transition">
                                Sauvegarder
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ProductList