import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { User, Mail, Phone, MapPin, Home, Building2, LogOut, Edit2, Save, X } from 'lucide-react';

// Select Field Component avec recherche
const SelectField = ({ name, placeholder, options, value, handleChange, loading, icon: Icon }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const filteredOptions = options.filter(opt => 
        opt.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedOption = options.find(opt => opt._id === value);

    return (
        <div className="relative">
            <div 
                className="w-full border border-gray-200 rounded-xl px-4 py-3 cursor-pointer flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    {Icon && <Icon size={18} className="text-gray-400" />}
                    <span className={selectedOption ? "text-gray-700" : "text-gray-400"}>
                        {selectedOption ? selectedOption.name : placeholder}
                    </span>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
            {isOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                    <div className="sticky top-0 bg-white p-2 border-b border-gray-100">
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-primary text-sm"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    {loading ? (
                        <div className="p-4 text-center text-gray-400 text-sm">Chargement...</div>
                    ) : filteredOptions.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">Aucune option</div>
                    ) : (
                        filteredOptions.map(opt => (
                            <div
                                key={opt._id}
                                className="px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors text-sm"
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
    const { axios, user, fetchUser, setShowUserLogin, logoutUser } = useAppContext();
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
            // ✅ MODIFICATION : POST au lieu de PUT, et route correcte
            const { data } = await axios.post('/api/user/update', formData);
            if (data.success) {
                toast.success('Informations mises à jour');
                setIsEditing(false);
                if (fetchUser) await fetchUser();
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
                toast.error(data.message || "Erreur lors de la mise à jour");
            }
        } catch (error) {
            console.error("Erreur mise à jour:", error);
            toast.error(error.response?.data?.message || "Erreur de connexion");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        if (window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            await logoutUser();
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 pt-20 pb-16 px-4">
                <div className="max-w-md mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-800">Mon compte</h1>
                        <div className="w-20 h-1 bg-primary rounded-full mx-auto mt-2"></div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <User size={40} className="text-gray-400" />
                        </div>
                        <p className="text-gray-500 mb-6">Vous n'êtes pas connecté</p>
                        <button
                            onClick={() => setShowUserLogin(true)}
                            className="w-full bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary-dark transition shadow-sm"
                        >
                            Se connecter
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-16 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">Mon compte</h1>
                    <div className="w-20 h-1 bg-primary rounded-full mt-2"></div>
                    <p className="text-gray-500 mt-2">Gérez vos informations personnelles</p>
                </div>

                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="p-6 md:p-8">
                        {!isEditing ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex items-start gap-3">
                                        <User size={20} className="text-primary mt-0.5" />
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-wide">Nom complet</p>
                                            <p className="text-gray-800 font-medium">{formData.name || 'Non renseigné'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Mail size={20} className="text-primary mt-0.5" />
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
                                            <p className="text-gray-800 font-medium">{formData.email || 'Non renseigné'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Phone size={20} className="text-primary mt-0.5" />
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-wide">Téléphone</p>
                                            <p className="text-gray-800 font-medium">{formData.phone || 'Non renseigné'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <MapPin size={20} className="text-primary mt-0.5" />
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-wide">Quartier / Rue</p>
                                            <p className="text-gray-800 font-medium">{formData.street || 'Non renseigné'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Building2 size={20} className="text-primary mt-0.5" />
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-wide">Ville</p>
                                            <p className="text-gray-800 font-medium">
                                                {cities.find(c => c._id === formData.cityId)?.name || 'Non renseigné'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Home size={20} className="text-primary mt-0.5" />
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-wide">Commune</p>
                                            <p className="text-gray-800 font-medium">
                                                {communes.find(c => c._id === formData.communeId)?.name || 'Non renseigné'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="flex items-center justify-center gap-2 flex-1 bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary-dark transition shadow-sm"
                                    >
                                        <Edit2 size={18} />
                                        Modifier
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center justify-center gap-2 flex-1 bg-red-500 text-white py-3 rounded-xl font-medium hover:bg-red-600 transition shadow-sm"
                                    >
                                        <LogOut size={18} />
                                        Déconnexion
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleUpdate} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
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
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
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
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Quartier / Rue</label>
                                    <input
                                        type="text"
                                        name="street"
                                        value={formData.street}
                                        onChange={handleChange}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
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
                                        icon={Building2}
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
                                        icon={Home}
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex items-center justify-center gap-2 flex-1 bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary-dark transition disabled:opacity-50"
                                    >
                                        <Save size={18} />
                                        {loading ? 'Enregistrement...' : 'Enregistrer'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(false)}
                                        className="flex items-center justify-center gap-2 flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
                                    >
                                        <X size={18} />
                                        Annuler
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Account;