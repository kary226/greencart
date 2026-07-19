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

const MesColisShein = () => {
    const { axios, user } = useAppContext();
    const [colisListe, setColisListe] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        axios.get("/api/shein-cart/user")
            .then(({ data }) => { if (data.success) setColisListe(data.colis); })
            .finally(() => setLoading(false));
    }, [user]);

    return (
        <div className="mcs-page">
            <div className="mcs-header">
                <h1>Mes colis SHEIN</h1>
                <Link to="/valider-panier-shein" className="mcs-new-btn">+ Nouveau panier</Link>
            </div>

            {loading ? (
                <p className="mcs-empty">Chargement…</p>
            ) : colisListe.length === 0 ? (
                <div className="mcs-empty-state">
                    <p>Aucun colis SHEIN pour l'instant.</p>
                    <Link to="/valider-panier-shein" className="mcs-new-btn">Valider mon premier panier</Link>
                </div>
            ) : (
                colisListe.map((c) => (
                    <Link key={c._id} to={`/colis-shein/${c._id}`} className="mcs-card">
                        <div className="mcs-card-top">
                            <span className="mcs-numero">{c.numeroSuivi}</span>
                            <span className={`mcs-badge mcs-${c.statut}`}>{STATUT_LABELS[c.statut] || c.statut}</span>
                        </div>
                        <p className="mcs-articles-count">{c.articlesValides?.length || 0} article(s)</p>
                        {c.devis?.montantArticles > 0 && (
                            <p className="mcs-montant">{money(c.devis.montantArticles, c.devise)}</p>
                        )}
                    </Link>
                ))
            )}

            <style>{`
        .mcs-page { max-width: 480px; margin: 0 auto; font-family: 'DM Sans', sans-serif; }
        .mcs-header { display: flex; align-items: center; justify-content: space-between; margin: 16px 0; }
        .mcs-header h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; font-weight: 600; color: #111; margin: 0; }
        .mcs-new-btn { background: #111; color: #fff; text-decoration: none; font-size: 12.5px; font-weight: 600; padding: 8px 14px; border-radius: 40px; white-space: nowrap; }
        .mcs-empty { text-align: center; color: #999; font-size: 13px; padding: 40px 0; }
        .mcs-empty-state { text-align: center; padding: 50px 20px; color: #999; }
        .mcs-empty-state p { margin-bottom: 16px; font-size: 13.5px; }
        .mcs-card { display: block; background: #fff; border: 1px solid #f0ede8; border-radius: 14px; padding: 14px 16px; margin-bottom: 10px; text-decoration: none; }
        .mcs-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .mcs-numero { font-size: 13px; font-weight: 700; color: #111; }
        .mcs-badge { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; background: #f7f5f2; color: #666; }
        .mcs-badge.mcs-livre { background: #e8f5e9; color: #2e7d32; }
        .mcs-badge.mcs-annule { background: #fdecea; color: #c62828; }
        .mcs-articles-count { font-size: 12px; color: #999; margin: 0; }
        .mcs-montant { font-size: 14px; font-weight: 700; color: #e53935; margin: 4px 0 0; }
      `}</style>
        </div>
    );
};

export default MesColisShein;