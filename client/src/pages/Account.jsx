import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { User, Mail, Phone, MapPin, Home, Building2, LogOut, Edit2, Save, X, Coins, ChevronDown, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
// Selecteur partage et accessible — remplace la copie locale inaccessible.
import SelectSearch from '../components/SelectSearch';


const Account = () => {
    const { axios, user, fetchUser, setShowUserLogin, logoutUser } = useAppContext();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cities, setCities] = useState([]);
    const [communes, setCommunes] = useState([]);
    const [loadingCities, setLoadingCities] = useState(true);
    const [loadingCommunes, setLoadingCommunes] = useState(false);
    const [creditBalance, setCreditBalance] = useState(null);
    // Historique RCoins : le solde seul ne disait pas D'OÙ venait l'argent.
    const [mouvements, setMouvements] = useState([]);
    const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
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
        if (!user) return;
        axios.get('/api/order/user/credit')
            .then(({ data }) => { if (data.success) setCreditBalance(data.creditBalance) })
            .catch(() => {})
        axios.get('/api/order/user/credit/historique')
            .then(({ data }) => { if (data.success) setMouvements(data.mouvements || []) })
            .catch(() => {})
    }, [user]);

    useEffect(() => {
        if (formData.cityId) {
            fetchCommunes(formData.cityId);
        }
    }, [formData.cityId]);

    useEffect(() => {
        if (user) {
            setFormData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
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
            const { data } = await axios.post('/api/user/update', formData);
            if (data.success) {
                toast.success('Informations mises à jour');
                setIsEditing(false);
                if (fetchUser) await fetchUser();
                const { data: userData } = await axios.get('/api/user/is-auth');
                if (userData.success) {
                    setFormData({
                        firstName: userData.user.firstName || '',
                        lastName: userData.user.lastName || '',
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
            <div className="min-h-screen bg-ink-50 flex items-center justify-center px-6">
                <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-5">
                        <User size={32} className="text-ink-400" />
                    </div>
                    <h2 className="rs-h1 mb-2">Mon compte</h2>
                    <p className="text-ink-400 text-[14px] mb-7 max-w-[280px] mx-auto">
                        Connectez-vous pour gérer vos informations et retrouver vos commandes.
                    </p>
                    <button onClick={() => setShowUserLogin(true)} className="rs-btn rs-btn--primary">
                        Se connecter
                    </button>
                </div>
            </div>
        );
    }

    const nomComplet = [formData.firstName, formData.lastName].filter(Boolean).join(' ');
    const initiales = [formData.firstName, formData.lastName]
        .filter(Boolean).map(s => s[0]?.toUpperCase()).join('') || '?';

    const infos = [
        { Icon: User,      label: 'Nom complet',     valeur: nomComplet },
        { Icon: Mail,      label: 'E-mail',          valeur: formData.email },
        { Icon: Phone,     label: 'Téléphone',       valeur: formData.phone },
        { Icon: MapPin,    label: 'Quartier / Rue',  valeur: formData.street },
        { Icon: Building2, label: 'Ville',           valeur: cities.find(c => c._id === formData.cityId)?.name },
        { Icon: Home,      label: 'Commune',         valeur: communes.find(c => c._id === formData.communeId)?.name },
    ];

    const Champ = ({ htmlFor, children }) => (
        <label htmlFor={htmlFor} className="block text-[12px] font-semibold text-ink-500 mb-1.5">
            {children}
        </label>
    );

    return (
        <div className="min-h-screen bg-ink-50 pt-6 pb-16 px-4">
            <div className="max-w-2xl mx-auto">

                {/* ── Identité ───────────────────────────────────────────── */}
                {/* La page ouvrait sur un titre et un trait décoratif. Elle
                    ouvre maintenant sur la personne : c'est l'information que
                    l'utilisateur vient vérifier en premier. */}
                <div className="rs-card flex items-center gap-4 mb-3">
                    <div className="w-14 h-14 rounded-full bg-ink-900 text-white flex items-center justify-center shrink-0">
                        <span className="text-[18px] font-extrabold tracking-tight">{initiales}</span>
                    </div>
                    <div className="min-w-0">
                        <h1 className="rs-h1 truncate">{nomComplet || 'Mon compte'}</h1>
                        {formData.email && (
                            <p className="text-[13px] text-ink-400 truncate mt-0.5">{formData.email}</p>
                        )}
                    </div>
                </div>

                {/* ── Solde RCoins ───────────────────────────────────────────
                    Affiché MÊME À ZÉRO. Avant, le bloc disparaissait sous
                    `creditBalance > 0` : un client qui n'avait jamais été
                    remboursé ignorait que les RCoins existaient, et celui qui
                    venait de l'être voyait une somme surgir sans explication.
                    Or c'est la voie normale de remboursement d'un retour.
                    ────────────────────────────────────────────────────────── */}
                {creditBalance !== null && (
                    <div className="rs-card mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-ramses-50 flex items-center justify-center shrink-0">
                                <Coins size={20} className="text-ramses-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[12px] text-ink-400">Mes RCoins</p>
                                <p className="text-[16px] font-bold text-ink-900 tabular-nums">
                                    {creditBalance.toLocaleString()} FCFA
                                </p>
                            </div>
                            <p className="text-[11px] text-ink-300 ml-auto text-right max-w-[130px]">
                                {creditBalance > 0
                                    ? 'Déduits automatiquement de votre prochaine commande'
                                    : 'Votre cagnotte se remplit lors d’un remboursement'}
                            </p>
                        </div>

                        {/* L'historique explique la provenance de chaque somme :
                            c'est ce que le client demande au support quand un
                            montant apparaît sans qu'il sache pourquoi. */}
                        {mouvements.length > 0 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setHistoriqueOuvert((v) => !v)}
                                    aria-expanded={historiqueOuvert}
                                    className="mt-3 w-full flex items-center justify-between text-[12px] text-ink-500 hover:text-ink-800 transition"
                                >
                                    <span>{historiqueOuvert ? 'Masquer' : 'Voir'} l’historique ({mouvements.length})</span>
                                    <ChevronDown
                                        size={15}
                                        className={`transition-transform ${historiqueOuvert ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {historiqueOuvert && (
                                    <ul className="mt-2 pt-2 border-t border-ink-100 space-y-2.5 list-none p-0">
                                        {mouvements.map((m) => (
                                            <li key={m.id} className="flex items-start gap-2.5">
                                                <span
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                                        m.sens === 'credit' ? 'bg-ok-50 text-ok-600' : 'bg-ink-100 text-ink-500'
                                                    }`}
                                                >
                                                    {m.sens === 'credit'
                                                        ? <ArrowDownLeft size={13} />
                                                        : <ArrowUpRight size={13} />}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-[12.5px] text-ink-800 leading-snug">
                                                        {m.libelle}
                                                    </span>
                                                    <span className="block text-[11px] text-ink-400">
                                                        {new Date(m.date).toLocaleDateString('fr-FR', {
                                                            day: '2-digit', month: 'short', year: 'numeric',
                                                        })}
                                                        {m.commande ? ` · commande ${m.commande}` : ''}
                                                    </span>
                                                </span>
                                                <span
                                                    className={`text-[12.5px] font-semibold tabular-nums shrink-0 ${
                                                        m.sens === 'credit' ? 'text-ok-600' : 'text-ink-500'
                                                    }`}
                                                >
                                                    {m.sens === 'credit' ? '+' : '−'}{m.montant.toLocaleString()}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}
                    </div>
                )}

                {!isEditing ? (
                    <>
                        <div className="rs-card mb-3">
                            <p className="rs-label text-ink-400 mb-3">Mes informations</p>

                            {/* Lignes séparées par un filet plutôt qu'une grille de
                                blocs à icônes : sur mobile, la grille 2 colonnes
                                cassait les libellés en deux et rendait la lecture
                                sautillante. */}
                            <dl className="m-0">
                                {infos.map(({ Icon, label, valeur }, i) => (
                                    <div
                                        key={label}
                                        className={`flex items-start gap-3 py-3 ${i < infos.length - 1 ? 'border-b border-ink-100' : ''}`}
                                    >
                                        <Icon size={17} className="text-ink-400 shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <dt className="text-[12px] text-ink-400">{label}</dt>
                                            <dd className={`text-[14px] m-0 mt-0.5 break-words ${valeur ? 'font-semibold text-ink-900' : 'text-ink-300'}`}>
                                                {valeur || 'Non renseigné'}
                                            </dd>
                                        </div>
                                    </div>
                                ))}
                            </dl>
                        </div>

                        <div className="grid gap-2.5">
                            <button onClick={() => setIsEditing(true)} className="rs-btn rs-btn--primary rs-btn--block">
                                <Edit2 size={17} />
                                Modifier mes informations
                            </button>
                            {/* Déconnexion en bouton bordé et non en rouge plein :
                                un rouge plein à côté de l'action principale se fait
                                cliquer par réflexe. */}
                            <button onClick={handleLogout} className="rs-btn rs-btn--danger rs-btn--block">
                                <LogOut size={17} />
                                Se déconnecter
                            </button>
                        </div>
                    </>
                ) : (
                    <form onSubmit={handleUpdate} className="rs-card grid gap-4">
                        <p className="rs-label text-ink-400">Modifier mes informations</p>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Champ htmlFor="firstName">Prénom</Champ>
                                <input
                                    id="firstName"
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    className="rs-input"
                                    required
                                />
                            </div>
                            <div>
                                <Champ htmlFor="lastName">Nom</Champ>
                                <input
                                    id="lastName"
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    className="rs-input"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <Champ htmlFor="email">E-mail</Champ>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                inputMode="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="rs-input"
                                required
                            />
                        </div>

                        <div>
                            <Champ htmlFor="phone">Téléphone</Champ>
                            <input
                                id="phone"
                                type="tel"
                                name="phone"
                                inputMode="tel"
                                value={formData.phone}
                                onChange={handleChange}
                                className="rs-input"
                            />
                        </div>

                        <div>
                            <Champ htmlFor="street">Quartier / Rue</Champ>
                            <input
                                id="street"
                                type="text"
                                name="street"
                                value={formData.street}
                                onChange={handleChange}
                                className="rs-input"
                            />
                        </div>

                        <div>
                            <Champ htmlFor="cityId">Ville</Champ>
                            <SelectSearch
                                id="cityId"
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
                            <Champ htmlFor="communeId">Commune</Champ>
                            <SelectSearch
                                id="communeId"
                                name="communeId"
                                placeholder={formData.cityId ? 'Sélectionner une commune' : "Choisissez d'abord une ville"}
                                options={communes}
                                value={formData.communeId}
                                handleChange={handleChange}
                                loading={loadingCommunes}
                                icon={Home}
                            />
                        </div>

                        <div className="flex gap-2.5 pt-1">
                            <button type="button" onClick={() => setIsEditing(false)} className="rs-btn rs-btn--secondary flex-1">
                                <X size={17} />
                                Annuler
                            </button>
                            <button type="submit" disabled={loading} className="rs-btn rs-btn--primary flex-1">
                                <Save size={17} />
                                {loading ? 'Enregistrement…' : 'Enregistrer'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Account;