import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
import { ArrowLeft, ChevronDown, Image as ImageIcon, Send, X, Star } from "lucide-react";
// [PHASE 1 - PERF] Transformation Cloudinary (f_auto, q_auto, largeur adaptée)
import { getPresetImageUrl } from "../utils/cloudinaryImage";

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

const TYPING_TTL_MS = 4000;
const POLL_MS = 3000;
const TYPING_SIGNAL_THROTTLE_MS = 2200;

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

const DayDivider = ({ children }) => (
    <div className="flex items-center justify-center my-4">
        <span className="text-[11px] font-medium text-gray-400 bg-blush-50 px-3 py-1 rounded-full">{children}</span>
    </div>
);

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
        return <div className="flex items-center justify-center py-24 text-sm text-gray-400">Chargement de la conversation…</div>;
    }
    if (!colis) {
        return <div className="flex items-center justify-center py-24 text-sm text-gray-400">Colis introuvable</div>;
    }

    const chatFerme = colis.statut === "livre" || colis.statut === "annule";

    return (
        <div className="max-w-lg mx-auto flex flex-col h-[calc(100vh-64px)]">
            {/* Header */}
            <header className="flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-blush-100 bg-white">
                <button onClick={() => navigate("/mes-colis-shein")} className="text-gray-400 hover:text-gray-700 transition" aria-label="Retour">
                    <ArrowLeft size={19} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${chatFerme ? "bg-gray-300" : "bg-emerald-500"}`} />
                        <p className="text-[13px] font-bold text-gray-900">{colis.numeroSuivi}</p>
                    </div>
                    <h1 className="text-xs text-burgundy-600 font-medium truncate">{STATUT_LABELS[colis.statut] || colis.statut}</h1>
                </div>
                <button
                    onClick={() => navigate(`/colis-shein/${id}/detail`)}
                    className="w-9 h-9 rounded-full bg-blush-50 flex items-center justify-center text-gray-500 hover:bg-blush-100 transition"
                    aria-label="Détails du colis"
                >
                    <ChevronDown size={16} className="-rotate-90" />
                </button>
            </header>

            {/* Messages */}
            <div ref={messagesContainerRef} onScroll={gererScroll} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 bg-ivory-100">
                {messages.length === 0 && (
                    <div className="text-center py-16">
                        <p className="text-sm font-semibold text-gray-700">Aucun message pour l'instant</p>
                        <p className="text-xs text-gray-400 mt-1">Pose ta question à l'agent directement ici.</p>
                    </div>
                )}

                {messages.map((m, idx) => {
                    const precedent = messages[idx - 1];
                    const nouveauJour = !precedent || !memeJour(precedent.createdAt, m.createdAt);

                    if (m.type === "systeme") {
                        return (
                            <div key={m._id}>
                                {nouveauJour && <DayDivider>{libelleJour(m.createdAt)}</DayDivider>}
                                <div className="text-center text-[11px] text-gray-400 bg-white/70 rounded-full px-3 py-1.5 mx-auto w-fit mb-3">{m.texte}</div>
                            </div>
                        );
                    }

                    if (m.type === "devis") {
                        const dejaPayee = m.payload?.paymentType === "shein_acompte" ? colis.paiement?.acomptePaye : colis.paiement?.soldePaye;
                        return (
                            <div key={m._id}>
                                {nouveauJour && <DayDivider>{libelleJour(m.createdAt)}</DayDivider>}
                                <div className={`max-w-[85%] bg-white border rounded-2xl p-4 mb-3 ${m.payload?.superseded ? "opacity-50 border-gray-200" : "border-blush-200 shadow-sm shadow-black/[0.03]"}`}>
                                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 ${m.payload?.superseded ? "bg-gray-100 text-gray-400" : "bg-burgundy-600 text-white"}`}>
                                        {m.payload?.superseded ? "VERSION PRÉCÉDENTE" : "DEVIS"}
                                    </span>
                                    <p className="text-sm text-gray-700 mb-1">{m.payload?.libelle}</p>
                                    <p className={`text-lg font-bold ${m.payload?.superseded ? "text-gray-400 line-through" : "text-gray-900"}`}>{fcfa(m.payload?.montant)}</p>
                                    {m.payload?.detail && <p className="text-xs text-gray-400 mt-1">{m.payload.detail}</p>}
                                    {!m.payload?.superseded && (
                                        dejaPayee ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 mt-2">✓ Paiement confirmé</span>
                                        ) : (
                                            <button
                                                onClick={m.payload?.paymentType === "shein_acompte" ? payerAcompte : payerSolde}
                                                disabled={payingAcompte || payingSolde}
                                                className="mt-3 w-full bg-burgundy-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-burgundy-700 transition disabled:opacity-50"
                                            >
                                                Payer maintenant
                                            </button>
                                        )
                                    )}
                                    <span className="block text-[10px] text-gray-300 mt-2">{heure(m.createdAt)}</span>
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
                                    <div className="max-w-[85%] bg-white border border-blush-200 rounded-2xl p-4 mb-3">
                                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 mb-2">AVIS ENVOYÉ</span>
                                        <p className="text-sm text-gray-700 mb-2">Merci pour ton avis.</p>
                                        <div className="flex gap-0.5">
                                            {[1, 2, 3, 4, 5].map((n) => (
                                                <Star key={n} size={16} className={n <= m.payload.etoilesDonnees ? "fill-burgundy-500 text-burgundy-500" : "text-gray-200"} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        const brouillon = avisEnCours[m._id] || {};
                        return (
                            <div key={m._id}>
                                {nouveauJour && <DayDivider>{libelleJour(m.createdAt)}</DayDivider>}
                                <div className="max-w-[85%] bg-white border border-blush-200 rounded-2xl p-4 mb-3 shadow-sm shadow-black/[0.03]">
                                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-burgundy-600 text-white mb-2">VOTRE AVIS</span>
                                    <p className="text-sm text-gray-700 mb-2">{m.payload?.libelle || "Comment s'est passée votre expérience ?"}</p>
                                    <div className="flex gap-1 mb-2">
                                        {[1, 2, 3, 4, 5].map((n) => (
                                            <button key={n} type="button" onClick={() => choisirEtoiles(m._id, n)} aria-label={`${n} étoiles`}>
                                                <Star size={20} className={n <= (brouillon.etoiles || 0) ? "fill-burgundy-500 text-burgundy-500" : "text-gray-200"} />
                                            </button>
                                        ))}
                                    </div>
                                    <textarea
                                        placeholder="Un commentaire ? (optionnel)"
                                        value={brouillon.commentaire || ""}
                                        onChange={(e) => changerCommentaireAvis(m._id, e.target.value)}
                                        rows={2}
                                        className="w-full text-sm border border-blush-200 rounded-xl px-3 py-2 outline-none focus:border-burgundy-400 resize-none mb-2"
                                    />
                                    <button
                                        onClick={() => envoyerAvis(m._id)}
                                        disabled={envoiAvis === m._id}
                                        className="w-full bg-burgundy-600 text-white text-sm font-semibold py-2 rounded-xl hover:bg-burgundy-700 transition disabled:opacity-50"
                                    >
                                        {envoiAvis === m._id ? "Envoi…" : "Envoyer mon avis"}
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    const estClient = m.expediteurRole === "client";
                    const lu = estClient && colis.adminDernierLu && new Date(m.createdAt) <= new Date(colis.adminDernierLu);

                    return (
                        <div key={m._id} className={`flex ${estClient ? "justify-end" : "justify-start"}`}>
                            <div className="max-w-[78%] mb-3">
                                {nouveauJour && <DayDivider>{libelleJour(m.createdAt)}</DayDivider>}
                                <div className={`rounded-2xl px-3.5 py-2.5 ${estClient ? "bg-burgundy-600 text-white rounded-br-md" : "bg-white border border-blush-100 text-gray-800 rounded-bl-md"}`}>
                                    {!estClient && <p className="text-[10px] font-bold text-burgundy-500 mb-1">Assistance</p>}
                                    {m.imageUrl && (
                                        <img src={getPresetImageUrl(m.imageUrl, 'card')} alt="" loading="lazy" onClick={() => window.open(m.imageUrl, "_blank")} className="rounded-xl mb-1.5 max-h-48 object-cover cursor-pointer" />
                                    )}
                                    {m.texte && <p className="text-sm leading-relaxed">{m.texte}</p>}
                                    <div className={`flex items-center gap-1 mt-1 ${estClient ? "justify-end text-blush-200" : "text-gray-300"}`}>
                                        <span className="text-[10px]">{heure(m.createdAt)}</span>
                                        {estClient && <span className="text-[11px]">{lu ? "✓✓" : "✓"}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {agentEnTrainDecrire && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-blush-100 rounded-2xl rounded-bl-md px-4 py-3 mb-2">
                            <p className="text-[10px] font-bold text-burgundy-500 mb-1">Assistance</p>
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Zone de saisie */}
            {chatFerme ? (
                <div className="flex items-center gap-3 justify-center py-3.5 text-xs text-gray-400 border-t border-blush-100 bg-white">
                    <span className="h-px w-8 bg-blush-200" />
                    {colis.statut === "livre" ? "Colis livré — conversation clôturée" : "Colis annulé — conversation clôturée"}
                    <span className="h-px w-8 bg-blush-200" />
                </div>
            ) : (
                <form onSubmit={envoyerMessage} className="border-t border-blush-100 bg-white px-3 sm:px-4 py-3">
                    {imageChoisie && (
                        <div className="flex items-center gap-2 bg-blush-50 rounded-xl px-3 py-2 mb-2">
                            <img src={URL.createObjectURL(imageChoisie)} alt="" className="w-9 h-9 rounded-lg object-cover" />
                            <div className="flex-1 text-xs">
                                <p className="font-semibold text-gray-700">Image jointe</p>
                                <p className="text-gray-400">Prête à être envoyée</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setImageChoisie(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                className="text-gray-400 hover:text-gray-700"
                                aria-label="Retirer l'image"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="shrink-0 w-9 h-9 rounded-full bg-blush-50 flex items-center justify-center text-gray-500 hover:bg-blush-100 transition"
                            aria-label="Joindre une image"
                        >
                            <ImageIcon size={16} />
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && setImageChoisie(e.target.files[0])} />
                        <input
                            value={texte}
                            onChange={(e) => { setTexte(e.target.value); signalerFrappe(); }}
                            placeholder="Écrire un message…"
                            className="flex-1 bg-blush-50 rounded-full px-4 py-2.5 text-sm outline-none placeholder-gray-400"
                        />
                        <button
                            type="submit"
                            disabled={envoi || (!texte.trim() && !imageChoisie)}
                            className="shrink-0 w-9 h-9 rounded-full bg-burgundy-600 flex items-center justify-center text-white hover:bg-burgundy-700 transition disabled:opacity-40"
                            aria-label="Envoyer"
                        >
                            <Send size={15} />
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default ColisSheinConversation;