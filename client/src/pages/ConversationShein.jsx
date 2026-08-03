import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

// Réutilise vos fonctions helpers depuis votre page principale
const fcfa = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

const IconRetour = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
);
const IconMenu = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
    </svg>
);
const IconPapillon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2c-3 0-5 2-5 5s2 5 5 5 5-2 5-5-2-5-5-5z" />
        <path d="M12 12v10M8 16l4 2 4-2" />
    </svg>
);
const IconCheckVerif = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);
const IconDevis = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </svg>
);

const ConversationShein = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { axios, user } = useAppContext();
    const [colis, setColis] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [nouveauMsg, setNouveauMsg] = useState("");
    const finMessagesRef = useRef(null);

    // Chargement des données
    useEffect(() => {
        if (!user) return;
        setLoading(true);
        Promise.all([
            axios.get(`/api/shein-cart/${id}`),
            axios.get(`/api/message-colis/${id}`) // Assurez-vous que cette route existe
        ])
        .then(([resColis, resMsg]) => {
            if (resColis.data.success) setColis(resColis.data.colis);
            if (resMsg.data.success) setMessages(resMsg.data.messages || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [id, user]);

    // Scroll automatique vers le bas au chargement des messages
    useEffect(() => {
        finMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const envoyerMessage = (e) => {
        e.preventDefault();
        if (!nouveauMsg.trim()) return;
        const messageEnvoye = nouveauMsg.trim();
        
        // Optimistic UI : on ajoute le message immédiatement
        setMessages(prev => [...prev, { 
            contenu: messageEnvoye, 
            estAgent: false, 
            createdAt: new Date().toISOString() 
        }]);
        setNouveauMsg("");

        // Appel API
        axios.post(`/api/message-colis/${id}`, { contenu: messageEnvoye })
            .catch(() => {
                // En cas d'erreur, retirer le message
                setMessages(prev => prev.slice(0, -1));
                setNouveauMsg(messageEnvoye);
            });
    };

    if (loading || !colis) {
        return <div className="mcs-loading">Chargement de la conversation...</div>;
    }

    const totalFCFA = colis.devis?.totalFCFA || 0;
    const sousTotal = colis.devis?.montantArticlesFCFA || 0;
    const fraisLivraison = colis.devis?.fraisLivraison || 0;
    const afficherDevis = colis.statut === "devis_envoye" || colis.statut === "acompte_paye" || colis.statut === "achete";

    return (
        <div className="mcs-chat-page">
            {/* 1. Header */}
            <div className="mcs-chat-header">
                <button className="mcs-chat-back" onClick={() => navigate("/colis-shein")}><IconRetour /></button>
                <div className="mcs-chat-title">
                    <div className="mcs-chat-numero">{colis.numeroSuivi || "Commande"}</div>
                    <div className="mcs-chat-statut">
                        <span className={`mcs-pill ${STATUT_STYLE[colis.statut] || "mcs-pill-attente"}`}>
                            <span className="mcs-pill-dot" /> {STATUT_LABELS[colis.statut] || colis.statut}
                        </span>
                    </div>
                </div>
                <button className="mcs-chat-menu"><IconMenu /></button>
            </div>

            {/* 2. Zone des messages (avec scroll) */}
            <div className="mcs-chat-messages">
                
                {/* Devis (Ecran 3) - Apparaît en haut si le statut le permet */}
                {afficherDevis && (
                    <div className="mcs-devis-container">
                        <div className="mcs-devis-date">20 Mai 2025</div>
                        <div className="mcs-devis-card">
                            <div className="mcs-devis-header">
                                <IconDevis /> 
                                <span className="mcs-devis-title">DEVIS REÇU</span>
                            </div>
                            <div className="mcs-devis-line">
                                <span>Sous-total produits</span>
                                <span className="mcs-devis-value">{fcfa(sousTotal)}</span>
                            </div>
                            <div className="mcs-devis-line">
                                <span>Frais de livraison</span>
                                <span className="mcs-devis-value">{fcfa(fraisLivraison)}</span>
                            </div>
                            <div className="mcs-devis-total">
                                <span>TOTAL</span>
                                <span className="mcs-devis-total-value">{fcfa(totalFCFA)}</span>
                            </div>
                            <Link to={`/colis-shein/${id}/details`} className="mcs-devis-btn">
                                Voir le devis
                            </Link>
                            <div className="mcs-devis-footer-msg">
                                Veuillez confirmer ce devis pour que nous puissions procéder à l'achat.
                            </div>
                        </div>
                    </div>
                )}

                {/* Messages */}
                <div className="mcs-messages-list">
                    {messages.map((msg, index) => (
                        <div key={index} className={`mcs-msg-row ${msg.estAgent ? 'agent' : 'client'}`}>
                            {msg.estAgent && (
                                <div className="mcs-msg-agent-container">
                                    <div className="mcs-msg-agent-circle">A</div>
                                    <div className="mcs-msg-content">{msg.contenu}</div>
                                </div>
                            )}
                            {!msg.estAgent && (
                                <div className="mcs-msg-client-container">
                                    <div className="mcs-msg-content">{msg.contenu}</div>
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={finMessagesRef} />
                </div>
            </div>

            {/* 3. Barre de saisie (Pied de page) */}
            <div className="mcs-chat-footer">
                <button className="mcs-chat-add-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>
                <form className="mcs-chat-form" onSubmit={envoyerMessage}>
                    <input 
                        type="text" 
                        placeholder="Écrire un message..." 
                        value={nouveauMsg}
                        onChange={(e) => setNouveauMsg(e.target.value)}
                    />
                    <button type="submit" className="mcs-chat-send" disabled={!nouveauMsg.trim()}>
                        <IconPapillon />
                    </button>
                </form>
            </div>

            <style>{`
                /* --- PAGE CHAT --- */
                .mcs-chat-page { 
                    max-width: 480px; 
                    margin: 0 auto; 
                    font-family: 'DM Sans', sans-serif; 
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    background: #fff;
                    position: relative;
                }

                /* --- HEADER --- */
                .mcs-chat-header {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 16px; background: #fff; border-bottom: 1px solid #f0ede8;
                    flex-shrink: 0; position: sticky; top: 0; z-index: 10;
                }
                .mcs-chat-back { background: none; border: none; cursor: pointer; padding: 4px; }
                .mcs-chat-title { text-align: center; flex: 1; }
                .mcs-chat-numero { font-size: 14px; font-weight: 700; color: #111; }
                .mcs-chat-statut { display: flex; justify-content: center; margin-top: 4px; }
                .mcs-chat-menu { background: none; border: none; cursor: pointer; padding: 4px; }

                /* --- ZONE MESSAGES --- */
                .mcs-chat-messages {
                    flex: 1; overflow-y: auto; padding: 12px 16px 100px; display: flex; flex-direction: column; gap: 12px;
                }

                /* --- DEVIS CARD (ECRAN 3) --- */
                .mcs-devis-container { display: flex; flex-direction: column; align-items: center; margin-bottom: 10px; }
                .mcs-devis-date { font-size: 11px; color: #bbb; margin-bottom: 8px; }
                .mcs-devis-card {
                    background: #fdf6f5; border: 1px solid #f5e8e6; border-radius: 16px;
                    padding: 20px; width: 100%; max-width: 380px; box-sizing: border-box;
                }
                .mcs-devis-header { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 14px; }
                .mcs-devis-title { font-size: 13px; font-weight: 700; color: #e53935; letter-spacing: 1px; }
                .mcs-devis-line { display: flex; justify-content: space-between; font-size: 13px; color: #555; margin-bottom: 8px; }
                .mcs-devis-value { color: #333; font-weight: 600; }
                .mcs-devis-total { display: flex; justify-content: space-between; border-top: 1px solid #f0ede8; padding-top: 12px; margin-top: 8px; font-weight: 700; font-size: 15px; }
                .mcs-devis-total-value { color: #e53935; }
                .mcs-devis-btn {
                    display: block; text-align: center; background: #8a1c1c; color: #fff; text-decoration: none;
                    padding: 12px; border-radius: 10px; font-weight: 700; font-size: 14px; margin: 16px 0 12px;
                }
                .mcs-devis-footer-msg { font-size: 12px; color: #999; text-align: center; }

                /* --- BULLES DE MESSAGES --- */
                .mcs-messages-list { display: flex; flex-direction: column; gap: 16px; }
                .mcs-msg-row { display: flex; width: 100%; }
                .mcs-msg-row.agent { justify-content: flex-start; }
                .mcs-msg-row.client { justify-content: flex-end; }
                
                .mcs-msg-agent-container { display: flex; align-items: flex-end; gap: 8px; max-width: 85%; }
                .mcs-msg-agent-circle { width: 28px; height: 28px; border-radius: 50%; background: #f0ede8; color: #888; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-bottom: 4px; }
                
                .mcs-msg-content {
                    background: #f7f5f2; color: #111; padding: 12px 16px; border-radius: 16px;
                    font-size: 14px; line-height: 1.4; word-wrap: break-word; position: relative;
                }
                .mcs-msg-row.agent .mcs-msg-content { border-bottom-left-radius: 4px; }
                .mcs-msg-row.client .mcs-msg-content { background: #fdf1f0; color: #111; border-bottom-right-radius: 4px; }

                /* --- FOOTER SAISIE --- */
                .mcs-chat-footer {
                    position: absolute; bottom: 0; left: 0; right: 0;
                    background: #fff; padding: 8px 16px 16px; border-top: 1px solid #f0ede8;
                    display: flex; gap: 12px; align-items: center;
                }
                .mcs-chat-add-btn {
                    width: 38px; height: 38px; border-radius: 50%; border: 1px solid #f0ede8;
                    background: #f7f5f2; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
                }
                .mcs-chat-form {
                    flex: 1; display: flex; align-items: center; gap: 10px; background: #f7f5f2;
                    border-radius: 40px; padding: 4px 4px 4px 16px;
                }
                .mcs-chat-form input {
                    flex: 1; border: none; background: none; outline: none; font-size: 14px; font-family: inherit; color: #111;
                }
                .mcs-chat-send {
                    width: 38px; height: 38px; border-radius: 50%; border: none; background: #e53935;
                    display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: opacity .15s;
                }
                .mcs-chat-send:disabled { opacity: 0.4; cursor: default; }
                .mcs-chat-send:not(:disabled):active { transform: scale(0.9); }

                /* Réutiliser vos classes de statuts depuis MesColisShein */
                ${document.querySelector('style')?.innerHTML.includes('.mcs-pill-attente') ? '' : `
                    .mcs-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
                    .mcs-pill-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
                    .mcs-pill-attente { background: #fdf1f0; color: #c62828; }
                    .mcs-pill-devis { background: #fdecea; color: #e53935; }
                    .mcs-pill-paiement { background: #fff4e0; color: #b7791f; }
                    .mcs-pill-ok { background: #eef7f0; color: #2e7d32; }
                    .mcs-pill-livraison { background: #e8f5e9; color: #2e7d32; }
                    .mcs-pill-clos { background: #f0ede8; color: #888; }
                    .mcs-pill-annule { background: #f5eaea; color: #a33; }
                `}
            `}</style>
        </div>
    );
};

export default ConversationShein;