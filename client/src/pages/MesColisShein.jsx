import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { Search, Package, PackageCheck, Plus, ChevronRight, X } from "lucide-react";

const STATUT_LABELS = {
    soumis: "En attente de vérification",
    en_verification: "En cours de vérification",
    devis_envoye: "Devis prêt",
    acompte_paye: "Articles payés",
    achete: "Acheté chez SHEIN",
    en_entrepot: "En entrepôt",
    arrive_abidjan: "Arrivé à Abidjan",
    pese: "Paiement attendu",
    solde_du: "Paiement attendu",
    solde_paye: "Livraison payée",
    en_livraison: "En livraison",
    livre: "Livré",
    annule: "Annulé",
};

// [DESIGN.md §4] Trois familles seulement : ce qui attend le client (warn),
// ce qui avance (info/neutral), ce qui est acquis (ok). Le rouge de marque
// n'est jamais un statut — il resterait en concurrence avec les boutons
// d'action, et un colis annulé n'est pas une alerte : c'est un dossier clos.
const STATUT_VARIANTE = {
    soumis: "info",
    en_verification: "info",
    devis_envoye: "warn",
    acompte_paye: "neutral",
    achete: "neutral",
    en_entrepot: "neutral",
    arrive_abidjan: "neutral",
    pese: "warn",
    solde_du: "warn",
    solde_paye: "neutral",
    en_livraison: "info",
    livre: "ok",
    annule: "done",
};

// Statuts où la balle est dans le camp du client : ils remontent en tête de
// carte avec le rail rouge, c'est la seule chose qu'il doit voir en scrollant.
const ATTEND_LE_CLIENT = new Set(["devis_envoye", "pese", "solde_du"]);

const money = (n, devise) => `${devise === "EUR" ? "€" : "$"}${Number(n || 0).toFixed(2)}`;
const fcfa = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

const tempsEcoule = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) {
        const m = Math.max(1, Math.floor(diff / 60000));
        return `il y a ${m} min`;
    }
    if (h < 24) return `il y a ${h} h`;
    const j = Math.floor(h / 24);
    if (j === 1) return "hier";
    return `il y a ${j} j`;
};

const MesColisShein = () => {
    const { axios, user } = useAppContext();
    const [colisListe, setColisListe] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtre, setFiltre] = useState("tous");
    const [recherche, setRecherche] = useState("");

    useEffect(() => {
        if (!user) return;
        axios.get("/api/shein-cart/user")
            .then(({ data }) => {
                if (data.success) {
                    const tries = [...data.colis].sort(
                        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
                    );
                    setColisListe(tries);
                }
            })
            .finally(() => setLoading(false));
    }, [user]);

    const estFerme = (c) => c.statut === "livre" || c.statut === "annule";

    const compteurs = useMemo(() => ({
        tous: colisListe.length,
        actifs: colisListe.filter((c) => !estFerme(c)).length,
        clos: colisListe.filter(estFerme).length,
    }), [colisListe]);

    const prenom = (user?.name || "").trim().split(" ")[0] || "";

    const listeAffichee = colisListe.filter((c) => {
        if (filtre === "actifs" && estFerme(c)) return false;
        if (filtre === "clos" && !estFerme(c)) return false;
        if (recherche.trim()) {
            const q = recherche.trim().toLowerCase();
            const matchNumero = c.numeroSuivi?.toLowerCase().includes(q);
            const matchArticle = c.articlesValides?.some((a) => a.nom?.toLowerCase().includes(q));
            if (!matchNumero && !matchArticle) return false;
        }
        return true;
    });

    const onglets = [
        { key: "tous", label: "Tous", count: compteurs.tous },
        { key: "actifs", label: "En cours", count: compteurs.actifs },
        { key: "clos", label: "Terminés", count: compteurs.clos },
    ];

    const nbAAction = colisListe.filter((c) => ATTEND_LE_CLIENT.has(c.statut)).length;

    return (
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-12">

            {/* ── En-tête ────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 pt-6 pb-5">
                <div className="min-w-0">
                    <h1 className="rs-display">
                        Mes colis{prenom ? <span className="text-ink-400 font-extrabold"> · {prenom}</span> : ""}
                    </h1>
                    <p className="text-[13px] text-ink-400 mt-1.5">
                        {nbAAction > 0
                            ? `${nbAAction} colis ${nbAAction > 1 ? "attendent" : "attend"} une action de votre part.`
                            : "Tous vos échanges avec nos agents."}
                    </p>
                </div>

                <Link to="/valider-panier-shein" className="rs-btn rs-btn--primary shrink-0">
                    <Plus size={16} /> Nouveau
                </Link>
            </div>

            {/* ── Recherche ──────────────────────────────────────────────── */}
            {/* Le bouton « Filtrer » d'origine n'avait aucun gestionnaire : il a été
                retiré plutôt que laissé en place. Les onglets ci-dessous couvrent
                déjà le filtrage, et un contrôle qui ne réagit pas est pire que pas
                de contrôle du tout. */}
            <div className="relative mb-3">
                <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                <input
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Numéro de suivi ou article…"
                    aria-label="Rechercher un colis"
                    className="rs-input rs-input--pill rs-input--icon-l rs-input--icon-r"
                />
                {recherche && (
                    <button
                        type="button"
                        onClick={() => setRecherche("")}
                        className="absolute right-1 top-1/2 -translate-y-1/2 rs-icon-btn"
                        aria-label="Effacer la recherche"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* ── Onglets ────────────────────────────────────────────────── */}
            <div className="flex items-center gap-1 bg-ink-50 rounded-full p-1 mb-5" role="tablist">
                {onglets.map((o) => {
                    const actif = filtre === o.key;
                    return (
                        <button
                            key={o.key}
                            role="tab"
                            aria-selected={actif}
                            onClick={() => setFiltre(o.key)}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-semibold transition ${
                                actif ? "bg-ink-0 text-ink-900 shadow-sm" : "text-ink-400 hover:text-ink-600"
                            }`}
                        >
                            {o.label}
                            <span
                                className={`text-[10px] font-extrabold rounded-full px-1.5 py-0.5 min-w-[18px] text-center tabular-nums ${
                                    actif ? "bg-ramses-600 text-white" : "bg-ink-100 text-ink-500"
                                }`}
                            >
                                {o.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Contenu ────────────────────────────────────────────────── */}
            {loading ? (
                <div className="flex flex-col items-center gap-3 py-16">
                    <div className="rs-typing"><span /><span /><span /></div>
                    <p className="text-[13px] text-ink-400">Chargement de vos colis…</p>
                </div>
            ) : colisListe.length === 0 ? (
                <div className="text-center px-6 py-14">
                    <div className="w-16 h-16 rounded-full bg-ramses-50 flex items-center justify-center mx-auto mb-4">
                        <Package size={26} className="text-ramses-600" />
                    </div>
                    <p className="rs-h2 mb-1.5">Aucun colis pour l'instant</p>
                    <p className="text-[13px] text-ink-400 mb-6 leading-relaxed max-w-[300px] mx-auto">
                        Validez un panier SHEIN et une conversation avec votre agent apparaîtra ici.
                    </p>
                    <Link to="/valider-panier-shein" className="rs-btn rs-btn--primary">
                        Valider mon premier panier
                    </Link>
                </div>
            ) : listeAffichee.length === 0 ? (
                <div className="text-center py-14 px-6">
                    <p className="rs-h2 mb-1.5">Aucun résultat</p>
                    <p className="text-[13px] text-ink-400 mb-5">
                        {recherche
                            ? <>Rien ne correspond à « {recherche} ».</>
                            : "Aucun colis dans cette catégorie."}
                    </p>
                    {recherche && (
                        <button onClick={() => setRecherche("")} className="rs-btn rs-btn--secondary">
                            Effacer la recherche
                        </button>
                    )}
                </div>
            ) : (
                <ul className="grid gap-3 list-none p-0 m-0">
                    {listeAffichee.map((c) => {
                        const ferme = estFerme(c);
                        const aAgir = ATTEND_LE_CLIENT.has(c.statut);
                        const nbArticles = c.articlesValides?.length || 0;

                        return (
                            <li key={c._id}>
                                <Link
                                    to={`/colis-shein/${c._id}`}
                                    className={`rs-card ${aAgir ? "rs-card--action" : ""} ${ferme ? "rs-card--muted" : ""} flex gap-3 items-start transition active:scale-[.99] hover:border-ink-200 no-underline`}
                                >
                                    <div className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center ${
                                        ferme ? "bg-ink-100" : aAgir ? "bg-ramses-50" : "bg-ink-50"
                                    }`}>
                                        {ferme
                                            ? <PackageCheck size={19} className="text-ink-400" />
                                            : <Package size={19} className={aAgir ? "text-ramses-600" : "text-ink-500"} />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-3 mb-2">
                                            <span className="text-[14px] font-extrabold text-ink-900 tracking-tight truncate">
                                                {c.numeroSuivi}
                                            </span>
                                            <span className="flex items-center gap-2 shrink-0">
                                                <span className="text-[11px] text-ink-400 whitespace-nowrap tabular-nums">
                                                    {tempsEcoule(c.updatedAt)}
                                                </span>
                                                {c.nonLuClient && !ferme && (
                                                    <span
                                                        className="w-2 h-2 rounded-full bg-ramses-600"
                                                        aria-label="Nouveau message non lu"
                                                    />
                                                )}
                                            </span>
                                        </div>

                                        {/* Le statut porte déjà l'information ; la ligne
                                            « Agent · <même statut> » d'origine la répétait
                                            mot pour mot et a été supprimée. */}
                                        <span className={`rs-badge rs-badge--${STATUT_VARIANTE[c.statut] || "neutral"}`}>
                                            {STATUT_LABELS[c.statut] || c.statut}
                                        </span>

                                        <div className="flex items-end justify-between gap-3 mt-3">
                                            <span className="flex items-center gap-1.5 text-[12px] text-ink-400">
                                                <Package size={13} />
                                                {nbArticles} article{nbArticles > 1 ? "s" : ""}
                                            </span>

                                            {c.devis?.montantArticles > 0 && (
                                                <span className="flex flex-col items-end leading-tight">
                                                    {/* Le FCFA passe devant : c'est la devise
                                                        dans laquelle le client paie réellement. */}
                                                    {c.devis?.montantArticlesFCFA != null ? (
                                                        <>
                                                            <span className="rs-money text-[15px]">
                                                                {fcfa(c.devis.montantArticlesFCFA)}
                                                            </span>
                                                            <span className="text-[11px] text-ink-400 mt-0.5 tabular-nums">
                                                                {money(c.devis.montantArticles, c.devise)}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="rs-money text-[15px]">
                                                            {money(c.devis.montantArticles, c.devise)}
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <ChevronRight size={18} className="text-ink-300 shrink-0 self-center" />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default MesColisShein;
