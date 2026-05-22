import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

// Select Field Component avec recherche
const SelectField = ({ name, placeholder, options, value, handleChange, loading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const filteredOptions = options.filter(opt => 
        opt.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedOption = options.find(opt => opt._id === value);

    return (
        <div className="relative">
            <div 
                className="w-full border border-gray-300 rounded-lg px-4 py-2 cursor-pointer flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{selectedOption ? selectedOption.name : placeholder}</span>
                <span className="text-xs">▼</span>
            </div>
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-auto">
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 border-b border-gray-200 outline-none sticky top-0 bg-white"
                        onClick={(e) => e.stopPropagation()}
                    />
                    {loading ? (
                        <div className="p-3 text-center text-gray-400">Chargement...</div>
                    ) : filteredOptions.length === 0 ? (
                        <div className="p-3 text-center text-gray-400">Aucune option</div>
                    ) : (
                        filteredOptions.map(opt => (
                            <div
                                key={opt._id}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                onClick={() => {
                                    handleChange({ target: { name, value: opt._id } });
                                    setIsOpen(false);
                                    setSearchTerm('');
                                }}
                            >
                                {opt.name}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const Account = () => {
    const { axios, user, fetchUser, setShowUserLogin } = useAppContext();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cities, setCities] = useState([]);
    const [communes, setCommunes] = useState([]);
    const [loadingCities, setLoadingCities] = useState(true);
    const [loadingCommunes, setLoadingCommunes] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        street: '',
        cityId: '',
        communeId: ''
    });

    // Charger les villes
    const fetchCities = async () => {
        try {
            const { data } = await axios.get('/api/location/cities');
            if (data.success) setCities(data.cities);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingCities(false);
        }
    };

    // Charger les communes
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
        fetchCities();
    }, []);

    useEffect(() => {
        if (formData.cityId) {
            fetchCommunes(formData.cityId);
        }
    }, [formData.cityId]);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                street: user.street || '',
                cityId: user.cityId || '',
                communeId: user.communeId || ''
            });
            if (user.cityId) fetchCommunes(user.cityId);
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await axios.put('/api/user/update', formData);
            if (data.success) {
                toast.success('Informations mises à jour');
                setIsEditing(false);
                await fetchUser();
                // Recharger les données locales après mise à jour
                const { data: userData } = await axios.get('/api/user/is-auth');
                if (userData.success) {
                    setFormData({
                        name: userData.user.name || '',
                        email: userData.user.email || '',
                        phone: userData.user.phone || '',
                        street: userData.user.street || '',
                        cityId: userData.user.cityId || '',
                        communeId: userData.user.communeId || ''
                    });
                }
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="mt-16 pb-16">
                <div className="flex flex-col items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">Mon compte</h1>
                    <div className="w-20 h-1 bg-primary rounded-full mt-2"></div>
                </div>
                <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md">
                    <p className="text-center text-gray-500 mb-4">Vous n'êtes pas connecté</p>
                    <button
                        onClick={() => setShowUserLogin(true)}
                        className="w-full bg-primary text-white py-3 rounded-lg hover:opacity-90 transition"
                    >
                        Se connecter
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-16 pb-16">
            <div className="flex flex-col items-start mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Mon compte</h1>
                <div className="w-20 h-1 bg-primary rounded-full mt-2"></div>
                <p className="text-gray-500 mt-2">Gérez vos informations personnelles</p>
            </div>

            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
                <div className="p-6">
                    {!isEditing ? (
                        <div className="space-y-4">
                            <div className="border-b pb-3">
                                <p className="text-sm text-gray-500">Nom complet</p>
                                <p className="text-lg font-medium">{formData.name || 'Non renseigné'}</p>
                            </div>
                            <div className="border-b pb-3">
                                <p className="text-sm text-gray-500">Email</p>
                                <p className="text-lg font-medium">{formData.email || 'Non renseigné'}</p>
                            </div>
                            <div className="border-b pb-3">
                                <p className="text-sm text-gray-500">Téléphone</p>
                                <p className="text-lg font-medium">{formData.phone || 'Non renseigné'}</p>
                            </div>
                            <div className="border-b pb-3">
                                <p className="text-sm text-gray-500">Quartier / Rue</p>
                                <p className="text-lg font-medium">{formData.street || 'Non renseigné'}</p>
                            </div>
                            <div className="border-b pb-3">
                                <p className="text-sm text-gray-500">Ville</p>
                                <p className="text-lg font-medium">
                                    {cities.find(c => c._id === formData.cityId)?.name || 'Non renseigné'}
                                </p>
                            </div>
                            <div className="border-b pb-3">
                                <p className="text-sm text-gray-500">Commune</p>
                                <p className="text-lg font-medium">
                                    {communes.find(c => c._id === formData.communeId)?.name || 'Non renseigné'}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition"
                            >
                                Modifier mes informations
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quartier / Rue</label>
                                <input
                                    type="text"
                                    name="street"
                                    value={formData.street}
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                                <SelectField
                                    name="cityId"
                                    placeholder="Sélectionner une ville"
                                    options={cities}
                                    value={formData.cityId}
                                    handleChange={handleChange}
                                    loading={loadingCities}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Commune</label>
                                <SelectField
                                    name="communeId"
                                    placeholder={formData.cityId ? "Sélectionner une commune" : "Sélectionnez d'abord une ville"}
                                    options={communes}
                                    value={formData.communeId}
                                    handleChange={handleChange}
                                    loading={loadingCommunes}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-primary text-white py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                                >
                                    {loading ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50 transition"
                                >
                                    Annuler
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Account;