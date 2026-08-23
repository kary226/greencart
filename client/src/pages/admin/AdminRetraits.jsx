import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import AdminNav from './AdminNav';
import {
    Banknote, ShieldAlert, Loader2, Clock, Send, CheckCircle2, XCircle,
    Phone, User, Copy, ExternalLink, AlertCircle,
} from 'lucide-react';

// Traitement des demandes de retrait, côté administrateur.
//
// Rappel du modèle (voir server/controllers/retraitController.js) : les
// fonds sont réservés dès la demande, le virement s'exécute ici, à la main,
// parce que Jèko — le prestataire de paiement du site — n'expose aucune API
// de versement. Cet écran est donc la dernière étape humaine du circuit, et
// il doit permettre de la faire vite : chaque seconde de retard ici est une
// seconde où le commerçant attend son argent alors qu'il l'a déjà "vu"
// disparaître de son solde.
//
// en_attente -> en_cours -> payee
//                        \-> rejetee (fonds restitués automatiquement)

const OPERATEUR_COULEURS = {
    orange_money: 'bg-orange-100 text-orange-700',
    mtn_money: 'bg-amber-100 text-amber-700',
    moov_money: 'bg-blue-100 text-blue-700',
    wave: 'bg-sky-100 text-sky-700',
};

const STATUT_CONFIG = {
    en_attente: { label: 'À traiter', className: 'bg-warn-50 text-warn-500', icon: Clock },
    en_cours: { label: 'Virement en cours', className: 'bg-blue-100 text-blue-700', icon: Send },
    payee: { label: 'Payée', className: 'bg-ok-50 text-ok-500', icon: CheckCircle2 },
    rejetee: { label: 'Rejetée', className: 'bg-ink-100 text-ink-500', icon: XCircle },
};

const ONGLETS_STATUT = [
    { value: '', label: 'Toutes' },
    { value: 'en_attente', label: 'À traiter' },
    { value: 'en_cours', label: 'En cours' },
    { value: 'payee', label: 'Payées' },
    { value: 'rejetee', label: 'Rejetées' },
];

const StatutBadge = ({ statut }) => {
    const c = STATUT_CONFIG[statut] || STATUT_CONFIG.en_attente;
    const Icon = c.icon;
    return (
        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${c.className}`}>
            <Icon size={12} /> {c.label}
        </span>
    );
};

const copier = (valeur) => {
    navigator.clipboard?.writeText(valeur);
    toast.success('Copié');
};

// Modale d'action : "Marquer payé" (référence obligatoire) ou "Rejeter"
// (motif obligatoire). Même composant pour les deux, le contenu change.
const ModaleAction = ({ demande, mode, onClose, onConfirm, enCours }) => {
    const [reference, setReference] = useState('');
    const [preuvePaiement, setPreuvePaiement] = useState('');
    const [noteAdmin, setNoteAdmin] = useState('');

    const estPaiement = mode === 'payee';

    const soumettre = () => {
        if (estPaiement && !reference.trim()) {
            toast.error('La référence du virement est obligatoire');
            return;
        }
        if (!estPaiement && !noteAdmin.trim()) {
            toast.error('Indique un motif de rejet — le commerçant le verra');
            return;
        }
        onConfirm(demande, mode, { reference, preuvePaiement, noteAdmin });
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-semibold text-ink-900 mb-1">
                    {estPaiement ? 'Marquer ce retrait comme payé' : 'Rejeter cette demande'}
                </h3>
                <p className="text-sm text-ink-500 mb-4">
                    {demande.montant.toLocaleString('fr-FR')} FCFA · {demande.operateurLibelle} · {demande.numero}
                </p>

                {estPaiement ? (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-ink-700 mb-1">
                                Référence du virement <span className="text-ramses-600">*</span>
                            </label>
                            <input
                                autoFocus
                                type="text"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="Ex : ID transaction Orange Money"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-ink-200 focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500 outline-none transition text-sm"
                            />
                            <p className="text-xs text-ink-400 mt-1">Preuve en cas de contestation du commerçant.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-ink-700 mb-1">Lien preuve de paiement (optionnel)</label>
                            <input
                                type="text"
                                value={preuvePaiement}
                                onChange={(e) => setPreuvePaiement(e.target.value)}
                                placeholder="https://…"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-ink-200 focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500 outline-none transition text-sm"
                            />
                        </div>
                    </div>
                ) : (
                    <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">
                            Motif du rejet <span className="text-ramses-600">*</span>
                        </label>
                        <textarea
                            autoFocus
                            rows={3}
                            value={noteAdmin}
                            onChange={(e) => setNoteAdmin(e.target.value)}
                            placeholder="Ex : numéro invalide, à corriger et redemander"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-ink-200 focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500 outline-none transition text-sm"
                        />
                        <p className="text-xs text-ink-400 mt-1">Les fonds seront immédiatement restitués au portefeuille du commerçant.</p>
                    </div>
                )}

                <div className="flex gap-2 mt-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-ink-200 text-sm font-medium hover:bg-ink-50 transition">
                        Annuler
                    </button>
                    <button
                        onClick={soumettre}
                        disabled={enCours}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition disabled:opacity-50 ${
                            estPaiement ? 'bg-ok-500 hover:bg-ok-600' : 'bg-ramses-600 hover:bg-ramses-700'
                        }`}
                    >
                        {enCours ? <Loader2 size={16} className="animate-spin mx-auto" /> : estPaiement ? 'Confirmer le paiement' : 'Confirmer le rejet'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AdminRetraits = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [authorized, setAuthorized] = useState(null);
    const [moi, setMoi] = useState(null);

    const [demandes, setDemandes] = useState([]);
    const [aTraiter, setATraiter] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filtreStatut, setFiltreStatut] = useState('en_attente');

    const [modale, setModale] = useState(null); // { demande, mode }
    const [actionEnCours, setActionEnCours] = useState(false);

    const charger = useCallback(async () => {
        setLoading(true);
        try {
            const params = filtreStatut ? `?statut=${filtreStatut}` : '';
            const { data } = await axios.get(`/api/retraits${params}`);
            if (data.success) {
                setDemandes(data.demandes || []);
                setATraiter(data.aTraiter || 0);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    }, [axios, filtreStatut]);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axios.get('/api/staff/is-auth');
                if (data.success && ['admin', 'super_admin'].includes(data.staffUser?.role)) {
                    setMoi(data.staffUser);
                    setAuthorized(true);
                } else {
                    setAuthorized(false);
                }
            } catch (error) {
                setAuthorized(false);
            }
        })();
    }, [axios]);

    useEffect(() => { if (authorized) charger(); }, [authorized, charger]);

    // Démarrer le virement : passe la demande en "en_cours" pour signaler
    // aux autres admins qu'elle est prise en charge, avant même que le
    // virement Mobile Money soit envoyé.
    const demarrerVirement = async (demande) => {
        try {
            const { data } = await axios.patch(`/api/retraits/${demande._id}`, { statut: 'en_cours' });
            if (data.success) {
                toast.success('Virement marqué en cours — tu peux maintenant l\'exécuter dans ton app Mobile Money / Jèko Business');
                charger();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const confirmerAction = async (demande, statut, { reference, preuvePaiement, noteAdmin }) => {
        setActionEnCours(true);
        try {
            const { data } = await axios.patch(`/api/retraits/${demande._id}`, {
                statut,
                reference: reference || undefined,
                preuvePaiement: preuvePaiement || undefined,
                noteAdmin: noteAdmin || undefined,
            });
            if (data.success) {
                toast.success(data.message);
                setModale(null);
                charger();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setActionEnCours(false);
        }
    };

    const montantATraiter = useMemo(
        () => demandes.filter((d) => ['en_attente', 'en_cours'].includes(d.statut)).reduce((s, d) => s + d.montant, 0),
        [demandes]
    );

    if (authorized === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-ink-50">
                <Loader2 className="animate-spin text-ramses-600" size={28} />
            </div>
        );
    }

    if (authorized === false) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
                <div className="text-center max-w-sm">
                    <ShieldAlert size={44} className="text-ramses-600 mx-auto mb-3" />
                    <h1 className="text-lg font-bold text-ink-900">Accès refusé</h1>
                    <p className="text-sm text-ink-500 mt-1 mb-5">Cette page est réservée aux comptes admin.</p>
                    <button onClick={() => navigate('/staff/login')} className="px-4 py-2 bg-ramses-600 text-white rounded-xl text-sm font-medium hover:bg-ramses-700 transition">
                        Aller à la connexion
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ink-50">
            <AdminNav titre="Retraits" sousTitre={`${moi?.nom} · Administrateur`} />

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Chiffres clés */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className={`bg-white rounded-2xl border p-4 ${aTraiter > 0 ? 'border-warn-500/40' : 'border-ink-100'}`}>
                        <div className="flex items-center gap-2 text-xs text-ink-400"><Clock size={14} /> À traiter</div>
                        <p className={`text-2xl font-bold mt-1 ${aTraiter > 0 ? 'text-warn-500' : 'text-ink-700'}`}>{aTraiter}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-100 p-4">
                        <div className="flex items-center gap-2 text-xs text-ink-400"><Banknote size={14} /> Montant visible ici</div>
                        <p className="text-2xl font-bold mt-1 text-ink-700">{montantATraiter.toLocaleString('fr-FR')} FCFA</p>
                    </div>
                </div>

                {aTraiter > 0 && (
                    <div className="bg-warn-50 border border-warn-500/30 rounded-2xl p-4 flex items-start gap-2.5">
                        <AlertCircle size={18} className="text-warn-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-warn-500">
                            {aTraiter} demande{aTraiter > 1 ? 's' : ''} en attente. Les fonds sont déjà réservés côté commerçant —
                            plus vite le virement part, mieux c'est.
                        </p>
                    </div>
                )}

                {/* Filtres */}
                <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-ink-100 w-fit overflow-x-auto max-w-full">
                    {ONGLETS_STATUT.map((o) => (
                        <button
                            key={o.value}
                            onClick={() => setFiltreStatut(o.value)}
                            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                                filtreStatut === o.value ? 'bg-ramses-600 text-white' : 'text-ink-500 hover:text-ink-800'
                            }`}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>

                {/* Liste */}
                <div className="bg-white rounded-2xl border border-ink-100 overflow-hidden">
                    {loading ? (
                        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-ramses-600" size={26} /></div>
                    ) : demandes.length === 0 ? (
                        <div className="p-16 text-center text-sm text-ink-400">Aucune demande dans cette catégorie</div>
                    ) : (
                        <div className="divide-y divide-ink-50">
                            {demandes.map((d) => (
                                <div key={d._id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                            <span className="font-semibold text-ink-900">{d.montant.toLocaleString('fr-FR')} FCFA</span>
                                            <StatutBadge statut={d.statut} />
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${OPERATEUR_COULEURS[d.operateur] || 'bg-ink-100 text-ink-500'}`}>
                                                {d.operateurLibelle}
                                            </span>
                                        </div>
                                        <p className="text-sm text-ink-700 truncate">{d.commercialId?.nom} · {d.commercialId?.email}</p>
                                        <div className="flex items-center gap-4 mt-1.5 text-sm text-ink-500 flex-wrap">
                                            <button onClick={() => copier(d.numero)} className="inline-flex items-center gap-1 hover:text-ramses-600 transition">
                                                <Phone size={13} /> {d.numero} <Copy size={11} />
                                            </button>
                                            {d.titulaire && (
                                                <span className="inline-flex items-center gap-1"><User size={13} /> {d.titulaire}</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-ink-400 mt-1">
                                            Demandée le {new Date(d.createdAt).toLocaleString('fr-FR')}
                                            {d.traiteLe && ` · traitée le ${new Date(d.traiteLe).toLocaleString('fr-FR')}`}
                                        </p>
                                        {d.reference && <p className="text-xs text-ink-500 mt-1">Réf. virement : {d.reference}</p>}
                                        {d.noteAdmin && <p className="text-xs text-ramses-600 mt-1">Note : {d.noteAdmin}</p>}
                                        {d.preuvePaiement && (
                                            <a href={d.preuvePaiement} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-ramses-700 hover:underline mt-1">
                                                Voir la preuve <ExternalLink size={11} />
                                            </a>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {d.statut === 'en_attente' && (
                                            <>
                                                <button onClick={() => demarrerVirement(d)} className="px-3.5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
                                                    Démarrer le virement
                                                </button>
                                                <button onClick={() => setModale({ demande: d, mode: 'rejetee' })} className="px-3.5 py-2 rounded-xl border border-ink-200 text-sm font-medium hover:bg-ink-50 transition">
                                                    Rejeter
                                                </button>
                                            </>
                                        )}
                                        {d.statut === 'en_cours' && (
                                            <>
                                                <button onClick={() => setModale({ demande: d, mode: 'payee' })} className="px-3.5 py-2 rounded-xl bg-ok-500 text-white text-sm font-medium hover:bg-ok-600 transition">
                                                    Marquer payé
                                                </button>
                                                <button onClick={() => setModale({ demande: d, mode: 'rejetee' })} className="px-3.5 py-2 rounded-xl border border-ink-200 text-sm font-medium hover:bg-ink-50 transition">
                                                    Rejeter
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {modale && (
                <ModaleAction
                    demande={modale.demande}
                    mode={modale.mode}
                    onClose={() => setModale(null)}
                    onConfirm={confirmerAction}
                    enCours={actionEnCours}
                />
            )}
        </div>
    );
};

export default AdminRetraits;