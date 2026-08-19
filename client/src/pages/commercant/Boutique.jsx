import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import BoutiqueIndisponible from './BoutiqueIndisponible';
import { Store, Edit, Save, X, Loader2, Camera, Upload, MapPin, ChevronDown } from 'lucide-react';

const Boutique = () => {
    const { axios } = useAppContext();
    const { boutique, setBoutique, boutiqueEnCours, erreurBoutique, rechargerBoutique } = useOutletContext();

    const [editing, setEditing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [nom, setNom] = useState(boutique?.nom || '');
    const [description, setDescription] = useState(boutique?.description || '');
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);

    // Zones de livraison
    const [cities, setCities] = useState([]);
    const [communesByCity, setCommunesByCity] = useState({});
    const [openCity, setOpenCity] = useState(null);
    const [zones, setZones] = useState([]); // [{ cityId, communeId }]
    const [savingZones, setSavingZones] = useState(false);

    useEffect(() => {
        const loadCities = async () => {
            try {
                const { data } = await axios.get('/api/location/cities');
                if (data.success) setCities(data.cities || []);
            } catch (error) { console.error('Erreur chargement villes:', error); }
        };
        loadCities();
    }, [axios]);

    useEffect(() => {
        if (boutique?.zonesLivraison) {
            setZones(boutique.zonesLivraison.map((z) => ({
                cityId: z.cityId?._id || z.cityId,
                communeId: z.communeId?._id || z.communeId || null,
            })));
        }
    }, [boutique]);

    const loadCommunes = async (cityId) => {
        if (communesByCity[cityId]) return;
        try {
            const { data } = await axios.get(`/api/location/communes/${cityId}`);
            if (data.success) setCommunesByCity((prev) => ({ ...prev, [cityId]: data.communes || [] }));
        } catch (error) { console.error('Erreur chargement communes:', error); }
    };

    const toggleCityOpen = (cityId) => {
        setOpenCity((prev) => (prev === cityId ? null : cityId));
        loadCommunes(cityId);
    };

    const isWholeCitySelected = (cityId) => zones.some((z) => z.cityId === cityId && !z.communeId);
    const isCommuneSelected = (cityId, communeId) => zones.some((z) => z.cityId === cityId && z.communeId === communeId);

    const toggleWholeCity = (cityId) => {
        setZones((prev) => {
            if (isWholeCitySelected(cityId)) return prev.filter((z) => z.cityId !== cityId);
            // Sélectionner toute la ville remplace les communes déjà cochées pour cette ville
            return [...prev.filter((z) => z.cityId !== cityId), { cityId, communeId: null }];
        });
    };

    const toggleCommune = (cityId, communeId) => {
        setZones((prev) => {
            if (isWholeCitySelected(cityId)) return prev; // "toute la ville" prime
            if (isCommuneSelected(cityId, communeId)) return prev.filter((z) => !(z.cityId === cityId && z.communeId === communeId));
            return [...prev, { cityId, communeId }];
        });
    };

    const saveZones = async () => {
        setSavingZones(true);
        try {
            const { data } = await axios.patch('/api/boutiques/moi/zones-livraison', { zones });
            if (data.success) {
                toast.success('Zones de livraison mises à jour');
                setBoutique(data.boutique);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSavingZones(false);
        }
    };

    const zonesCount = zones.length;

    if (boutiqueEnCours) {
        return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-ramses-600" size={28} /></div>;
    }

    if (!boutique) {
        return (
            <div className="py-16 px-4">
                <BoutiqueIndisponible erreur={erreurBoutique} onRetry={rechargerBoutique} />
            </div>
        );
    }

    const startEditing = () => {
        setNom(boutique.nom || '');
        setDescription(boutique.description || '');
        setLogoFile(null);
        setLogoPreview(null);
        setEditing(true);
    };

    const handleLogoChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('nom', nom);
            formData.append('description', description);
            if (logoFile) formData.append('logo', logoFile);

            const { data } = await axios.patch('/api/boutiques/moi', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (data.success) {
                toast.success('Boutique mise à jour');
                setBoutique(data.boutique);
                setEditing(false);
                setLogoFile(null);
                setLogoPreview(null);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex items-center justify-between mb-2">
                <h1 className="font-display text-2xl font-semibold text-ink-900">Ma boutique</h1>
                {!editing && (
                    <button onClick={startEditing} className="flex items-center gap-2 bg-ramses-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-ramses-700 transition">
                        <Edit size={15} /> Modifier
                    </button>
                )}
            </div>
            <p className="text-sm text-ink-500 mb-6">
                Votre boutique a été créée avec votre compte. À vous de la personnaliser : nom, description,
                logo et zones de livraison.
            </p>

            {boutique.statut === 'suspendue' && (
                <div className="mb-6 bg-ramses-50 border border-ramses-200 rounded-2xl p-4 text-sm">
                    <p className="font-medium text-red-800">Boutique suspendue par l'administrateur</p>
                    <p className="text-ramses-700 mt-1">
                        Vos articles sont retirés du catalogue et la publication est bloquée. Vous pouvez
                        toujours corriger les informations ci-dessous.
                        {boutique.motifSuspension ? ` Motif : ${boutique.motifSuspension}` : ''}
                    </p>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-ink-200 overflow-hidden">
                <div className="p-6 border-b border-ink-50 flex items-center gap-5">
                    <div className="relative shrink-0">
                        <div className="w-20 h-20 rounded-2xl bg-ink-50 flex items-center justify-center overflow-hidden">
                            {(logoPreview || boutique.logo) ? (
                                <img src={logoPreview || boutique.logo} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <Camera size={26} className="text-ink-400" />
                            )}
                        </div>
                        {editing && (
                            <label className="absolute -bottom-1.5 -right-1.5 bg-ramses-600 text-white p-1.5 rounded-full cursor-pointer hover:bg-ramses-700 transition shadow-sm">
                                <Upload size={13} />
                                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                            </label>
                        )}
                    </div>
                    <div>
                        <h2 className="font-display text-lg font-semibold text-ink-900">{boutique.nom}</h2>
                        <p className="text-xs text-ink-400 mt-0.5">
                            {boutique.statut === 'active' ? (
                                <span className="text-ok-500 font-medium">● Active</span>
                            ) : (
                                <span className="text-ramses-600 font-medium">● Suspendue</span>
                            )}
                            <span className="mx-1.5">·</span>
                            Créée le {new Date(boutique.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Nom de la boutique</label>
                        <input
                            type="text"
                            value={editing ? nom : boutique.nom}
                            onChange={(e) => setNom(e.target.value)}
                            disabled={!editing}
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition ${
                                editing ? 'border-ink-200 focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500' : 'border-transparent bg-ink-100 text-ink-600'
                            }`}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Description</label>
                        <textarea
                            value={editing ? description : (boutique.description || 'Aucune description')}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={!editing}
                            rows={4}
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition resize-none ${
                                editing ? 'border-ink-200 focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500' : 'border-transparent bg-ink-100 text-ink-600'
                            }`}
                            placeholder="Décrivez votre boutique..."
                        />
                    </div>

                    {editing && (
                        <div className="flex items-center gap-3 pt-2">
                            <button type="submit" disabled={uploading} className="flex items-center gap-2 bg-ramses-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-ramses-700 transition disabled:opacity-50">
                                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer
                            </button>
                            <button type="button" onClick={() => setEditing(false)} className="flex items-center gap-2 bg-ink-100 text-ink-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-ink-200 transition">
                                <X size={16} /> Annuler
                            </button>
                        </div>
                    )}
                </form>
            </div>

            <div className="bg-white rounded-2xl border border-ink-200 overflow-hidden mt-6">
                <div className="p-6 border-b border-ink-50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <MapPin size={18} className="text-ramses-600" />
                        <div>
                            <h2 className="font-display text-lg font-semibold text-ink-900">Zones de livraison</h2>
                            <p className="text-xs text-ink-400">
                                Les endroits où vous livrez vous-même. Les tarifs de livraison restent fixés par la plateforme.
                            </p>
                        </div>
                    </div>
                    {zonesCount > 0 && (
                        <span className="text-xs font-medium text-ramses-700 bg-ink-50 px-2.5 py-1 rounded-full shrink-0">
                            {zonesCount} zone{zonesCount > 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                <div className="p-4 max-h-80 overflow-y-auto divide-y divide-ink-50">
                    {cities.length === 0 ? (
                        <p className="text-sm text-ink-400 px-2 py-4">Aucune ville disponible pour le moment.</p>
                    ) : cities.map((city) => (
                        <div key={city._id} className="py-2">
                            <div className="flex items-center gap-3 px-2">
                                <input
                                    type="checkbox"
                                    checked={isWholeCitySelected(city._id)}
                                    onChange={() => toggleWholeCity(city._id)}
                                    className="w-4 h-4 rounded accent-ramses-600"
                                />
                                <button
                                    type="button"
                                    onClick={() => toggleCityOpen(city._id)}
                                    className="flex-1 flex items-center justify-between text-left py-1.5"
                                >
                                    <span className="text-sm font-medium text-ink-800">{city.name}</span>
                                    <ChevronDown size={16} className={`text-ink-400 transition-transform ${openCity === city._id ? 'rotate-180' : ''}`} />
                                </button>
                            </div>

                            {openCity === city._id && (
                                <div className="pl-9 pr-2 pb-2 flex flex-wrap gap-2">
                                    {(communesByCity[city._id] || []).length === 0 ? (
                                        <p className="text-xs text-ink-400 py-1">Chargement…</p>
                                    ) : communesByCity[city._id].map((commune) => (
                                        <button
                                            type="button"
                                            key={commune._id}
                                            onClick={() => toggleCommune(city._id, commune._id)}
                                            disabled={isWholeCitySelected(city._id)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition disabled:opacity-40 ${
                                                isCommuneSelected(city._id, commune._id)
                                                    ? 'bg-ramses-600 border-ramses-600 text-white'
                                                    : 'bg-white border-ink-200 text-ink-600 hover:border-ramses-400'
                                            }`}
                                        >
                                            {commune.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-ink-50">
                    <button
                        onClick={saveZones}
                        disabled={savingZones}
                        className="flex items-center gap-2 bg-ramses-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-ramses-700 transition disabled:opacity-50"
                    >
                        {savingZones ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer les zones
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Boutique;