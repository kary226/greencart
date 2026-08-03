import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { Search, SlidersHorizontal, Package, PackageCheck, Plus } from "lucide-react";

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

// Palette de statut, alignée sur burgundy/blush/ivory plutôt que le rouge générique d'origine
const STATUT_STYLE = {
    soumis: "bg-blush-100 text-burgundy-700",
    en_verification: "bg-blush-100 text-burgundy-700",
    devis_envoye: "bg-ivory-500/60 text-ivory-900",
    acompte_paye: "bg-emerald-50 text-emerald-700",
    achete: "bg-emerald-50 text-emerald-700",
    en_entrepot: "bg-emerald-50 text-emerald-700",
    arrive_abidjan: "bg-blush-200 text-burgundy-700",
    pese: "bg-ivory-500/60 text-ivory-900",
    solde_du: "bg-ivory-500/60 text-ivory-900",
    solde_paye: "bg-emerald-50 text-emerald-700",
    en_livraison: "bg-blush-200 text-burgundy-700",
    livre: "bg-gray-100 text-gray-500",
    annule: "bg-gray-100 text-gray-400",
};

const money = (n, devise) => `${devise === "EUR" ? "€" : "$"}${Number(n || 0).toFixed(2)}`;
const fcfa = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

const tempsEcoule = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) {
        const m = Math.max(1, Math.floor(diff / 60000));
        return `il y a ${m} min`;
    }
    if (h < 24) return `il y a ${h}h`;
    const j = Math.floor(h / 24);
    if (j === 1) return "hier";
    return `il y a ${j}j`;
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

    return (
        <div className="max-w-lg mx-auto px-4 sm:px-6 pb-10">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pt-6 pb-5">
                <div>
                    <h1 className="font-display text-2xl font-semibold text-gray-900 flex items-center gap-1.5">
                        Bienvenue{prenom ? `, ${prenom}` : ""} <span className="text-xl">👋</span>
                    </h1>
                    <p className="text-[13px] text-gray-400 mt-0.5">Tous vos échanges avec nos agents.</p>
                </div>
                <Link
                    to="/valider-panier-shein"
                    className="shrink-0 flex items-center gap-1.5 bg-burgundy-600 text-white text-xs font-semibold px-4 py-2.5 rounded-full whitespace-nowrap shadow-sm shadow-burgundy-600/30 hover:bg-burgundy-700 transition"
                >
                    <Plus size={14} /> Nouveau
                </Link>
            </div>

            {/* Recherche */}
            <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 flex items-center gap-2 bg-blush-50 rounded-full px-4 py-2.5">
                    <Search size={16} className="text-gray-400 shrink-0" />
                    <input
                        value={recherche}
                        onChange={(e) => setRecherche(e.target.value)}
                        placeholder="Rechercher une conversation…"
                        className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
                    />
                </div>
                <button
                    type="button"
                    className="shrink-0 w-10 h-10 rounded-full bg-blush-50 flex items-center justify-center text-gray-500 hover:bg-blush-100 transition"
                    aria-label="Filtrer"
                >
                    <SlidersHorizontal size={15} />
                </button>
            </div>

            {/* Onglets filtre */}
            <div className="flex items-center gap-1 bg-blush-50 rounded-full p-1 mb-5">
                {onglets.map((o) => (
                    <button
                        key={o.key}
                        onClick={() => setFiltre(o.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition ${
                            filtre === o.key
                                ? "bg-white text-burgundy-700 shadow-sm"
                                : "text-gray-400 hover:text-gray-600"
                        }`}
                    >
                        {o.label}
                        <span
                            className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[16px] text-center ${
                                filtre === o.key ? "bg-burgundy-600 text-white" : "bg-black/5 text-gray-500"
                            }`}
                        >
                            {o.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Contenu */}
            {loading ? (
                <p className="text-center text-sm text-gray-400 py-10">Chargement…</p>
            ) : colisListe.length === 0 ? (
                <div className="text-center px-6 py-14">
                    <div className="w-20 h-20 rounded-full bg-blush-100 flex items-center justify-center mx-auto mb-4">
                        <Package size={32} className="text-burgundy-400" />
                    </div>
                    <p className="text-[15px] font-semibold text-gray-900 mb-1.5">Aucun colis SHEIN pour l'instant</p>
                    <p className="text-[13px] text-gray-400 mb-5 leading-relaxed">
                        Lorsque vous validerez un panier, une conversation avec votre agent apparaîtra ici.
                    </p>
                    <Link
                        to="/valider-panier-shein"
                        className="inline-flex items-center gap-2 bg-burgundy-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-burgundy-700 transition"
                    >
                        Valider mon premier panier
                    </Link>
                </div>
            ) : listeAffichee.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">Aucun résultat pour cette recherche.</p>
            ) : (
                <div className="space-y-2.5">
                    {listeAffichee.map((c) => {
                        const ferme = estFerme(c);
                        return (
                            <Link
                                key={c._id}
                                to={`/colis-shein/${c._id}`}
                                className={`relative flex gap-3 bg-white border border-blush-100 rounded-2xl pl-5 pr-4 py-3.5 overflow-hidden transition active:scale-[0.985] ${
                                    ferme ? "opacity-60" : "shadow-sm shadow-black/[0.03]"
                                }`}
                            >
                                <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-r-full ${ferme ? "bg-gray-200" : "bg-burgundy-600"}`} />

                                <div className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center ${ferme ? "bg-gray-100" : "bg-blush-100"}`}>
                                    {ferme ? <PackageCheck size={18} className="text-gray-400" /> : <Package size={18} className="text-burgundy-600" />}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[13.5px] font-bold text-gray-900">{c.numeroSuivi}</span>
                                        <span className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-[10.5px] text-gray-300 whitespace-nowrap">{tempsEcoule(c.updatedAt)}</span>
                                            {c.nonLuClient && !ferme && <span className="w-1.5 h-1.5 rounded-full bg-burgundy-600" />}
                                        </span>
                                    </div>

                                    <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2.5 py-1 rounded-full mb-1.5 ${STATUT_STYLE[c.statut] || "bg-blush-100 text-burgundy-700"}`}>
                                        <span className="w-1 h-1 rounded-full bg-current" />
                                        {STATUT_LABELS[c.statut] || c.statut}
                                    </span>

                                    <p className="text-xs text-gray-500 truncate mb-2">
                                        Agent · {STATUT_LABELS[c.statut] || "Mise à jour du colis"}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
                                            <Package size={12} /> {c.articlesValides?.length || 0} article(s)
                                        </span>
                                        {c.devis?.montantArticles > 0 && (
                                            <span className="flex flex-col items-end">
                                                <span className="text-sm font-bold text-gray-900">{money(c.devis.montantArticles, c.devise)}</span>
                                                {c.devis?.montantArticlesFCFA != null && (
                                                    <span className="text-[10.5px] text-burgundy-600 mt-0.5">≈ {fcfa(c.devis.montantArticlesFCFA)}</span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MesColisShein;