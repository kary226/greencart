import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
import { ArrowLeft, Check, MessageCircle, Scale, Package2 } from "lucide-react";

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
    en_livraison: "Expédié",
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
    en_livraison: "Votre colis est en cours d'acheminement vers Abidjan.",
    livre: "Votre colis vous a été livré.",
};

const STATUT_ORDER = [
    "soumis", "en_verification", "devis_envoye", "acompte_paye",
    "achete", "en_entrepot", "pese", "solde_du", "solde_paye",
    "en_livraison", "livre",
];

// Étapes affichées dans le résumé condensé (6 jalons principaux, comme le mockup)
const ETAPES_PRINCIPALES = ["soumis", "en_verification", "devis_envoye", "achete", "en_livraison", "livre"];

const fcfa = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;
const dateHeure = (d) =>
    new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const ColisSheinDetailPage = () => {
    const { id } = useParams();
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [colis, setColis] = useState(null);
    const [loading, setLoading] = useState(true);

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
        return <div className="flex items-center justify-center py-24 text-sm text-gray-400">Chargement…</div>;
    }
    if (!colis) {
        return <div className="flex items-center justify-center py-24 text-sm text-gray-400">Colis introuvable</div>;
    }

    const indexActuel = STATUT_ORDER.indexOf(colis.statut);
    const nbArticles = colis.articlesValides?.length || 0;
    const poids = colis.devis?.poidsReel;
    const montantTotalFCFA =
        colis.devis?.montantFinal ??
        (colis.devis?.montantArticlesFCFA != null
            ? colis.devis.montantArticlesFCFA + (colis.devis.fraisLivraisonEstime || 0)
            : null);

    return (
        <div className="max-w-lg mx-auto pb-10">
            {/* Header */}
            <header className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-blush-100">
                <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700 transition" aria-label="Retour">
                    <ArrowLeft size={19} />
                </button>
                <h1 className="text-[15px] font-bold text-gray-900">Détails du colis</h1>
            </header>

            <div className="px-4 sm:px-6 pt-5 space-y-4">
                {/* Carte identité colis */}
                <div className="flex items-center gap-3 bg-white border border-blush-100 rounded-2xl p-4 shadow-sm shadow-black/[0.03]">
                    <div className="w-11 h-11 shrink-0 rounded-full bg-blush-100 flex items-center justify-center">
                        <Package2 size={18} className="text-burgundy-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900">Commande #{colis.numeroSuivi}</p>
                        <p className="text-xs text-gray-400">Créée le {dateHeure(colis.createdAt)}</p>
                    </div>
                </div>

                {/* Résumé */}
                <div className="bg-white border border-blush-100 rounded-2xl p-4 shadow-sm shadow-black/[0.03]">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Résumé</p>
                    <div className="space-y-2.5">
                        {poids != null && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1.5 text-gray-500"><Scale size={13} /> Poids réel</span>
                                <span className="font-semibold text-gray-900">{poids} kg</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Articles</span>
                            <span className="font-semibold text-gray-900">{nbArticles} article{nbArticles > 1 ? "s" : ""}</span>
                        </div>
                        {montantTotalFCFA != null && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Montant total</span>
                                <span className="font-semibold text-gray-900">{fcfa(montantTotalFCFA)}</span>
                            </div>
                        )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-blush-100">
                        <p className="text-xs text-gray-400 mb-1">Statut actuel</p>
                        <span className="inline-block text-xs font-bold text-burgundy-700 bg-blush-100 px-2.5 py-1 rounded-full">
                            {STATUT_LABELS[colis.statut] || colis.statut}
                        </span>
                        <p className="text-[11px] text-gray-300 mt-1.5">Mis à jour le {dateHeure(colis.updatedAt)}</p>
                    </div>
                </div>

                {/* Étapes du colis */}
                <div className="bg-white border border-blush-100 rounded-2xl p-4 shadow-sm shadow-black/[0.03]">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Étapes du colis</p>
                    <div className="space-y-3.5">
                        {ETAPES_PRINCIPALES.map((cle) => {
                            const idxEtape = STATUT_ORDER.indexOf(cle);
                            const fait = idxEtape !== -1 && idxEtape <= indexActuel;
                            const date = dateEtape(cle);
                            return (
                                <div key={cle} className="flex items-center gap-3">
                                    <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center ${fait ? "bg-emerald-500" : "bg-gray-200"}`}>
                                        {fait && <Check size={12} className="text-white" strokeWidth={3} />}
                                    </span>
                                    <span className={`flex-1 text-sm ${fait ? "text-gray-800 font-medium" : "text-gray-400"}`}>
                                        {STATUT_LABELS[cle]}
                                    </span>
                                    <span className="text-xs text-gray-300 shrink-0">
                                        {date ? dateHeure(date) : "—"}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Timeline détaillée avec descriptions (façon écran statut) */}
                <div className="bg-white border border-blush-100 rounded-2xl p-4 shadow-sm shadow-black/[0.03]">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Suivi détaillé</p>
                    <div className="relative pl-6">
                        <span className="absolute left-[9px] top-1 bottom-1 w-px bg-blush-200" />
                        {ETAPES_PRINCIPALES.map((cle) => {
                            const idxEtape = STATUT_ORDER.indexOf(cle);
                            const fait = idxEtape !== -1 && idxEtape < indexActuel;
                            const enCours = idxEtape === indexActuel;
                            const date = dateEtape(cle);
                            return (
                                <div key={cle} className="relative pb-5 last:pb-0">
                                    <span
                                        className={`absolute -left-6 top-0.5 w-[19px] h-[19px] rounded-full border-2 flex items-center justify-center ${
                                            fait
                                                ? "bg-emerald-500 border-emerald-500"
                                                : enCours
                                                ? "bg-white border-burgundy-500"
                                                : "bg-white border-gray-200"
                                        }`}
                                    >
                                        {fait && <Check size={10} className="text-white" strokeWidth={3} />}
                                        {enCours && <span className="w-1.5 h-1.5 rounded-full bg-burgundy-500" />}
                                    </span>
                                    <p className={`text-sm font-semibold ${fait || enCours ? "text-gray-900" : "text-gray-300"}`}>
                                        {STATUT_LABELS[cle]}
                                    </p>
                                    {date && <p className="text-[11px] text-gray-300 mb-0.5">{dateHeure(date)}</p>}
                                    <p className={`text-xs leading-relaxed ${fait || enCours ? "text-gray-500" : "text-gray-300"}`}>
                                        {STATUT_DESCRIPTIONS[cle]}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {colis.statut !== "livre" && colis.statut !== "annule" && (
                    <div className="bg-blush-50 border border-blush-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Besoin d'aide ?</p>
                            <p className="text-xs text-gray-500">Contactez votre assistant dans la conversation.</p>
                        </div>
                        <MessageCircle size={20} className="text-burgundy-500 shrink-0" />
                    </div>
                )}

                <Link
                    to={`/colis-shein/${id}`}
                    className="block text-center bg-white border border-burgundy-600 text-burgundy-700 font-semibold text-sm py-3 rounded-xl hover:bg-blush-50 transition"
                >
                    Voir la conversation
                </Link>
            </div>
        </div>
    );
};

export default ColisSheinDetailPage;