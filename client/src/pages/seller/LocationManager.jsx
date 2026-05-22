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

    // Charger les données
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

    // ==================== VILLES ====================
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

    // ==================== COMMUNES ====================
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

    // Ajout en masse des communes
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

        // Séparer les noms par virgule et nettoyer
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
        return <div className="p-10 text-center">Chargement...</div>;
    }

    return (
        <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll">
            <div className="md:p-10 p-4 space-y-6">
                <h2 className="text-2xl font-bold">Gestion des localisations</h2>

                {/* Onglets */}
                <div className="flex gap-4 border-b">
                    <button
                        onClick={() => setActiveTab('cities')}
                        className={`pb-2 px-4 ${activeTab === 'cities' ? 'border-b-2 border-primary text-primary font-semibold' : 'text-gray-500'}`}
                    >
                        🏙️ Villes
                    </button>
                    <button
                        onClick={() => setActiveTab('communes')}
                        className={`pb-2 px-4 ${activeTab === 'communes' ? 'border-b-2 border-primary text-primary font-semibold' : 'text-gray-500'}`}
                    >
                        📍 Communes
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
                                className="bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
                            >
                                {showCityForm ? 'Annuler' : '+ Ajouter une ville'}
                            </button>
                        </div>

                        {showCityForm && (
                            <form onSubmit={handleCitySubmit} className="bg-white border rounded-xl p-6 mb-6 space-y-4">
                                <h3 className="text-lg font-semibold">{editingCity ? 'Modifier' : 'Ajouter'} une ville</h3>
                                <input
                                    type="text"
                                    placeholder="Nom de la ville"
                                    value={cityForm.name}
                                    onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                    required
                                />
                                <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg">
                                    {editingCity ? 'Mettre à jour' : 'Ajouter'}
                                </button>
                            </form>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full bg-white border rounded-xl">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Nom</th>
                                        <th className="px-4 py-3 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cities.map((city) => (
                                        <tr key={city._id} className="border-t">
                                            <td className="px-4 py-3 font-medium">{city.name}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingCity(city);
                                                            setCityForm({ name: city.name });
                                                            setShowCityForm(true);
                                                        }}
                                                        className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded"
                                                    >
                                                        Modifier
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCity(city._id)}
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

                {/* Section Communes */}
                {activeTab === 'communes' && (
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
                                        setEditingCommune(null);
                                        setCommuneForm({ name: '', cityId: '' });
                                        setShowCommuneForm(!showCommuneForm);
                                        setShowBulkCommuneForm(false);
                                    }}
                                    className="bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
                                >
                                    {showCommuneForm ? 'Annuler' : '+ Ajouter une commune'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowBulkCommuneForm(!showBulkCommuneForm);
                                        setShowCommuneForm(false);
                                    }}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
                                >
                                    📦 Ajouter plusieurs
                                </button>
                            </div>
                        </div>

                        {/* Formulaire ajout simple */}
                        {showCommuneForm && (
                            <form onSubmit={handleCommuneSubmit} className="bg-white border rounded-xl p-6 mb-6 space-y-4">
                                <h3 className="text-lg font-semibold">{editingCommune ? 'Modifier' : 'Ajouter'} une commune</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <select
                                        value={communeForm.cityId}
                                        onChange={(e) => setCommuneForm({ ...communeForm, cityId: e.target.value })}
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none"
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
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none"
                                        required
                                    />
                                </div>
                                <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg">
                                    {editingCommune ? 'Mettre à jour' : 'Ajouter'}
                                </button>
                            </form>
                        )}

                        {/* Formulaire ajout en masse */}
                        {showBulkCommuneForm && (
                            <form onSubmit={handleBulkCommuneSubmit} className="bg-white border rounded-xl p-6 mb-6 space-y-4">
                                <h3 className="text-lg font-semibold">Ajouter plusieurs communes en une fois</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <select
                                        value={bulkCommuneForm.cityId}
                                        onChange={(e) => setBulkCommuneForm({ ...bulkCommuneForm, cityId: e.target.value })}
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none"
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
                                        className="border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                        required
                                    />
                                </div>
                                <p className="text-xs text-gray-400">
                                    💡 Séparez chaque commune par une virgule. Exemple: "Cocody, Marcory, Yopougon, Plateau"
                                </p>
                                <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:opacity-90 transition">
                                    Ajouter toutes les communes
                                </button>
                            </form>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full bg-white border rounded-xl">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Ville</th>
                                        <th className="px-4 py-3 text-left">Commune</th>
                                        <th className="px-4 py-3 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCommunes.map((commune) => (
                                        <tr key={commune._id} className="border-t">
                                            <td className="px-4 py-3">{commune.cityId?.name || '-'}</td>
                                            <td className="px-4 py-3 font-medium">{commune.name}</td>
                                            <td className="px-4 py-3">
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
                                                        className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded"
                                                    >
                                                        Modifier
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCommune(commune._id)}
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

export default LocationManager;