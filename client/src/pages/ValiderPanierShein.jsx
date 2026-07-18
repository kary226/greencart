import { useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const ValiderPanierShein = () => {
    const { axios, user, setShowUserLogin, navigate } = useAppContext();

    const [images, setImages] = useState([]);
    const [lienPartage, setLienPartage] = useState("");
    const [status, setStatus] = useState("idle"); // idle | analyzing | reviewing | submitting | submitted
    const [articles, setArticles] = useState([]);
    const [captures, setCaptures] = useState([]);
    const [totalAffiche, setTotalAffiche] = useState(null);

    const handleFiles = (fileList) => {
        const files = Array.from(fileList).map((f) => ({
            id: crypto.randomUUID(),
            file: f,
            url: URL.createObjectURL(f),
        }));
        setImages((prev) => [...prev, ...files]);
    };

    const removeImage = (id) => setImages((prev) => prev.filter((img) => img.id !== id));

    const analyser = async () => {
        if (!user) {
            setShowUserLogin(true);
            return;
        }
        if (images.length === 0) return;

        setStatus("analyzing");
        try {
            const formData = new FormData();
            images.forEach((img) => formData.append("captures", img.file));

            const { data } = await axios.post("/api/shein-cart/analyze", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            if (data.success) {
                setArticles(
                    data.articles.map((a) => ({ ...a, id: crypto.randomUUID() }))
                );
                setCaptures(data.captures);
                setTotalAffiche(data.totalAffiche);
                setStatus("reviewing");
            } else {
                toast.error(data.message || "Extraction impossible");
                setStatus("idle");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur pendant l'analyse");
            setStatus("idle");
        }
    };

    const updateArticle = (id, field, value) => {
        setArticles((prev) =>
            prev.map((a) => (a.id === id ? { ...a, [field]: value === "" ? "" : Number(value) } : a))
        );
    };

    const removeArticle = (id) => setArticles((prev) => prev.filter((a) => a.id !== id));

    const sousTotal = articles.reduce(
        (sum, a) => sum + (Number(a.prix_unitaire ?? a.prixUnitaire) || 0) * (Number(a.quantite) || 0),
        0
    );
    const ecartTotal = totalAffiche != null && Math.abs(sousTotal - totalAffiche) > 0.5;

    const soumettre = async () => {
        setStatus("submitting");
        try {
            const payload = {
                lienPartage,
                captures,
                articles: articles.map((a) => ({
                    boutique: a.boutique,
                    nom: a.nom,
                    variante: a.variante,
                    prixUnitaire: a.prix_unitaire ?? a.prixUnitaire,
                    prixOriginal: a.prix_original ?? a.prixOriginal ?? null,
                    quantite: a.quantite,
                })),
            };
            const { data } = await axios.post("/api/shein-cart/submit", payload);
            if (data.success) {
                toast.success("Panier soumis pour validation");
                setStatus("submitted");
            } else {
                toast.error(data.message || "Soumission impossible");
                setStatus("reviewing");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur pendant la soumission");
            setStatus("reviewing");
        }
    };

    return (
        <div className="vps-page">
            <h1 className="vps-title">Valider le panier SHEIN</h1>

            {status === "submitted" ? (
                <div className="vps-card vps-confirm">
                    <p className="vps-confirm-title">Panier soumis</p>
                    <p className="vps-confirm-text">
                        Un agent vérifie ton panier. Tu recevras ton devis sous peu.
                    </p>
                    <span className="vps-badge">En attente de vérification par un agent</span>
                    <button className="vps-btn-secondary" onClick={() => navigate("/my-orders")}>
                        Voir mes commandes
                    </button>
                </div>
            ) : (
                <>
                    <div className="vps-instruction">
                        Sélectionne <strong>« Tout »</strong> dans ton panier SHEIN et vérifie que le
                        total n'affiche pas <strong>$0.00</strong> avant de capturer l'écran.
                    </div>

                    <div className="vps-card">
                        <label className="vps-upload-zone">
                            <span className="vps-upload-label">Ajouter une capture</span>
                            <span className="vps-upload-sub">PNG ou JPG, plusieurs images acceptées</span>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                hidden
                                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                            />
                        </label>

                        {images.length > 0 && (
                            <div className="vps-thumbs">
                                {images.map((img) => (
                                    <div key={img.id} className="vps-thumb">
                                        <img src={img.url} alt="" />
                                        <button onClick={() => removeImage(img.id)} aria-label="Supprimer">
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <input
                            type="text"
                            placeholder="Lien de partage SHEIN (optionnel, pour référence)"
                            value={lienPartage}
                            onChange={(e) => setLienPartage(e.target.value)}
                            className="vps-link-input"
                        />

                        {images.length > 0 && status !== "reviewing" && (
                            <button
                                onClick={analyser}
                                disabled={status === "analyzing"}
                                className="vps-btn-primary"
                            >
                                {status === "analyzing" ? "Analyse en cours…" : "Analyser mon panier"}
                            </button>
                        )}
                    </div>

                    {status === "reviewing" && (
                        <div className="vps-results">
                            {ecartTotal && (
                                <div className="vps-warning">
                                    Le total calculé ({money(sousTotal)}) diffère du total affiché sur ton
                                    panier ({money(totalAffiche)}). Vérifie les quantités — l'agent confirmera
                                    à la validation.
                                </div>
                            )}

                            {articles.map((a) => (
                                <div key={a.id} className="vps-card vps-article">
                                    <div className="vps-article-info">
                                        <p className="vps-shop">{a.boutique}</p>
                                        <p className="vps-name">{a.nom}</p>
                                        <p className="vps-variant">{a.variante}</p>
                                        <div className="vps-fields">
                                            <label>
                                                Prix
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={a.prix_unitaire ?? a.prixUnitaire}
                                                    onChange={(e) => updateArticle(a.id, "prix_unitaire", e.target.value)}
                                                />
                                            </label>
                                            <label>
                                                Qté
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={a.quantite}
                                                    onChange={(e) => updateArticle(a.id, "quantite", e.target.value)}
                                                />
                                            </label>
                                            <span className="vps-line-total">
                                                {money((a.prix_unitaire ?? a.prixUnitaire) * a.quantite)}
                                            </span>
                                        </div>
                                    </div>
                                    <button className="vps-remove" onClick={() => removeArticle(a.id)} aria-label="Retirer">
                                        🗑
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {status === "reviewing" && (
                <div className="vps-sticky-bar">
                    <div className="vps-sticky-inner">
                        <div>
                            <p className="vps-total-label">Total estimé</p>
                            <p className="vps-total-value">{money(sousTotal)}</p>
                        </div>
                        <button
                            onClick={soumettre}
                            disabled={articles.length === 0 || status === "submitting"}
                            className="vps-btn-primary vps-submit"
                        >
                            {status === "submitting" ? "Envoi…" : "Soumettre pour validation"}
                        </button>
                    </div>
                </div>
            )}

            <style>{`
        .vps-page { max-width: 480px; margin: 0 auto; padding-bottom: 100px; font-family: 'DM Sans', sans-serif; }
        .vps-title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px; font-weight: 600; letter-spacing: 2px; color: #111; margin: 12px 0 16px; }
        .vps-instruction { background: #fdf1f0; border: 1px solid #f5d5d3; border-radius: 12px; padding: 10px 14px; font-size: 13.5px; color: #c62828; margin-bottom: 14px; }
        .vps-card { background: #fff; border: 1px solid #f0ede8; border-radius: 14px; padding: 14px; margin-bottom: 12px; }
        .vps-upload-zone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border: 2px dashed #e5e0d8; border-radius: 12px; padding: 28px 12px; cursor: pointer; transition: border-color .15s; }
        .vps-upload-zone:hover { border-color: #e53935; }
        .vps-upload-label { font-size: 14px; font-weight: 600; color: #111; }
        .vps-upload-sub { font-size: 12px; color: #999; }
        .vps-thumbs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
        .vps-thumb { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: #f7f5f2; }
        .vps-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .vps-thumb button { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,.6); color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer; }
        .vps-link-input { width: 100%; border: 1px solid #e5e0d8; border-radius: 10px; padding: 10px 12px; font-size: 13px; margin-top: 12px; outline: none; }
        .vps-link-input:focus { border-color: #e53935; }
        .vps-btn-primary { width: 100%; background: #111; color: #fff; border: none; border-radius: 40px; padding: 13px 16px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 12px; transition: opacity .15s; }
        .vps-btn-primary:disabled { opacity: .5; cursor: default; }
        .vps-btn-secondary { width: 100%; background: none; border: 1px solid #e5e0d8; color: #111; border-radius: 40px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 16px; }
        .vps-warning { background: #fff8e6; border: 1px solid #f0dca0; color: #8a6d1f; border-radius: 12px; padding: 10px 14px; font-size: 12.5px; margin-bottom: 12px; }
        .vps-article { display: flex; gap: 10px; }
        .vps-article-info { flex: 1; min-width: 0; }
        .vps-shop { font-size: 11px; color: #aaa; margin: 0; }
        .vps-name { font-size: 14px; font-weight: 600; color: #111; margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .vps-variant { font-size: 12px; color: #888; margin: 0 0 8px; }
        .vps-fields { display: flex; align-items: center; gap: 12px; }
        .vps-fields label { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #999; }
        .vps-fields input { width: 56px; border: 1px solid #e5e0d8; border-radius: 8px; padding: 4px 6px; font-size: 13px; color: #111; }
        .vps-fields input[type="number"]:nth-of-type(2) { width: 42px; }
        .vps-line-total { margin-left: auto; font-size: 14px; font-weight: 700; color: #e53935; }
        .vps-remove { background: none; border: none; color: #ccc; cursor: pointer; align-self: flex-start; font-size: 14px; }
        .vps-sticky-bar { position: fixed; bottom: 70px; left: 0; right: 0; background: #fff; border-top: 1px solid #f0ede8; padding: 12px 16px; padding-bottom: calc(12px + env(safe-area-inset-bottom)); z-index: 150; }
        .vps-sticky-inner { max-width: 480px; margin: 0 auto; display: flex; align-items: center; gap: 12px; }
        .vps-total-label { font-size: 11px; color: #999; margin: 0; }
        .vps-total-value { font-size: 18px; font-weight: 700; color: #111; margin: 0; }
        .vps-submit { flex: 1; margin-top: 0; }
        .vps-confirm { text-align: center; padding: 32px 20px; margin-top: 24px; }
        .vps-confirm-title { font-size: 17px; font-weight: 700; color: #111; margin: 0 0 6px; }
        .vps-confirm-text { font-size: 13.5px; color: #888; margin: 0 0 14px; }
        .vps-badge { display: inline-block; font-size: 11px; font-weight: 600; background: #f7f5f2; color: #666; border-radius: 40px; padding: 6px 14px; }
      `}</style>
        </div>
    );
};

export default ValiderPanierShein;