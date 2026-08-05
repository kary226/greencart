import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Send, Loader2, Package, CheckCircle,
    FileText, Truck, X, UserPlus, Scale
} from 'lucide-react';

// [DESIGN.md §4] Même réduction que sur la liste des conversations : trois
// familles au lieu des neuf teintes d'origine, pour que l'agent repère d'un
// coup d'œil ce qui demande une action.
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
    annule:          { label: 'Annulé',          variante: 'done' },
};

const fcfa = (n) => `${Math.round(n || 0).toLocaleString('fr-FR')} FCFA`;

// Ferme une boîte de dialogue sur Échap. Les deux modales d'origine ne
// pouvaient être fermées qu'à la souris, sur la croix.
const useEchap = (actif, fermer) => {
    useEffect(() => {
        if (!actif) return;
        const onKey = (e) => { if (e.key === 'Escape') fermer(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [actif, fermer]);
};

const ChatDetail = () => {
    const { id } = useParams();
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [moi, setMoi] = useState(null);
    const [showDevisModal, setShowDevisModal] = useState(false);
    const [devisMontant, setDevisMontant] = useState('');
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assistants, setAssistants] = useState([]);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEchap(showDevisModal, () => setShowDevisModal(false));
    useEchap(showAssignModal, () => setShowAssignModal(false));

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: authData } = await axios.get('/api/staff/is-auth');
            if (!authData.success || !['admin', 'assistant_shein'].includes(authData.staffUser?.role)) {
                navigate('/staff/login');
                return;
            }
            setMoi(authData.staffUser);

            const { data: convData } = await axios.get(`/api/shein-cart/admin/conversations/${id}`);
            if (convData.success) {
                setConversation(convData.conversation);
            }

            const { data: msgData } = await axios.get(`/api/message-colis/${id}`);
            if (msgData.success) {
                setMessages(msgData.messages);
            }

            if (authData.staffUser.role === 'admin') {
                const { data: assistantData } = await axios.get('/api/shein-cart/admin/assistants-disponibles');
                if (assistantData.success) {
                    setAssistants(assistantData.assistants);
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        setSending(true);
        try {
            const { data } = await axios.post(`/api/message-colis/${id}`, {
                texte: newMessage.trim(),
                type: 'texte',
            });
            if (data.success) {
                setMessages([...messages, data.messageData]);
                setNewMessage('');
                inputRef.current?.focus();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSending(false);
        }
    };

    const handleSendDevis = async () => {
        if (!devisMontant || parseFloat(devisMontant) <= 0) {
            toast.error('Veuillez saisir un montant valide');
            return;
        }

        setSending(true);
        try {
            const { data } = await axios.post(`/api/message-colis/${id}/devis`, {
                montant: parseFloat(devisMontant),
                libelle: 'Devis',
            });
            if (data.success) {
                setMessages([...messages, data.messageData]);
                setShowDevisModal(false);
                setDevisMontant('');
                toast.success('Devis envoyé avec succès');
                loadData();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSending(false);
        }
    };

    const handleUpdateStatut = async (statut) => {
        try {
            const { data } = await axios.patch(`/api/message-colis/${id}/statut`, {
                statut,
            });
            if (data.success) {
                toast.success(`Statut mis à jour : ${STATUTS[statut]?.label || statut}`);
                loadData();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    // « Livré » clôt la conversation côté client : elle devient lecture seule et
    // il ne peut plus écrire. C'est la seule transition non rattrapable de
    // l'écran, d'où la confirmation. Les autres restent en un clic.
    const handleLivrer = () => {
        if (window.confirm(
            'Marquer ce colis comme livré ?\n\n' +
            'La conversation sera clôturée : le client ne pourra plus vous écrire.'
        )) {
            handleUpdateStatut('livre');
        }
    };

    const handleAssigner = async (assistantId) => {
        try {
            const { data } = await axios.patch('/api/shein-cart/admin/assigner', {
                colisId: id,
                assistantId,
            });
            if (data.success) {
                toast.success('Assistant assigné avec succès');
                setShowAssignModal(false);
                loadData();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center gap-3">
                <div className="rs-typing"><span /><span /><span /></div>
                <p className="text-[13px] text-ink-400">Chargement de la conversation…</p>
            </div>
        );
    }

    if (!conversation) {
        return (
            <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-4">
                        <Package size={26} className="text-ink-400" />
                    </div>
                    <p className="rs-h2 mb-1.5">Conversation introuvable</p>
                    <p className="text-[13px] text-ink-400 mb-5">Elle a peut-être été supprimée.</p>
                    <button onClick={() => navigate('/assistant/conversations')} className="rs-btn rs-btn--secondary">
                        Retour aux conversations
                    </button>
                </div>
            </div>
        );
    }

    const statut = STATUTS[conversation.statut] || { label: conversation.statut, variante: 'neutral' };
    const isAdmin = moi?.role === 'admin';
    const clos = conversation.statut === 'livre' || conversation.statut === 'annule';

    // Une seule transition possible à la fois, celle qui suit logiquement le
    // statut courant. La barre d'origine pouvait en afficher plusieurs sans
    // indiquer laquelle était la bonne.
    const transition = {
        devis_envoye: { label: 'Marquer acompte payé', icone: CheckCircle, action: () => handleUpdateStatut('acompte_paye') },
        en_entrepot:  { label: 'Marquer pesé',         icone: Scale,       action: () => handleUpdateStatut('pese') },
        pese:         { label: 'Passer en livraison',  icone: Truck,       action: () => handleUpdateStatut('en_livraison') },
        en_livraison: { label: 'Marquer livré',        icone: CheckCircle, action: handleLivrer },
    }[conversation.statut];

    const IconeTransition = transition?.icone;

    return (
        <div className="min-h-screen bg-ink-50 flex flex-col">

            {/* ── En-tête ────────────────────────────────────────────────── */}
            <header className="sticky top-0 z-10 rs-surface border-b border-ink-100">
                <div className="max-w-4xl mx-auto px-2 sm:px-4 py-2 flex items-center gap-2">
                    <button
                        onClick={() => navigate('/assistant/conversations')}
                        className="rs-icon-btn"
                        aria-label="Retour aux conversations"
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-extrabold text-ink-900 tracking-tight truncate">
                            {conversation.numeroSuivi || conversation._id.slice(-8)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 min-w-0">
                            <span className="text-[12px] text-ink-500 truncate">
                                {conversation.userId?.name || 'Client'}
                            </span>
                            {/* Le badge d'origine passait par une chaîne de .replace()
                                qui s'annulait et renvoyait la classe inchangée : un
                                fond clair atterrissait sur le bandeau coloré. */}
                            <span className={`rs-badge rs-badge--${statut.variante} shrink-0`}>
                                {statut.label}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {conversation.agentAssigneld && (
                            <span className="text-[12px] text-ink-400 hidden sm:inline truncate max-w-[120px]">
                                {conversation.agentAssigneld.nom}
                            </span>
                        )}
                        {isAdmin && (
                            <button onClick={() => setShowAssignModal(true)} className="rs-btn rs-btn--secondary !min-h-[36px] !px-3 text-[13px]">
                                <UserPlus size={15} />
                                <span className="hidden sm:inline">
                                    {conversation.agentAssigneld ? 'Changer' : 'Assigner'}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Messages ───────────────────────────────────────────────── */}
            <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-4">
                {messages.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="rs-h2 mb-1">Aucun message</p>
                        <p className="text-[13px] text-ink-400">Écrivez au client pour démarrer la conversation.</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMoi = msg.agentStaffId?._id === moi?._id;
                        const estAgent = !!msg.agentStaffId;

                        return (
                            <div key={msg._id} className={`flex mb-2.5 ${isMoi ? 'justify-end' : 'justify-start'}`}>
                                <div className={`rs-bubble ${isMoi ? 'rs-bubble--client' : 'rs-bubble--agent'}`}>
                                    {/* Le nom de l'expéditeur était en text-gray-400 y
                                        compris à l'intérieur des bulles colorées, donc
                                        illisible. Il suit maintenant la bulle. */}
                                    <p className={`rs-label mb-1.5 ${isMoi ? 'text-ramses-200' : 'text-ink-400'}`}>
                                        {estAgent
                                            ? (isMoi ? 'Vous' : msg.agentStaffId.nom)
                                            : 'Client'}
                                    </p>

                                    {msg.texte && <p className="whitespace-pre-wrap">{msg.texte}</p>}

                                    {msg.type === 'devis' && msg.payload?.montant != null && (
                                        <div className={`mt-2 pt-2 border-t ${isMoi ? 'border-white/20' : 'border-ink-100'}`}>
                                            <span className={`rs-label ${isMoi ? 'text-ramses-200' : 'text-ramses-600'}`}>
                                                Devis
                                            </span>
                                            <p className={`text-[18px] font-extrabold tabular-nums tracking-tight mt-1 ${isMoi ? 'text-white' : 'text-ink-900'}`}>
                                                {fcfa(msg.payload.montant)}
                                            </p>
                                        </div>
                                    )}

                                    <div className="rs-bubble__meta">
                                        <span>
                                            {new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* ── Barre d'actions + saisie ───────────────────────────────── */}
            <div className="sticky bottom-0 rs-surface border-t border-ink-100">
                <div className="max-w-4xl mx-auto w-full px-4 pt-2.5" style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>

                    {!clos && (isAdmin || transition) && (
                        <div className="flex flex-wrap gap-2 mb-2.5">
                            {isAdmin && (
                                <button
                                    onClick={() => setShowDevisModal(true)}
                                    className="rs-btn rs-btn--secondary !min-h-[38px] !px-3.5 text-[13px]"
                                >
                                    <FileText size={15} /> Envoyer un devis
                                </button>
                            )}
                            {transition && (
                                <button
                                    onClick={transition.action}
                                    className="rs-btn rs-btn--secondary !min-h-[38px] !px-3.5 text-[13px]"
                                >
                                    <IconeTransition size={15} /> {transition.label}
                                </button>
                            )}
                        </div>
                    )}

                    {clos ? (
                        <p className="text-center text-[12px] font-medium text-ink-400 py-3">
                            {conversation.statut === 'livre'
                                ? 'Colis livré — conversation clôturée'
                                : 'Colis annulé — conversation clôturée'}
                        </p>
                    ) : (
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Écrire au client…"
                                aria-label="Votre message"
                                className="rs-input rs-input--pill flex-1"
                            />
                            <button
                                type="submit"
                                disabled={sending || !newMessage.trim()}
                                className="rs-icon-btn rs-icon-btn--filled"
                                aria-label="Envoyer le message"
                            >
                                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* ── Modale : devis ─────────────────────────────────────────── */}
            {showDevisModal && (
                <div
                    className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowDevisModal(false)}
                    role="presentation"
                >
                    <div
                        className="bg-ink-0 rounded-2xl max-w-md w-full p-6"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="titre-devis"
                    >
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h2 id="titre-devis" className="rs-h1">Envoyer un devis</h2>
                                <p className="text-[13px] text-ink-500 mt-1">
                                    Le client recevra un bouton de paiement dans la conversation.
                                </p>
                            </div>
                            <button onClick={() => setShowDevisModal(false)} className="rs-icon-btn shrink-0" aria-label="Fermer">
                                <X size={20} />
                            </button>
                        </div>

                        <label htmlFor="montant-devis" className="block text-[12px] font-semibold text-ink-500 mb-1.5">
                            Montant en FCFA
                        </label>
                        <input
                            id="montant-devis"
                            type="number"
                            min="0"
                            step="100"
                            inputMode="numeric"
                            value={devisMontant}
                            onChange={(e) => setDevisMontant(e.target.value)}
                            className="rs-input"
                            placeholder="25000"
                            autoFocus
                        />

                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setShowDevisModal(false)} className="rs-btn rs-btn--secondary flex-1">
                                Annuler
                            </button>
                            <button
                                onClick={handleSendDevis}
                                disabled={sending || !devisMontant}
                                className="rs-btn rs-btn--primary flex-1"
                            >
                                {sending ? <Loader2 size={18} className="animate-spin" /> : 'Envoyer le devis'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modale : assignation ───────────────────────────────────── */}
            {showAssignModal && (
                <div
                    className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowAssignModal(false)}
                    role="presentation"
                >
                    <div
                        className="bg-ink-0 rounded-2xl max-w-md w-full p-6"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="titre-assign"
                    >
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <h2 id="titre-assign" className="rs-h1">Assigner un assistant</h2>
                            <button onClick={() => setShowAssignModal(false)} className="rs-icon-btn shrink-0" aria-label="Fermer">
                                <X size={20} />
                            </button>
                        </div>

                        {assistants.length === 0 ? (
                            <p className="text-[13px] text-ink-400 py-4 text-center">
                                Aucun assistant disponible pour le moment.
                            </p>
                        ) : (
                            <ul className="grid gap-2 list-none p-0 m-0">
                                {assistants.map((assistant) => {
                                    const actuel = conversation.agentAssigneld?._id === assistant._id;
                                    return (
                                        <li key={assistant._id}>
                                            <button
                                                onClick={() => handleAssigner(assistant._id)}
                                                disabled={actuel}
                                                className={`w-full text-left px-4 py-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                                                    actuel
                                                        ? 'border-ramses-200 bg-ramses-50 cursor-default'
                                                        : 'border-ink-200 hover:bg-ink-50'
                                                }`}
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-[14px] font-semibold text-ink-900 truncate">
                                                        {assistant.nom}
                                                    </p>
                                                    <p className="text-[12px] text-ink-500 truncate">{assistant.email}</p>
                                                </div>
                                                {actuel ? (
                                                    <span className="rs-badge rs-badge--ok shrink-0">Assigné</span>
                                                ) : (
                                                    <span className="text-[12px] text-ink-400 shrink-0 tabular-nums">
                                                        {assistant.conversationsEnCours} en cours
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatDetail;
