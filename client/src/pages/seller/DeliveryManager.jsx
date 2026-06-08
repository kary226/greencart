import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';

const DeliveryManager = () => {
    const { axios } = useAppContext();
    const [activeTab, setActiveTab] = useState('types');
    const [loading, setLoading] = useState(true);
    
    // Types de livraison
    const [deliveryTypes, setDeliveryTypes] = useState([]);
    const [showTypeForm, setShowTypeForm] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [typeForm, setTypeForm] = useState({ name: '', description: '', order: 0 });
    
    // Prix de livraison
    const [deliveryPrices, setDeliveryPrices] = useState([]);
    const [cities, setCities] = useState([]);
    const [communes, setCommunes] = useState([]);
    const [loadingCommunes, setLoadingCommunes] = useState(false);
    const [showPriceForm, setShowPriceForm] = useState(false);
    const [showBulkForm, setShowBulkForm] = useState(false);
    const [editingPrice, setEditingPrice] = useState(null);
    const [priceForm, setPriceForm] = useState({ deliveryTypeId: '', cityId: '', communeId: '', price: '' });
    const [bulkForm, setBulkForm] = useState({ deliveryTypeId: '', cityId: '', communeNames: '', price: '' });
    const [selectedCityFilter, setSelectedCityFilter] = useState('');

    const fetchDeliveryTypes = async () => {
        try {
            const { data } = await axios.get('/api/delivery/types/admin');
            if (data.success) setDeliveryTypes(data.types);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const fetchDeliveryPrices = async () => {
        try {
            const { data } = await axios.get('/api/delivery/prices/admin');
            if (data.success) setDeliveryPrices(data.prices);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const fetchCities = async () => {
        try {
            const { data } = await axios.get('/api/location/admin/cities');
            if (data.success) setCities(data.cities);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const fetchCommunes = async (cityId) => {
        if (!cityId) {
            setCommunes([]);
            return;
        }
        setLoadingCommunes(true);
        try {
            const { data } = await axios.get(`/api/location/communes/${cityId}`);
            if (data.success) setCommunes(data.communes);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingCommunes(false);
        }
    };

    useEffect(() => {
        Promise.all([fetchDeliveryTypes(), fetchDeliveryPrices(), fetchCities()]).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (priceForm.cityId) {
            fetchCommunes(priceForm.cityId);
        } else {
            setCommunes([]);
        }
    }, [priceForm.cityId]);

    const handleTypeSubmit = async (e) => {
        e.preventDefault();
        try {
            let res;
            if (editingType) {
                res = await axios.post('/api/delivery/type/update', { id: editingType._id, ...typeForm });
            } else {
                res = await axios.post('/api/delivery/type/add', typeForm);
            }
            if (res.data.success) {
                toast.success(res.data.message);
                setShowTypeForm(false);
                setEditingType(null);
                setTypeForm({ name: '', description: '', order: 0 });
                fetchDeliveryTypes();
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleDeleteType = async (id) => {
        if (!window.confirm('Supprimer ce type de livraison ?')) return;
        try {
            const { data } = await axios.post('/api/delivery/type/delete', { id });
            if (data.success) {
                toast.success(data.message);
                fetchDeliveryTypes();
                fetchDeliveryPrices();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handlePriceSubmit = async (e) => {
        e.preventDefault();
        try {
            let res;
            if (editingPrice) {
                res = await axios.post('/api/delivery/price/update', { id: editingPrice._id, price: priceForm.price });
            } else {
                const payload = {
                    deliveryTypeId: priceForm.deliveryTypeId,
                    cityId: priceForm.cityId || null,
                    communeId: priceForm.communeId || null,
                    price: priceForm.price
                };
                res = await axios.post('/api/delivery/price/add', payload);
            }
            if (res.data.success) {
                toast.success(res.data.message);
                setShowPriceForm(false);
                setEditingPrice(null);
                setPriceForm({ deliveryTypeId: '', cityId: '', communeId: '', price: '' });
                fetchDeliveryPrices();
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleBulkSubmit = async (e) => {
        e.preventDefault();
        if (!bulkForm.deliveryTypeId || !bulkForm.cityId || !bulkForm.communeNames || !bulkForm.price) {
            toast.error('Tous les champs sont requis');
            return;
        }
        try {
            const { data } = await axios.post('/api/delivery/price/bulk', bulkForm);
            if (data.success) {
                toast.success(data.message);
                setShowBulkForm(false);
                setBulkForm({ deliveryTypeId: '', cityId: '', communeNames: '', price: '' });
                fetchDeliveryPrices();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleDeletePrice = async (id) => {
        if (!window.confirm('Supprimer ce tarif ?')) return;
        try {
            const { data } = await axios.post('/api/delivery/price/delete', { id });
            if (data.success) {
                toast.success(data.message);
                fetchDeliveryPrices();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const filteredPrices = selectedCityFilter 
        ? deliveryPrices.filter(p => p.cityId?._id === selectedCityFilter || p.cityId === selectedCityFilter)
        : deliveryPrices;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-500">Chargement...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-6 space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestion des livraisons</h1>
                    <p className="text-sm text-gray-500 mt-1">Configurez les types et tarifs de livraison</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('types')}
                        className={`px-6 py-2.5 text-sm font-medium rounded-t-lg transition ${
                            activeTab === 'types' 
                                ? 'bg-white text-red-500 border-b-2 border-red-500' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Types de livraison
                    </button>
                    <button
                        onClick={() => setActiveTab('prices')}
                        className={`px-6 py-2.5 text-sm font-medium rounded-t-lg transition ${
                            activeTab === 'prices' 
                                ? 'bg-white text-red-500 border-b-2 border-red-500' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Tarifs par commune
                    </button>
                </div>

                {activeTab === 'types' && (
                    <div>
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={() => {
                                    setEditingType(null);
                                    setTypeForm({ name: '', description: '', order: 0 });
                                    setShowTypeForm(!showTypeForm);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition shadow-sm"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="8" x2="12" y2="16"/>
                                    <line x1="8" y1="12" x2="16" y2="12"/>
                                </svg>
                                {showTypeForm ? 'Annuler' : 'Ajouter un type'}
                            </button>
                        </div>

                        {showTypeForm && (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                                <div className="p-6 border-b border-gray-100">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        {editingType ? 'Modifier le type' : 'Nouveau type de livraison'}
                                    </h2>
                                </div>
                                <form onSubmit={handleTypeSubmit} className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <input
                                            type="text"
                                            placeholder="Nom (ex: Standard, Express)"
                                            value={typeForm.name}
                                            onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            required
                                        />
                                        <input
                                            type="text"
                                            placeholder="Description"
                                            value={typeForm.description}
                                            onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Ordre"
                                            value={typeForm.order}
                                            onChange={(e) => setTypeForm({ ...typeForm, order: parseInt(e.target.value) })}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        />
                                    </div>
                                    <button type="submit" className="px-6 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition">
                                        {editingType ? 'Mettre à jour' : 'Ajouter'}
                                    </button>
                                </form>
                            </div>
                        )}

                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {deliveryTypes.map((type) => (
                                            <tr key={type._id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 font-medium text-gray-900">{type.name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{type.description || '-'}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                                        type.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {type.isActive ? 'Actif' : 'Inactif'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingType(type);
                                                                setTypeForm({ name: type.name, description: type.description || '', order: type.order });
                                                                setShowTypeForm(true);
                                                            }}
                                                            className="text-xs px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                                        >
                                                            Modifier
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteType(type._id)}
                                                            className="text-xs px-3 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                                                        >
                                                            Supprimer
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'prices' && (
                    <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                            <select
                                value={selectedCityFilter}
                                onChange={(e) => setSelectedCityFilter(e.target.value)}
                                className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                            >
                                <option value="">Toutes les villes</option>
                                {cities.map(city => (
                                    <option key={city._id} value={city._id}>{city.name}</option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setEditingPrice(null);
                                        setPriceForm({ deliveryTypeId: '', cityId: '', communeId: '', price: '' });
                                        setShowPriceForm(!showPriceForm);
                                        setShowBulkForm(false);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition shadow-sm"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <line x1="12" y1="8" x2="12" y2="16"/>
                                        <line x1="8" y1="12" x2="16" y2="12"/>
                                    </svg>
                                    {showPriceForm ? 'Annuler' : 'Ajouter un tarif'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowBulkForm(!showBulkForm);
                                        setShowPriceForm(false);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition shadow-sm"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                                        <line x1="2" y1="10" x2="22" y2="10"/>
                                    </svg>
                                    Ajouter plusieurs
                                </button>
                            </div>
                        </div>

                        {showPriceForm && (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                                <div className="p-6 border-b border-gray-100">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        {editingPrice ? 'Modifier le tarif' : 'Nouveau tarif'}
                                    </h2>
                                </div>
                                <form onSubmit={handlePriceSubmit} className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <select
                                            value={priceForm.deliveryTypeId}
                                            onChange={(e) => setPriceForm({ ...priceForm, deliveryTypeId: e.target.value })}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            required
                                        >
                                            <option value="">Type de livraison</option>
                                            {deliveryTypes.filter(t => t.isActive).map(type => (
                                                <option key={type._id} value={type._id}>{type.name}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={priceForm.cityId}
                                            onChange={(e) => setPriceForm({ ...priceForm, cityId: e.target.value })}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        >
                                            <option value="">Toutes les villes</option>
                                            {cities.map(city => (
                                                <option key={city._id} value={city._id}>{city.name}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={priceForm.communeId}
                                            onChange={(e) => setPriceForm({ ...priceForm, communeId: e.target.value })}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            disabled={!priceForm.cityId}
                                        >
                                            <option value="">Toutes les communes</option>
                                            {communes.map(commune => (
                                                <option key={commune._id} value={commune._id}>{commune.name}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            placeholder="Prix (FCFA)"
                                            value={priceForm.price}
                                            onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            required
                                        />
                                    </div>
                                    <button type="submit" className="px-6 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition">
                                        {editingPrice ? 'Mettre à jour' : 'Ajouter'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {showBulkForm && (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                                <div className="p-6 border-b border-gray-100">
                                    <h2 className="text-lg font-semibold text-gray-900">Ajouter plusieurs communes</h2>
                                </div>
                                <form onSubmit={handleBulkSubmit} className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <select
                                            value={bulkForm.deliveryTypeId}
                                            onChange={(e) => setBulkForm({ ...bulkForm, deliveryTypeId: e.target.value })}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            required
                                        >
                                            <option value="">Type de livraison</option>
                                            {deliveryTypes.filter(t => t.isActive).map(type => (
                                                <option key={type._id} value={type._id}>{type.name}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={bulkForm.cityId}
                                            onChange={(e) => setBulkForm({ ...bulkForm, cityId: e.target.value })}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            required
                                        >
                                            <option value="">Sélectionner une ville</option>
                                            {cities.map(city => (
                                                <option key={city._id} value={city._id}>{city.name}</option>
                                            ))}
                                        </select>
                                        <textarea
                                            placeholder="Noms des communes (séparés par des virgules)"
                                            value={bulkForm.communeNames}
                                            onChange={(e) => setBulkForm({ ...bulkForm, communeNames: e.target.value })}
                                            rows={3}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            required
                                        />
                                        <input
                                            type="number"
                                            placeholder="Prix (FCFA)"
                                            value={bulkForm.price}
                                            onChange={(e) => setBulkForm({ ...bulkForm, price: e.target.value })}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            required
                                        />
                                    </div>
                                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition">
                                        Ajouter toutes les communes
                                    </button>
                                </form>
                            </div>
                        )}

                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ville</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Commune</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Prix</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredPrices.map((price) => (
                                            <tr key={price._id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 text-sm text-gray-900">{price.deliveryTypeId?.name || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{price.cityId?.name || 'Toutes'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{price.communeId?.name || 'Toutes'}</td>
                                                <td className="px-6 py-4 text-sm font-medium text-red-600">{price.price.toLocaleString()} FCFA</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingPrice(price);
                                                                setPriceForm({
                                                                    deliveryTypeId: price.deliveryTypeId?._id || price.deliveryTypeId,
                                                                    cityId: price.cityId?._id || price.cityId || '',
                                                                    communeId: price.communeId?._id || price.communeId || '',
                                                                    price: price.price
                                                                });
                                                                setShowPriceForm(true);
                                                                setShowBulkForm(false);
                                                            }}
                                                            className="text-xs px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                                        >
                                                            Modifier
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePrice(price._id)}
                                                            className="text-xs px-3 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                                                        >
                                                            Supprimer
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeliveryManager;