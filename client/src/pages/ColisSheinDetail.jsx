import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";

const money = (n, devise) => {
    const symbole = devise === "EUR" ? "€" : "$";
    return `${symbole}${Number(n || 0).toFixed(2)}`;
};

const fcfa = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

const dateCourte = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Horaires de service (Setting "sheinHoraires") — "HH:MM" en heure locale du navigateur.
// Si aucun horaire n'est configuré côté admin, le service est considéré ouvert en permanence.
const estDansHoraires = (horaires, maintenant) => {
    if (!horaires?.ouverture || !horaires?.fermeture) return true;
    const now = new Date(maintenant);
    const [hO, mO] = horaires.ouverture.split(":").map(Number);
    const [hF, mF] = horaires.fermeture.split(":").map(Number);
    const minutesMaintenant = now.getHours() * 60 + now.getMinutes();
    const minutesOuverture = hO * 60 + mO;
    const minutesFermeture = hF * 60 + mF;
    if (minutesFermeture > minutesOuverture) {
        return minutesMaintenant >= minutesOuverture && minutesMaintenant < minutesFermeture;
    }
    // Plage à cheval sur minuit (ex. 20:00 → 06:00)
    return minutesMaintenant >= minutesOuverture || minutesMaintenant < minutesFermeture;
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

// Fenêtre de validité de l'indicateur "en train d'écrire" — l'agent renvoie un
// signal toutes les ~2s pendant qu'il tape, on considère le badge expiré passé ce délai.
const TYPING_TTL_MS = 4000;
// Cadence de rafraîchissement du fil (messages + statut colis, dont le champ
// agentTypingAt) — plus rapide que l'ancien polling pour un rendu réactif.
const POLL_MS = 3000;
// Anti-spam de l'appel /typing pendant la frappe côté client.
const TYPING_SIGNAL_THROTTLE_MS = 2200;

const memeJour = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

const libelleJour = (date) => {
    const d = new Date(date);
    const hier = new Date();
    hier.setDate(hier.getDate() - 1);
    if (memeJour(d, new Date())) return "Aujourd'hui";
    if (memeJour(d, hier)) return "Hier";
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
};

const CocheSimple = () => (
    <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
        <path d="M1 5.5L5 9.5L15 0.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const CocheDouble = () => (
    <svg width="18" height="10" viewBox="0 0 20 11" fill="none">
        <path d="M1 5.5L5 9.5L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 5.5L10 9.5L19 0.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const Etoile = ({ remplie }) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={remplie ? "#f5a623" : "none"} stroke={remplie ? "#f5a623" : "#ccc"} strokeWidth="1.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
);

const ColisSheinDetail = () => {
    const { id } = useParams();
    const { axios, user } = useAppContext();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [payingAcompte, setPayingAcompte] = useState(false);
    const [payingSolde, setPayingSolde] = useState(false);
    const [horaires, setHoraires] = useState(null);

    const [colis, setColis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [texte, setTexte] = useState("");
    const [envoi, setEnvoi] = useState(false);
    const [infosOuvertes, setInfosOuvertes] = useState(false);
    const [imageChoisie, setImageChoisie] = useState(null);
    const [maintenant, setMaintenant] = useState(Date.now());
    const [avisEnCours, setAvisEnCours] = useState({}); // { [messageId]: { etoiles, commentaire } }
    const [envoiAvis, setEnvoiAvis] = useState(null); // messageId en cours d'envoi

    const messagesContainerRef = useRef(null);
    const pollRef = useRef(null);
    const tickRef = useRef(null);
    const premierChargement = useRef(true);
    const fileInputRef = useRef(null);
    const dernierSignalFrappe = useRef(0);

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
        axios.get("/api/setting/sheinHoraires")
            .then(({ data }) => { if (data.success && data.data) setHoraires(data.data); })
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!user) return;
        fetchColis();
        fetchMessages();
        // Un seul cycle de polling pour les deux : messages ET statut du colis
        // (ce dernier porte agentTypingAt, nécessaire à l'indicateur "en train d'écrire").
        pollRef.current = setInterval(() => {
            fetchMessages();
            fetchColis();
        }, POLL_MS);
        return () => clearInterval(pollRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, user]);

    // Horloge locale à 1s — permet à l'indicateur de frappe de disparaître de
    // lui-même entre deux cycles de polling, sans attendre le prochain fetch.
    useEffect(() => {
        tickRef.current = setInterval(() => setMaintenant(Date.now()), 1000);
        return () => clearInterval(tickRef.current);
    }, []);

    useEffect(() => {
        if (colis && (colis.statut === "livre" || colis.statut === "annule") && pollRef.current) {
            clearInterval(pollRef.current);
        }
    }, [colis?.statut]);

    const agentEnTrainDecrire =
        !!colis?.agentTypingAt && maintenant - new Date(colis.agentTypingAt).getTime() < TYPING_TTL_MS;

    // Scroll confiné au conteneur de messages uniquement — jamais à la fenêtre entière.
    // C'est ce qui causait le défilement automatique de toute la page : scrollIntoView()
    // remonte le DOM et peut faire bouger la fenêtre ; scrollTop sur le conteneur ne bouge que lui.
    useEffect(() => {
        const el = messagesContainerRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        premierChargement.current = false;
    }, [messages, agentEnTrainDecrire]);

    const choisirImage = (e) => {
        const file = e.target.files?.[0];
        if (file) setImageChoisie(file);
    };

    // Signale la frappe côté client, limité à un appel toutes les ~2.2s pour ne
    // pas spammer l'API à chaque frappe clavier.
    const signalerFrappe = () => {
        const t = Date.now();
        if (t - dernierSignalFrappe.current < TYPING_SIGNAL_THROTTLE_MS) return;
        dernierSignalFrappe.current = t;
        axios.post(`/api/shein-cart/${id}/typing`).catch(() => {});
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

    const choisirEtoiles = (messageId, etoiles) => {
        setAvisEnCours((prev) => ({ ...prev, [messageId]: { ...prev[messageId], etoiles } }));
    };

    const changerCommentaireAvis = (messageId, commentaire) => {
        setAvisEnCours((prev) => ({ ...prev, [messageId]: { ...prev[messageId], commentaire } }));
    };

    const envoyerAvis = async (messageId) => {
        const brouillon = avisEnCours[messageId];
        if (!brouillon?.etoiles) {
            toast.error("Choisis une note avant d'envoyer");
            return;
        }
        setEnvoiAvis(messageId);
        try {
            const { data } = await axios.post(`/api/shein-cart/${id}/avis`, {
                messageId,
                etoiles: brouillon.etoiles,
                commentaire: brouillon.commentaire || "",
            });
            if (data.success) {
                toast.success("Merci pour ton avis !");
                setMessages((prev) => prev.map((m) => (m._id === messageId
                    ? { ...m, payload: { ...m.payload, repondu: true, etoilesDonnees: brouillon.etoiles } }
                    : m)));
                fetchMessages();
            } else {
                toast.error(data.message || "Envoi impossible");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur d'envoi");
        } finally {
            setEnvoiAvis(null);
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
    const tauxApplique = colis.devis?.tauxApplique || null;
    const serviceOuvert = estDansHoraires(horaires, maintenant);

    return (
        <div className="csd-page">
            {/* En-tête compact, toujours visible */}
            <div className="csd-header">
                <button className="csd-back" onClick={() => navigate("/mes-colis-shein")} aria-label="Retour">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <div className="csd-header-titre">
                    <p className="csd-numero">{colis.numeroSuivi}</p>
                    <h1 className="csd-statut">{STATUT_LABELS[colis.statut] || colis.statut}</h1>
                </div>
                <button className={`csd-toggle ${infosOuvertes ? "open" : ""}`} onClick={() => setInfosOuvertes((v) => !v)} aria-label="Détails du colis">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
            </div>

            {!serviceOuvert && (
                <div className="csd-horaires-banner">
                    Service fermé{horaires?.ouverture ? ` — réouverture à ${horaires.ouverture}` : ""}. Tu peux quand même écrire, on te répondra à la réouverture.
                </div>
            )}

            {colis.estimationArrivee?.dateDebut && colis.estimationArrivee?.dateFin && !colis.estimationArrivee?.confirmee && (
                <div className="csd-arrivee-banner">
                    🚚 Arrivée estimée à Abidjan entre le <strong>{dateCourte(colis.estimationArrivee.dateDebut)}</strong> et le <strong>{dateCourte(colis.estimationArrivee.dateFin)}</strong>
                </div>
            )}

            {colis.statut === "en_livraison" && colis.livraison?.dateDebut && colis.livraison?.dateFin && (
                <div className="csd-livraison-banner">
                    📦 Livraison estimée entre le <strong>{dateCourte(colis.livraison.dateDebut)}</strong> et le <strong>{dateCourte(colis.livraison.dateFin)}</strong>
                </div>
            )}

            {colis.statut === "devis_envoye" && !colis.paiement?.acomptePaye && colis.devis?.montantInitial > 0 && (
                <button className="csd-pay-btn" onClick={payerAcompte} disabled={payingAcompte}>
                    {payingAcompte ? "Redirection…" : `Payer les articles — ${fcfa(colis.devis.montantInitial)}`}
                </button>
            )}
            {(colis.statut === "pese" || colis.statut === "solde_du") && !colis.paiement?.soldePaye && colis.paiement?.soldeMontant > 0 && (
                <button className="csd-pay-btn" onClick={payerSolde} disabled={payingSolde}>
                    {payingSolde ? "Redirection…" : `Payer la livraison — ${fcfa(colis.paiement.soldeMontant)}`}
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
                            <div className="csd-article-prix-bloc">
                                <span className="csd-article-prix">{money(a.prixUnitaire * a.quantite, colis.devise)}</span>
                                {tauxApplique && (
                                    <span className="csd-article-fcfa">≈ {fcfa(a.prixUnitaire * a.quantite * tauxApplique)}</span>
                                )}
                            </div>
                        </div>
                    ))}
                    <div className="csd-total-row">
                        <span>Total articles</span>
                        <strong>{money(colis.devis?.montantArticles, colis.devise)}</strong>
                    </div>
                    {colis.devis?.montantArticlesFCFA != null && (
                        <div className="csd-total-row csd-fcfa">
                            <span>Équivalent</span>
                            <strong>{fcfa(colis.devis.montantArticlesFCFA)}</strong>
                        </div>
                    )}
                </div>
            </div>

            {/* Zone de chat — occupe l'espace principal de l'écran */}
            <div className="csd-chat-zone">
                <div className="csd-messages" ref={messagesContainerRef}>
                    {messages.length === 0 && !agentEnTrainDecrire && (
                        <p className="csd-chat-empty">Aucun message pour l'instant — pose ta question à l'agent ici.</p>
                    )}
                    {messages.map((m, idx) => {
                        const precedent = messages[idx - 1];
                        const nouveauJour = !precedent || !memeJour(precedent.createdAt, m.createdAt);

                        if (m.type === "systeme") {
                            return (
                                <div key={m._id} className="csd-msg-wrap">
                                    {nouveauJour && <div className="csd-day-divider"><span>{libelleJour(m.createdAt)}</span></div>}
                                    <div className="csd-badge-systeme">{m.texte}</div>
                                </div>
                            );
                        }
                        if (m.type === "devis") {
                            if (m.payload?.superseded) {
                                return (
                                    <div key={m._id} className="csd-msg-wrap">
                                        {nouveauJour && <div className="csd-day-divider"><span>{libelleJour(m.createdAt)}</span></div>}
                                        <div className="csd-devis-card csd-devis-remplace">
                                            <p className="csd-devis-libelle">{m.payload?.libelle}</p>
                                            <p className="csd-devis-montant-barre">{fcfa(m.payload?.montant)}</p>
                                            <span className="csd-devis-remplace-tag">Devis remplacé par une version plus récente</span>
                                        </div>
                                    </div>
                                );
                            }
                            const dejaPayee = m.payload?.paymentType === "shein_acompte" ? colis.paiement?.acomptePaye : colis.paiement?.soldePaye;
                            return (
                                <div key={m._id} className="csd-msg-wrap">
                                    {nouveauJour && <div className="csd-day-divider"><span>{libelleJour(m.createdAt)}</span></div>}
                                    <div className="csd-devis-card">
                                        <p className="csd-devis-libelle">{m.payload?.libelle}</p>
                                        <p className="csd-devis-montant">{fcfa(m.payload?.montant)}</p>
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
                                </div>
                            );
                        }

                        if (m.type === "avis") {
                            if (m.payload?.superseded) return null;
                            if (m.payload?.repondu) {
                                return (
                                    <div key={m._id} className="csd-msg-wrap">
                                        {nouveauJour && <div className="csd-day-divider"><span>{libelleJour(m.createdAt)}</span></div>}
                                        <div className="csd-avis-card csd-avis-repondu">
                                            <p className="csd-avis-libelle">Merci pour ton avis !</p>
                                            <div className="csd-avis-etoiles-lecture">
                                                {[1, 2, 3, 4, 5].map((n) => <Etoile key={n} remplie={n <= m.payload.etoilesDonnees} />)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            const brouillon = avisEnCours[m._id] || {};
                            return (
                                <div key={m._id} className="csd-msg-wrap">
                                    {nouveauJour && <div className="csd-day-divider"><span>{libelleJour(m.createdAt)}</span></div>}
                                    <div className="csd-avis-card">
                                        <p className="csd-avis-libelle">{m.payload?.libelle || "Comment s'est passée votre expérience ?"}</p>
                                        <div className="csd-avis-etoiles">
                                            {[1, 2, 3, 4, 5].map((n) => (
                                                <button key={n} type="button" onClick={() => choisirEtoiles(m._id, n)} aria-label={`${n} étoiles`}>
                                                    <Etoile remplie={n <= (brouillon.etoiles || 0)} />
                                                </button>
                                            ))}
                                        </div>
                                        <textarea
                                            placeholder="Un commentaire ? (optionnel)"
                                            value={brouillon.commentaire || ""}
                                            onChange={(e) => changerCommentaireAvis(m._id, e.target.value)}
                                            rows={2}
                                        />
                                        <button className="csd-avis-envoyer" onClick={() => envoyerAvis(m._id)} disabled={envoiAvis === m._id}>
                                            {envoiAvis === m._id ? "Envoi…" : "Envoyer mon avis"}
                                        </button>
                                    </div>
                                </div>
                            );
                        }
                        const estClient = m.expediteurRole === "client";
                        const lu = estClient && colis.adminDernierLu && new Date(m.createdAt) <= new Date(colis.adminDernierLu);

                        return (
                            <div key={m._id} className="csd-msg-wrap">
                                {nouveauJour && <div className="csd-day-divider"><span>{libelleJour(m.createdAt)}</span></div>}
                                <div className={`csd-msg ${estClient ? "csd-msg-client" : "csd-msg-agent"}`}>
                                    {m.imageUrl && <img src={m.imageUrl} alt="" className="csd-msg-img" onClick={() => window.open(m.imageUrl, "_blank")} />}
                                    {m.texte && <p>{m.texte}</p>}
                                    <span className="csd-msg-meta">
                                        <span className="csd-msg-heure">
                                            {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                        {estClient && (
                                            <span className={`csd-check ${lu ? "csd-check-lu" : ""}`} aria-label={lu ? "Lu" : "Envoyé"}>
                                                {lu ? <CocheDouble /> : <CocheSimple />}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {agentEnTrainDecrire && (
                        <div className="csd-msg csd-msg-agent csd-typing" aria-label="L'agent écrit">
                            <span className="csd-typing-dot" />
                            <span className="csd-typing-dot" />
                            <span className="csd-typing-dot" />
                        </div>
                    )}
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
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                </svg>
                                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={choisirImage} />
                            </label>
                            <input
                                type="text"
                                placeholder="Écris un message…"
                                value={texte}
                                onChange={(e) => { setTexte(e.target.value); if (e.target.value.trim()) signalerFrappe(); }}
                                maxLength={2000}
                            />
                            <button type="submit" disabled={(!texte.trim() && !imageChoisie) || envoi} className="csd-send-btn" aria-label="Envoyer">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
                                </svg>
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <style>{`
        .csd-page { max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; height: calc(100vh - 70px); height: calc(100dvh - 70px); font-family: 'DM Sans', sans-serif; padding: 0 12px; }
        .csd-loading { text-align: center; padding: 60px 20px; color: #999; font-size: 14px; }
        .csd-header { display: flex; align-items: center; gap: 10px; padding: 12px 0 10px; flex-shrink: 0; }
        .csd-header-titre { flex: 1; min-width: 0; }
        .csd-back { background: #f7f5f2; border: none; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; color: #333; cursor: pointer; flex-shrink: 0; transition: background .15s; }
        .csd-back:hover { background: #f0ede8; }
        .csd-numero { font-size: 11.5px; color: #999; margin: 0 0 2px; letter-spacing: .3px; }
        .csd-statut { font-size: 15px; font-weight: 700; color: #111; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .csd-toggle { background: #f7f5f2; border: none; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; color: #555; cursor: pointer; transition: transform .2s, background .15s; flex-shrink: 0; }
        .csd-toggle:hover { background: #f0ede8; }
        .csd-toggle.open { transform: rotate(180deg); }
        .csd-horaires-banner { flex-shrink: 0; background: #fdf1f0; color: #b23b36; font-size: 11.5px; font-weight: 500; border-radius: 12px; padding: 8px 12px; margin-bottom: 8px; text-align: center; }
        .csd-livraison-banner { flex-shrink: 0; background: #eef7f0; color: #256029; font-size: 12px; font-weight: 500; border-radius: 12px; padding: 9px 12px; margin-bottom: 8px; text-align: center; }
        .csd-arrivee-banner { flex-shrink: 0; background: #fff8e6; color: #8a6100; font-size: 12px; font-weight: 500; border-radius: 12px; padding: 9px 12px; margin-bottom: 8px; text-align: center; }
        .csd-avis-card { background: #fff; border: 1px solid #f0ede8; border-radius: 14px; padding: 14px 16px; max-width: 280px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
        .csd-avis-libelle { font-size: 13px; font-weight: 600; color: #222; margin: 0 0 10px; }
        .csd-avis-etoiles { display: flex; gap: 4px; margin-bottom: 10px; }
        .csd-avis-etoiles button { background: none; border: none; padding: 2px; cursor: pointer; }
        .csd-avis-etoiles-lecture { display: flex; gap: 2px; }
        .csd-avis-card textarea { width: 100%; border: 1px solid #eee; border-radius: 8px; padding: 8px 10px; font-size: 12.5px; font-family: inherit; resize: none; margin-bottom: 10px; box-sizing: border-box; }
        .csd-avis-envoyer { width: 100%; background: #111; color: #fff; border: none; border-radius: 8px; padding: 9px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .csd-avis-envoyer:disabled { opacity: .5; cursor: default; }
        .csd-avis-repondu { text-align: center; }
        .csd-avis-repondu .csd-avis-libelle { margin-bottom: 8px; }
        .csd-avis-etoiles-lecture { justify-content: center; }
        .csd-pay-btn { width: 100%; background: #e53935; color: #fff; border: none; border-radius: 40px; padding: 12px 16px; font-size: 13.5px; font-weight: 600; cursor: pointer; margin-bottom: 10px; box-shadow: 0 4px 14px rgba(229,57,53,0.25); transition: transform .12s, box-shadow .12s; }
        .csd-pay-btn:active { transform: scale(0.98); }
        .csd-pay-btn:disabled { opacity: .6; cursor: default; box-shadow: none; }
        .csd-infos { max-height: 0; overflow: hidden; transition: max-height .25s ease; }
        .csd-infos.open { max-height: 600px; overflow-y: auto; }
        .csd-progress { display: flex; gap: 4px; margin-bottom: 12px; }
        .csd-dot { flex: 1; height: 4px; border-radius: 2px; background: #f0ede8; transition: background .2s; }
        .csd-dot.done { background: #e53935; }
        .csd-card { background: #fff; border: 1px solid #f0ede8; border-radius: 14px; padding: 14px; margin-bottom: 10px; }
        .csd-card-title { font-size: 12px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: .5px; margin: 0 0 10px; }
        .csd-article { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #faf8f5; gap: 10px; }
        .csd-article:last-of-type { border-bottom: none; }
        .csd-article-nom { font-size: 13.5px; font-weight: 500; color: #111; margin: 0; }
        .csd-article-variante { font-size: 12px; color: #999; margin: 2px 0 0; }
        .csd-article-prix-bloc { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
        .csd-article-prix { font-size: 13.5px; font-weight: 600; color: #111; white-space: nowrap; }
        .csd-article-fcfa { font-size: 11px; color: #b7791f; white-space: nowrap; margin-top: 2px; }
        .csd-total-row { display: flex; justify-content: space-between; padding-top: 10px; margin-top: 6px; border-top: 1px solid #f0ede8; font-size: 14px; color: #111; }
        .csd-fcfa { color: #e53935; font-size: 13px; border-top: none; padding-top: 0; margin-top: 2px; }

        .csd-chat-zone { flex: 1; display: flex; flex-direction: column; min-height: 0; background: #fbfaf8; border: 1px solid #f0ede8; border-radius: 18px; margin-top: 8px; overflow: hidden; box-shadow: 0 2px 16px rgba(17,17,17,0.03); }
        .csd-messages { flex: 1; overflow-y: auto; padding: 16px 14px; display: flex; flex-direction: column; gap: 6px; }
        .csd-chat-empty { font-size: 12.5px; color: #bbb; text-align: center; padding: 30px 0; margin: auto; }

        .csd-msg-wrap { display: flex; flex-direction: column; animation: csd-pop .22s ease; }
        @keyframes csd-pop { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

        .csd-day-divider { display: flex; align-items: center; justify-content: center; margin: 12px 0 8px; }
        .csd-day-divider span { font-size: 11px; font-weight: 600; color: #a39d92; background: #f0ede8; padding: 4px 12px; border-radius: 20px; }

        .csd-msg { max-width: 78%; padding: 9px 12px; border-radius: 17px; font-size: 13.5px; line-height: 1.45; position: relative; margin-bottom: 2px; box-shadow: 0 1px 2px rgba(17,17,17,0.04); }
        .csd-msg p { margin: 0; word-break: break-word; }
        .csd-msg-meta { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 3px; }
        .csd-msg-heure { font-size: 10px; opacity: .55; }
        .csd-msg-img { width: 160px; border-radius: 10px; display: block; margin-bottom: 4px; cursor: pointer; }
        .csd-msg-client { align-self: flex-end; background: #111; color: #fff; border-radius: 17px 17px 4px 17px; }
        .csd-msg-agent { align-self: flex-start; background: #fff; color: #222; border: 1px solid #f0ede8; border-radius: 17px 17px 17px 4px; }

        .csd-check { display: inline-flex; color: rgba(255,255,255,0.55); }
        .csd-check-lu { color: #5ec2f0; }

        .csd-typing { display: flex; align-items: center; gap: 4px; padding: 12px 14px; width: fit-content; }
        .csd-typing-dot { width: 6px; height: 6px; border-radius: 50%; background: #bbb; animation: csd-bounce 1.1s infinite ease-in-out; }
        .csd-typing-dot:nth-child(2) { animation-delay: .15s; }
        .csd-typing-dot:nth-child(3) { animation-delay: .3s; }
        @keyframes csd-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-4px); opacity: 1; } }

        .csd-badge-systeme { align-self: center; background: #f0ede8; color: #888; font-size: 11px; padding: 5px 12px; border-radius: 20px; margin: 4px 0; }

        .csd-devis-card { align-self: center; width: 90%; background: #fff; border: 1.5px solid #e53935; border-radius: 16px; padding: 16px; text-align: center; margin: 6px 0; box-shadow: 0 4px 16px rgba(229,57,53,0.08); }
        .csd-devis-libelle { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: .5px; margin: 0 0 4px; }
        .csd-devis-montant { font-size: 20px; font-weight: 700; color: #111; margin: 0 0 10px; }
        .csd-devis-detail { font-size: 11px; color: #999; margin: -6px 0 10px; }
        .csd-devis-card button { background: #e53935; color: #fff; border: none; border-radius: 30px; padding: 9px 20px; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: transform .12s; }
        .csd-devis-card button:active { transform: scale(0.97); }
        .csd-devis-card button:disabled { opacity: .5; cursor: default; }
        .csd-devis-paye { display: inline-block; background: #eef7f0; color: #2e7d32; font-size: 12px; font-weight: 600; padding: 6px 16px; border-radius: 20px; }
        .csd-devis-card .csd-msg-heure { display: block; margin-top: 8px; text-align: center; opacity: .5; }
        .csd-devis-remplace { border-color: #e5e0d8; opacity: .6; box-shadow: none; }
        .csd-devis-montant-barre { font-size: 16px; font-weight: 600; color: #999; text-decoration: line-through; margin: 0 0 6px; }
        .csd-devis-remplace-tag { font-size: 11px; color: #999; }

        .csd-chat-form { border-top: 1px solid #f0ede8; background: #fff; padding: 10px 12px; padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
        .csd-chat-row { display: flex; align-items: center; gap: 8px; }
        .csd-attach-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: #f7f5f2; color: #888; cursor: pointer; flex-shrink: 0; transition: background .15s; }
        .csd-attach-btn:hover { background: #f0ede8; }
        .csd-chat-row input[type="text"] { flex: 1; border: 1.5px solid #eee9e2; background: #faf8f5; border-radius: 40px; padding: 10px 16px; font-size: 13px; outline: none; transition: border-color .15s, background .15s; }
        .csd-chat-row input[type="text"]:focus { border-color: #e53935; background: #fff; }
        .csd-send-btn { background: #111; color: #fff; border: none; border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: transform .12s, opacity .15s; }
        .csd-send-btn:active { transform: scale(0.92); }
        .csd-send-btn:disabled { opacity: .35; cursor: default; }
        .csd-preview { position: relative; width: 60px; margin-bottom: 8px; }
        .csd-preview img { width: 60px; height: 60px; object-fit: cover; border-radius: 10px; }
        .csd-preview button { position: absolute; top: -6px; right: -6px; background: #111; color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer; }
        .csd-chat-closed { text-align: center; font-size: 12.5px; color: #999; background: #f7f5f2; border-radius: 40px; padding: 10px 14px; margin: 10px 12px; }
      `}</style>
        </div>
    );
};

export default ColisSheinDetail;