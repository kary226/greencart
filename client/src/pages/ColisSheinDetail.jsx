import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";

const money = (n, devise) => {
    const symbole = devise === "EUR" ? "€" : "$";
    return `${symbole}${Number(n || 0).toFixed(2)}`;
};

const STATUT_LABELS = {
    soumis: "En attente de vérification par un agent",
    en_verification: "En cours de vérification",
    devis_envoye: "Devis validé — acompte à régler",
    acompte_paye: "Acompte reçu — commande en cours",
    achete: "Article(s) acheté(s) chez SHEIN",
    en_entrepot: "Arrivé en entrepôt — en attente de pesée",
    pese: "Pesé — solde à régler",
    solde_du: "Solde à régler",
    solde_paye: "Solde réglé — préparation livraison",
    en_livraison: "En cours de livraison",
    livre: "Livré",
    annule: "Annulé",
};

const STATUT_ORDER = [
    "soumis", "en_verification", "devis_envoye", "acompte_paye",
    "achete", "en_entrepot", "pese", "solde_du", "solde_paye", "en_livraison", "livre",
];

const ColisSheinDetail = () => {
    const { id } = useParams();
    const { axios, user } = useAppContext();
    const [searchParams, setSearchParams] = useSearchParams();
    const [payingAcompte, setPayingAcompte] = useState(false);
    const [payingSolde, setPayingSolde] = useState(false);

    const [colis, setColis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [texte, setTexte] = useState("");
    const [envoi, setEnvoi] = useState(false);
    const [infosOuvertes, setInfosOuvertes] = useState(false);
    const [imageChoisie, setImageChoisie] = useState(null);

    const messagesContainerRef = useRef(null);
    const pollRef = useRef(null);
    const premierChargement = useRef(true);
    const fileInputRef = useRef(null);

    const fetchColis = async () => {
        try {
            const { data } = await axios.get(`/api/shein-cart/${id}`);
            if (data.success) setColis(data.colis);
        } catch (error) {
            toast.error("Impossible de charger ce colis");
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async () => {
        try {
            const { data } = await axios.get(`/api/shein-cart/${id}/messages`);
            if (data.success) setMessages(data.messages);
        } catch (error) {
            // silencieux — le polling réessaiera au prochain cycle
        }
    };

    useEffect(() => {
        if (!user) return;
        fetchColis();
        fetchMessages();
        pollRef.current = setInterval(fetchMessages, 5000);
        return () => clearInterval(pollRef.current);
    }, [id, user]);

    useEffect(() => {
        if (colis && (colis.statut === "livre" || colis.statut === "annule") && pollRef.current) {
            clearInterval(pollRef.current);
        }
    }, [colis?.statut]);

    // Scroll confiné au conteneur de messages uniquement — jamais à la fenêtre entière.
    // C'est ce qui causait le défilement automatique de toute la page : scrollIntoView()
    // remonte le DOM et peut faire bouger la fenêtre ; scrollTop sur le conteneur ne bouge que lui.
    useEffect(() => {
        const el = messagesContainerRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        premierChargement.current = false;
    }, [messages]);

    const choisirImage = (e) => {
        const file = e.target.files?.[0];
        if (file) setImageChoisie(file);
    };

    const envoyerMessage = async (e) => {
        e.preventDefault();
        if ((!texte.trim() && !imageChoisie) || envoi) return;
        setEnvoi(true);
        try {
            const formData = new FormData();
            if (texte.trim()) formData.append("texte", texte.trim());
            if (imageChoisie) formData.append("image", imageChoisie);

            const { data } = await axios.post(`/api/shein-cart/${id}/messages`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            if (data.success) {
                setMessages((prev) => [...prev, data.message]);
                setTexte("");
                setImageChoisie(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
            } else {
                toast.error(data.message || "Envoi impossible");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur d'envoi");
        } finally {
            setEnvoi(false);
        }
    };

    useEffect(() => {
        const paiement = searchParams.get("paiement");
        if (paiement === "succes") {
            toast.success("Paiement confirmé");
            fetchColis();
            setSearchParams({}, { replace: true });
        } else if (paiement === "erreur") {
            toast.error("Le paiement n'a pas abouti — réessaie");
            setSearchParams({}, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const payerAcompte = async () => {
        setPayingAcompte(true);
        try {
            const { data } = await axios.post(`/api/shein-cart/${id}/pay-acompte`);
            if (data.success) {
                window.location.href = data.checkout_url;
            } else {
                toast.error(data.message || "Paiement impossible");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur de paiement");
        } finally {
            setPayingAcompte(false);
        }
    };

    const payerSolde = async () => {
        setPayingSolde(true);
        try {
            const { data } = await axios.post(`/api/shein-cart/${id}/pay-solde`);
            if (data.success) {
                window.location.href = data.checkout_url;
            } else {
                toast.error(data.message || "Paiement impossible");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur de paiement");
        } finally {
            setPayingSolde(false);
        }
    };

    if (loading) return <div className="csd-loading">Chargement…</div>;
    if (!colis) return <div className="csd-loading">Colis introuvable</div>;

    const etapeActuelle = STATUT_ORDER.indexOf(colis.statut);
    const chatFerme = colis.statut === "livre" || colis.statut === "annule";

    return (
        <div className="csd-page">
            {/* En-tête compact, toujours visible */}
            <div className="csd-header">
                <div>
                    <p className="csd-numero">{colis.numeroSuivi}</p>
                    <h1 className="csd-statut">{STATUT_LABELS[colis.statut] || colis.statut}</h1>
                </div>
                <button className={`csd-toggle ${infosOuvertes ? "open" : ""}`} onClick={() => setInfosOuvertes((v) => !v)} aria-label="Détails du colis">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
            </div>

            {colis.statut === "devis_envoye" && !colis.paiement?.acomptePaye && colis.devis?.montantInitial > 0 && (
                <button className="csd-pay-btn" onClick={payerAcompte} disabled={payingAcompte}>
                    {payingAcompte ? "Redirection…" : `Payer les articles — ${Math.round(colis.devis.montantInitial).toLocaleString("fr-FR")} FCFA`}
                </button>
            )}
            {(colis.statut === "pese" || colis.statut === "solde_du") && !colis.paiement?.soldePaye && colis.paiement?.soldeMontant > 0 && (
                <button className="csd-pay-btn" onClick={payerSolde} disabled={payingSolde}>
                    {payingSolde ? "Redirection…" : `Payer la livraison — ${Math.round(colis.paiement.soldeMontant).toLocaleString("fr-FR")} FCFA`}
                </button>
            )}

            {/* Panneau repliable — progression + articles, fermé par défaut pour laisser la place au chat */}
            <div className={`csd-infos ${infosOuvertes ? "open" : ""}`}>
                {colis.statut !== "annule" && (
                    <div className="csd-progress">
                        {STATUT_ORDER.map((s, i) => (
                            <div key={s} className={`csd-dot ${i <= etapeActuelle ? "done" : ""}`} />
                        ))}
                    </div>
                )}

                <div className="csd-card">
                    <p className="csd-card-title">Articles</p>
                    {colis.articlesValides.map((a, i) => (
                        <div key={i} className="csd-article">
                            <div>
                                <p className="csd-article-nom">{a.nom}</p>
                                <p className="csd-article-variante">{a.variante} · x{a.quantite}</p>
                            </div>
                            <span className="csd-article-prix">{money(a.prixUnitaire * a.quantite, colis.devise)}</span>
                        </div>
                    ))}
                    <div className="csd-total-row">
                        <span>Total articles</span>
                        <strong>{money(colis.devis?.montantArticles, colis.devise)}</strong>
                    </div>
                    {colis.devis?.montantArticlesFCFA != null && (
                        <div className="csd-total-row csd-fcfa">
                            <span>Équivalent</span>
                            <strong>{Math.round(colis.devis.montantArticlesFCFA).toLocaleString("fr-FR")} FCFA</strong>
                        </div>
                    )}
                </div>
            </div>

            {/* Zone de chat — occupe l'espace principal de l'écran */}
            <div className="csd-chat-zone">
                <div className="csd-messages" ref={messagesContainerRef}>
                    {messages.length === 0 && (
                        <p className="csd-chat-empty">Aucun message pour l'instant — pose ta question à l'agent ici.</p>
                    )}
                    {messages.map((m) => {
                        if (m.type === "systeme") {
                            return <div key={m._id} className="csd-badge-systeme">{m.texte}</div>;
                        }
                        if (m.type === "devis") {
                            const dejaPayee = m.payload?.paymentType === "shein_acompte" ? colis.paiement?.acomptePaye : colis.paiement?.soldePaye;
                            return (
                                <div key={m._id} className="csd-devis-card">
                                    <p className="csd-devis-libelle">{m.payload?.libelle}</p>
                                    <p className="csd-devis-montant">{Math.round(m.payload?.montant || 0).toLocaleString("fr-FR")} FCFA</p>
                                    {m.payload?.detail && <p className="csd-devis-detail">{m.payload.detail}</p>}
                                    {dejaPayee ? (
                                        <span className="csd-devis-paye">✓ Payé</span>
                                    ) : (
                                        <button onClick={m.payload?.paymentType === "shein_acompte" ? payerAcompte : payerSolde} disabled={payingAcompte || payingSolde}>
                                            Payer maintenant
                                        </button>
                                    )}
                                    <span className="csd-msg-heure">{new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                            );
                        }
                        return (
                            <div key={m._id} className={`csd-msg ${m.expediteurRole === "client" ? "csd-msg-client" : "csd-msg-agent"}`}>
                                {m.imageUrl && <img src={m.imageUrl} alt="" className="csd-msg-img" onClick={() => window.open(m.imageUrl, "_blank")} />}
                                {m.texte && <p>{m.texte}</p>}
                                <span className="csd-msg-heure">
                                    {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {chatFerme ? (
                    <div className="csd-chat-closed">
                        {colis.statut === "livre" ? "Colis livré — conversation clôturée" : "Colis annulé — conversation clôturée"}
                    </div>
                ) : (
                    <form className="csd-chat-form" onSubmit={envoyerMessage}>
                        {imageChoisie && (
                            <div className="csd-preview">
                                <img src={URL.createObjectURL(imageChoisie)} alt="" />
                                <button type="button" onClick={() => { setImageChoisie(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>✕</button>
                            </div>
                        )}
                        <div className="csd-chat-row">
                            <label className="csd-attach-btn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                </svg>
                                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={choisirImage} />
                            </label>
                            <input
                                type="text"
                                placeholder="Écris un message…"
                                value={texte}
                                onChange={(e) => setTexte(e.target.value)}
                                maxLength={2000}
                            />
                            <button type="submit" disabled={(!texte.trim() && !imageChoisie) || envoi} className="csd-send-btn" aria-label="Envoyer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
                                </svg>
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <style>{`
        .csd-page { max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; height: calc(100vh - 140px); font-family: 'DM Sans', sans-serif; }
        .csd-loading { text-align: center; padding: 60px 20px; color: #999; font-size: 14px; }
        .csd-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 0 10px; }
        .csd-numero { font-size: 11.5px; color: #999; margin: 0 0 2px; }
        .csd-statut { font-size: 15px; font-weight: 700; color: #111; margin: 0; }
        .csd-toggle { background: #f7f5f2; border: none; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; color: #555; cursor: pointer; transition: transform .2s; flex-shrink: 0; }
        .csd-toggle.open { transform: rotate(180deg); }
        .csd-pay-btn { width: 100%; background: #e53935; color: #fff; border: none; border-radius: 40px; padding: 12px 16px; font-size: 13.5px; font-weight: 600; cursor: pointer; margin-bottom: 10px; }
        .csd-pay-btn:disabled { opacity: .6; cursor: default; }
        .csd-infos { max-height: 0; overflow: hidden; transition: max-height .25s ease; }
        .csd-infos.open { max-height: 600px; overflow-y: auto; }
        .csd-progress { display: flex; gap: 4px; margin-bottom: 12px; }
        .csd-dot { flex: 1; height: 4px; border-radius: 2px; background: #f0ede8; }
        .csd-dot.done { background: #e53935; }
        .csd-card { background: #fff; border: 1px solid #f0ede8; border-radius: 14px; padding: 14px; margin-bottom: 10px; }
        .csd-card-title { font-size: 12px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: .5px; margin: 0 0 10px; }
        .csd-article { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #faf8f5; }
        .csd-article:last-of-type { border-bottom: none; }
        .csd-article-nom { font-size: 13.5px; font-weight: 500; color: #111; margin: 0; }
        .csd-article-variante { font-size: 12px; color: #999; margin: 2px 0 0; }
        .csd-article-prix { font-size: 13.5px; font-weight: 600; color: #111; white-space: nowrap; }
        .csd-total-row { display: flex; justify-content: space-between; padding-top: 10px; margin-top: 6px; border-top: 1px solid #f0ede8; font-size: 14px; color: #111; }
        .csd-fcfa { color: #e53935; font-size: 13px; border-top: none; padding-top: 0; margin-top: 2px; }

        .csd-chat-zone { flex: 1; display: flex; flex-direction: column; min-height: 0; background: #fff; border: 1px solid #f0ede8; border-radius: 16px; margin-top: 8px; overflow: hidden; }
        .csd-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
        .csd-chat-empty { font-size: 12.5px; color: #bbb; text-align: center; padding: 30px 0; margin: auto; }
        .csd-msg { max-width: 78%; padding: 8px 12px; border-radius: 16px; font-size: 13.5px; line-height: 1.4; position: relative; }
        .csd-msg p { margin: 0; }
        .csd-msg-heure { display: block; font-size: 10px; opacity: .55; margin-top: 3px; text-align: right; }
        .csd-msg-img { width: 160px; border-radius: 10px; display: block; margin-bottom: 4px; cursor: pointer; }
        .csd-msg-client { align-self: flex-end; background: #111; color: #fff; border-radius: 16px 16px 3px 16px; }
        .csd-msg-agent { align-self: flex-start; background: #f7f5f2; color: #222; border-radius: 16px 16px 16px 3px; }

        .csd-badge-systeme { align-self: center; background: #f0ede8; color: #888; font-size: 11px; padding: 5px 12px; border-radius: 20px; margin: 4px 0; }

        .csd-devis-card { align-self: center; width: 90%; background: #fff; border: 1.5px solid #e53935; border-radius: 14px; padding: 14px; text-align: center; margin: 6px 0; }
        .csd-devis-libelle { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: .5px; margin: 0 0 4px; }
        .csd-devis-montant { font-size: 20px; font-weight: 700; color: #111; margin: 0 0 10px; }
        .csd-devis-detail { font-size: 11px; color: #999; margin: -6px 0 10px; }
        .csd-devis-card button { background: #e53935; color: #fff; border: none; border-radius: 30px; padding: 9px 20px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .csd-devis-card button:disabled { opacity: .5; cursor: default; }
        .csd-devis-paye { display: inline-block; background: #e8f5e9; color: #2e7d32; font-size: 12px; font-weight: 600; padding: 6px 16px; border-radius: 20px; }
        .csd-devis-card .csd-msg-heure { display: block; margin-top: 8px; text-align: center; }

        .csd-chat-form { border-top: 1px solid #f0ede8; padding: 10px 12px; padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
        .csd-chat-row { display: flex; align-items: center; gap: 8px; }
        .csd-attach-btn { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; background: #f7f5f2; cursor: pointer; flex-shrink: 0; }
        .csd-chat-row input[type="text"] { flex: 1; border: 1px solid #e5e0d8; border-radius: 40px; padding: 10px 14px; font-size: 13px; outline: none; }
        .csd-chat-row input[type="text"]:focus { border-color: #e53935; }
        .csd-send-btn { background: #111; color: #fff; border: none; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .csd-send-btn:disabled { opacity: .4; cursor: default; }
        .csd-preview { position: relative; width: 60px; margin-bottom: 8px; }
        .csd-preview img { width: 60px; height: 60px; object-fit: cover; border-radius: 10px; }
        .csd-preview button { position: absolute; top: -6px; right: -6px; background: #111; color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer; }
        .csd-chat-closed { text-align: center; font-size: 12.5px; color: #999; background: #f7f5f2; border-radius: 40px; padding: 10px 14px; margin: 10px 12px; }
      `}</style>
        </div>
    );
};

export default ColisSheinDetail;