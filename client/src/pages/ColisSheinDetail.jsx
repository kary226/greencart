import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
// [PHASE 1 - PERF] Transformation Cloudinary (f_auto, q_auto, largeur adaptée)
import { getPresetImageUrl } from "../utils/cloudinaryImage";

const money = (n, devise) => {
    const symbole = devise === "EUR" ? "€" : "$";
    return `${symbole}${Number(n || 0).toFixed(2)}`;
};

const fcfa = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

const dateCourte = (d) =>
    new Date(d).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });

const estDansHoraires = (horaires, maintenant) => {
    if (!horaires?.ouverture || !horaires?.fermeture) return true;

    const now = new Date(maintenant);
    const [hO, mO] = horaires.ouverture.split(":").map(Number);
    const [hF, mF] = horaires.fermeture.split(":").map(Number);

    const minutesMaintenant = now.getHours() * 60 + now.getMinutes();
    const minutesOuverture = hO * 60 + mO;
    const minutesFermeture = hF * 60 + mF;

    if (minutesFermeture > minutesOuverture) {
        return (
            minutesMaintenant >= minutesOuverture &&
            minutesMaintenant < minutesFermeture
        );
    }

    return (
        minutesMaintenant >= minutesOuverture ||
        minutesMaintenant < minutesFermeture
    );
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
    "soumis",
    "en_verification",
    "devis_envoye",
    "acompte_paye",
    "achete",
    "en_entrepot",
    "pese",
    "solde_du",
    "solde_paye",
    "en_livraison",
    "livre",
];

const TYPING_TTL_MS = 4000;
const POLL_MS = 3000;
const TYPING_SIGNAL_THROTTLE_MS = 2200;

const memeJour = (a, b) =>
    new Date(a).toDateString() === new Date(b).toDateString();

const libelleJour = (date) => {
    const d = new Date(date);
    const hier = new Date();
    hier.setDate(hier.getDate() - 1);

    if (memeJour(d, new Date())) return "Aujourd'hui";
    if (memeJour(d, hier)) return "Hier";

    return d.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
    });
};

const IconBack = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="15 18 9 12 15 6" />
    </svg>
);

const IconChevron = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

const IconAttach = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
);

const IconSend = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
    </svg>
);

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
    <svg width="25" height="25" viewBox="0 0 24 24" fill={remplie ? "#E03131" : "none"} stroke={remplie ? "#E03131" : "#9CA3AF"} strokeWidth="1.5">
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
    const [avisEnCours, setAvisEnCours] = useState({});
    const [envoiAvis, setEnvoiAvis] = useState(null);

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
            // Le polling réessaiera.
        }
    };

    useEffect(() => {
        axios.get("/api/setting/sheinHoraires")
            .then(({ data }) => {
                if (data.success && data.data) setHoraires(data.data);
            })
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!user) return;

        fetchColis();
        fetchMessages();

        pollRef.current = setInterval(() => {
            fetchMessages();
            fetchColis();
        }, POLL_MS);

        return () => clearInterval(pollRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, user]);

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
        !!colis?.agentTypingAt &&
        maintenant - new Date(colis.agentTypingAt).getTime() < TYPING_TTL_MS;

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
                setMessages((prev) =>
                    prev.map((m) =>
                        m._id === messageId
                            ? { ...m, payload: { ...m.payload, repondu: true, etoilesDonnees: brouillon.etoiles } }
                            : m
                    )
                );
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
            if (data.success) window.location.href = data.checkout_url;
            else toast.error(data.message || "Paiement impossible");
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
            if (data.success) window.location.href = data.checkout_url;
            else toast.error(data.message || "Paiement impossible");
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur de paiement");
        } finally {
            setPayingSolde(false);
        }
    };

    if (loading) {
        return (
            <div className="csd-loading">
                <span className="csd-loading-spinner" />
                <span>Chargement de la conversation</span>
            </div>
        );
    }

    if (!colis) {
        return (
            <div className="csd-loading">
                <span>Colis introuvable</span>
            </div>
        );
    }

    const etapeActuelle = STATUT_ORDER.indexOf(colis.statut);
    const chatFerme = colis.statut === "livre" || colis.statut === "annule";
    const tauxApplique = colis.devis?.tauxApplique || null;
    const serviceOuvert = estDansHoraires(horaires, maintenant);

    return (
        <div className="csd-page">
            <header className="csd-header">
                <button className="csd-back" onClick={() => navigate("/mes-colis-shein")} aria-label="Retour">
                    <IconBack />
                </button>

                <div className="csd-header-titre">
                    <div className="csd-header-topline">
                        <span className="csd-live-dot" />
                        <p className="csd-numero">{colis.numeroSuivi}</p>
                    </div>
                    <h1 className="csd-statut">{STATUT_LABELS[colis.statut] || colis.statut}</h1>
                </div>

                <button className={`csd-toggle ${infosOuvertes ? "open" : ""}`} onClick={() => setInfosOuvertes((v) => !v)} aria-label="Détails du colis">
                    <IconChevron />
                </button>
            </header>

            <div className="csd-chat-heading">
                <div>
                    <span className="csd-chat-heading-label">Discussion</span>
                    <span className="csd-chat-heading-sub">Assistance SHEIN</span>
                </div>
                <span className="csd-secure-label">Conversation sécurisée</span>
            </div>

            {!serviceOuvert && (
                <div className="csd-horaires-banner">
                    <strong>Service fermé</strong>
                    {horaires?.ouverture ? ` — réouverture à ${horaires.ouverture}` : ""}
                    . Tu peux quand même écrire, on te répondra à la réouverture.
                </div>
            )}

            {colis.estimationArrivee?.dateDebut && colis.estimationArrivee?.dateFin && !colis.estimationArrivee?.confirmee && (
                <div className="csd-arrivee-banner">
                    <span className="csd-banner-dot" />
                    Arrivée estimée à Abidjan entre le <strong>{dateCourte(colis.estimationArrivee.dateDebut)}</strong> et le <strong>{dateCourte(colis.estimationArrivee.dateFin)}</strong>
                </div>
            )}

            {colis.statut === "en_livraison" && colis.livraison?.dateDebut && colis.livraison?.dateFin && (
                <div className="csd-livraison-banner">
                    <span className="csd-banner-dot" />
                    Livraison estimée entre le <strong>{dateCourte(colis.livraison.dateDebut)}</strong> et le <strong>{dateCourte(colis.livraison.dateFin)}</strong>
                </div>
            )}

            {colis.statut === "devis_envoye" && !colis.paiement?.acomptePaye && colis.devis?.montantInitial > 0 && (
                <button className="csd-pay-btn" onClick={payerAcompte} disabled={payingAcompte}>
                    <span>{payingAcompte ? "Redirection…" : "Payer les articles"}</span>
                    {!payingAcompte && <strong>{fcfa(colis.devis.montantInitial)}</strong>}
                </button>
            )}

            {(colis.statut === "pese" || colis.statut === "solde_du") && !colis.paiement?.soldePaye && colis.paiement?.soldeMontant > 0 && (
                <button className="csd-pay-btn" onClick={payerSolde} disabled={payingSolde}>
                    <span>{payingSolde ? "Redirection…" : "Payer la livraison"}</span>
                    {!payingSolde && <strong>{fcfa(colis.paiement.soldeMontant)}</strong>}
                </button>
            )}

            <div className={`csd-infos ${infosOuvertes ? "open" : ""}`}>
                {colis.statut !== "annule" && (
                    <div className="csd-progress">
                        {STATUT_ORDER.map((s, i) => (
                            <div key={s} className={`csd-dot ${i <= etapeActuelle ? "done" : ""}`} />
                        ))}
                    </div>
                )}

                <div className="csd-card">
                    <div className="csd-card-heading">
                        <p className="csd-card-title">Articles</p>
                        <span>{colis.articlesValides.length} article{colis.articlesValides.length > 1 ? "s" : ""}</span>
                    </div>

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

            <div className="csd-chat-zone">
                <div className="csd-messages" ref={messagesContainerRef}>
                    {messages.length === 0 && !agentEnTrainDecrire && (
                        <div className="csd-empty-state">
                            <div className="csd-empty-icon"><span /></div>
                            <strong>Aucun message pour l'instant</strong>
                            <p>Pose ta question à l'agent directement ici.</p>
                        </div>
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
                                            <div className="csd-card-status">VERSION PRÉCÉDENTE</div>
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
                                        <div className="csd-card-status red">DEVIS</div>
                                        <p className="csd-devis-libelle">{m.payload?.libelle}</p>
                                        <p className="csd-devis-montant">{fcfa(m.payload?.montant)}</p>
                                        {m.payload?.detail && <p className="csd-devis-detail">{m.payload.detail}</p>}
                                        {dejaPayee ? (
                                            <span className="csd-devis-paye">Paiement confirmé</span>
                                        ) : (
                                            <button
                                                onClick={m.payload?.paymentType === "shein_acompte" ? payerAcompte : payerSolde}
                                                disabled={payingAcompte || payingSolde}
                                            >
                                                Payer maintenant
                                            </button>
                                        )}
                                        <span className="csd-msg-heure">
                                            {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
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
                                            <div className="csd-card-status">AVIS ENVOYÉ</div>
                                            <p className="csd-avis-libelle">Merci pour ton avis.</p>
                                            <div className="csd-avis-etoiles-lecture">
                                                {[1, 2, 3, 4, 5].map((n) => (
                                                    <Etoile key={n} remplie={n <= m.payload.etoilesDonnees} />
                                                ))}
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
                                        <div className="csd-card-status red">VOTRE AVIS</div>
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
                            <div key={m._id} className={`csd-msg-wrap ${estClient ? "client-wrap" : "agent-wrap"}`}>
                                {nouveauJour && <div className="csd-day-divider"><span>{libelleJour(m.createdAt)}</span></div>}
                                <div className={`csd-msg ${estClient ? "csd-msg-client" : "csd-msg-agent"}`}>
                                    {!estClient && <div className="csd-agent-label">Assistance</div>}
                                    {m.imageUrl && (
                                        <img src={getPresetImageUrl(m.imageUrl, 'card')} alt="" loading="lazy" className="csd-msg-img" onClick={() => window.open(m.imageUrl, "_blank")} />
                                    )}
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
                            <div className="csd-agent-label">Assistance</div>
                            <div className="csd-typing-row">
                                <span className="csd-typing-dot" />
                                <span className="csd-typing-dot" />
                                <span className="csd-typing-dot" />
                            </div>
                        </div>
                    )}
                </div>

                {chatFerme ? (
                    <div className="csd-chat-closed">
                        <span className="csd-closed-line" />
                        {colis.statut === "livre" ? "Colis livré — conversation clôturée" : "Colis annulé — conversation clôturée"}
                        <span className="csd-closed-line" />
                    </div>
                ) : (
                    <form className="csd-chat-form" onSubmit={envoyerMessage}>
                        {imageChoisie && (
                            <div className="csd-preview">
                                <img src={URL.createObjectURL(imageChoisie)} alt="" />
                                <div className="csd-preview-info">
                                    <strong>Image jointe</strong>
                                    <span>Prête à être envoyée</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setImageChoisie(null);
                                        if (fileInputRef.current) fileInputRef.current.value = "";
                                    }}
                                    aria-label="Retirer l'image"
                                >
                                    ×
                                </button>
                            </div>
                        )}

                        <div className="csd-chat-row">
                            <label className="csd-attach-btn" title="Joindre une image">
                                <IconAttach />
                                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={choisirImage} />
                            </label>

                            <input
                                type="text"
                                placeholder="Écrire un message..."
                                value={texte}
                                onChange={(e) => {
                                    setTexte(e.target.value);
                                    if (e.target.value.trim()) signalerFrappe();
                                }}
                                maxLength={2000}
                            />

                            <button type="submit" disabled={(!texte.trim() && !imageChoisie) || envoi} className="csd-send-btn" aria-label="Envoyer">
                                <IconSend />
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <style>{`
                .csd-page {
                    --primary: #E03131;
                    --primary-hover: #C92A2A;
                    --primary-active: #B42323;
                    --primary-soft: #FDECEC;
                    --primary-ultra-soft: #FFF6F6;

                    --black: #111111;
                    --heading: #1A1A1A;
                    --body: #404040;
                    --secondary-text: #6B7280;
                    --muted-text: #9CA3AF;
                    --disabled: #C7CBD3;
                    --white: #FFFFFF;

                    --app-bg: #FCFCFD;
                    --bg-2: #F7F8FA;
                    --bg-3: #F1F3F5;
                    --card-bg: #FFFFFF;
                    --hover-bg: #F8F9FB;
                    --selected-bg: #FFF6F6;

                    --border-light: #ECEEF2;
                    --border: #E4E7EC;
                    --border-strong: #D6DAE1;
                    --divider: #F1F2F4;

                    --success: #16A34A;
                    --success-bg: #ECFDF3;
                    --warning: #EA580C;
                    --warning-bg: #FFF7ED;
                    --error: #DC2626;
                    --error-bg: #FEF2F2;
                    --info: #2563EB;
                    --info-bg: #EFF6FF;

                    --shadow-xs: rgba(17,17,17,.02);
                    --shadow-sm: rgba(17,17,17,.04);
                    --shadow-md: rgba(17,17,17,.06);
                    --shadow-lg: rgba(17,17,17,.08);
                    --primary-shadow: rgba(224,49,49,.18);

                    max-width: 560px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    height: calc(100vh - 70px);
                    height: calc(100dvh - 70px);
                    font-family: Inter, "DM Sans", sans-serif;
                    padding: 0 14px 14px;
                    color: var(--body);
                    background: var(--app-bg);
                }

                .csd-loading {
                    min-height: 50vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    background: var(--app-bg);
                    color: var(--muted-text);
                    font-size: 13px;
                }

                .csd-loading-spinner {
                    width: 22px;
                    height: 22px;
                    border: 2px solid var(--border);
                    border-top-color: var(--primary);
                    border-radius: 50%;
                    animation: csd-spin .7s linear infinite;
                }

                @keyframes csd-spin { to { transform: rotate(360deg); } }

                .csd-header { display: flex; align-items: center; gap: 11px; padding: 14px 0 10px; flex-shrink: 0; }

                .csd-back, .csd-toggle {
                    width: 38px; height: 38px;
                    border: 1px solid var(--border);
                    background: var(--card-bg);
                    color: var(--secondary-text);
                    border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; flex-shrink: 0;
                    transition: .18s ease;
                    box-shadow: 0 1px 2px var(--shadow-xs);
                }

                .csd-back svg, .csd-toggle svg { width: 18px; height: 18px; }

                .csd-back:hover, .csd-toggle:hover {
                    background: var(--hover-bg);
                    border-color: var(--border-strong);
                    color: var(--heading);
                }

                .csd-header-titre { flex: 1; min-width: 0; }
                .csd-header-topline { display: flex; align-items: center; gap: 6px; }

                .csd-live-dot {
                    width: 6px; height: 6px;
                    background: var(--primary);
                    border-radius: 50%;
                    box-shadow: 0 0 0 4px var(--primary-soft);
                }

                .csd-numero { font-size: 10px; color: var(--muted-text); margin: 0; letter-spacing: .7px; text-transform: uppercase; }

                .csd-statut {
                    font-size: 14px; font-weight: 700; color: var(--heading);
                    margin: 3px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }

                .csd-toggle.open { transform: rotate(180deg); color: var(--primary); border-color: var(--primary-soft); }

                .csd-chat-heading {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 10px 2px 12px; border-top: 1px solid var(--divider); flex-shrink: 0;
                }

                .csd-chat-heading-label { display: block; font-size: 14px; font-weight: 750; color: var(--heading); letter-spacing: -.2px; }
                .csd-chat-heading-sub { display: block; margin-top: 2px; color: var(--muted-text); font-size: 10.5px; }

                .csd-secure-label {
                    font-size: 9px; text-transform: uppercase; letter-spacing: .65px;
                    color: var(--secondary-text); border: 1px solid var(--border);
                    border-radius: 20px; padding: 5px 8px; background: var(--card-bg);
                }

                .csd-horaires-banner, .csd-arrivee-banner, .csd-livraison-banner {
                    flex-shrink: 0; border-radius: 10px; padding: 9px 11px; margin-bottom: 8px;
                    text-align: center; font-size: 10.5px; line-height: 1.4;
                }

                .csd-horaires-banner { background: var(--warning-bg); border: 1px solid #FED7AA; color: var(--warning); }

                .csd-arrivee-banner, .csd-livraison-banner {
                    background: var(--card-bg); border: 1px solid var(--border); color: var(--secondary-text);
                }

                .csd-arrivee-banner strong, .csd-livraison-banner strong { color: var(--heading); }

                .csd-banner-dot {
                    display: inline-block; width: 5px; height: 5px;
                    background: var(--primary); border-radius: 50%; margin: 0 6px 1px 0;
                }

                .csd-pay-btn {
                    width: 100%; display: flex; justify-content: space-between; align-items: center;
                    background: var(--primary); color: var(--white); border: 0; border-radius: 11px;
                    padding: 12px 14px; font-size: 12px; font-weight: 650; cursor: pointer;
                    margin-bottom: 9px; box-shadow: 0 7px 24px var(--primary-shadow); transition: .18s ease;
                }

                .csd-pay-btn strong { font-size: 12px; }
                .csd-pay-btn:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-1px); }
                .csd-pay-btn:disabled { opacity: .55; cursor: default; }

                .csd-infos { max-height: 0; overflow: hidden; transition: max-height .28s ease; }
                .csd-infos.open { max-height: 600px; overflow-y: auto; }

                .csd-progress { display: flex; gap: 4px; margin: 0 0 10px; }
                .csd-dot { flex: 1; height: 3px; border-radius: 2px; background: var(--border); transition: .2s; }
                .csd-dot.done { background: var(--primary); }

                .csd-card {
                    background: var(--card-bg); border: 1px solid var(--border); border-radius: 15px;
                    padding: 14px; margin-bottom: 10px; box-shadow: 0 1px 3px var(--shadow-sm);
                }

                .csd-card-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; }
                .csd-card-heading > span { color: var(--muted-text); font-size: 10px; }

                .csd-card-title {
                    font-size: 10px; font-weight: 700; color: var(--secondary-text);
                    text-transform: uppercase; letter-spacing: .8px; margin: 0;
                }

                .csd-article {
                    display: flex; justify-content: space-between; align-items: flex-start;
                    padding: 9px 0; border-bottom: 1px solid var(--divider); gap: 10px;
                }
                .csd-article:last-of-type { border-bottom: none; }

                .csd-article-nom { font-size: 12px; font-weight: 550; color: var(--heading); margin: 0; }
                .csd-article-variante { font-size: 10px; color: var(--muted-text); margin: 3px 0 0; }

                .csd-article-prix-bloc { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
                .csd-article-prix { font-size: 12px; font-weight: 650; color: var(--heading); }
                .csd-article-fcfa { font-size: 9px; color: var(--secondary-text); margin-top: 2px; }

                .csd-total-row {
                    display: flex; justify-content: space-between; padding-top: 10px; margin-top: 5px;
                    border-top: 1px solid var(--border); font-size: 12px; color: var(--secondary-text);
                }
                .csd-total-row strong { color: var(--heading); }
                .csd-total-row.csd-fcfa { border-top: 0; padding-top: 0; margin-top: 3px; }
                .csd-total-row.csd-fcfa strong { color: var(--primary); }

                .csd-chat-zone {
                    flex: 1; display: flex; flex-direction: column; min-height: 0;
                    background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px;
                    overflow: hidden; box-shadow: 0 6px 24px var(--shadow-md);
                }

                .csd-messages {
                    flex: 1; overflow-y: auto; padding: 18px 13px; display: flex; flex-direction: column;
                    gap: 7px; background: var(--bg-2);
                    scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent;
                }

                .csd-messages::-webkit-scrollbar { width: 4px; }
                .csd-messages::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 20px; }

                .csd-empty-state { margin: auto; text-align: center; max-width: 230px; padding: 30px 0; color: var(--secondary-text); }

                .csd-empty-icon {
                    width: 42px; height: 42px; margin: 0 auto 13px; border-radius: 14px;
                    background: var(--card-bg); border: 1px solid var(--border);
                    display: flex; align-items: center; justify-content: center;
                }

                .csd-empty-icon span { width: 14px; height: 10px; border: 1.5px solid var(--muted-text); border-radius: 4px; position: relative; }

                .csd-empty-icon span::after {
                    content: ""; position: absolute; bottom: -4px; left: 3px;
                    border-width: 3px 3px 0 0; border-style: solid;
                    border-color: var(--muted-text) transparent transparent transparent;
                }

                .csd-empty-state strong { display: block; color: var(--heading); font-size: 12px; }
                .csd-empty-state p { margin: 5px 0 0; color: var(--muted-text); font-size: 10.5px; line-height: 1.5; }

                .csd-msg-wrap { display: flex; flex-direction: column; animation: csd-pop .2s ease; }

                @keyframes csd-pop {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .csd-day-divider { display: flex; align-items: center; justify-content: center; margin: 12px 0 8px; }

                .csd-day-divider span {
                    font-size: 9px; font-weight: 650; color: var(--secondary-text);
                    background: var(--card-bg); border: 1px solid var(--border);
                    padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: .45px;
                }

                .csd-msg {
                    max-width: 80%; padding: 9px 11px; border-radius: 15px; font-size: 12.5px;
                    line-height: 1.5; position: relative; margin-bottom: 2px;
                }

                .csd-msg p { margin: 0; word-break: break-word; }

                .client-wrap { align-items: flex-end; }
                .agent-wrap { align-items: flex-start; }

                .csd-msg-client {
                    align-self: flex-end; background: var(--primary); color: var(--white);
                    border: 1px solid var(--primary-hover); border-radius: 15px 15px 4px 15px;
                    box-shadow: 0 4px 12px var(--primary-shadow);
                }

                .csd-msg-agent {
                    align-self: flex-start; background: var(--card-bg); color: var(--body);
                    border: 1px solid var(--border); border-radius: 15px 15px 15px 4px;
                    box-shadow: 0 1px 2px var(--shadow-xs);
                }

                .csd-agent-label {
                    color: var(--muted-text); font-size: 8.5px; text-transform: uppercase;
                    letter-spacing: .65px; font-weight: 700; margin-bottom: 4px;
                }

                .csd-msg-client .csd-agent-label { display: none; }

                .csd-msg-meta { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 4px; }
                .csd-msg-heure { font-size: 8.5px; opacity: .6; }

                .csd-msg-img { width: 180px; max-width: 100%; border-radius: 10px; display: block; margin-bottom: 5px; cursor: pointer; }

                .csd-check { display: inline-flex; color: rgba(255,255,255,.6); }
                .csd-check-lu { color: var(--white); }

                .csd-typing { width: fit-content; min-width: 62px; }
                .csd-typing-row { display: flex; align-items: center; gap: 4px; }

                .csd-typing-dot {
                    width: 5px; height: 5px; border-radius: 50%; background: var(--muted-text);
                    animation: csd-bounce 1.1s infinite ease-in-out;
                }

                .csd-typing-dot:nth-child(2) { animation-delay: .15s; }
                .csd-typing-dot:nth-child(3) { animation-delay: .3s; }

                @keyframes csd-bounce {
                    0%, 60%, 100% { transform: translateY(0); opacity: .45; }
                    30% { transform: translateY(-4px); opacity: 1; }
                }

                .csd-badge-systeme {
                    align-self: center; background: var(--card-bg); border: 1px solid var(--border);
                    color: var(--secondary-text); font-size: 9.5px; padding: 5px 11px;
                    border-radius: 20px; margin: 4px 0;
                }

                .csd-devis-card, .csd-avis-card {
                    align-self: center; width: 90%; background: var(--card-bg);
                    border: 1.5px solid var(--primary); border-radius: 15px; padding: 15px;
                    text-align: center; margin: 6px 0; box-shadow: 0 8px 25px var(--shadow-md);
                }

                .csd-avis-card { border: 1px solid var(--border); }

                .csd-card-status {
                    display: inline-block; font-size: 8px; letter-spacing: 1px; font-weight: 750;
                    color: var(--secondary-text); border: 1px solid var(--border); border-radius: 20px;
                    padding: 4px 7px; margin-bottom: 8px; background: var(--bg-2);
                }

                .csd-card-status.red { color: var(--primary); border-color: var(--primary-soft); background: var(--primary-ultra-soft); }

                .csd-devis-libelle { font-size: 10px; color: var(--secondary-text); text-transform: uppercase; letter-spacing: .5px; margin: 0 0 4px; }
                .csd-devis-montant { font-size: 20px; font-weight: 750; color: var(--heading); margin: 0 0 10px; }
                .csd-devis-detail { font-size: 10px; color: var(--muted-text); margin: -4px 0 10px; line-height: 1.45; }

                .csd-devis-card button {
                    background: var(--primary); color: var(--white); border: none; border-radius: 9px;
                    padding: 9px 18px; font-size: 11px; font-weight: 700; cursor: pointer; transition: .16s;
                }

                .csd-devis-card button:hover:not(:disabled) { background: var(--primary-hover); }
                .csd-devis-card button:disabled { opacity: .5; cursor: default; }

                .csd-devis-paye {
                    display: inline-block; color: var(--success); background: var(--success-bg);
                    border: 1px solid #BBF7D0; font-size: 10px; font-weight: 600; padding: 7px 13px; border-radius: 20px;
                }

                .csd-devis-card .csd-msg-heure { display: block; margin-top: 9px; text-align: center; opacity: .5; color: var(--muted-text); }

                .csd-devis-remplace { border-color: var(--border); opacity: .65; box-shadow: none; }
                .csd-devis-montant-barre { font-size: 15px; font-weight: 600; color: var(--muted-text); text-decoration: line-through; margin: 0 0 6px; }
                .csd-devis-remplace-tag { font-size: 9.5px; color: var(--muted-text); }

                .csd-avis-libelle { font-size: 12px; font-weight: 600; color: var(--heading); margin: 0 0 10px; }
                .csd-avis-etoiles { display: flex; justify-content: center; gap: 4px; margin-bottom: 10px; }
                .csd-avis-etoiles button { background: none; border: none; padding: 2px; cursor: pointer; }
                .csd-avis-etoiles-lecture { display: flex; gap: 2px; justify-content: center; }

                .csd-avis-card textarea {
                    width: 100%; box-sizing: border-box; border: 1px solid var(--border);
                    background: var(--bg-2); color: var(--body); border-radius: 9px; padding: 9px 10px;
                    font-size: 11px; font-family: inherit; resize: none; margin-bottom: 9px; outline: none;
                }

                .csd-avis-card textarea:focus { border-color: var(--border-strong); }

                .csd-avis-envoyer {
                    width: 100%; background: var(--primary); color: var(--white); border: none;
                    border-radius: 9px; padding: 9px; font-size: 11px; font-weight: 650; cursor: pointer;
                }

                .csd-avis-envoyer:disabled { opacity: .5; cursor: default; }

                .csd-chat-form {
                    border-top: 1px solid var(--border); background: var(--card-bg); padding: 10px;
                    padding-bottom: calc(10px + env(safe-area-inset-bottom));
                }

                .csd-chat-row { display: flex; align-items: center; gap: 7px; }

                .csd-attach-btn {
                    display: flex; align-items: center; justify-content: center; width: 37px; height: 37px;
                    border-radius: 11px; background: var(--bg-2); border: 1px solid var(--border);
                    color: var(--secondary-text); cursor: pointer; flex-shrink: 0; transition: .16s;
                }

                .csd-attach-btn svg { width: 17px; height: 17px; }
                .csd-attach-btn:hover { color: var(--heading); border-color: var(--border-strong); }

                .csd-chat-row input[type="text"] {
                    flex: 1; min-width: 0; border: 1px solid var(--border); background: var(--bg-2);
                    color: var(--body); border-radius: 11px; padding: 10px 13px; font-size: 12px;
                    outline: none; transition: .16s;
                }

                .csd-chat-row input[type="text"]::placeholder { color: var(--muted-text); }
                .csd-chat-row input[type="text"]:focus { border-color: var(--primary); background: var(--white); }

                .csd-send-btn {
                    background: var(--primary); color: var(--white); border: none; border-radius: 11px;
                    width: 37px; height: 37px; display: flex; align-items: center; justify-content: center;
                    cursor: pointer; flex-shrink: 0; transition: .16s; box-shadow: 0 4px 12px var(--primary-shadow);
                }

                .csd-send-btn svg { width: 15px; height: 15px; }
                .csd-send-btn:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-1px); }
                .csd-send-btn:disabled { opacity: .3; cursor: default; box-shadow: none; }

                .csd-preview {
                    display: flex; align-items: center; gap: 9px; position: relative;
                    background: var(--bg-2); border: 1px solid var(--border); border-radius: 10px;
                    padding: 7px; margin-bottom: 8px;
                }

                .csd-preview img { width: 48px; height: 48px; object-fit: cover; border-radius: 7px; }

                .csd-preview-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
                .csd-preview-info strong { font-size: 10px; color: var(--heading); }
                .csd-preview-info span { font-size: 9px; color: var(--muted-text); }

                .csd-preview button {
                    background: var(--card-bg); color: var(--secondary-text); border: 1px solid var(--border);
                    border-radius: 7px; width: 25px; height: 25px; font-size: 17px; line-height: 1; cursor: pointer;
                }

                .csd-chat-closed {
                    display: flex; align-items: center; justify-content: center; gap: 9px;
                    text-align: center; color: var(--muted-text); font-size: 10px; background: var(--bg-2); padding: 13px 10px;
                }

                .csd-closed-line { width: 25px; height: 1px; background: var(--border); }

                @media (min-width: 700px) {
                    .csd-page { max-width: 640px; padding-left: 0; padding-right: 0; }
                }

                @media (max-width: 420px) {
                    .csd-page { padding-left: 9px; padding-right: 9px; }
                    .csd-secure-label { display: none; }
                    .csd-msg { max-width: 86%; }
                }
            `}</style>
        </div>
    );
};

export default ColisSheinDetail;