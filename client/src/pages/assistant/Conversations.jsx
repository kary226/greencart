import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { MessageSquare, Search, ChevronRight, User, Mail, Package, X } from 'lucide-react';

// [DESIGN.md §4] L'écran d'origine peignait chaque statut d'une teinte
// différente : gris, bleu, ambre, vert, violet, indigo, cyan, émeraude, rouge.
// Neuf couleurs ne hiérarchisent rien — l'agent ne pouvait pas repérer d'un
// coup d'œil ce qui demandait une action. Trois familles seulement :
//   warn    → la balle est dans le camp du client ou de l'agent
//   info    → ça avance, rien à faire
//   ok/done → acquis ou clos
const STATUTS = {
    soumis:          { label: 'Soumis',          variante: 'warn' },
    en_verification: { label: 'En vérification', variante: 'info' },
    devis_envoye:    { label: 'Devis envoyé',    variante: 'warn' },
    acompte_paye:    { label: 'Acompte payé',    variante: 'neutral' },
    achete:          { label: 'Acheté',          variante: 'neutral' },
    en_entrepot:     { label: 'En entrepôt',     variante: 'neutral' },
    pese:            { label: 'Pesé',            variante: 'warn' },
    solde_du:        { label: 'Solde dû',        variante: 'warn' },
    solde_paye:      { label: 'Solde payé',      variante: 'neutral' },
    en_livraison:    { label: 'En livraison',    variante: 'info' },
    livre:           { label: 'Livré',           variante: 'ok' },
    // Annulé en gris et non en rouge : un dossier clos n'est pas une alerte,
    // et le rouge est réservé à la marque et aux actions.
    annule:          { label: 'Annulé',          variante: 'done' },
};

const OPTIONS_STATUT = Object.entries(STATUTS).map(([valeur, { label }]) => ({ valeur, label }));

const Conversations = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [conversations, setConversations] = useState([]);
    const [stats, setStats] = useState(null);
    const [moi, setMoi] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: authData } = await axios.get('/api/staff/is-auth');
            if (!authData.success || !['admin', 'assistant_shein'].includes(authData.staffUser?.role)) {
                navigate('/staff/login');
                return;
            }
            setMoi(authData.staffUser);

            const params = new URLSearchParams();
            if (filterStatus) params.append('statut', filterStatus);

            const { data } = await axios.get(`/api/shein-cart/admin/conversations?${params.toString()}`);
            if (data.success) {
                setConversations(data.conversations);
            }

            if (authData.staffUser.role === 'admin') {
                const { data: statsData } = await axios.get('/api/shein-cart/admin/stats');
                if (statsData.success) {
                    setStats(statsData.stats);
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
            if (error.response?.status === 401) navigate('/staff/login');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filterStatus]);

    const q = searchTerm.trim().toLowerCase();
    const filteredConversations = q
        ? conversations.filter((conv) =>
            conv.numeroSuivi?.toLowerCase().includes(q) ||
            conv.userId?.name?.toLowerCase().includes(q) ||
            conv.userId?.email?.toLowerCase().includes(q)
        )
        : conversations;

    if (loading) {
        return (
            <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center gap-3">
                <div className="rs-typing"><span /><span /><span /></div>
                <p className="text-[13px] text-ink-400">Chargement des conversations…</p>
            </div>
        );
    }

    const estAdmin = moi?.role === 'admin';

    return (
        <div className="min-h-screen bg-ink-50">

            {/* ── En-tête ────────────────────────────────────────────────── */}
            {/* Le bandeau rouge plein d'origine violait la règle « l'accent ne
                dépasse jamais ~15 % de l'écran » : une barre rouge sur toute la
                largeur écrase les boutons d'action de la page. */}
            <header className="sticky top-0 z-10 rs-surface border-b border-ink-100">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 shrink-0 rounded-full bg-ramses-50 flex items-center justify-center">
                            <MessageSquare size={19} className="text-ramses-600" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="rs-h2 truncate">Conversations SHEIN</h1>
                            <p className="text-[12px] text-ink-400">
                                {estAdmin ? 'Toutes les conversations' : 'Mes conversations assignées'}
                            </p>
                        </div>
                    </div>
                    <span className="rs-badge rs-badge--neutral shrink-0">
                        {estAdmin ? 'Admin' : 'Assistant'}
                    </span>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">

                {/* ── Indicateurs ────────────────────────────────────────── */}
                {/* « Sans agent » porte le rail rouge : c'est la seule ligne du
                    tableau de bord sur laquelle l'admin doit agir. Les autres
                    sont des constats. */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-5">
                        {[
                            { cle: 'total',     label: 'Total',      valeur: stats.total,     ton: 'text-ink-900' },
                            { cle: 'attente',   label: 'En attente', valeur: stats.enAttente, ton: 'text-warn-500' },
                            { cle: 'cours',     label: 'En cours',   valeur: stats.enCours,   ton: 'text-info-500' },
                            { cle: 'termines',  label: 'Terminés',   valeur: stats.termines,  ton: 'text-ok-500' },
                            { cle: 'sansAgent', label: 'Sans agent', valeur: stats.sansAgent, ton: 'text-ramses-600', action: true },
                        ].map((s) => (
                            <div key={s.cle} className={`rs-card ${s.action && s.valeur > 0 ? 'rs-card--action' : ''} py-3`}>
                                <p className="rs-label text-ink-400">{s.label}</p>
                                <p className={`text-[26px] font-extrabold tracking-tight tabular-nums mt-1.5 ${s.ton}`}>
                                    {s.valeur}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Recherche et filtre ────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
                    <div className="relative flex-1">
                        <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Numéro de suivi, nom ou e-mail du client…"
                            aria-label="Rechercher une conversation"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="rs-input pl-11 pr-11"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-1 top-1/2 -translate-y-1/2 rs-icon-btn"
                                aria-label="Effacer la recherche"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        aria-label="Filtrer par statut"
                        className="rs-input sm:w-56"
                    >
                        <option value="">Tous les statuts</option>
                        {OPTIONS_STATUT.map((o) => (
                            <option key={o.valeur} value={o.valeur}>{o.label}</option>
                        ))}
                    </select>
                </div>

                {/* ── Liste ──────────────────────────────────────────────── */}
                {filteredConversations.length === 0 ? (
                    <div className="rs-card text-center py-14">
                        <div className="w-16 h-16 rounded-full bg-ink-50 flex items-center justify-center mx-auto mb-4">
                            <MessageSquare size={26} className="text-ink-400" />
                        </div>
                        <p className="rs-h2 mb-1.5">Aucune conversation</p>
                        <p className="text-[13px] text-ink-400 max-w-[340px] mx-auto">
                            {searchTerm
                                ? <>Rien ne correspond à « {searchTerm} ».</>
                                : moi?.role === 'assistant_shein'
                                    ? "Aucune conversation ne vous est assignée pour l'instant."
                                    : 'Aucune conversation ne correspond à ce filtre.'}
                        </p>
                        {(searchTerm || filterStatus) && (
                            <button
                                onClick={() => { setSearchTerm(''); setFilterStatus(''); }}
                                className="rs-btn rs-btn--secondary mt-5"
                            >
                                Réinitialiser les filtres
                            </button>
                        )}
                    </div>
                ) : (
                    <ul className="rs-card p-0 overflow-hidden list-none m-0">
                        {filteredConversations.map((conv, i) => {
                            const statut = STATUTS[conv.statut] || { label: conv.statut, variante: 'neutral' };
                            const sansAgent = !conv.agentAssigneld;

                            return (
                                <li key={conv._id} className={i > 0 ? 'border-t border-ink-100' : ''}>
                                    {/* <button> et non <div onClick> : la version
                                        d'origine n'était ni focalisable au clavier
                                        ni annoncée comme cliquable. */}
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/assistant/conversation/${conv._id}`)}
                                        className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-ink-50 transition focus-visible:outline-none focus-visible:bg-ink-50"
                                    >
                                        <div className="w-10 h-10 shrink-0 rounded-full bg-ink-50 flex items-center justify-center">
                                            <Package size={18} className="text-ink-500" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-[14px] font-extrabold text-ink-900 tracking-tight truncate">
                                                {conv.numeroSuivi || conv._id.slice(-8)}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[12px] text-ink-500 mt-1">
                                                <span className="flex items-center gap-1.5 min-w-0">
                                                    <User size={13} className="shrink-0" />
                                                    <span className="truncate">{conv.userId?.name || 'Client'}</span>
                                                </span>
                                                {conv.userId?.email && (
                                                    <span className="flex items-center gap-1.5 min-w-0">
                                                        <Mail size={13} className="shrink-0" />
                                                        <span className="truncate">{conv.userId.email}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            {estAdmin && (
                                                sansAgent ? (
                                                    <span className="rs-label text-ramses-600 hidden sm:inline">
                                                        Non assigné
                                                    </span>
                                                ) : (
                                                    <span className="text-[12px] text-ink-400 hidden sm:inline truncate max-w-[120px]">
                                                        {conv.agentAssigneld.nom}
                                                    </span>
                                                )
                                            )}
                                            <span className={`rs-badge rs-badge--${statut.variante}`}>
                                                {statut.label}
                                            </span>
                                            <ChevronRight size={18} className="text-ink-300" />
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default Conversations;
