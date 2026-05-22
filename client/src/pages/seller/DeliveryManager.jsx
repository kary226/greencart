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
        return <div className="p-10 text-center">Chargement...</div>;
    }

    return (
        <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll">
            <div className="md:p-10 p-4 space-y-6">
                <h2 className="text-2xl font-bold">Gestion des livraisons</h2>

                <div className="flex gap-4 border-b">
                    <button
                        onClick={() => setActiveTab('types')}
                        className={`pb-2 px-4 ${activeTab === 'types' ? 'border-b-2 border-primary text-primary font-semibold' : 'text-gray-500'}`}
                    >
                        🚚 Types de livraison
                    </button>
                    <button
                        onClick={() => setActiveTab('prices')}
                        className={`pb-2 px-4 ${activeTab === 'prices' ? 'border-b-2 border-primary text-primary font-semibold' : 'text-gray-500'}`}
                    >
                        💰 Tarifs par commune
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
                                className="bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
                            >
                                {showTypeForm ? 'Annuler' : '+ Ajouter un type'}
                            </button>
                        </div>

                        {showTypeForm && (
                            <form onSubmit={handleTypeSubmit} className="bg-white border rounded-xl p-6 mb-6 space-y-4">
                                <h3 className="text-lg font-semibold">{editingType ? 'Modifier' : 'Ajouter'} un type</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <input
                                        type="text"
                                        placeholder="Nom (ex: Standard, Express)"
                                        value={typeForm.name}
                                        onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                        required
                                    />
                                    <input
                                        type="text"
                                        placeholder="Description"
                                        value={typeForm.description}
                                        onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Ordre"
                                        value={typeForm.order}
                                        onChange={(e) => setTypeForm({ ...typeForm, order: parseInt(e.target.value) })}
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none"
                                    />
                                </div>
                                <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg">
                                    {editingType ? 'Mettre à jour' : 'Ajouter'}
                                </button>
                            </form>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full bg-white border rounded-xl">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Nom</th>
                                        <th className="px-4 py-3 text-left">Description</th>
                                        <th className="px-4 py-3 text-left">Statut</th>
                                        <th className="px-4 py-3 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deliveryTypes.map((type) => (
                                        <tr key={type._id} className="border-t">
                                            <td className="px-4 py-3 font-medium">{type.name}</td>
                                            <td className="px-4 py-3">{type.description || '-'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs ${type.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {type.isActive ? 'Actif' : 'Inactif'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingType(type);
                                                            setTypeForm({ name: type.name, description: type.description || '', order: type.order });
                                                            setShowTypeForm(true);
                                                        }}
                                                        className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded"
                                                    >
                                                        Modifier
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteType(type._id)}
                                                        className="text-sm bg-red-50 text-red-500 px-3 py-1 rounded"
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
                )}

                {activeTab === 'prices' && (
                    <div>
                        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                            <select
                                value={selectedCityFilter}
                                onChange={(e) => setSelectedCityFilter(e.target.value)}
                                className="border border-gray-300 rounded-lg px-4 py-2 outline-none"
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
                                    className="bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
                                >
                                    {showPriceForm ? 'Annuler' : '+ Ajouter un tarif'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowBulkForm(!showBulkForm);
                                        setShowPriceForm(false);
                                    }}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
                                >
                                    📦 Ajouter plusieurs
                                </button>
                            </div>
                        </div>

                        {showPriceForm && (
                            <form onSubmit={handlePriceSubmit} className="bg-white border rounded-xl p-6 mb-6 space-y-4">
                                <h3 className="text-lg font-semibold">Ajouter un tarif</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <select
                                        value={priceForm.deliveryTypeId}
                                        onChange={(e) => setPriceForm({ ...priceForm, deliveryTypeId: e.target.value })}
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none"
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
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none"
                                    >
                                        <option value="">Toutes les villes</option>
                                        {cities.map(city => (
                                            <option key={city._id} value={city._id}>{city.name}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={priceForm.communeId}
                                        onChange={(e) => setPriceForm({ ...priceForm, communeId: e.target.value })}
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none"
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
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none"
                                        required
                                    />
                                </div>
                                <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg">
                                    Ajouter
                                </button>
                            </form>
                        )}

                        {showBulkForm && (
                            <form onSubmit={handleBulkSubmit} className="bg-white border rounded-xl p-6 mb-6 space-y-4">
                                <h3 className="text-lg font-semibold">Ajouter plusieurs communes</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <select
                                        value={bulkForm.deliveryTypeId}
                                        onChange={(e) => setBulkForm({ ...bulkForm, deliveryTypeId: e.target.value })}
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none"
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
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none"
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
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none"
                                        required
                                    />
                                    <input
                                        type="number"
                                        placeholder="Prix (FCFA)"
                                        value={bulkForm.price}
                                        onChange={(e) => setBulkForm({ ...bulkForm, price: e.target.value })}
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none"
                                        required
                                    />
                                </div>
                                <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg">
                                    Ajouter toutes les communes
                                </button>
                            </form>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full bg-white border rounded-xl">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Type</th>
                                        <th className="px-4 py-3 text-left">Ville</th>
                                        <th className="px-4 py-3 text-left">Commune</th>
                                        <th className="px-4 py-3 text-left">Prix</th>
                                        <th className="px-4 py-3 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPrices.map((price) => (
                                        <tr key={price._id} className="border-t">
                                            <td className="px-4 py-3">{price.deliveryTypeId?.name || '-'}</td>
                                            <td className="px-4 py-3">{price.cityId?.name || 'Toutes'}</td>
                                            <td className="px-4 py-3">{price.communeId?.name || 'Toutes'}</td>
                                            <td className="px-4 py-3 text-primary font-medium">{price.price} FCFA</td>
                                            <td className="px-4 py-3">
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
                                                        className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded"
                                                    >
                                                        Modifier
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePrice(price._id)}
                                                        className="text-sm bg-red-50 text-red-500 px-3 py-1 rounded"
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
                )}
            </div>
        </div>
    );
};

export default DeliveryManager;