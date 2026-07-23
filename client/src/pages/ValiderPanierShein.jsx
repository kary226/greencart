import { useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";

const money = (n, devise) => `${devise === "EUR" ? "€" : "$"}${Number(n || 0).toFixed(2)}`;

const IconUpload = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

const IconLink = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
);

const IconTrash = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" /><path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
);

const IconCheck = () => (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const IconArrow = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
);

const IconWarning = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

const ETAPES = [
    { id: "saisie", numero: 1, label: "Photos & lien" },
    { id: "reviewing", numero: 2, label: "Vérification" },
    { id: "submitted", numero: 3, label: "Confirmation" },
];

const ValiderPanierShein = () => {
    const { axios, user, setShowUserLogin, navigate } = useAppContext();

    const [images, setImages] = useState([]);
    const [lienPartage, setLienPartage] = useState("");
    const [status, setStatus] = useState("idle"); // idle | analyzing | reviewing | submitting | submitted
    const [articles, setArticles] = useState([]);
    const [captures, setCaptures] = useState([]);
    const [totalAffiche, setTotalAffiche] = useState(null);
    const [devise, setDevise] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [aEssaye, setAEssaye] = useState(false); // true dès la première tentative d'analyse — active l'affichage des erreurs de champs

    const hasImages = images.length > 0;
    const hasLink = lienPartage.trim() !== "";
    const canAnalyze = hasImages && hasLink;

    // Étape actuelle pour l'indicateur en haut de page — purement visuel, ne pilote aucune logique.
    const etapeActuelle = status === "submitted" ? "submitted" : (status === "reviewing" || status === "submitting") ? "reviewing" : "saisie";

    const handleFiles = (fileList) => {
        const files = Array.from(fileList).map((f) => ({
            id: crypto.randomUUID(),
            file: f,
            url: URL.createObjectURL(f),
        }));
        setImages((prev) => [...prev, ...files]);
    };

    const removeImage = (id) => setImages((prev) => prev.filter((img) => img.id !== id));

    const onDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
    };

    const analyser = async () => {
        if (!user) {
            setShowUserLogin(true);
            return;
        }
        setAEssaye(true);
        if (!canAnalyze) return;

        setStatus("analyzing");
        try {
            const formData = new FormData();
            images.forEach((img) => formData.append("captures", img.file));
            formData.append("lienPartage", lienPartage.trim());

            const { data } = await axios.post("/api/shein-cart/analyze", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            if (data.success) {
                setArticles(
                    data.articles.map((a) => ({ ...a, id: crypto.randomUUID() }))
                );
                setCaptures(data.captures);
                setTotalAffiche(data.totalAffiche);
                setDevise(data.devise ?? null);
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

    const ajusterQuantite = (id, delta) => {
        setArticles((prev) =>
            prev.map((a) => {
                if (a.id !== id) return a;
                const actuelle = Number(a.quantite) || 0;
                return { ...a, quantite: Math.max(1, actuelle + delta) };
            })
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
                lienPartage: lienPartage.trim(),
                captures,
                devise,
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
                setTimeout(() => navigate("/mes-colis-shein"), 1200);
            } else {
                toast.error(data.message || "Soumission impossible");
                setStatus("reviewing");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur pendant la soumission");
            setStatus("reviewing");
        }
    };

    const champImageInvalide = aEssaye && !hasImages;
    const champLienInvalide = aEssaye && !hasLink;

    return (
        <div className="vps-page">
            <h1 className="vps-title">Valider le panier SHEIN</h1>

            <div className="vps-steps" aria-hidden="true">
                {ETAPES.map((e, i) => {
                    const actif = e.id === etapeActuelle;
                    const complet = ETAPES.findIndex((x) => x.id === etapeActuelle) > i;
                    return (
                        <div key={e.id} className={`vps-step ${actif ? "actif" : ""} ${complet ? "complet" : ""}`}>
                            <span className="vps-step-num">{complet ? <IconCheck /> : e.numero}</span>
                            <span className="vps-step-label">{e.label}</span>
                            {i < ETAPES.length - 1 && <span className="vps-step-line" />}
                        </div>
                    );
                })}
            </div>

            {status === "submitted" ? (
                <div className="vps-card vps-confirm">
                    <div className="vps-confirm-icon"><IconCheck /></div>
                    <p className="vps-confirm-title">Panier soumis</p>
                    <p className="vps-confirm-text">
                        Un agent vérifie ton panier. Tu recevras ton devis sous peu.
                    </p>
                    <span className="vps-badge">En attente de vérification par un agent</span>
                    <button className="vps-btn-secondary" onClick={() => navigate("/mes-colis-shein")}>
                        Voir mes colis SHEIN
                    </button>
                </div>
            ) : (
                <>
                    <div className="vps-instruction">
                        <IconWarning />
                        <span>
                            Sélectionne <strong>« Tout »</strong> dans ton panier SHEIN et vérifie que le
                            total n'affiche pas <strong>$0.00</strong> avant de capturer l'écran.
                        </span>
                    </div>

                    <div className="vps-card">
                        <div className="vps-field-label">
                            Captures d'écran <span className="vps-required">obligatoire</span>
                        </div>
                        <label
                            className={`vps-upload-zone ${dragActive ? "drag" : ""} ${champImageInvalide ? "invalide" : ""}`}
                            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={onDrop}
                        >
                            <span className="vps-upload-icon"><IconUpload /></span>
                            <span className="vps-upload-label">Glisse tes captures ici, ou clique pour choisir</span>
                            <span className="vps-upload-sub">PNG ou JPG, plusieurs images acceptées</span>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                hidden
                                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                            />
                        </label>
                        {champImageInvalide && <p className="vps-field-error">Ajoute au moins une capture d'écran</p>}

                        {hasImages && (
                            <div className="vps-thumbs">
                                {images.map((img) => (
                                    <div key={img.id} className="vps-thumb">
                                        <img src={img.url} alt="" />
                                        <button onClick={() => removeImage(img.id)} aria-label="Supprimer">
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                <label className="vps-thumb vps-thumb-add">
                                    <span>+</span>
                                    <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && handleFiles(e.target.files)} />
                                </label>
                            </div>
                        )}

                        <div className="vps-field-label vps-field-label-spaced">
                            Lien de partage SHEIN <span className="vps-required">obligatoire</span>
                        </div>
                        <div className={`vps-link-wrap ${champLienInvalide ? "invalide" : ""}`}>
                            <IconLink />
                            <input
                                type="text"
                                placeholder="https://fr.shein.com/share/..."
                                value={lienPartage}
                                onChange={(e) => setLienPartage(e.target.value)}
                                className="vps-link-input"
                            />
                        </div>
                        {champLienInvalide && <p className="vps-field-error">Colle le lien de partage de ton panier</p>}

                        <p className="vps-required-note">
                            Les deux champs sont obligatoires pour lancer l'analyse.
                        </p>

                        {status !== "reviewing" && (
                            <button
                                onClick={analyser}
                                disabled={status === "analyzing"}
                                className="vps-btn-primary"
                            >
                                {status === "analyzing" ? (
                                    <span className="vps-spinner-wrap"><span className="vps-spinner" />Analyse en cours…</span>
                                ) : (
                                    <>Analyser mon panier <IconArrow /></>
                                )}
                            </button>
                        )}
                    </div>

                    {status === "reviewing" && (
                        <div className="vps-results">
                            {ecartTotal && (
                                <div className="vps-warning">
                                    <IconWarning />
                                    <span>
                                        Le total calculé ({money(sousTotal, devise)}) diffère du total affiché sur ton
                                        panier ({money(totalAffiche, devise)}). Vérifie les quantités — l'agent confirmera
                                        à la validation.
                                    </span>
                                </div>
                            )}

                            <p className="vps-results-count">{articles.length} article{articles.length > 1 ? "s" : ""} détecté{articles.length > 1 ? "s" : ""}</p>

                            {articles.map((a) => (
                                <div key={a.id} className="vps-card vps-article">
                                    <div className="vps-article-info">
                                        <p className="vps-shop">{a.boutique}</p>
                                        <p className="vps-name">{a.nom}</p>
                                        {a.variante && <p className="vps-variant">{a.variante}</p>}
                                        <div className="vps-fields">
                                            <label className="vps-price-field">
                                                <span className="vps-currency">{devise === "EUR" ? "€" : "$"}</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={a.prix_unitaire ?? a.prixUnitaire}
                                                    onChange={(e) => updateArticle(a.id, "prix_unitaire", e.target.value)}
                                                />
                                            </label>
                                            <div className="vps-stepper">
                                                <button onClick={() => ajusterQuantite(a.id, -1)} aria-label="Diminuer">−</button>
                                                <span>{a.quantite}</span>
                                                <button onClick={() => ajusterQuantite(a.id, 1)} aria-label="Augmenter">+</button>
                                            </div>
                                            <span className="vps-line-total">
                                                {money((a.prix_unitaire ?? a.prixUnitaire) * a.quantite, devise)}
                                            </span>
                                        </div>
                                    </div>
                                    <button className="vps-remove" onClick={() => removeArticle(a.id)} aria-label="Retirer">
                                        <IconTrash />
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
                            <p className="vps-total-label">{articles.length} article{articles.length > 1 ? "s" : ""} · Total estimé</p>
                            <p className="vps-total-value">{money(sousTotal, devise)}</p>
                        </div>
                        <button
                            onClick={soumettre}
                            disabled={articles.length === 0 || status === "submitting"}
                            className="vps-btn-primary vps-submit"
                        >
                            {status === "submitting" ? "Envoi…" : <>Soumettre <IconArrow /></>}
                        </button>
                    </div>
                </div>
            )}

            <style>{`
        .vps-page { max-width: 480px; margin: 0 auto; padding: 0 4px 100px; font-family: 'DM Sans', sans-serif; }
        .vps-title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px; font-weight: 600; letter-spacing: 2px; color: #111; margin: 12px 0 18px; }

        .vps-steps { display: flex; align-items: flex-start; margin-bottom: 20px; }
        .vps-step { display: flex; flex-direction: column; align-items: center; position: relative; flex: 1; }
        .vps-step-num { width: 26px; height: 26px; border-radius: 50%; background: #f0ede8; color: #999; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; margin-bottom: 6px; transition: background .2s, color .2s; z-index: 1; }
        .vps-step.actif .vps-step-num { background: #111; color: #fff; }
        .vps-step.complet .vps-step-num { background: #e53935; color: #fff; }
        .vps-step-label { font-size: 10.5px; color: #999; text-align: center; font-weight: 600; }
        .vps-step.actif .vps-step-label { color: #111; }
        .vps-step-line { position: absolute; top: 13px; left: calc(50% + 17px); right: calc(-50% + 17px); height: 2px; background: #f0ede8; }
        .vps-step.complet .vps-step-line { background: #e53935; }

        .vps-instruction { display: flex; align-items: flex-start; gap: 8px; background: #fdf1f0; border: 1px solid #f5d5d3; border-radius: 12px; padding: 11px 14px; font-size: 13px; line-height: 1.45; color: #c62828; margin-bottom: 14px; }
        .vps-instruction svg { flex-shrink: 0; margin-top: 1px; }

        .vps-card { background: #fff; border: 1px solid #f0ede8; border-radius: 16px; padding: 16px; margin-bottom: 12px; }

        .vps-field-label { font-size: 12.5px; font-weight: 700; color: #111; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .vps-field-label-spaced { margin-top: 16px; }
        .vps-required { font-size: 9.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: #e53935; background: #fdecea; padding: 2px 7px; border-radius: 20px; }
        .vps-field-error { font-size: 11.5px; color: #c62828; margin: 6px 2px 0; }
        .vps-required-note { font-size: 11px; color: #aaa; text-align: center; margin: 12px 0 0; }

        .vps-upload-zone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border: 2px dashed #e5e0d8; border-radius: 14px; padding: 30px 12px; cursor: pointer; transition: border-color .15s, background .15s; color: #555; }
        .vps-upload-zone:hover { border-color: #e53935; background: #fef9f9; }
        .vps-upload-zone.drag { border-color: #e53935; background: #fdf1f0; }
        .vps-upload-zone.invalide { border-color: #f0a19d; }
        .vps-upload-icon { color: #bbb; margin-bottom: 4px; }
        .vps-upload-zone:hover .vps-upload-icon, .vps-upload-zone.drag .vps-upload-icon { color: #e53935; }
        .vps-upload-label { font-size: 13.5px; font-weight: 600; color: #111; text-align: center; }
        .vps-upload-sub { font-size: 11.5px; color: #999; }

        .vps-thumbs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
        .vps-thumb { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: #f7f5f2; }
        .vps-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .vps-thumb button { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,.6); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 10px; cursor: pointer; line-height: 1; }
        .vps-thumb-add { display: flex; align-items: center; justify-content: center; border: 1.5px dashed #e5e0d8; cursor: pointer; color: #bbb; font-size: 20px; font-weight: 300; transition: border-color .15s, color .15s; }
        .vps-thumb-add:hover { border-color: #e53935; color: #e53935; }

        .vps-link-wrap { display: flex; align-items: center; gap: 8px; border: 1.5px solid #e5e0d8; border-radius: 12px; padding: 11px 13px; transition: border-color .15s; color: #aaa; }
        .vps-link-wrap:focus-within { border-color: #e53935; color: #e53935; }
        .vps-link-wrap.invalide { border-color: #f0a19d; }
        .vps-link-input { flex: 1; border: none; outline: none; font-size: 13.5px; color: #111; background: none; }

        .vps-btn-primary { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: #111; color: #fff; border: none; border-radius: 40px; padding: 14px 16px; font-size: 14.5px; font-weight: 700; cursor: pointer; margin-top: 16px; transition: opacity .15s, transform .1s; }
        .vps-btn-primary:hover:not(:disabled) { opacity: .92; }
        .vps-btn-primary:active:not(:disabled) { transform: scale(0.98); }
        .vps-btn-primary:disabled { opacity: .45; cursor: default; }
        .vps-btn-secondary { width: 100%; background: none; border: 1.5px solid #e5e0d8; color: #111; border-radius: 40px; padding: 13px 16px; font-size: 14px; font-weight: 700; cursor: pointer; margin-top: 18px; transition: border-color .15s; }
        .vps-btn-secondary:hover { border-color: #111; }

        .vps-spinner-wrap { display: flex; align-items: center; gap: 8px; }
        .vps-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; animation: vps-spin .7s linear infinite; }
        @keyframes vps-spin { to { transform: rotate(360deg); } }

        .vps-results-count { font-size: 12px; color: #999; font-weight: 600; margin: 4px 4px 10px; }
        .vps-warning { display: flex; align-items: flex-start; gap: 8px; background: #fff8e6; border: 1px solid #f0dca0; color: #8a6d1f; border-radius: 12px; padding: 11px 14px; font-size: 12.5px; line-height: 1.45; margin-bottom: 12px; }
        .vps-warning svg { flex-shrink: 0; margin-top: 1px; }

        .vps-article { display: flex; gap: 10px; transition: box-shadow .15s; }
        .vps-article:hover { box-shadow: 0 2px 10px rgba(0,0,0,.04); }
        .vps-article-info { flex: 1; min-width: 0; }
        .vps-shop { font-size: 10.5px; color: #bbb; margin: 0; text-transform: uppercase; letter-spacing: .4px; font-weight: 600; }
        .vps-name { font-size: 14px; font-weight: 700; color: #111; margin: 3px 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .vps-variant { font-size: 12px; color: #888; margin: 0 0 10px; }
        .vps-fields { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .vps-price-field { display: flex; align-items: center; gap: 3px; border: 1px solid #e5e0d8; border-radius: 8px; padding: 4px 8px; }
        .vps-price-field .vps-currency { font-size: 12px; color: #999; }
        .vps-price-field input { width: 52px; border: none; outline: none; font-size: 13px; color: #111; padding: 0; }
        .vps-stepper { display: flex; align-items: center; gap: 0; border: 1px solid #e5e0d8; border-radius: 8px; overflow: hidden; }
        .vps-stepper button { width: 26px; height: 26px; border: none; background: #f7f5f2; color: #111; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .vps-stepper button:hover { background: #efece6; }
        .vps-stepper span { width: 26px; text-align: center; font-size: 13px; font-weight: 600; }
        .vps-line-total { margin-left: auto; font-size: 14.5px; font-weight: 700; color: #e53935; }
        .vps-remove { background: none; border: none; color: #ccc; cursor: pointer; align-self: flex-start; padding: 2px; transition: color .15s; }
        .vps-remove:hover { color: #e53935; }

        .vps-sticky-bar { position: fixed; bottom: 70px; left: 0; right: 0; background: rgba(255,255,255,.92); backdrop-filter: blur(8px); border-top: 1px solid #f0ede8; padding: 12px 16px; padding-bottom: calc(12px + env(safe-area-inset-bottom)); z-index: 150; }
        .vps-sticky-inner { max-width: 480px; margin: 0 auto; display: flex; align-items: center; gap: 12px; }
        .vps-total-label { font-size: 11px; color: #999; margin: 0; font-weight: 600; }
        .vps-total-value { font-size: 19px; font-weight: 800; color: #111; margin: 0; }
        .vps-submit { flex: 1; margin-top: 0; width: auto; }

        .vps-confirm { text-align: center; padding: 40px 20px; margin-top: 24px; }
        .vps-confirm-icon { width: 52px; height: 52px; border-radius: 50%; background: #eafaf0; color: #1a9e5c; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
        .vps-confirm-title { font-size: 17px; font-weight: 700; color: #111; margin: 0 0 6px; }
        .vps-confirm-text { font-size: 13.5px; color: #888; margin: 0 0 14px; }
        .vps-badge { display: inline-block; font-size: 11px; font-weight: 600; background: #f7f5f2; color: #666; border-radius: 40px; padding: 6px 14px; }
      `}</style>
        </div>
    );
};

export default ValiderPanierShein;