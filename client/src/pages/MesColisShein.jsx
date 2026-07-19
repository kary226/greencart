import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const STATUT_LABELS = {
    soumis: "En attente de vérification",
    en_verification: "En cours de vérification",
    devis_envoye: "Devis prêt",
    acompte_paye: "Acompte reçu",
    achete: "Acheté chez SHEIN",
    en_entrepot: "En entrepôt",
    pese: "Pesé — solde à régler",
    solde_du: "Solde à régler",
    solde_paye: "Solde réglé",
    en_livraison: "En livraison",
    livre: "Livré",
    annule: "Annulé",
};

const money = (n, devise) => `${devise === "EUR" ? "€" : "$"}${Number(n || 0).toFixed(2)}`;

const tempsEcoule = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "à l'instant";
    if (h < 24) return `il y a ${h}h`;
    const j = Math.floor(h / 24);
    return `il y a ${j}j`;
};

const MesColisShein = () => {
    const { axios, user } = useAppContext();
    const [colisListe, setColisListe] = useState([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="mcs-page">
            <div className="mcs-header">
                <h1>Mes colis SHEIN</h1>
                <Link to="/valider-panier-shein" className="mcs-new-btn">+ Nouveau</Link>
            </div>

            {loading ? (
                <p className="mcs-empty">Chargement…</p>
            ) : colisListe.length === 0 ? (
                <div className="mcs-empty-state">
                    <p>Aucun colis SHEIN pour l'instant.</p>
                    <Link to="/valider-panier-shein" className="mcs-new-btn">Valider mon premier panier</Link>
                </div>
            ) : (
                colisListe.map((c) => {
                    const ferme = c.statut === "livre" || c.statut === "annule";
                    return (
                        <Link key={c._id} to={`/colis-shein/${c._id}`} className={`mcs-card ${ferme ? "mcs-card-ferme" : ""}`}>
                            <div className="mcs-card-icon">
                                {ferme ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="10" rx="2"/>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
                                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                                    </svg>
                                )}
                            </div>
                            <div className="mcs-card-body">
                                <div className="mcs-card-top">
                                    <span className="mcs-numero">{c.numeroSuivi}</span>
                                    <span className="mcs-temps">{tempsEcoule(c.updatedAt)}</span>
                                </div>
                                <p className={`mcs-statut ${ferme ? "mcs-statut-ferme" : ""}`}>
                                    {STATUT_LABELS[c.statut] || c.statut}
                                </p>
                                <div className="mcs-card-bottom">
                                    <span className="mcs-articles-count">{c.articlesValides?.length || 0} article(s)</span>
                                    {c.devis?.montantArticles > 0 && (
                                        <span className="mcs-montant">{money(c.devis.montantArticles, c.devise)}</span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                })
            )}

            <style>{`
        .mcs-page { max-width: 480px; margin: 0 auto; font-family: 'DM Sans', sans-serif; }
        .mcs-header { display: flex; align-items: center; justify-content: space-between; margin: 16px 0; }
        .mcs-header h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; font-weight: 600; color: #111; margin: 0; }
        .mcs-new-btn { background: #111; color: #fff; text-decoration: none; font-size: 12.5px; font-weight: 600; padding: 8px 14px; border-radius: 40px; white-space: nowrap; }
        .mcs-empty { text-align: center; color: #999; font-size: 13px; padding: 40px 0; }
        .mcs-empty-state { text-align: center; padding: 50px 20px; color: #999; }
        .mcs-empty-state p { margin-bottom: 16px; font-size: 13.5px; }
        .mcs-card { display: flex; gap: 12px; background: #fff; border: 1px solid #f0ede8; border-radius: 14px; padding: 14px; margin-bottom: 10px; text-decoration: none; }
        .mcs-card-ferme { opacity: .65; }
        .mcs-card-icon { width: 38px; height: 38px; min-width: 38px; border-radius: 50%; background: #fdf1f0; display: flex; align-items: center; justify-content: center; }
        .mcs-card-ferme .mcs-card-icon { background: #f7f5f2; }
        .mcs-card-body { flex: 1; min-width: 0; }
        .mcs-card-top { display: flex; align-items: center; justify-content: space-between; }
        .mcs-numero { font-size: 13px; font-weight: 700; color: #111; }
        .mcs-temps { font-size: 11px; color: #bbb; }
        .mcs-statut { font-size: 12.5px; color: #e53935; font-weight: 600; margin: 3px 0 6px; }
        .mcs-statut-ferme { color: #999; font-weight: 500; }
        .mcs-card-bottom { display: flex; align-items: center; justify-content: space-between; }
        .mcs-articles-count { font-size: 11.5px; color: #999; }
        .mcs-montant { font-size: 13px; font-weight: 700; color: #111; }
      `}</style>
        </div>
    );
};

export default MesColisShein;