import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
import { ArrowLeft, MessageCircle, Scale, Package2, ChevronRight, ChevronDown } from "lucide-react";
import ColisSheinReceiptButton from "../components/ColisSheinReceiptButton";

const STATUT_LABELS = {
    soumis: "Commande soumise",
    en_verification: "En vérification",
    devis_envoye: "Devis envoyé",
    acompte_paye: "Acompte payé",
    achete: "Acheté chez SHEIN",
    en_entrepot: "Arrivé en entrepôt",
    pese: "Pesé",
    solde_du: "Solde à régler",
    solde_paye: "Solde réglé",
    en_livraison: "En cours de livraison",
    livre: "Livré",
};

const STATUT_DESCRIPTIONS = {
    soumis: "Nous avons bien reçu votre commande.",
    en_verification: "Nous vérifions la disponibilité des articles.",
    devis_envoye: "Le devis vous a été envoyé.",
    acompte_paye: "Acompte reçu, achat en préparation.",
    achete: "Vos articles ont été achetés chez SHEIN.",
    en_entrepot: "Votre colis est arrivé en entrepôt.",
    pese: "Le poids réel a été mesuré.",
    solde_du: "Le solde de livraison est à régler.",
    solde_paye: "Solde réglé, préparation de la livraison.",
    en_livraison: "Votre colis est en cours de livraison vers vous.",
    livre: "Votre colis vous a été livré.",
};

const STATUT_ORDER = [
    "soumis", "en_verification", "devis_envoye", "acompte_paye",
    "achete", "en_entrepot", "pese", "solde_du", "solde_paye",
    "en_livraison", "livre",
];

// Jalons affichés au client — l'intégralité du parcours réel du colis
// (STATUT_ORDER), pour que le client voie précisément où il en est plutôt
// qu'une version condensée qui saute des étapes.
const ETAPES_PRINCIPALES = STATUT_ORDER;

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

const fcfa = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;
const money = (n, devise) => `${devise === "EUR" ? "€" : "$"}${Number(n || 0).toFixed(2)}`;
const dateHeure = (d) =>
    new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const ColisSheinDetailPage = () => {
    const { id } = useParams();
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [colis, setColis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [articlesOuverts, setArticlesOuverts] = useState(false);

    useEffect(() => {
        axios.get(`/api/shein-cart/${id}`)
            .then(({ data }) => {
                if (data.success) setColis(data.colis);
                else toast.error("Colis introuvable");
            })
            .catch(() => toast.error("Impossible de charger ce colis"))
            .finally(() => setLoading(false));
    }, [id]);

    // Trouve la vraie date d'une étape dans l'historique (aucune date inventée)
    const dateEtape = (cle) => {
        if (!colis) return null;
        if (cle === "soumis") return colis.createdAt;
        const entree = colis.historique?.find((h) => h.action === `statut_${cle}`);
        return entree?.date || null;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
                <div className="rs-typing"><span /><span /><span /></div>
                <p className="text-[13px] text-ink-400">Chargement du colis…</p>
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

    const indexActuel = STATUT_ORDER.indexOf(colis.statut);
    const nbArticles = colis.articlesValides?.length || 0;
    const poids = colis.devis?.poidsReel;
    const montantTotalFCFA =
        colis.devis?.montantFinal ??
        (colis.devis?.montantArticlesFCFA != null
            ? colis.devis.montantArticlesFCFA + (colis.devis.fraisLivraisonEstime || 0)
            : null);
    const clos = colis.statut === "livre" || colis.statut === "annule";

    return (
        <div className="max-w-[720px] mx-auto pb-12">

            {/* ── En-tête ────────────────────────────────────────────────── */}
            <header className="sticky top-0 z-10 flex items-center gap-2 px-2 sm:px-3 py-2 rs-surface border-b border-ink-100">
                <button onClick={() => navigate(-1)} className="rs-icon-btn" aria-label="Retour">
                    <ArrowLeft size={20} />
                </button>
                <div className="min-w-0">
                    <p className="text-[14px] font-extrabold text-ink-900 tracking-tight truncate">
                        {colis.numeroSuivi}
                    </p>
                    <p className="text-[11px] text-ink-400">Détail du colis</p>
                </div>
            </header>

            <div className="px-4 sm:px-6 pt-5 grid gap-3">

                {/* ── Statut en cours ────────────────────────────────────── */}
                <div className="rs-card">
                    <div className="flex items-start gap-3">
                        <div className="w-11 h-11 shrink-0 rounded-full bg-ramses-50 flex items-center justify-center">
                            <Package2 size={19} className="text-ramses-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div aria-live="polite">
                                <span className={`rs-badge rs-badge--${STATUT_VARIANTE[colis.statut] || "neutral"}`}>
                                    {STATUT_LABELS[colis.statut] || colis.statut}
                                </span>
                            </div>
                            <p className="text-[13px] text-ink-500 mt-2 leading-relaxed">
                                {STATUT_DESCRIPTIONS[colis.statut] || "Votre colis suit son cours."}
                            </p>
                            <p className="text-[11px] text-ink-400 mt-1.5 tabular-nums">
                                Mis à jour le {dateHeure(colis.updatedAt)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Résumé chiffré ─────────────────────────────────────── */}
                <div className="rs-card">
                    <p className="rs-label text-ink-400 mb-3">Résumé</p>

                    <button
                        type="button"
                        onClick={() => setArticlesOuverts((v) => !v)}
                        disabled={nbArticles === 0}
                        aria-expanded={articlesOuverts}
                        className="flex items-center justify-between gap-3 w-full text-left disabled:cursor-default"
                    >
                        <span className="text-[13px] text-ink-500">Articles</span>
                        <span className="flex items-center gap-1 text-[13px] font-semibold text-ink-900 tabular-nums">
                            {nbArticles} article{nbArticles > 1 ? "s" : ""}
                            {nbArticles > 0 && (
                                <ChevronDown size={14} className={`text-ink-400 transition-transform ${articlesOuverts ? "rotate-180" : ""}`} />
                            )}
                        </span>
                    </button>

                    {articlesOuverts && nbArticles > 0 && (
                        <div className="grid gap-2.5 mt-2.5">
                            {colis.articlesValides.map((a, i) => (
                                <div key={i} className={`flex gap-2.5 pb-2.5 ${i < nbArticles - 1 ? "border-b border-ink-100" : ""}`}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12.5px] font-semibold text-ink-800 leading-snug">
                                            {a.nom || "Article sans nom"}
                                        </p>
                                        {a.variante && (
                                            <p className="text-[11px] text-ink-400 mt-0.5">{a.variante}</p>
                                        )}
                                        {a.boutique && (
                                            <p className="text-[10.5px] text-ink-300 mt-0.5">{a.boutique}</p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[12.5px] font-semibold text-ink-900 tabular-nums">
                                            {money(a.prixUnitaire, colis.devise)}
                                            {a.quantite > 1 && <span className="text-ink-400 font-normal"> × {a.quantite}</span>}
                                        </p>
                                        {a.prixOriginal != null && a.prixOriginal > a.prixUnitaire && (
                                            <p className="text-[10.5px] text-ink-300 line-through tabular-nums">
                                                {money(a.prixOriginal, colis.devise)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <dl className="grid gap-2.5 m-0 mt-2.5">
                        {poids != null && (
                            <div className="flex items-center justify-between gap-3">
                                <dt className="flex items-center gap-1.5 text-[13px] text-ink-500">
                                    <Scale size={14} /> Poids réel
                                </dt>
                                <dd className="text-[13px] font-semibold text-ink-900 m-0 tabular-nums">{poids} kg</dd>
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-3">
                            <dt className="text-[13px] text-ink-500">Commande créée le</dt>
                            <dd className="text-[13px] font-semibold text-ink-900 m-0 tabular-nums">
                                {dateHeure(colis.createdAt)}
                            </dd>
                        </div>
                    </dl>

                    {montantTotalFCFA != null && (
                        <div className="mt-3.5 pt-3.5 border-t border-ink-100 flex items-baseline justify-between gap-3">
                            <span className="text-[13px] font-semibold text-ink-700">Montant total</span>
                            <span className="rs-money text-[20px]">{fcfa(montantTotalFCFA)}</span>
                        </div>
                    )}
                </div>

                {/* ── Reçu d'achat ───────────────────────────────────────────
                    Généré automatiquement à partir des données du colis
                    (comme la facture des commandes classiques) — visible dès
                    que l'achat chez SHEIN a eu lieu. */}
                {STATUT_ORDER.indexOf("achete") !== -1 && indexActuel >= STATUT_ORDER.indexOf("achete") && (
                    <div className="rs-card flex items-center gap-3">
                        <div className="w-11 h-11 shrink-0 rounded-full bg-ramses-50 flex items-center justify-center">
                            <Package2 size={19} className="text-ramses-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-bold text-ink-900">Reçu d'achat SHEIN</p>
                            <p className="text-[12px] text-ink-500 mt-0.5">Détail des articles achetés</p>
                        </div>
                        <ColisSheinReceiptButton colis={colis} />
                    </div>
                )}

                {/* ── Suivi ──────────────────────────────────────────────── */}
                {/* Une seule frise. L'écran d'origine en affichait deux qui
                    parcouraient la même liste d'étapes : « Étapes du colis » et
                    « Suivi détaillé » répétaient les mêmes jalons, l'une sans
                    description, l'autre avec. Celle-ci les remplace toutes deux.
                    Masquée si annulé : "annule" ne fait pas partie du parcours
                    normal, la frise n'aurait aucun jalon cohérent à montrer. */}
                {colis.statut !== "annule" && (
                <div className="rs-card">
                    <p className="rs-label text-ink-400 mb-4">Suivi</p>

                    {ETAPES_PRINCIPALES.map((cle, i) => {
                        const idxEtape = STATUT_ORDER.indexOf(cle);
                        const fait = idxEtape !== -1 && idxEtape < indexActuel;
                        const enCours = idxEtape === indexActuel;
                        const date = dateEtape(cle);
                        const dernier = i === ETAPES_PRINCIPALES.length - 1;

                        return (
                            <div
                                key={cle}
                                className={`rs-step ${fait ? "rs-step--done" : ""} ${enCours ? "rs-step--now" : ""}`}
                            >
                                <div className="rs-step__rail">
                                    <span className="rs-step__dot" />
                                    {!dernier && <span className="rs-step__line" />}
                                </div>

                                <div className={dernier ? "" : "flex-1 min-w-0"}>
                                    <div className="rs-step__label">
                                        {STATUT_LABELS[cle]}
                                        {date && (
                                            <span className="block text-[11px] font-normal text-ink-400 mt-0.5 tabular-nums">
                                                {dateHeure(date)}
                                            </span>
                                        )}
                                        {(fait || enCours) && (
                                            <span className="block text-[12px] font-normal text-ink-500 mt-1 leading-relaxed">
                                                {STATUT_DESCRIPTIONS[cle]}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                )}

                {/* ── Accès à la conversation ────────────────────────────── */}
                {/* La carte « Besoin d'aide ? » d'origine portait une icône de chat
                    mais n'était pas cliquable, et un second bouton « Voir la
                    conversation » la doublait juste en dessous. Les deux sont
                    fusionnés en un seul point d'entrée. */}
                <Link
                    to={`/colis-shein/${id}`}
                    className="rs-card flex items-center gap-3 no-underline transition active:scale-[.99] hover:border-ink-200"
                >
                    <div className="w-11 h-11 shrink-0 rounded-full bg-ramses-50 flex items-center justify-center">
                        <MessageCircle size={19} className="text-ramses-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-ink-900">
                            {clos ? "Voir la conversation" : "Une question ?"}
                        </p>
                        <p className="text-[12px] text-ink-500 mt-0.5">
                            {clos
                                ? "L'historique reste consultable."
                                : "Votre agent vous répond directement dans la conversation."}
                        </p>
                    </div>
                    <ChevronRight size={18} className="text-ink-300 shrink-0" />
                </Link>
            </div>
        </div>
    );
};

export default ColisSheinDetailPage;