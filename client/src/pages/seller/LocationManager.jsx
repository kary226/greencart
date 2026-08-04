import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';

const LocationManager = () => {
    const { axios } = useAppContext();
    const [cities, setCities] = useState([]);
    const [communes, setCommunes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('cities');
    
    // États pour les villes
    const [showCityForm, setShowCityForm] = useState(false);
    const [editingCity, setEditingCity] = useState(null);
    const [cityForm, setCityForm] = useState({ name: '' });
    
    // États pour les communes
    const [showCommuneForm, setShowCommuneForm] = useState(false);
    const [showBulkCommuneForm, setShowBulkCommuneForm] = useState(false);
    const [editingCommune, setEditingCommune] = useState(null);
    const [communeForm, setCommuneForm] = useState({ name: '', cityId: '' });
    const [bulkCommuneForm, setBulkCommuneForm] = useState({ names: '', cityId: '' });
    const [selectedCityFilter, setSelectedCityFilter] = useState('');

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
        try {
            let res;
            if (editingCity) {
                res = await axios.post('/api/location/city/update', { id: editingCity._id, name: cityForm.name });
            } else {
                res = await axios.post('/api/location/city/add', cityForm);
            }
            if (res.data.success) {
                toast.success(res.data.message);
                setShowCityForm(false);
                setEditingCity(null);
                setCityForm({ name: '' });
                fetchCities();
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
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
        try {
            let res;
            if (editingCommune) {
                res = await axios.post('/api/location/commune/update', { id: editingCommune._id, name: communeForm.name, cityId: communeForm.cityId });
            } else {
                res = await axios.post('/api/location/commune/add', communeForm);
            }
            if (res.data.success) {
                toast.success(res.data.message);
                setShowCommuneForm(false);
                setEditingCommune(null);
                setCommuneForm({ name: '', cityId: '' });
                fetchCommunes();
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleBulkCommuneSubmit = async (e) => {
        e.preventDefault();
        
        if (!bulkCommuneForm.cityId) {
            toast.error('Veuillez sélectionner une ville');
            return;
        }
        if (!bulkCommuneForm.names.trim()) {
            toast.error('Veuillez entrer des noms de communes');
            return;
        }

        const namesList = bulkCommuneForm.names
            .split(',')
            .map(name => name.trim())
            .filter(name => name !== '');

        if (namesList.length === 0) {
            toast.error('Aucun nom valide');
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const name of namesList) {
            try {
                const { data } = await axios.post('/api/location/commune/add', {
                    name: name,
                    cityId: bulkCommuneForm.cityId
                });
                if (data.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
            }
        }

        if (successCount > 0) {
            toast.success(`${successCount} commune(s) ajoutée(s)${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}`);
        } else {
            toast.error(`Aucune commune ajoutée (${errorCount} erreur(s))`);
        }

        setBulkCommuneForm({ names: '', cityId: '' });
        setShowBulkCommuneForm(false);
        fetchCommunes();
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

    const filteredCommunes = selectedCityFilter 
        ? communes.filter(c => c.cityId?._id === selectedCityFilter || c.cityId === selectedCityFilter)
        : communes;

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
            <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestion des localisations</h1>
                    <p className="text-sm text-gray-500 mt-1">Gérez les villes et communes</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('cities')}
                        className={`px-6 py-2.5 text-sm font-medium rounded-t-lg transition ${
                            activeTab === 'cities' 
                                ? 'bg-white text-red-500 border-b-2 border-red-500' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Villes
                    </button>
                    <button
                        onClick={() => setActiveTab('communes')}
                        className={`px-6 py-2.5 text-sm font-medium rounded-t-lg transition ${
                            activeTab === 'communes' 
                                ? 'bg-white text-red-500 border-b-2 border-red-500' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Communes
                    </button>
                </div>

                {/* Section Villes */}
                {activeTab === 'cities' && (
                    <div>
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={() => {
                                    setEditingCity(null);
                                    setCityForm({ name: '' });
                                    setShowCityForm(!showCityForm);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition shadow-sm"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="8" x2="12" y2="16"/>
                                    <line x1="8" y1="12" x2="16" y2="12"/>
                                </svg>
                                {showCityForm ? 'Annuler' : 'Ajouter une ville'}
                            </button>
                        </div>

                        {showCityForm && (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                                <div className="p-6 border-b border-gray-100">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        {editingCity ? 'Modifier la ville' : 'Nouvelle ville'}
                                    </h2>
                                </div>
                                <form onSubmit={handleCitySubmit} className="p-6 space-y-4">
                                    <input
                                        type="text"
                                        placeholder="Nom de la ville"
                                        value={cityForm.name}
                                        onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        required
                                    />
                                    <button type="submit" className="px-6 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition">
                                        {editingCity ? 'Mettre à jour' : 'Ajouter'}
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
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {cities.map((city) => (
                                            <tr key={city._id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 font-medium text-gray-900">{city.name}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingCity(city);
                                                                setCityForm({ name: city.name });
                                                                setShowCityForm(true);
                                                            }}
                                                            className="text-xs px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                                        >
                                                            Modifier
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteCity(city._id)}
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

                {/* Section Communes */}
                {activeTab === 'communes' && (
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
                                        setEditingCommune(null);
                                        setCommuneForm({ name: '', cityId: '' });
                                        setShowCommuneForm(!showCommuneForm);
                                        setShowBulkCommuneForm(false);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition shadow-sm"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <line x1="12" y1="8" x2="12" y2="16"/>
                                        <line x1="8" y1="12" x2="16" y2="12"/>
                                    </svg>
                                    {showCommuneForm ? 'Annuler' : 'Ajouter une commune'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowBulkCommuneForm(!showBulkCommuneForm);
                                        setShowCommuneForm(false);
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

                        {showCommuneForm && (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                                <div className="p-6 border-b border-gray-100">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        {editingCommune ? 'Modifier la commune' : 'Nouvelle commune'}
                                    </h2>
                                </div>
                                <form onSubmit={handleCommuneSubmit} className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <select
                                            value={communeForm.cityId}
                                            onChange={(e) => setCommuneForm({ ...communeForm, cityId: e.target.value })}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            required
                                        >
                                            <option value="">Sélectionner une ville</option>
                                            {cities.map(city => (
                                                <option key={city._id} value={city._id}>{city.name}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="Nom de la commune"
                                            value={communeForm.name}
                                            onChange={(e) => setCommuneForm({ ...communeForm, name: e.target.value })}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            required
                                        />
                                    </div>
                                    <button type="submit" className="px-6 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition">
                                        {editingCommune ? 'Mettre à jour' : 'Ajouter'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {showBulkCommuneForm && (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                                <div className="p-6 border-b border-gray-100">
                                    <h2 className="text-lg font-semibold text-gray-900">Ajouter plusieurs communes</h2>
                                </div>
                                <form onSubmit={handleBulkCommuneSubmit} className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <select
                                            value={bulkCommuneForm.cityId}
                                            onChange={(e) => setBulkCommuneForm({ ...bulkCommuneForm, cityId: e.target.value })}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            required
                                        >
                                            <option value="">Sélectionner une ville</option>
                                            {cities.map(city => (
                                                <option key={city._id} value={city._id}>{city.name}</option>
                                            ))}
                                        </select>
                                        <textarea
                                            placeholder="Noms des communes (séparés par des virgules)&#10;Ex: Cocody, Marcory, Yopougon, Plateau"
                                            value={bulkCommuneForm.names}
                                            onChange={(e) => setBulkCommuneForm({ ...bulkCommuneForm, names: e.target.value })}
                                            rows={4}
                                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        Séparez chaque commune par une virgule. Exemple: "Cocody, Marcory, Yopougon, Plateau"
                                    </p>
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
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ville</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Commune</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredCommunes.map((commune) => (
                                            <tr key={commune._id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 text-sm text-gray-500">{commune.cityId?.name || '-'}</td>
                                                <td className="px-6 py-4 font-medium text-gray-900">{commune.name}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingCommune(commune);
                                                                setCommuneForm({
                                                                    name: commune.name,
                                                                    cityId: commune.cityId?._id || commune.cityId
                                                                });
                                                                setShowCommuneForm(true);
                                                                setShowBulkCommuneForm(false);
                                                            }}
                                                            className="text-xs px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                                        >
                                                            Modifier
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteCommune(commune._id)}
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

export default LocationManager;