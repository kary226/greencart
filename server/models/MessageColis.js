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
    pese: "Paiement attendu",
    solde_du: "Paiement attendu",
    solde_paye: "Livraison payée",
    en_livraison: "En livraison",
    livre: "Livré",
    annule: "Annulé",
};

// Une couleur de statut par famille d'état, pour que l'œil retrouve vite
// "il y a une action à faire" (rouge/orange) vs "ça avance" (vert) vs "clos" (gris).
const STATUT_STYLE = {
    soumis: "mcs-pill-attente",
    en_verification: "mcs-pill-attente",
    devis_envoye: "mcs-pill-devis",
    acompte_paye: "mcs-pill-ok",
    achete: "mcs-pill-ok",
    en_entrepot: "mcs-pill-ok",
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

const MesColisShein = () => {
    const { axios, user } = useAppContext();
    const [colisListe, setColisListe] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtre, setFiltre] = useState("tous"); // tous | actifs | clos

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

    const listeAffichee = colisListe.filter((c) => {
        if (filtre === "actifs") return !estFerme(c);
        if (filtre === "clos") return estFerme(c);
        return true;
    });

    return (
        <div className="mcs-page">
            <div className="mcs-header">
                <div>
                    <h1>Mes colis SHEIN</h1>
                    <p className="mcs-subtitle">Tous vos échanges avec nos agents.</p>
                </div>
                <Link to="/valider-panier-shein" className="mcs-new-btn">+ Nouveau</Link>
            </div>

            {!loading && colisListe.length > 0 && (
                <div className="mcs-filters">
                    <button className={`mcs-filter-tab ${filtre === "tous" ? "active" : ""}`} onClick={() => setFiltre("tous")}>
                        Tous <span className="mcs-filter-count">{compteurs.tous}</span>
                    </button>
                    <button className={`mcs-filter-tab ${filtre === "actifs" ? "active" : ""}`} onClick={() => setFiltre("actifs")}>
                        Actifs <span className="mcs-filter-count">{compteurs.actifs}</span>
                    </button>
                    <button className={`mcs-filter-tab ${filtre === "clos" ? "active" : ""}`} onClick={() => setFiltre("clos")}>
                        Clos <span className="mcs-filter-count">{compteurs.clos}</span>
                    </button>
                </div>
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
            ) : (
                listeAffichee.map((c) => {
                    const ferme = estFerme(c);
                    return (
                        <Link key={c._id} to={`/colis-shein/${c._id}`} className={`mcs-card ${ferme ? "mcs-card-ferme" : "mcs-card-active"}`}>
                            <div className="mcs-card-icon">
                                {ferme ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="10" rx="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                ) : (
                                    <>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
                                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                        </svg>
                                        {c.nonLuClient && <span className="mcs-icon-dot" />}
                                    </>
                                )}
                            </div>
                            <div className="mcs-card-body">
                                <div className="mcs-card-top">
                                    <span className="mcs-numero">{c.numeroSuivi}</span>
                                    <span className="mcs-temps">{tempsEcoule(c.updatedAt)}</span>
                                </div>
                                <span className={`mcs-pill ${STATUT_STYLE[c.statut] || "mcs-pill-attente"}`}>
                                    {STATUT_LABELS[c.statut] || c.statut}
                                </span>
                                <p className="mcs-derniere-activite">Agent · {STATUT_LABELS[c.statut] || "Mise à jour du colis"}</p>
                                <div className="mcs-card-bottom">
                                    <span className="mcs-articles-count">{c.articlesValides?.length || 0} article(s)</span>
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
                            {c.nonLuClient && !ferme && <span className="mcs-badge-nonlu">1</span>}
                        </Link>
                    );
                })
            )}

            <style>{`
        .mcs-page { max-width: 480px; margin: 0 auto; font-family: 'DM Sans', sans-serif; }

        .mcs-header { display: flex; align-items: flex-start; justify-content: space-between; margin: 18px 0 14px; gap: 12px; }
        .mcs-header h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 24px; font-weight: 600; color: #111; margin: 0; }
        .mcs-subtitle { font-size: 12.5px; color: #999; margin: 2px 0 0; }
        .mcs-new-btn { background: #111; color: #fff; text-decoration: none; font-size: 12.5px; font-weight: 600; padding: 9px 16px; border-radius: 40px; white-space: nowrap; flex-shrink: 0; transition: opacity .15s; }
        .mcs-new-btn:hover { opacity: .85; }
        .mcs-new-btn-big { display: inline-block; padding: 12px 24px; font-size: 13px; }

        .mcs-filters { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .mcs-filter-tab { display: flex; align-items: center; gap: 6px; background: #f7f5f2; border: none; border-radius: 40px; padding: 8px 14px; font-size: 12.5px; font-weight: 600; color: #999; cursor: pointer; transition: all .15s; }
        .mcs-filter-tab.active { background: #111; color: #fff; }
        .mcs-filter-count { background: rgba(0,0,0,0.08); color: inherit; font-size: 10.5px; font-weight: 700; border-radius: 10px; padding: 1px 6px; }
        .mcs-filter-tab.active .mcs-filter-count { background: rgba(255,255,255,0.2); }

        .mcs-loading { text-align: center; color: #999; font-size: 13px; padding: 40px 0; }

        .mcs-empty-state { text-align: center; padding: 50px 24px; }
        .mcs-empty-illustration { width: 84px; height: 84px; border-radius: 50%; background: #fdf1f0; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; }
        .mcs-empty-title { font-size: 15px; font-weight: 700; color: #111; margin: 0 0 6px; }
        .mcs-empty-text { font-size: 12.5px; color: #999; margin: 0 0 20px; line-height: 1.5; }

        .mcs-card { position: relative; display: flex; gap: 12px; background: #fff; border: 1px solid #f0ede8; border-radius: 16px; padding: 14px 16px; margin-bottom: 10px; text-decoration: none; transition: transform .12s, box-shadow .12s; overflow: hidden; }
        .mcs-card:active { transform: scale(0.985); }
        .mcs-card-active { border-left: 3px solid #e53935; box-shadow: 0 2px 10px rgba(17,17,17,0.04); }
        .mcs-card-ferme { opacity: .6; }

        .mcs-card-icon { position: relative; width: 40px; height: 40px; min-width: 40px; border-radius: 50%; background: #fdf1f0; display: flex; align-items: center; justify-content: center; }
        .mcs-card-ferme .mcs-card-icon { background: #f0ede8; }
        .mcs-icon-dot { position: absolute; top: -1px; right: -1px; width: 10px; height: 10px; border-radius: 50%; background: #e53935; border: 2px solid #fff; }

        .mcs-card-body { flex: 1; min-width: 0; }
        .mcs-card-top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 5px; }
        .mcs-numero { font-size: 13.5px; font-weight: 700; color: #111; }
        .mcs-temps { font-size: 10.5px; color: #bbb; white-space: nowrap; }

        .mcs-pill { display: inline-block; font-size: 10.5px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-bottom: 6px; }
        .mcs-pill-attente { background: #fdf1f0; color: #c62828; }
        .mcs-pill-devis { background: #fdecea; color: #e53935; }
        .mcs-pill-paiement { background: #fff4e0; color: #b7791f; }
        .mcs-pill-ok { background: #eef7f0; color: #2e7d32; }
        .mcs-pill-livraison { background: #e8f5e9; color: #2e7d32; }
        .mcs-pill-clos { background: #f0ede8; color: #888; }
        .mcs-pill-annule { background: #f5eaea; color: #a33; }

        .mcs-derniere-activite { font-size: 12px; color: #555; margin: 0 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .mcs-card-bottom { display: flex; align-items: center; justify-content: space-between; }
        .mcs-articles-count { font-size: 11px; color: #999; }
        .mcs-montant-bloc { display: flex; flex-direction: column; align-items: flex-end; }
        .mcs-montant { font-size: 13.5px; font-weight: 700; color: #111; }
        .mcs-montant-fcfa { font-size: 10.5px; color: #b7791f; margin-top: 1px; }

        .mcs-badge-nonlu { position: absolute; top: 14px; right: 14px; background: #e53935; color: #fff; font-size: 10.5px; font-weight: 700; min-width: 18px; height: 18px; border-radius: 9px; display: flex; align-items: center; justify-content: center; padding: 0 5px; }
      `}</style>
        </div>
    );
};

export default MesColisShein;