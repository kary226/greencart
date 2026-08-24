import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    MapPin, Home, Plus, X, Loader2, Pencil, Trash2, Search, ChevronLeft, ChevronRight
} from 'lucide-react';

const Locations = () => {
    const { axios } = useAppContext();
    const [cities, setCities] = useState([]);
    const [communes, setCommunes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('cities');

    // Villes
    const [showCityForm, setShowCityForm] = useState(false);
    const [editingCity, setEditingCity] = useState(null);
    const [cityForm, setCityForm] = useState({ name: '' });
    const [citySubmitting, setCitySubmitting] = useState(false);

    // Communes
    const [showCommuneForm, setShowCommuneForm] = useState(false);
    const [showBulkForm, setShowBulkForm] = useState(false);
    const [editingCommune, setEditingCommune] = useState(null);
    const [communeForm, setCommuneForm] = useState({ name: '', cityId: '' });
    const [bulkForm, setBulkForm] = useState({ names: '', cityId: '' });
    const [communeSubmitting, setCommuneSubmitting] = useState(false);
    const [bulkSubmitting, setBulkSubmitting] = useState(false);
    const [cityFilter, setCityFilter] = useState('');

    const fetchCities = async () => {
        try {
            const { data } = await axios.get('/api/location/admin/cities');
            if (data.success) setCities(data.cities);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const fetchCommunes = async () => {
        try {
            const { data } = await axios.get('/api/location/admin/communes');
            if (data.success) setCommunes(data.communes);
        } catch (error) {
            toast.error(error.message);
        }
    };

    useEffect(() => {
        Promise.all([fetchCities(), fetchCommunes()]).finally(() => setLoading(false));
    }, []);

    const handleCitySubmit = async (e) => {
        e.preventDefault();
        setCitySubmitting(true);
        try {
            const endpoint = editingCity ? '/api/location/city/update' : '/api/location/city/add';
            const { data } = await axios.post(endpoint, cityForm);
            if (data.success) {
                toast.success(data.message);
                setShowCityForm(false);
                resetCityForm();
                fetchCities();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setCitySubmitting(false);
        }
    };

    const resetCityForm = () => {
        setEditingCity(null);
        setCityForm({ name: '' });
    };

    const handleDeleteCity = async (id) => {
        if (!window.confirm('Supprimer cette ville ? Toutes ses communes seront aussi supprimées.')) return;
        try {
            const { data } = await axios.post('/api/location/city/delete', { id });
            if (data.success) {
                toast.success(data.message);
                fetchCities();
                fetchCommunes();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleCommuneSubmit = async (e) => {
        e.preventDefault();
        setCommuneSubmitting(true);
        try {
            const endpoint = editingCommune ? '/api/location/commune/update' : '/api/location/commune/add';
            const { data } = await axios.post(endpoint, communeForm);
            if (data.success) {
                toast.success(data.message);
                setShowCommuneForm(false);
                resetCommuneForm();
                fetchCommunes();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setCommuneSubmitting(false);
        }
    };

    const resetCommuneForm = () => {
        setEditingCommune(null);
        setCommuneForm({ name: '', cityId: '' });
    };

    const handleBulkSubmit = async (e) => {
        e.preventDefault();
        if (!bulkForm.cityId || !bulkForm.names.trim()) {
            toast.error('Veuillez remplir tous les champs');
            return;
        }
        setBulkSubmitting(true);
        try {
            const { data } = await axios.post('/api/location/commune/bulk', bulkForm);
            if (data.success) {
                toast.success(data.message);
                setShowBulkForm(false);
                setBulkForm({ names: '', cityId: '' });
                fetchCommunes();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setBulkSubmitting(false);
        }
    };

    const handleDeleteCommune = async (id) => {
        if (!window.confirm('Supprimer cette commune ?')) return;
        try {
            const { data } = await axios.post('/api/location/commune/delete', { id });
            if (data.success) {
                toast.success(data.message);
                fetchCommunes();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const filteredCommunes = cityFilter
        ? communes.filter(c => c.cityId?._id === cityFilter || c.cityId === cityFilter)
        : communes;

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
                    <h1 className="text-2xl font-bold text-gray-900">Localisations</h1>
                    <p className="text-sm text-gray-500 mt-1">{cities.length} villes · {communes.length} communes</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-gray-200 mt-5">
                    <button
                        onClick={() => setActiveTab('cities')}
                        className={`px-6 py-2.5 text-sm font-medium rounded-t-lg transition ${activeTab === 'cities' ? 'bg-white text-red-500 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Villes ({cities.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('communes')}
                        className={`px-6 py-2.5 text-sm font-medium rounded-t-lg transition ${activeTab === 'communes' ? 'bg-white text-red-500 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Communes ({communes.length})
                    </button>
                </div>

                {/* Villes */}
                {activeTab === 'cities' && (
                    <div className="mt-5">
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={() => { resetCityForm(); setShowCityForm(!showCityForm); }}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition"
                            >
                                <Plus size={16} />
                                {showCityForm ? 'Annuler' : 'Ajouter une ville'}
                            </button>
                        </div>

                        {showCityForm && (
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
                                <h2 className="font-semibold text-gray-900 mb-4">{editingCity ? 'Modifier' : 'Nouvelle'} ville</h2>
                                <form onSubmit={handleCitySubmit} className="flex gap-3">
                                    <input type="text" value={cityForm.name} onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })} placeholder="Nom de la ville" className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" required />
                                    <button type="submit" disabled={citySubmitting} className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50">
                                        {citySubmitting ? <Loader2 size={16} className="animate-spin" /> : (editingCity ? 'Mettre à jour' : 'Ajouter')}
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
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {cities.map((city) => (
                                            <tr key={city._id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 font-medium text-gray-900">{city.name}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        <button onClick={() => { setEditingCity(city); setCityForm({ name: city.name }); setShowCityForm(true); }} className="text-xs px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition">Modifier</button>
                                                        <button onClick={() => handleDeleteCity(city._id)} className="text-xs px-3 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Supprimer</button>
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

                {/* Communes */}
                {activeTab === 'communes' && (
                    <div className="mt-5">
                        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                            <div className="flex gap-2">
                                <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none bg-white">
                                    <option value="">Toutes les villes</option>
                                    {cities.map(city => <option key={city._id} value={city._id}>{city.name}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { resetCommuneForm(); setShowCommuneForm(!showCommuneForm); setShowBulkForm(false); }} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition">
                                    <Plus size={16} />
                                    {showCommuneForm ? 'Annuler' : 'Ajouter'}
                                </button>
                                <button onClick={() => { setShowBulkForm(!showBulkForm); setShowCommuneForm(false); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition">
                                    Ajouter plusieurs
                                </button>
                            </div>
                        </div>

                        {showCommuneForm && (
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
                                <h2 className="font-semibold text-gray-900 mb-4">{editingCommune ? 'Modifier' : 'Nouvelle'} commune</h2>
                                <form onSubmit={handleCommuneSubmit} className="flex gap-3 flex-wrap">
                                    <select value={communeForm.cityId} onChange={(e) => setCommuneForm({ ...communeForm, cityId: e.target.value })} className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" required>
                                        <option value="">Ville</option>
                                        {cities.map(city => <option key={city._id} value={city._id}>{city.name}</option>)}
                                    </select>
                                    <input type="text" value={communeForm.name} onChange={(e) => setCommuneForm({ ...communeForm, name: e.target.value })} placeholder="Nom de la commune" className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" required />
                                    <button type="submit" disabled={communeSubmitting} className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50">
                                        {communeSubmitting ? <Loader2 size={16} className="animate-spin" /> : (editingCommune ? 'Mettre à jour' : 'Ajouter')}
                                    </button>
                                </form>
                            </div>
                        )}

                        {showBulkForm && (
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
                                <h2 className="font-semibold text-gray-900 mb-4">Ajouter plusieurs communes</h2>
                                <form onSubmit={handleBulkSubmit} className="space-y-3">
                                    <select value={bulkForm.cityId} onChange={(e) => setBulkForm({ ...bulkForm, cityId: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" required>
                                        <option value="">Sélectionner une ville</option>
                                        {cities.map(city => <option key={city._id} value={city._id}>{city.name}</option>)}
                                    </select>
                                    <textarea value={bulkForm.names} onChange={(e) => setBulkForm({ ...bulkForm, names: e.target.value })} placeholder="Noms séparés par des virgules&#10;Ex: Cocody, Marcory, Yopougon, Plateau" rows={3} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" required />
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
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ville</th>
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Commune</th>
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredCommunes.map((commune) => (
                                            <tr key={commune._id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 text-sm text-gray-500">{commune.cityId?.name || '-'}</td>
                                                <td className="px-6 py-4 font-medium text-gray-900">{commune.name}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        <button onClick={() => { setEditingCommune(commune); setCommuneForm({ name: commune.name, cityId: commune.cityId?._id || commune.cityId }); setShowCommuneForm(true); setShowBulkForm(false); }} className="text-xs px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition">Modifier</button>
                                                        <button onClick={() => handleDeleteCommune(commune._id)} className="text-xs px-3 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Supprimer</button>
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

export default Locations;