import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
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

    const [colis, setColis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [texte, setTexte] = useState("");
    const [envoi, setEnvoi] = useState(false);
    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);

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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const envoyerMessage = async (e) => {
        e.preventDefault();
        if (!texte.trim() || envoi) return;
        setEnvoi(true);
        try {
            const { data } = await axios.post(`/api/shein-cart/${id}/messages`, { texte: texte.trim() });
            if (data.success) {
                setMessages((prev) => [...prev, data.message]);
                setTexte("");
            } else {
                toast.error(data.message || "Envoi impossible");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur d'envoi");
        } finally {
            setEnvoi(false);
        }
    };

    if (loading) return <div className="csd-loading">Chargement…</div>;
    if (!colis) return <div className="csd-loading">Colis introuvable</div>;

    const etapeActuelle = STATUT_ORDER.indexOf(colis.statut);
    const chatFerme = colis.statut === "livre" || colis.statut === "annule";

    return (
        <div className="csd-page">
            <div className="csd-header">
                <p className="csd-numero">{colis.numeroSuivi}</p>
                <h1 className="csd-statut">{STATUT_LABELS[colis.statut] || colis.statut}</h1>
            </div>

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

            <div className="csd-card csd-chat-card">
                <p className="csd-card-title">Discuter de ce colis</p>
                <div className="csd-messages">
                    {messages.length === 0 && (
                        <p className="csd-chat-empty">Aucun message pour l'instant — pose ta question à l'agent ici.</p>
                    )}
                    {messages.map((m) => (
                        <div key={m._id} className={`csd-msg ${m.expediteurRole === "client" ? "csd-msg-client" : "csd-msg-agent"}`}>
                            <p>{m.texte}</p>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                {chatFerme ? (
                    <div className="csd-chat-closed">
                        {colis.statut === "livre" ? "Colis livré — conversation clôturée" : "Colis annulé — conversation clôturée"}
                    </div>
                ) : (
                    <form className="csd-chat-form" onSubmit={envoyerMessage}>
                        <input
                            type="text"
                            placeholder="Écris un message…"
                            value={texte}
                            onChange={(e) => setTexte(e.target.value)}
                            maxLength={2000}
                        />
                        <button type="submit" disabled={!texte.trim() || envoi}>Envoyer</button>
                    </form>
                )}
            </div>

            <style>{`
        .csd-page { max-width: 480px; margin: 0 auto; padding-bottom: 40px; font-family: 'DM Sans', sans-serif; }
        .csd-loading { text-align: center; padding: 60px 20px; color: #999; font-size: 14px; }
        .csd-header { margin: 16px 0 14px; }
        .csd-numero { font-size: 12px; color: #999; margin: 0 0 4px; }
        .csd-statut { font-size: 17px; font-weight: 700; color: #111; margin: 0; }
        .csd-progress { display: flex; gap: 4px; margin-bottom: 16px; }
        .csd-dot { flex: 1; height: 4px; border-radius: 2px; background: #f0ede8; }
        .csd-dot.done { background: #e53935; }
        .csd-card { background: #fff; border: 1px solid #f0ede8; border-radius: 14px; padding: 14px; margin-bottom: 12px; }
        .csd-card-title { font-size: 12px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: .5px; margin: 0 0 10px; }
        .csd-article { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #faf8f5; }
        .csd-article:last-of-type { border-bottom: none; }
        .csd-article-nom { font-size: 13.5px; font-weight: 500; color: #111; margin: 0; }
        .csd-article-variante { font-size: 12px; color: #999; margin: 2px 0 0; }
        .csd-article-prix { font-size: 13.5px; font-weight: 600; color: #111; white-space: nowrap; }
        .csd-total-row { display: flex; justify-content: space-between; padding-top: 10px; margin-top: 6px; border-top: 1px solid #f0ede8; font-size: 14px; color: #111; }
        .csd-fcfa { color: #e53935; font-size: 13px; border-top: none; padding-top: 0; margin-top: 2px; }
        .csd-chat-card { padding-bottom: 10px; }
        .csd-messages { display: flex; flex-direction: column; gap: 8px; max-height: 340px; overflow-y: auto; padding: 4px 2px; }
        .csd-chat-empty { font-size: 12.5px; color: #bbb; text-align: center; padding: 20px 0; }
        .csd-msg { max-width: 80%; padding: 8px 12px; border-radius: 14px; font-size: 13.5px; line-height: 1.4; }
        .csd-msg p { margin: 0; }
        .csd-msg-client { align-self: flex-end; background: #111; color: #fff; border-bottom-right-radius: 4px; }
        .csd-msg-agent { align-self: flex-start; background: #f7f5f2; color: #222; border-bottom-left-radius: 4px; }
        .csd-chat-form { display: flex; gap: 8px; margin-top: 10px; }
        .csd-chat-form input { flex: 1; border: 1px solid #e5e0d8; border-radius: 40px; padding: 10px 14px; font-size: 13px; outline: none; }
        .csd-chat-form input:focus { border-color: #e53935; }
        .csd-chat-form button { background: #111; color: #fff; border: none; border-radius: 40px; padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .csd-chat-form button:disabled { opacity: .4; cursor: default; }
        .csd-chat-closed { text-align: center; font-size: 12.5px; color: #999; background: #f7f5f2; border-radius: 40px; padding: 10px 14px; margin-top: 10px; }
      `}</style>
        </div>
    );
};

export default ColisSheinDetail;