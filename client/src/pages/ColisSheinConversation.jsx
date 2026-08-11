import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
import { ArrowLeft, ChevronRight, Image as ImageIcon, Send, X, Star, Check, MessageSquare } from "lucide-react";
// [PHASE 1 - PERF] Transformation Cloudinary (f_auto, q_auto, largeur adaptée)
import { getPresetImageUrl } from "../utils/cloudinaryImage";
import JekoOperatorModal from "../components/JekoOperatorModal";

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

// [DESIGN.md §4] Le badge de statut doit se lire en une seconde. Trois familles
// seulement : ce qui attend le client (warn), ce qui avance (info/neutral), ce
// qui est acquis (ok). Le rouge de marque n'est jamais un statut — il est
// réservé aux actions et à l'identité.
const STATUT_VARIANTE = {
    soumis: "info",
    en_verification: "info",
    devis_envoye: "warn",
    acompte_paye: "neutral",
    achete: "neutral",
    en_entrepot: "neutral",
    pese: "warn",
    solde_du: "warn",
    solde_paye: "neutral",
    en_livraison: "info",
    livre: "ok",
    annule: "done",
};

const TYPING_TTL_MS = 4000;
const POLL_MS = 3000;
const TYPING_SIGNAL_THROTTLE_MS = 2200;
// [DESIGN.md §4] Deux messages du même émetteur à moins de 2 min se groupent.
const GROUPE_MS = 2 * 60 * 1000;

const fcfa = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

const memeJour = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

const libelleJour = (date) => {
    const d = new Date(date);
    const hier = new Date();
    hier.setDate(hier.getDate() - 1);
    if (memeJour(d, new Date())) return "Aujourd'hui";
    if (memeJour(d, hier)) return "Hier";
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
};

const heure = (d) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const DayDivider = ({ children }) => <span className="rs-day">{children}</span>;

const ColisSheinConversation = () => {
    const { id } = useParams();
    const { axios, user } = useAppContext();
    const navigate = useNavigate();

    const [colis, setColis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [texte, setTexte] = useState("");
    const [envoi, setEnvoi] = useState(false);
    const [imageChoisie, setImageChoisie] = useState(null);
    const [maintenant, setMaintenant] = useState(Date.now());
    const [avisEnCours, setAvisEnCours] = useState({});
    const [envoiAvis, setEnvoiAvis] = useState(null);
    const [payingAcompte, setPayingAcompte] = useState(false);
    const [payingSolde, setPayingSolde] = useState(false);

    const messagesContainerRef = useRef(null);
    const pollRef = useRef(null);
    const tickRef = useRef(null);
    const fileInputRef = useRef(null);
    const dernierSignalFrappe = useRef(0);
    const etaitProcheDuBas = useRef(true); // suit si l'utilisateur regardait déjà le bas du chat
    const premierChargement = useRef(true);

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
            // le polling réessaiera
        }
    };

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
        !!colis?.agentTypingAt && maintenant - new Date(colis.agentTypingAt).getTime() < TYPING_TTL_MS;

    const gererScroll = () => {
        const el = messagesContainerRef.current;
        if (!el) return;
        const distanceDuBas = el.scrollHeight - el.scrollTop - el.clientHeight;
        etaitProcheDuBas.current = distanceDuBas < 120; // marge de tolérance
    };

    useEffect(() => {
        const el = messagesContainerRef.current;
        if (!el) return;
        // Toujours défiler au tout premier chargement, sinon seulement si l'utilisateur
        // était déjà proche du bas (il suit la conversation en direct).
        if (premierChargement.current || etaitProcheDuBas.current) {
            el.scrollTop = el.scrollHeight;
        }
        premierChargement.current = false;
    }, [messages, agentEnTrainDecrire]);

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
                etaitProcheDuBas.current = true;
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
        if (!brouillon?.etoiles) { toast.error("Choisis au moins une étoile"); return; }
        setEnvoiAvis(messageId);
        try {
            const { data } = await axios.post(`/api/shein-cart/${id}/avis`, {
                messageId,
                etoiles: brouillon.etoiles,
                commentaire: brouillon.commentaire || "",
            });
            if (data.success) fetchMessages();
            else toast.error(data.message || "Envoi impossible");
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur d'envoi");
        } finally {
            setEnvoiAvis(null);
        }
    };

    // Jèko exige l'opérateur AVANT l'appel API — voir ColisSheinDetail.jsx
    // pour la même logique.
    const [modaleOperateur, setModaleOperateur] = useState(null); // "acompte" | "solde" | null

    const payerAcompte = () => setModaleOperateur("acompte");
    const payerSolde = () => setModaleOperateur("solde");

    const confirmerPaiement = async (operateur) => {
        const type = modaleOperateur;
        const setPaying = type === "acompte" ? setPayingAcompte : setPayingSolde;
        setPaying(true);
        try {
            const { data } = await axios.post(`/api/shein-cart/${id}/pay-${type}`, { jekoPaymentMethod: operateur });
            if (data.success) window.location.href = data.checkout_url;
            else {
                toast.error(data.message || "Paiement impossible");
                setPaying(false);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur de paiement");
            setPaying(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
                <div className="rs-typing"><span /><span /><span /></div>
                <p className="text-[13px] text-ink-400">Chargement de la conversation…</p>
            </div>
        );
    }
    if (!colis) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-2 px-6 text-center">
                <p className="rs-h2">Colis introuvable</p>
                <p className="text-[13px] text-ink-400">Ce colis n'existe plus ou ne vous appartient pas.</p>
                <button onClick={() => navigate("/mes-colis-shein")} className="rs-btn rs-btn--secondary mt-2">
                    Retour à mes colis
                </button>
            </div>
        );
    }

    const chatFerme = colis.statut === "livre" || colis.statut === "annule";
    const varianteStatut = STATUT_VARIANTE[colis.statut] || "neutral";

    return (
        <div className="mx-auto flex flex-col w-full max-w-[560px] h-[calc(100dvh-64px)] bg-ink-50">

            {/* ── En-tête collant ────────────────────────────────────────── */}
            <header className="sticky top-0 z-10 flex items-center gap-2 px-2 sm:px-3 py-2 rs-surface border-b border-ink-100">
                <button onClick={() => navigate("/mes-colis-shein")} className="rs-icon-btn" aria-label="Retour à mes colis">
                    <ArrowLeft size={20} />
                </button>

                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-extrabold text-ink-900 tracking-tight truncate">
                        {colis.numeroSuivi}
                    </p>
                    {/* aria-live : le statut change par polling, un lecteur d'écran
                        doit l'annoncer sans que l'utilisateur ait à relire la page. */}
                    <div className="mt-0.5" aria-live="polite">
                        <span className={`rs-badge rs-badge--${varianteStatut}`}>
                            {STATUT_LABELS[colis.statut] || colis.statut}
                        </span>
                    </div>
                </div>

                <button
                    onClick={() => navigate(`/colis-shein/${id}/detail`)}
                    className="rs-icon-btn"
                    aria-label="Voir le détail du colis"
                >
                    <ChevronRight size={20} />
                </button>
            </header>

            {/* ── Fil de conversation ────────────────────────────────────── */}
            <div
                ref={messagesContainerRef}
                onScroll={gererScroll}
                className="rs-scroll flex-1 px-4 py-2"
            >
                {messages.length === 0 && (
                    <div className="flex flex-col items-center text-center py-20 px-6">
                        <div className="w-14 h-14 rounded-full bg-ramses-50 flex items-center justify-center mb-4">
                            <MessageSquare size={22} className="text-ramses-600" />
                        </div>
                        <p className="rs-h2">Aucun message pour l'instant</p>
                        <p className="text-[13px] text-ink-400 mt-1 max-w-[280px]">
                            Un agent vous répondra ici. Vous pouvez déjà poser votre question ou joindre une photo.
                        </p>
                    </div>
                )}

                {messages.map((m, idx) => {
                    const precedent = messages[idx - 1];
                    const suivant = messages[idx + 1];
                    const nouveauJour = !precedent || !memeJour(precedent.createdAt, m.createdAt);

                    if (m.type === "systeme") {
                        return (
                            <div key={m._id}>
                                {nouveauJour && <DayDivider>{libelleJour(m.createdAt)}</DayDivider>}
                                <span className="rs-system">{m.texte}</span>
                            </div>
                        );
                    }

                    if (m.type === "devis") {
                        const dejaPayee = m.payload?.paymentType === "shein_acompte"
                            ? colis.paiement?.acomptePaye
                            : colis.paiement?.soldePaye;
                        const remplace = m.payload?.superseded;
                        const enCours = payingAcompte || payingSolde;

                        return (
                            <div key={m._id}>
                                {nouveauJour && <DayDivider>{libelleJour(m.createdAt)}</DayDivider>}
                                <div className={`rs-card mb-2.5 max-w-[88%] ${remplace ? "rs-card--muted" : !dejaPayee ? "rs-card--action" : ""}`}>
                                    <span className={`rs-label ${remplace ? "text-ink-400" : "text-ramses-600"}`}>
                                        {remplace ? "Remplacé" : "Devis"}
                                    </span>

                                    <p className="text-[13px] text-ink-500 mt-2">{m.payload?.libelle}</p>

                                    {/* Le montant est ce que le client cherche : 20px/800. */}
                                    <p className={`rs-money text-[20px] mt-0.5 ${remplace ? "text-ink-300 line-through" : ""}`}>
                                        {fcfa(m.payload?.montant)}
                                    </p>

                                    {m.payload?.detail && (
                                        <p className="text-[12px] text-ink-400 mt-1.5 leading-relaxed">{m.payload.detail}</p>
                                    )}

                                    {!remplace && (
                                        dejaPayee ? (
                                            <span className="rs-badge rs-badge--ok mt-3">Paiement confirmé</span>
                                        ) : (
                                            <button
                                                onClick={m.payload?.paymentType === "shein_acompte" ? payerAcompte : payerSolde}
                                                disabled={enCours}
                                                className="rs-btn rs-btn--primary rs-btn--block mt-3"
                                            >
                                                {enCours ? "Redirection…" : "Payer maintenant"}
                                            </button>
                                        )
                                    )}

                                    <span className="block text-[11px] text-ink-400 mt-2.5 tabular-nums">{heure(m.createdAt)}</span>
                                </div>
                            </div>
                        );
                    }

                    if (m.type === "avis") {
                        if (m.payload?.superseded) return null;

                        if (m.payload?.repondu) {
                            return (
                                <div key={m._id}>
                                    {nouveauJour && <DayDivider>{libelleJour(m.createdAt)}</DayDivider>}
                                    <div className="rs-card rs-card--muted mb-2.5 max-w-[88%]">
                                        <span className="rs-label text-ok-500">Avis envoyé</span>
                                        <p className="text-[13px] text-ink-500 mt-2 mb-2">Merci pour votre retour.</p>
                                        <div className="flex gap-1" role="img" aria-label={`${m.payload.etoilesDonnees} étoiles sur 5`}>
                                            {[1, 2, 3, 4, 5].map((n) => (
                                                <Star
                                                    key={n}
                                                    size={16}
                                                    className={n <= m.payload.etoilesDonnees ? "fill-ramses-600 text-ramses-600" : "text-ink-200"}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        const brouillon = avisEnCours[m._id] || {};
                        const enEnvoi = envoiAvis === m._id;

                        return (
                            <div key={m._id}>
                                {nouveauJour && <DayDivider>{libelleJour(m.createdAt)}</DayDivider>}
                                <div className="rs-card rs-card--action mb-2.5 max-w-[88%]">
                                    <span className="rs-label text-ramses-600">Votre avis</span>
                                    <p className="text-[13px] text-ink-500 mt-2 mb-2">
                                        {m.payload?.libelle || "Comment s'est passée votre expérience ?"}
                                    </p>

                                    {/* Cibles tactiles 44px : des étoiles de 20px sans padding
                                        sont impossibles à viser au pouce. */}
                                    <div className="flex mb-1 -ml-2">
                                        {[1, 2, 3, 4, 5].map((n) => (
                                            <button
                                                key={n}
                                                type="button"
                                                onClick={() => choisirEtoiles(m._id, n)}
                                                className="w-11 h-11 flex items-center justify-center rounded-full transition hover:bg-ink-50"
                                                aria-label={`Noter ${n} sur 5`}
                                                aria-pressed={n === brouillon.etoiles}
                                            >
                                                <Star
                                                    size={24}
                                                    className={n <= (brouillon.etoiles || 0) ? "fill-ramses-600 text-ramses-600" : "text-ink-200"}
                                                />
                                            </button>
                                        ))}
                                    </div>

                                    <textarea
                                        placeholder="Un commentaire ? (optionnel)"
                                        value={brouillon.commentaire || ""}
                                        onChange={(e) => changerCommentaireAvis(m._id, e.target.value)}
                                        rows={2}
                                        className="rs-input rs-input--area mb-2.5"
                                    />

                                    <button
                                        onClick={() => envoyerAvis(m._id)}
                                        disabled={enEnvoi || !brouillon.etoiles}
                                        className="rs-btn rs-btn--primary rs-btn--block"
                                    >
                                        {enEnvoi ? "Envoi…" : "Envoyer mon avis"}
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    // ── Message texte / image ──────────────────────────────
                    const estClient = m.expediteurRole === "client";
                    const lu = estClient && colis.adminDernierLu && new Date(m.createdAt) <= new Date(colis.adminDernierLu);

                    // Groupement : messages consécutifs du même émetteur à moins de
                    // 2 min. Le premier du groupe porte l'étiquette « Assistance »,
                    // le dernier porte l'horodatage. Entre les deux : rien.
                    const memeGroupeQuePrecedent =
                        precedent &&
                        !nouveauJour &&
                        precedent.expediteurRole === m.expediteurRole &&
                        !["systeme", "devis", "avis"].includes(precedent.type) &&
                        new Date(m.createdAt) - new Date(precedent.createdAt) < GROUPE_MS;

                    const memeGroupeQueSuivant =
                        suivant &&
                        memeJour(m.createdAt, suivant.createdAt) &&
                        suivant.expediteurRole === m.expediteurRole &&
                        !["systeme", "devis", "avis"].includes(suivant.type) &&
                        new Date(suivant.createdAt) - new Date(m.createdAt) < GROUPE_MS;

                    return (
                        <div key={m._id}>
                            {nouveauJour && <DayDivider>{libelleJour(m.createdAt)}</DayDivider>}
                            <div
                                className={`flex ${estClient ? "justify-end" : "justify-start"}`}
                                style={{ marginBottom: memeGroupeQueSuivant ? 2 : 10 }}
                            >
                                <div className={`rs-bubble ${estClient ? "rs-bubble--client" : "rs-bubble--agent"}`}>
                                    {!estClient && !memeGroupeQuePrecedent && (
                                        <p className="rs-label text-ramses-600 mb-1.5">Assistance</p>
                                    )}

                                    {m.imageUrl && (
                                        <img
                                            src={getPresetImageUrl(m.imageUrl, "card")}
                                            alt="Pièce jointe"
                                            loading="lazy"
                                            onClick={() => window.open(m.imageUrl, "_blank")}
                                            className="rounded-xl mb-1.5 max-h-56 w-full object-cover cursor-zoom-in"
                                        />
                                    )}

                                    {m.texte && <p>{m.texte}</p>}

                                    {!memeGroupeQueSuivant && (
                                        <div className="rs-bubble__meta">
                                            <span>{heure(m.createdAt)}</span>
                                            {estClient && (
                                                <span
                                                    className="inline-flex items-center"
                                                    aria-label={lu ? "Lu par l'agent" : "Envoyé"}
                                                >
                                                    <Check size={13} strokeWidth={3} />
                                                    {lu && <Check size={13} strokeWidth={3} className="-ml-2" />}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {agentEnTrainDecrire && (
                    <div className="flex justify-start mb-2.5">
                        <div className="rs-bubble rs-bubble--agent">
                            <p className="rs-label text-ramses-600 mb-1.5">Assistance</p>
                            <div className="rs-typing" aria-label="L'agent est en train d'écrire">
                                <span /><span /><span />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Zone de saisie ─────────────────────────────────────────── */}
            {chatFerme ? (
                <div
                    className="flex items-center justify-center gap-3 py-4 px-4 rs-surface border-t border-ink-100"
                    style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
                >
                    <span className="h-px w-6 bg-ink-200" />
                    <span className="text-[12px] font-medium text-ink-400 text-center">
                        {colis.statut === "livre" ? "Colis livré — conversation clôturée" : "Colis annulé — conversation clôturée"}
                    </span>
                    <span className="h-px w-6 bg-ink-200" />
                </div>
            ) : (
                <form
                    onSubmit={envoyerMessage}
                    className="rs-surface border-t border-ink-100 px-3 pt-2.5"
                    style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
                >
                    {imageChoisie && (
                        <div className="flex items-center gap-3 bg-ink-50 rounded-xl p-2 mb-2">
                            <img
                                src={URL.createObjectURL(imageChoisie)}
                                alt=""
                                className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-ink-800">Image jointe</p>
                                <p className="text-[11px] text-ink-400 truncate">{imageChoisie.name}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setImageChoisie(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                className="rs-icon-btn"
                                aria-label="Retirer l'image"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}

                    <div className="flex items-end gap-1.5">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="rs-icon-btn"
                            aria-label="Joindre une image"
                        >
                            <ImageIcon size={20} />
                        </button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && setImageChoisie(e.target.files[0])}
                        />

                        <input
                            value={texte}
                            onChange={(e) => { setTexte(e.target.value); signalerFrappe(); }}
                            placeholder="Écrire un message…"
                            aria-label="Votre message"
                            className="rs-input rs-input--pill flex-1"
                        />

                        <button
                            type="submit"
                            disabled={envoi || (!texte.trim() && !imageChoisie)}
                            className="rs-icon-btn rs-icon-btn--filled"
                            aria-label="Envoyer le message"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </form>
            )}

            <JekoOperatorModal
                open={modaleOperateur !== null}
                onClose={() => setModaleOperateur(null)}
                onConfirm={confirmerPaiement}
                loading={modaleOperateur === "acompte" ? payingAcompte : payingSolde}
                montantLabel={
                    modaleOperateur === "acompte"
                        ? `Payer les articles — ${fcfa(colis?.devis?.montantInitial)}`
                        : modaleOperateur === "solde"
                            ? `Payer la livraison — ${fcfa(colis?.paiement?.soldeMontant)}`
                            : undefined
                }
            />
        </div>
    );
};

export default ColisSheinConversation;