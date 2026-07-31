import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Send, Loader2, User, Mail, Phone,
    Package, Clock, CheckCircle, FileText, DollarSign,
    Truck, X
} from 'lucide-react';

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
                toast.success(`Statut mis à jour : ${statut}`);
                loadData();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
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

    const getStatusBadge = (statut) => {
        const config = {
            soumis: { label: 'Soumis', className: 'bg-gray-100 text-gray-700' },
            en_verification: { label: 'En vérification', className: 'bg-blue-100 text-blue-700' },
            devis_envoye: { label: 'Devis envoyé', className: 'bg-amber-100 text-amber-700' },
            acompte_paye: { label: 'Acompte payé', className: 'bg-green-100 text-green-700' },
            achete: { label: 'Acheté', className: 'bg-purple-100 text-purple-700' },
            en_entrepot: { label: 'En entrepôt', className: 'bg-indigo-100 text-indigo-700' },
            pese: { label: 'Pesé', className: 'bg-cyan-100 text-cyan-700' },
            solde_du: { label: 'Solde dû', className: 'bg-amber-100 text-amber-700' },
            solde_paye: { label: 'Solde payé', className: 'bg-green-100 text-green-700' },
            en_livraison: { label: 'En livraison', className: 'bg-blue-100 text-blue-700' },
            livre: { label: 'Livré', className: 'bg-emerald-100 text-emerald-700' },
            annule: { label: 'Annulé', className: 'bg-red-100 text-red-700' },
        };
        return config[statut] || { label: statut, className: 'bg-gray-100 text-gray-700' };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-ivory-200 flex items-center justify-center">
                <Loader2 className="animate-spin text-burgundy-600" size={40} />
            </div>
        );
    }

    if (!conversation) {
        return (
            <div className="min-h-screen bg-ivory-200 flex items-center justify-center px-4">
                <div className="text-center">
                    <Package className="mx-auto text-gray-400 mb-3" size={48} />
                    <h2 className="text-lg font-bold text-gray-800">Conversation non trouvée</h2>
                    <button
                        onClick={() => navigate('/assistant/conversations')}
                        className="mt-4 text-burgundy-600 hover:text-burgundy-700"
                    >
                        Retour aux conversations
                    </button>
                </div>
            </div>
        );
    }

    const status = getStatusBadge(conversation.statut);
    const isAssistant = moi?.role === 'assistant_shein';
    const isAdmin = moi?.role === 'admin';

    return (
        <div className="min-h-screen bg-ivory-200 flex flex-col">
            {/* En-tête */}
            <div className="bg-burgundy-600 text-ivory-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/assistant/conversations')}
                                className="p-1 hover:bg-blush-200/20 rounded-lg transition"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-base font-bold">#{conversation.numeroSuivi || conversation._id.slice(-8)}</h1>
                                <p className="text-xs text-blush-300 flex items-center gap-2">
                                    <span>{conversation.userId?.name || 'Client'}</span>
                                    <span>·</span>
                                    <span className={status.className.replace('bg-', 'text-').replace('text-', 'bg-').replace('text-', 'text-')}>
                                        {status.label}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isAdmin && (
                                <button
                                    onClick={() => setShowAssignModal(true)}
                                    className="text-xs bg-blush-200/20 px-3 py-1 rounded-full hover:bg-blush-200/30 transition"
                                >
                                    {conversation.agentAssigneld ? 'Changer' : 'Assigner'}
                                </button>
                            )}
                            {conversation.agentAssigneld && (
                                <span className="text-xs bg-blush-200/20 px-2 py-0.5 rounded-full">
                                    {conversation.agentAssigneld.nom}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-4 overflow-y-auto">
                <div className="space-y-3">
                    {messages.map((msg) => {
                        const isMoi = msg.agentStaffId?._id === moi?._id;
                        return (
                            <div
                                key={msg._id}
                                className={`flex ${isMoi ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[70%] rounded-xl px-4 py-2 ${
                                        isMoi
                                            ? 'bg-burgundy-600 text-ivory-200'
                                            : 'bg-white border border-blush-300 text-gray-800'
                                    }`}
                                >
                                    <p className="text-xs text-gray-400 mb-0.5">
                                        {msg.agentStaffId?.nom || msg.expediteurId || 'Inconnu'}
                                    </p>
                                    <p className="text-sm whitespace-pre-wrap">{msg.texte}</p>
                                    {msg.type === 'devis' && msg.payload?.montant && (
                                        <div className="mt-1 text-xs font-bold text-amber-500">
                                            💰 {msg.payload.montant.toLocaleString()} FCFA
                                        </div>
                                    )}
                                    <p className="text-xs opacity-50 mt-1">
                                        {new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Actions rapides */}
            <div className="max-w-4xl mx-auto w-full px-4 pb-2">
                <div className="flex flex-wrap gap-2">
                    {isAdmin && (
                        <button
                            onClick={() => setShowDevisModal(true)}
                            className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full hover:bg-amber-200 transition"
                        >
                            <FileText size={14} /> Devis
                        </button>
                    )}
                    {conversation.statut === 'devis_envoye' && (
                        <button
                            onClick={() => handleUpdateStatut('acompte_paye')}
                            className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full hover:bg-green-200 transition"
                        >
                            <CheckCircle size={14} /> Acompte payé
                        </button>
                    )}
                    {conversation.statut === 'en_entrepot' && (
                        <button
                            onClick={() => handleUpdateStatut('pese')}
                            className="flex items-center gap-1 text-xs bg-cyan-100 text-cyan-700 px-3 py-1.5 rounded-full hover:bg-cyan-200 transition"
                        >
                            <Truck size={14} /> Peser
                        </button>
                    )}
                    {conversation.statut === 'pese' && (
                        <button
                            onClick={() => handleUpdateStatut('en_livraison')}
                            className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-200 transition"
                        >
                            <Truck size={14} /> En livraison
                        </button>
                    )}
                    {conversation.statut === 'en_livraison' && (
                        <button
                            onClick={() => handleUpdateStatut('livre')}
                            className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full hover:bg-emerald-200 transition"
                        >
                            <CheckCircle size={14} /> Livrer
                        </button>
                    )}
                </div>
            </div>

            {/* Input */}
            <div className="max-w-4xl mx-auto w-full px-4 pb-4 sticky bottom-0 bg-ivory-200 pt-2">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Écrivez un message..."
                        className="flex-1 px-4 py-2.5 rounded-xl border border-blush-300 focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500 outline-none text-sm bg-white"
                    />
                    <button
                        type="submit"
                        disabled={sending || !newMessage.trim()}
                        className="bg-burgundy-600 text-ivory-200 p-2.5 rounded-xl hover:bg-burgundy-700 transition disabled:opacity-50"
                    >
                        {sending ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <Send size={20} />
                        )}
                    </button>
                </form>
            </div>

            {/* Modal Devis */}
            {showDevisModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-800">📄 Envoyer un devis</h3>
                            <button onClick={() => setShowDevisModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA)</label>
                            <input
                                type="number"
                                min="0"
                                step="100"
                                value={devisMontant}
                                onChange={(e) => setDevisMontant(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-lg border border-blush-300 focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500 outline-none text-sm"
                                placeholder="Ex: 25000"
                            />
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => setShowDevisModal(false)}
                                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleSendDevis}
                                disabled={sending}
                                className="flex-1 py-2.5 bg-burgundy-600 text-ivory-200 rounded-lg font-medium hover:bg-burgundy-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {sending ? <Loader2 size={18} className="animate-spin" /> : 'Envoyer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Assignation */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-800">👤 Assigner un assistant</h3>
                            <button onClick={() => setShowAssignModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {assistants.length === 0 ? (
                                <p className="text-sm text-gray-500">Aucun assistant disponible</p>
                            ) : (
                                assistants.map((assistant) => (
                                    <button
                                        key={assistant._id}
                                        onClick={() => handleAssigner(assistant._id)}
                                        className="w-full text-left px-4 py-3 rounded-lg border border-blush-300 hover:bg-blush-100 transition flex items-center justify-between"
                                    >
                                        <div>
                                            <p className="font-medium text-gray-800">{assistant.nom}</p>
                                            <p className="text-xs text-gray-500">{assistant.email}</p>
                                        </div>
                                        <span className="text-xs text-gray-400">
                                            {assistant.conversationsEnCours} en cours
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatDetail;