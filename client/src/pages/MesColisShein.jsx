import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

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

const STATUT_STYLE = {
    soumis: "mcs-pill-attente",
    en_verification: "mcs-pill-attente",
    devis_envoye: "mcs-pill-devis",
    acompte_paye: "mcs-pill-ok",
    achete: "mcs-pill-ok",
    en_entrepot: "mcs-pill-ok",
    arrive_abidjan: "mcs-pill-livraison",
    pese: "mcs-pill-paiement",
    solde_du: "mcs-pill-paiement",
    solde_paye: "mcs-pill-ok",
    en_livraison: "mcs-pill-livraison",
    livre: "mcs-pill-clos",
    annule: "mcs-pill-annule",
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

const IconCoeur = ({ className }) => (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21s-6.7-4.35-9.3-8.1C1 10.2 1.8 6.6 5 5.2c2.1-.9 4.3-.1 5.6 1.6C11.9 5.1 14.1 4.3 16.2 5.2c3.2 1.4 4 5 2.3 7.7C15.9 16.65 12 21 12 21z" />
    </svg>
);
const IconHorloge = ({ className }) => (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
    </svg>
);
const IconClos = ({ className }) => (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="8" width="18" height="12" rx="2" /><path d="M3 8l2-4h14l2 4" /><path d="M10 12h4" />
    </svg>
);
const IconRecherche = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2">
        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
);
const IconFiltre = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
        <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
);
const IconPlus = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
        <path d="M12 5v14M5 12h14" />
    </svg>
);
const IconBoite = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2">
        <path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" />
    </svg>
);

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

    return (
        <div className="mcs-page">
            <div className="mcs-header">
                <div>
                    <h1>Bonjour{prenom ? `, ${prenom}` : ""} <span className="mcs-wave">👋</span></h1>
                    <p className="mcs-subtitle">Tous vos échanges avec nos agents.</p>
                </div>
                <Link to="/valider-panier-shein" className="mcs-new-btn"><IconPlus /> Nouveau</Link>
            </div>

            {!loading && colisListe.length > 0 && (
                <>
                    <div className="mcs-search-row">
                        <div className="mcs-search-box">
                            <IconRecherche />
                            <input
                                type="text"
                                placeholder="Rechercher un colis, une conversation..."
                                value={recherche}
                                onChange={(e) => setRecherche(e.target.value)}
                            />
                        </div>
                        <button className="mcs-filtre-btn" aria-label="Filtrer"><IconFiltre /></button>
                    </div>

                    <div className="mcs-filters">
                        <button className={`mcs-filter-tab ${filtre === "tous" ? "active" : ""}`} onClick={() => setFiltre("tous")}>
                            <IconCoeur className="mcs-tab-icon" /> Tous <span className="mcs-filter-count">{compteurs.tous}</span>
                        </button>
                        <button className={`mcs-filter-tab ${filtre === "actifs" ? "active" : ""}`} onClick={() => setFiltre("actifs")}>
                            <IconHorloge className="mcs-tab-icon" /> Actifs <span className="mcs-filter-count">{compteurs.actifs}</span>
                        </button>
                        <button className={`mcs-filter-tab ${filtre === "clos" ? "active" : ""}`} onClick={() => setFiltre("clos")}>
                            <IconClos className="mcs-tab-icon" /> Clos <span className="mcs-filter-count">{compteurs.clos}</span>
                        </button>
                    </div>
                </>
            )}

            {loading ? (
                <p className="mcs-loading">Chargement…</p>
            ) : colisListe.length === 0 ? (
                <div className="mcs-empty-state">
                    <div className="mcs-empty-illustration">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="1.6">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                    </div>
                    <p className="mcs-empty-title">Aucun colis SHEIN pour l'instant</p>
                    <p className="mcs-empty-text">Lorsque vous validerez un panier, une conversation avec votre agent apparaîtra ici.</p>
                    <Link to="/valider-panier-shein" className="mcs-new-btn mcs-new-btn-big">Valider mon premier panier</Link>
                </div>
            ) : listeAffichee.length === 0 ? (
                <p className="mcs-loading">Aucun résultat pour cette recherche.</p>
            ) : (
                listeAffichee.map((c) => {
                    const ferme = estFerme(c);
                    return (
                        <Link key={c._id} to={`/colis-shein/${c._id}`} className={`mcs-card ${ferme ? "mcs-card-ferme" : "mcs-card-active"}`}>
                            <span className="mcs-card-bar" />
                            <div className="mcs-card-icon">
                                {ferme ? (
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                ) : (
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                )}
                            </div>
                            <div className="mcs-card-body">
                                <div className="mcs-card-top">
                                    <span className="mcs-numero">{c.numeroSuivi}</span>
                                    <span className="mcs-card-top-right">
                                        <span className="mcs-temps">{tempsEcoule(c.updatedAt)}</span>
                                        {c.nonLuClient && !ferme && <span className="mcs-icon-dot" />}
                                        <span className="mcs-menu-dots">⋮</span>
                                    </span>
                                </div>
                                <span className={`mcs-pill ${STATUT_STYLE[c.statut] || "mcs-pill-attente"}`}>
                                    <span className="mcs-pill-dot" /> {STATUT_LABELS[c.statut] || c.statut}
                                </span>
                                <p className="mcs-derniere-activite">Agent · {STATUT_LABELS[c.statut] || "Mise à jour du colis"}</p>
                                <div className="mcs-card-bottom">
                                    <span className="mcs-articles-count"><IconBoite /> {c.articlesValides?.length || 0} article(s)</span>
                                    {c.devis?.montantArticles > 0 && (
                                        <span className="mcs-montant-bloc">
                                            <span className="mcs-montant">{money(c.devis.montantArticles, c.devise)}</span>
                                            {c.devis?.montantArticlesFCFA != null && (
                                                <span className="mcs-montant-fcfa">≈ {fcfa(c.devis.montantArticlesFCFA)}</span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                })
            )}

            <style>{`
        .mcs-page { max-width: 480px; margin: 0 auto; font-family: 'DM Sans', sans-serif; padding-bottom: 24px; }

        .mcs-header { display: flex; align-items: flex-start; justify-content: space-between; margin: 18px 0 16px; gap: 12px; }
        .mcs-header h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 24px; font-weight: 600; color: #111; margin: 0; display: flex; align-items: center; gap: 6px; }
        .mcs-wave { font-size: 20px; display: inline-block; animation: mcs-wave-anim 2.2s ease-in-out infinite; transform-origin: 70% 70%; }
        @keyframes mcs-wave-anim { 0%,100% { transform: rotate(0deg); } 10% { transform: rotate(14deg); } 20% { transform: rotate(-8deg); } 30% { transform: rotate(14deg); } 40% { transform: rotate(-4deg); } 50% { transform: rotate(10deg); } 60% { transform: rotate(0deg); } }
        .mcs-subtitle { font-size: 12.5px; color: #999; margin: 2px 0 0; }
        .mcs-new-btn { display: flex; align-items: center; gap: 6px; background: #e53935; color: #fff; text-decoration: none; font-size: 12.5px; font-weight: 700; padding: 10px 18px; border-radius: 40px; white-space: nowrap; flex-shrink: 0; transition: opacity .15s, transform .1s; box-shadow: 0 4px 14px rgba(229,57,53,0.28); }
        .mcs-new-btn:hover { opacity: .9; }
        .mcs-new-btn:active { transform: scale(0.97); }
        .mcs-new-btn-big { display: inline-flex; padding: 12px 24px; font-size: 13px; }

        .mcs-search-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
        .mcs-search-box { flex: 1; display: flex; align-items: center; gap: 8px; background: #f7f5f2; border-radius: 40px; padding: 11px 16px; }
        .mcs-search-box input { flex: 1; border: none; background: none; outline: none; font-size: 13px; color: #333; font-family: inherit; }
        .mcs-search-box input::placeholder { color: #bbb; }
        .mcs-filtre-btn { flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; border: none; background: #f7f5f2; display: flex; align-items: center; justify-content: center; cursor: pointer; }

        .mcs-filters { display: flex; align-items: center; gap: 4px; margin-bottom: 18px; background: #f7f5f2; border-radius: 40px; padding: 4px; }
        .mcs-filter-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; background: none; border: none; border-radius: 36px; padding: 9px 10px; font-size: 12px; font-weight: 700; color: #999; cursor: pointer; transition: all .15s; }
        .mcs-tab-icon { flex-shrink: 0; opacity: .7; }
        .mcs-filter-tab.active { background: #fff; color: #e53935; box-shadow: 0 2px 8px rgba(17,17,17,0.06); }
        .mcs-filter-tab.active .mcs-tab-icon { opacity: 1; color: #e53935; }
        .mcs-filter-count { background: rgba(0,0,0,0.06); color: inherit; font-size: 10px; font-weight: 700; border-radius: 10px; padding: 1px 6px; min-width: 15px; text-align: center; }
        .mcs-filter-tab.active .mcs-filter-count { background: #e53935; color: #fff; }

        .mcs-loading { text-align: center; color: #999; font-size: 13px; padding: 40px 0; }

        .mcs-empty-state { text-align: center; padding: 50px 24px; }
        .mcs-empty-illustration { width: 84px; height: 84px; border-radius: 50%; background: #fdf1f0; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; }
        .mcs-empty-title { font-size: 15px; font-weight: 700; color: #111; margin: 0 0 6px; }
        .mcs-empty-text { font-size: 12.5px; color: #999; margin: 0 0 20px; line-height: 1.5; }

        .mcs-card { position: relative; display: flex; gap: 12px; background: #fff; border: 1px solid #f0ede8; border-radius: 16px; padding: 14px 16px 14px 20px; margin-bottom: 10px; text-decoration: none; transition: transform .12s, box-shadow .12s; overflow: hidden; }
        .mcs-card:active { transform: scale(0.985); }
        .mcs-card-active { box-shadow: 0 2px 12px rgba(17,17,17,0.05); }
        .mcs-card-ferme { opacity: .6; }
        .mcs-card-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #e53935; border-radius: 0 4px 4px 0; }
        .mcs-card-ferme .mcs-card-bar { background: #e2ddd3; }

        .mcs-card-icon { width: 42px; height: 42px; min-width: 42px; border-radius: 50%; background: #fdf1f0; display: flex; align-items: center; justify-content: center; }
        .mcs-card-ferme .mcs-card-icon { background: #f0ede8; }

        .mcs-card-body { flex: 1; min-width: 0; }
        .mcs-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .mcs-numero { font-size: 13.5px; font-weight: 700; color: #111; }
        .mcs-card-top-right { display: flex; align-items: center; gap: 6px; }
        .mcs-temps { font-size: 10.5px; color: #bbb; white-space: nowrap; }
        .mcs-icon-dot { width: 7px; height: 7px; border-radius: 50%; background: #e53935; flex-shrink: 0; }
        .mcs-menu-dots { font-size: 14px; color: #ccc; line-height: 1; padding: 0 2px; }

        .mcs-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-bottom: 6px; }
        .mcs-pill-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
        .mcs-pill-attente { background: #fdf1f0; color: #c62828; }
        .mcs-pill-devis { background: #fdecea; color: #e53935; }
        .mcs-pill-paiement { background: #fff4e0; color: #b7791f; }
        .mcs-pill-ok { background: #eef7f0; color: #2e7d32; }
        .mcs-pill-livraison { background: #e8f5e9; color: #2e7d32; }
        .mcs-pill-clos { background: #f0ede8; color: #888; }
        .mcs-pill-annule { background: #f5eaea; color: #a33; }

        .mcs-derniere-activite { font-size: 12px; color: #555; margin: 0 0 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .mcs-card-bottom { display: flex; align-items: center; justify-content: space-between; }
        .mcs-articles-count { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #999; }
        .mcs-montant-bloc { display: flex; flex-direction: column; align-items: flex-end; }
        .mcs-montant { font-size: 14px; font-weight: 700; color: #111; }
        .mcs-montant-fcfa { font-size: 10.5px; color: #e53935; margin-top: 1px; }
      `}</style>
        </div>
    );
};

export default MesColisShein;