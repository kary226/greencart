import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import AdminNav from './AdminNav';
import {
    ScrollText, ShieldAlert, Loader2, ChevronLeft, ChevronRight, X,
    Trash2, Archive, PencilLine, PlusCircle, Boxes, RotateCcw,
} from 'lucide-react';

// Journal des actions du staff.
//
// Sa raison d'être : un commerçant peut supprimer un article, y compris un
// article fourni par la plateforme. La suppression reste possible — c'est
// voulu — mais elle laisse désormais une trace qui dit quoi, qui et quand,
// avec de quoi reconstituer l'article (nom, code, prix, stock au moment de
// l'action).

// Chaque type d'action porte son icône et sa couleur : on repère une
// suppression dans une longue liste sans avoir à lire chaque ligne.
const ACTIONS = {
    'produit.creation': { label: 'Création', icone: PlusCircle, classe: 'bg-ok-50 text-ok-500' },
    'produit.modification': { label: 'Modification', icone: PencilLine, classe: 'bg-info-50 text-info-500' },
    'produit.stock': { label: 'Stock', icone: Boxes, classe: 'bg-ink-100 text-ink-600' },
    'produit.archivage': { label: 'Archivage', icone: Archive, classe: 'bg-warn-50 text-warn-500' },
    'produit.suppression': { label: 'Suppression', icone: Trash2, classe: 'bg-ramses-50 text-ramses-700' },
    'produit.restauration': { label: 'Restauration', icone: RotateCcw, classe: 'bg-ok-50 text-ok-500' },
};

const ROLES = {
    admin: 'Administrateur',
    commercant: 'Commerçant',
    livreur: 'Livreur',
    assistant_shein: 'Assistant Shein',
};

const AdminJournal = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [authorized, setAuthorized] = useState(null);
    const [moi, setMoi] = useState(null);

    const [entrees, setEntrees] = useState([]);
    const [boutiques, setBoutiques] = useState([]);
    const [chargement, setChargement] = useState(true);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [filtreAction, setFiltreAction] = useState('');
    const [filtreBoutique, setFiltreBoutique] = useState('');

    const charger = useCallback(async () => {
        setChargement(true);
        try {
            const params = new URLSearchParams({ page, limit: 30 });
            if (filtreAction) params.append('action', filtreAction);
            if (filtreBoutique) params.append('boutiqueId', filtreBoutique);

            const { data } = await axios.get(`/api/journal?${params.toString()}`);
            if (data.success) {
                setEntrees(data.entrees || []);
                setTotalPages(data.pagination?.totalPages || 1);
                setTotal(data.pagination?.total || 0);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setChargement(false);
        }
    }, [axios, page, filtreAction, filtreBoutique]);

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
                console.error('Erreur vérification authentification admin:', error);
                setAuthorized(false);
            }
        })();
    }, [axios]);

    useEffect(() => {
        if (!authorized) return;
        charger();
        axios.get('/api/journal/boutiques')
            .then(({ data }) => { if (data.success) setBoutiques(data.boutiques || []); })
            .catch(() => { /* le filtre reste vide, le journal fonctionne */ });
    }, [authorized, charger, axios]);

    // Revenir en page 1 quand les filtres changent, sinon on se retrouve sur
    // une page vide sans comprendre pourquoi.
    useEffect(() => { setPage(1); }, [filtreAction, filtreBoutique]);

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
                    <p className="text-sm text-ink-500 mt-1 mb-5">
                        Cette page est réservée aux comptes admin.
                    </p>
                    <button
                        onClick={() => navigate('/staff/login')}
                        className="px-4 py-2 bg-ramses-600 text-white rounded-xl text-sm font-medium hover:bg-ramses-700 transition"
                    >
                        Aller à la connexion
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ink-50">
            <AdminNav
                titre="Journal des actions"
                sousTitre={`${moi?.nom} · Administrateur · ${total} action${total > 1 ? 's' : ''} enregistrée${total > 1 ? 's' : ''}`}
            />

            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="bg-white rounded-2xl border border-ink-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-ink-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <ScrollText size={18} className="text-ink-400" />
                            <h2 className="font-semibold text-ink-900">Qui a fait quoi</h2>
                        </div>

                        <div className="flex gap-2">
                            <select
                                value={filtreAction}
                                onChange={(e) => setFiltreAction(e.target.value)}
                                className="px-3 py-1.5 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-600 transition"
                            >
                                <option value="">Toutes les actions</option>
                                {Object.entries(ACTIONS).map(([valeur, { label }]) => (
                                    <option key={valeur} value={valeur}>{label}</option>
                                ))}
                            </select>
                            <select
                                value={filtreBoutique}
                                onChange={(e) => setFiltreBoutique(e.target.value)}
                                className="px-3 py-1.5 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-600 transition"
                            >
                                <option value="">Toutes les boutiques</option>
                                {boutiques.map((b) => (
                                    <option key={b._id} value={b._id}>{b.nom}</option>
                                ))}
                            </select>
                            {(filtreAction || filtreBoutique) && (
                                <button
                                    onClick={() => { setFiltreAction(''); setFiltreBoutique(''); }}
                                    className="p-1.5 text-ink-400 hover:text-ink-800 rounded-lg hover:bg-ink-100 transition"
                                    title="Effacer les filtres"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    {chargement ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 className="animate-spin text-ink-300" size={22} />
                        </div>
                    ) : entrees.length === 0 ? (
                        <div className="p-10 text-center">
                            <ScrollText size={28} className="text-ink-300 mx-auto mb-3" />
                            <p className="text-sm text-ink-500">
                                {filtreAction || filtreBoutique
                                    ? 'Aucune action ne correspond à ces filtres.'
                                    : "Aucune action enregistrée pour l'instant."}
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-ink-100">
                            {entrees.map((e) => {
                                const meta = ACTIONS[e.action] || { label: e.action, icone: PencilLine, classe: 'bg-ink-100 text-ink-600' };
                                const Icone = meta.icone;
                                return (
                                    <li key={e._id} className="px-5 py-3.5 flex items-start gap-3">
                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.classe}`}>
                                            <Icone size={15} />
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm text-ink-900">
                                                <span className="font-medium">{meta.label}</span>
                                                {' — '}
                                                <span className="text-ink-700">{e.cibleLibelle || 'article sans nom'}</span>
                                            </p>
                                            <p className="text-xs text-ink-400 mt-0.5">
                                                {e.acteurNom} · {ROLES[e.acteurRole] || e.acteurRole}
                                                {e.boutiqueId?.nom ? ` · ${e.boutiqueId.nom}` : ''}
                                                {' · '}
                                                {new Date(e.createdAt).toLocaleString('fr-FR')}
                                            </p>

                                            {/* L'aperçu est ce qui rend une suppression rattrapable :
                                                il dit quoi recréer. */}
                                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-ink-500">
                                                {e.apercu?.sku && <span className="font-mono">{e.apercu.sku}</span>}
                                                {e.apercu?.prix != null && <span>{e.apercu.prix.toLocaleString('fr-FR')} FCFA</span>}
                                                {e.apercu?.stock != null && <span>stock {e.apercu.stock}</span>}
                                                {e.apercu?.nombreImages != null && <span>{e.apercu.nombreImages} photo(s)</span>}
                                                {e.apercu?.origine === 'plateforme' && (
                                                    <span className="font-semibold text-ink-700">article plateforme</span>
                                                )}
                                            </div>

                                            {e.note && <p className="text-[11px] text-ink-400 mt-1 italic">{e.note}</p>}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {totalPages > 1 && (
                        <div className="px-5 py-4 border-t border-ink-100 flex items-center justify-between">
                            <p className="text-sm text-ink-500">Page {page} sur {totalPages}</p>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 rounded-lg hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 rounded-lg hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminJournal;