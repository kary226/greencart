import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Truck, Plus, X, Loader2, Pencil, Trash2, Search, ChevronLeft, ChevronRight,
    MapPin, Home, Clock, CheckCircle
} from 'lucide-react';

const Deliveries = () => {
    const { axios } = useAppContext();
    const [deliveryTypes, setDeliveryTypes] = useState([]);
    const [deliveryPrices, setDeliveryPrices] = useState([]);
    const [cities, setCities] = useState([]);
    const [communes, setCommunes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('types');

    // Types
    const [showTypeForm, setShowTypeForm] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [typeForm, setTypeForm] = useState({ name: '', description: '', order: 0 });
    const [typeSubmitting, setTypeSubmitting] = useState(false);

    // Prix
    const [showPriceForm, setShowPriceForm] = useState(false);
    const [showBulkForm, setShowBulkForm] = useState(false);
    const [editingPrice, setEditingPrice] = useState(null);
    const [priceForm, setPriceForm] = useState({ deliveryTypeId: '', cityId: '', communeId: '', price: '' });
    const [bulkForm, setBulkForm] = useState({ deliveryTypeId: '', cityId: '', communeNames: '', price: '' });
    const [priceFilter, setPriceFilter] = useState('');
    const [priceSubmitting, setPriceSubmitting] = useState(false);
    const [bulkSubmitting, setBulkSubmitting] = useState(false);

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
        if (!cityId) { setCommunes([]); return; }
        try {
            const { data } = await axios.get(`/api/location/communes/${cityId}`);
            if (data.success) setCommunes(data.communes);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        Promise.all([fetchDeliveryTypes(), fetchDeliveryPrices(), fetchCities()]).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (priceForm.cityId) fetchCommunes(priceForm.cityId);
        else setCommunes([]);
    }, [priceForm.cityId]);

    const handleTypeSubmit = async (e) => {
        e.preventDefault();
        setTypeSubmitting(true);
        try {
            const endpoint = editingType ? '/api/delivery/type/update' : '/api/delivery/type/add';
            const { data } = await axios.post(endpoint, typeForm);
            if (data.success) {
                toast.success(data.message);
                setShowTypeForm(false);
                resetTypeForm();
                fetchDeliveryTypes();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setTypeSubmitting(false);
        }
    };

    const resetTypeForm = () => {
        setEditingType(null);
        setTypeForm({ name: '', description: '', order: 0 });
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
        setPriceSubmitting(true);
        try {
            const endpoint = editingPrice ? '/api/delivery/price/update' : '/api/delivery/price/add';
            const payload = editingPrice ? { id: editingPrice._id, price: priceForm.price } : {
                deliveryTypeId: priceForm.deliveryTypeId,
                cityId: priceForm.cityId || null,
                communeId: priceForm.communeId || null,
                price: priceForm.price
            };
            const { data } = await axios.post(endpoint, payload);
            if (data.success) {
                toast.success(data.message);
                setShowPriceForm(false);
                resetPriceForm();
                fetchDeliveryPrices();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setPriceSubmitting(false);
        }
    };

    const resetPriceForm = () => {
        setEditingPrice(null);
        setPriceForm({ deliveryTypeId: '', cityId: '', communeId: '', price: '' });
    };

    const handleBulkSubmit = async (e) => {
        e.preventDefault();
        if (!bulkForm.deliveryTypeId || !bulkForm.cityId || !bulkForm.communeNames || !bulkForm.price) {
            toast.error('Tous les champs sont requis');
            return;
        }
        setBulkSubmitting(true);
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
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setBulkSubmitting(false);
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

    const filteredPrices = priceFilter ? deliveryPrices.filter(p => p.cityId?._id === priceFilter || p.cityId === priceFilter) : deliveryPrices;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-red-500 mx-auto" size={32} />
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-4 sm:p-6 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Livraisons</h1>
                    <p className="text-sm text-gray-500 mt-1">{deliveryTypes.length} types · {deliveryPrices.length} tarifs</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-gray-200 mt-5">
                    <button onClick={() => setActiveTab('types')} className={`px-6 py-2.5 text-sm font-medium rounded-t-lg transition ${activeTab === 'types' ? 'bg-white text-red-500 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-700'}`}>
                        Types ({deliveryTypes.length})
                    </button>
                    <button onClick={() => setActiveTab('prices')} className={`px-6 py-2.5 text-sm font-medium rounded-t-lg transition ${activeTab === 'prices' ? 'bg-white text-red-500 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-700'}`}>
                        Tarifs ({deliveryPrices.length})
                    </button>
                </div>

                {/* Types */}
                {activeTab === 'types' && (
                    <div className="mt-5">
                        <div className="flex justify-end mb-4">
                            <button onClick={() => { resetTypeForm(); setShowTypeForm(!showTypeForm); }} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition">
                                <Plus size={16} /> {showTypeForm ? 'Annuler' : 'Ajouter un type'}
                            </button>
                        </div>

                        {showTypeForm && (
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
                                <h2 className="font-semibold text-gray-900 mb-4">{editingType ? 'Modifier' : 'Nouveau'} type</h2>
                                <form onSubmit={handleTypeSubmit} className="flex gap-3 flex-wrap">
                                    <input type="text" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="Nom (ex: Standard)" className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" required />
                                    <input type="text" value={typeForm.description} onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })} placeholder="Description" className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" />
                                    <input type="number" value={typeForm.order} onChange={(e) => setTypeForm({ ...typeForm, order: parseInt(e.target.value) || 0 })} placeholder="Ordre" className="w-24 border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                                    <button type="submit" disabled={typeSubmitting} className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50">
                                        {typeSubmitting ? <Loader2 size={16} className="animate-spin" /> : (editingType ? 'Mettre à jour' : 'Ajouter')}
                                    </button>
                                </form>
                            </div>
                        )}

                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom</th>
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {deliveryTypes.map((type) => (
                                            <tr key={type._id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 font-medium text-gray-900">{type.name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{type.description || '-'}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${type.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {type.isActive ? 'Actif' : 'Inactif'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        <button onClick={() => { setEditingType(type); setTypeForm({ name: type.name, description: type.description || '', order: type.order }); setShowTypeForm(true); }} className="text-xs px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition">Modifier</button>
                                                        <button onClick={() => handleDeleteType(type._id)} className="text-xs px-3 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Supprimer</button>
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

                {/* Prix */}
                {activeTab === 'prices' && (
                    <div className="mt-5">
                        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                            <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)} className="px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none bg-white">
                                <option value="">Toutes les villes</option>
                                {cities.map(city => <option key={city._id} value={city._id}>{city.name}</option>)}
                            </select>
                            <div className="flex gap-2">
                                <button onClick={() => { resetPriceForm(); setShowPriceForm(!showPriceForm); setShowBulkForm(false); }} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition">
                                    <Plus size={16} /> {showPriceForm ? 'Annuler' : 'Ajouter un tarif'}
                                </button>
                                <button onClick={() => { setShowBulkForm(!showBulkForm); setShowPriceForm(false); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition">
                                    Ajouter plusieurs
                                </button>
                            </div>
                        </div>

                        {showPriceForm && (
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
                                <h2 className="font-semibold text-gray-900 mb-4">{editingPrice ? 'Modifier' : 'Nouveau'} tarif</h2>
                                <form onSubmit={handlePriceSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <select value={priceForm.deliveryTypeId} onChange={(e) => setPriceForm({ ...priceForm, deliveryTypeId: e.target.value })} className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" required>
                                        <option value="">Type de livraison</option>
                                        {deliveryTypes.filter(t => t.isActive).map(type => <option key={type._id} value={type._id}>{type.name}</option>)}
                                    </select>
                                    <select value={priceForm.cityId} onChange={(e) => setPriceForm({ ...priceForm, cityId: e.target.value })} className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none">
                                        <option value="">Toutes les villes</option>
                                        {cities.map(city => <option key={city._id} value={city._id}>{city.name}</option>)}
                                    </select>
                                    <select value={priceForm.communeId} onChange={(e) => setPriceForm({ ...priceForm, communeId: e.target.value })} className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" disabled={!priceForm.cityId}>
                                        <option value="">Toutes les communes</option>
                                        {communes.map(commune => <option key={commune._id} value={commune._id}>{commune.name}</option>)}
                                    </select>
                                    <input type="number" value={priceForm.price} onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })} placeholder="Prix (FCFA)" className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" required />
                                    <div className="md:col-span-2 flex gap-2">
                                        <button type="submit" disabled={priceSubmitting} className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50">
                                            {priceSubmitting ? <Loader2 size={16} className="animate-spin" /> : (editingPrice ? 'Mettre à jour' : 'Ajouter')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {showBulkForm && (
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
                                <h2 className="font-semibold text-gray-900 mb-4">Ajouter plusieurs communes</h2>
                                <form onSubmit={handleBulkSubmit} className="space-y-3">
                                    <select value={bulkForm.deliveryTypeId} onChange={(e) => setBulkForm({ ...bulkForm, deliveryTypeId: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" required>
                                        <option value="">Type de livraison</option>
                                        {deliveryTypes.filter(t => t.isActive).map(type => <option key={type._id} value={type._id}>{type.name}</option>)}
                                    </select>
                                    <select value={bulkForm.cityId} onChange={(e) => setBulkForm({ ...bulkForm, cityId: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" required>
                                        <option value="">Sélectionner une ville</option>
                                        {cities.map(city => <option key={city._id} value={city._id}>{city.name}</option>)}
                                    </select>
                                    <textarea value={bulkForm.communeNames} onChange={(e) => setBulkForm({ ...bulkForm, communeNames: e.target.value })} placeholder="Noms séparés par des virgules" rows={3} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" required />
                                    <input type="number" value={bulkForm.price} onChange={(e) => setBulkForm({ ...bulkForm, price: e.target.value })} placeholder="Prix (FCFA)" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" required />
                                    <button type="submit" disabled={bulkSubmitting} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                                        {bulkSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Ajouter toutes les communes'}
                                    </button>
                                </form>
                            </div>
                        )}

                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ville</th>
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Commune</th>
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Prix</th>
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
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
                                                        <button onClick={() => { setEditingPrice(price); setPriceForm({ deliveryTypeId: price.deliveryTypeId?._id || price.deliveryTypeId, cityId: price.cityId?._id || price.cityId || '', communeId: price.communeId?._id || price.communeId || '', price: price.price }); setShowPriceForm(true); setShowBulkForm(false); }} className="text-xs px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition">Modifier</button>
                                                        <button onClick={() => handleDeletePrice(price._id)} className="text-xs px-3 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Supprimer</button>
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

export default Deliveries;