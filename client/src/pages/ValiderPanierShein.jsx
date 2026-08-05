import { useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
import {
    Upload, Link2, Trash2, Check, ArrowRight, AlertTriangle,
    X, Plus, Minus, Loader2, ImageIcon,
} from "lucide-react";

const money = (n, devise) => `${devise === "EUR" ? "€" : "$"}${Number(n || 0).toFixed(2)}`;

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
    // Alertes de cohérence renvoyées par l'extraction (capture manquante, écart
    // avec le total affiché, doublons fusionnés). Voir services/sheinExtraction.js.
    const [alertes, setAlertes] = useState([]);

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
                setAlertes(data.alertes || []);
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
    const nbAVerifier = articles.filter((a) => a.confiance && a.confiance !== "haute").length;

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
    const indexEtape = ETAPES.findIndex((x) => x.id === etapeActuelle);

    return (
        <div className="max-w-[560px] mx-auto px-4 pt-6" style={{ paddingBottom: status === "reviewing" ? 120 : 40 }}>

            <h1 className="rs-display mb-5">Valider mon panier SHEIN</h1>

            {/* ── Progression ────────────────────────────────────────────── */}
            <ol className="flex items-start mb-6 list-none p-0 m-0" aria-label="Progression">
                {ETAPES.map((e, i) => {
                    const actif = e.id === etapeActuelle;
                    const complet = indexEtape > i;
                    return (
                        <li key={e.id} className="flex-1 flex flex-col items-center relative">
                            <span
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-extrabold mb-2 relative z-[1] transition ${
                                    complet ? "bg-ramses-600 text-white"
                                    : actif ? "bg-ink-900 text-white"
                                    : "bg-ink-100 text-ink-400"
                                }`}
                                aria-current={actif ? "step" : undefined}
                            >
                                {complet ? <Check size={15} strokeWidth={3} /> : e.numero}
                            </span>
                            <span className={`text-[11px] font-semibold text-center leading-tight ${actif ? "text-ink-900" : "text-ink-400"}`}>
                                {e.label}
                            </span>
                            {i < ETAPES.length - 1 && (
                                <span
                                    className={`absolute top-[13px] h-0.5 ${complet ? "bg-ramses-600" : "bg-ink-100"}`}
                                    style={{ left: "calc(50% + 18px)", right: "calc(-50% + 18px)" }}
                                />
                            )}
                        </li>
                    );
                })}
            </ol>

            {status === "submitted" ? (
                <div className="rs-card text-center py-10">
                    <div className="w-16 h-16 rounded-full bg-ok-50 flex items-center justify-center mx-auto mb-4">
                        <Check size={28} className="text-ok-500" strokeWidth={2.5} />
                    </div>
                    <p className="rs-h1 mb-2">Panier soumis</p>
                    <p className="text-[13px] text-ink-500 mb-4 max-w-[300px] mx-auto leading-relaxed">
                        Un agent vérifie votre panier. Vous recevrez votre devis dans la conversation.
                    </p>
                    <span className="rs-badge rs-badge--info mb-6">En attente de vérification</span>
                    <button className="rs-btn rs-btn--secondary rs-btn--block" onClick={() => navigate("/mes-colis-shein")}>
                        Voir mes colis SHEIN
                    </button>
                </div>
            ) : (
                <>
                    {/* ── Consigne ───────────────────────────────────────── */}
                    <div className="flex items-start gap-2.5 bg-warn-50 border border-warn-500/20 rounded-xl px-4 py-3 mb-3">
                        <AlertTriangle size={17} className="text-warn-500 shrink-0 mt-0.5" />
                        <p className="text-[13px] text-ink-700 leading-relaxed">
                            Sélectionnez <strong>« Tout »</strong> dans votre panier SHEIN et vérifiez que le
                            total n'affiche pas <strong>0.00</strong> avant de capturer l'écran.
                        </p>
                    </div>

                    {/* ── Saisie ─────────────────────────────────────────── */}
                    <div className="rs-card">

                        <div className="flex items-center gap-2 mb-2.5">
                            <span className="text-[13px] font-bold text-ink-900">Captures d'écran</span>
                            <span className="rs-label text-ramses-600 bg-ramses-50 px-2 py-1 rounded-full">Obligatoire</span>
                        </div>

                        <label
                            className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-2xl px-4 py-8 cursor-pointer transition ${
                                dragActive ? "border-ramses-600 bg-ramses-50"
                                : champImageInvalide ? "border-ramses-600 bg-ramses-50/40"
                                : "border-ink-200 hover:border-ink-300 hover:bg-ink-50"
                            }`}
                            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={onDrop}
                        >
                            <Upload size={26} className="text-ink-400" strokeWidth={1.6} />
                            <span className="text-[13px] font-semibold text-ink-700 text-center">
                                Glissez vos captures ici, ou cliquez pour choisir
                            </span>
                            <span className="text-[11.5px] text-ink-400 text-center">
                                PNG ou JPG · plusieurs images acceptées
                            </span>
                            <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && handleFiles(e.target.files)} />
                        </label>

                        {champImageInvalide && (
                            <p className="text-[12px] text-ramses-900 mt-2">Ajoutez au moins une capture d'écran.</p>
                        )}

                        {hasImages && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {images.map((img) => (
                                    <div key={img.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-ink-100">
                                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(img.id)}
                                            aria-label="Supprimer cette capture"
                                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-ink-900/70 text-white flex items-center justify-center hover:bg-ink-900 transition"
                                        >
                                            <X size={13} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                ))}
                                <label className="w-16 h-16 rounded-xl border-2 border-dashed border-ink-200 flex items-center justify-center cursor-pointer text-ink-400 hover:border-ink-300 hover:bg-ink-50 transition">
                                    <Plus size={20} />
                                    <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && handleFiles(e.target.files)} />
                                </label>
                            </div>
                        )}

                        <div className="flex items-center gap-2 mt-5 mb-2.5">
                            <span className="text-[13px] font-bold text-ink-900">Lien de partage SHEIN</span>
                            <span className="rs-label text-ramses-600 bg-ramses-50 px-2 py-1 rounded-full">Obligatoire</span>
                        </div>

                        <div className="relative">
                            <Link2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                            <input
                                type="text"
                                inputMode="url"
                                placeholder="https://fr.shein.com/share/…"
                                aria-label="Lien de partage du panier SHEIN"
                                value={lienPartage}
                                onChange={(e) => setLienPartage(e.target.value)}
                                className="rs-input pl-11"
                                style={champLienInvalide ? { borderColor: "var(--color-ramses-600)" } : undefined}
                            />
                        </div>
                        {champLienInvalide && (
                            <p className="text-[12px] text-ramses-900 mt-2">Collez le lien de partage de votre panier.</p>
                        )}

                        {status !== "reviewing" && (
                            <button onClick={analyser} disabled={status === "analyzing"} className="rs-btn rs-btn--primary rs-btn--block mt-5">
                                {status === "analyzing" ? (
                                    <><Loader2 size={17} className="animate-spin" /> Analyse en cours…</>
                                ) : (
                                    <>Analyser mon panier <ArrowRight size={16} /></>
                                )}
                            </button>
                        )}

                        <p className="text-[11.5px] text-ink-400 text-center mt-3">
                            Les deux champs sont nécessaires pour lancer l'analyse.
                        </p>
                    </div>

                    {/* ── Vérification ───────────────────────────────────── */}
                    {status === "reviewing" && (
                        <div className="mt-4">

                            {/* Alertes de cohérence remontées par l'extraction : capture
                                manquante, écart avec le total, doublons fusionnés. */}
                            {alertes.map((a, i) => (
                                <div key={i} className="flex items-start gap-2.5 bg-warn-50 border border-warn-500/20 rounded-xl px-4 py-3 mb-2">
                                    <AlertTriangle size={17} className="text-warn-500 shrink-0 mt-0.5" />
                                    <p className="text-[13px] text-ink-700 leading-relaxed">{a}</p>
                                </div>
                            ))}

                            {ecartTotal && (
                                <div className="flex items-start gap-2.5 bg-warn-50 border border-warn-500/20 rounded-xl px-4 py-3 mb-2">
                                    <AlertTriangle size={17} className="text-warn-500 shrink-0 mt-0.5" />
                                    <p className="text-[13px] text-ink-700 leading-relaxed">
                                        Le total calculé ({money(sousTotal, devise)}) diffère du total affiché sur votre
                                        panier ({money(totalAffiche, devise)}). Vérifiez les quantités — l'agent
                                        confirmera à la validation.
                                    </p>
                                </div>
                            )}

                            <div className="flex items-baseline justify-between gap-3 mt-4 mb-2.5">
                                <p className="rs-h2">
                                    {articles.length} article{articles.length > 1 ? "s" : ""} détecté{articles.length > 1 ? "s" : ""}
                                </p>
                                {nbAVerifier > 0 && (
                                    <span className="rs-badge rs-badge--warn">
                                        {nbAVerifier} à relire
                                    </span>
                                )}
                            </div>

                            <div className="grid gap-2.5">
                                {articles.map((a) => {
                                    const aRelire = a.confiance && a.confiance !== "haute";
                                    const prix = a.prix_unitaire ?? a.prixUnitaire;

                                    return (
                                        <div key={a.id} className={`rs-card ${aRelire ? "rs-card--action" : ""} flex gap-3`}>
                                            <div className="flex-1 min-w-0">
                                                {a.boutique && (
                                                    <p className="rs-label text-ink-400 mb-1.5">{a.boutique}</p>
                                                )}
                                                <p className="text-[13.5px] font-semibold text-ink-900 leading-snug">{a.nom}</p>
                                                {a.variante && <p className="text-[12px] text-ink-400 mt-0.5">{a.variante}</p>}

                                                {/* Les incertitudes viennent de l'extraction : elles
                                                    disent au client quoi vérifier au lieu de lui
                                                    demander de tout relire. */}
                                                {aRelire && a.incertitudes?.length > 0 && (
                                                    <p className="text-[11.5px] text-warn-500 mt-1.5 leading-snug">
                                                        {a.incertitudes.join(" · ")}
                                                    </p>
                                                )}

                                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                    <label className="flex items-center gap-1 bg-ink-50 rounded-xl px-3 h-11 focus-within:bg-ink-0 focus-within:ring-2 focus-within:ring-ramses-600/15 focus-within:border-ramses-600 border-[1.5px] border-transparent transition">
                                                        <span className="text-[13px] font-semibold text-ink-400">
                                                            {devise === "EUR" ? "€" : "$"}
                                                        </span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            inputMode="decimal"
                                                            aria-label={`Prix unitaire de ${a.nom}`}
                                                            value={prix}
                                                            onChange={(e) => updateArticle(a.id, "prix_unitaire", e.target.value)}
                                                            className="w-[68px] bg-transparent outline-none text-[16px] font-semibold text-ink-900 tabular-nums"
                                                        />
                                                    </label>

                                                    <div className="flex items-center bg-ink-50 rounded-xl h-11">
                                                        <button
                                                            type="button"
                                                            onClick={() => ajusterQuantite(a.id, -1)}
                                                            aria-label="Diminuer la quantité"
                                                            className="w-11 h-11 flex items-center justify-center text-ink-500 hover:text-ink-900 rounded-l-xl transition"
                                                        >
                                                            <Minus size={16} />
                                                        </button>
                                                        <span className="min-w-[26px] text-center text-[15px] font-bold text-ink-900 tabular-nums">
                                                            {a.quantite}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => ajusterQuantite(a.id, 1)}
                                                            aria-label="Augmenter la quantité"
                                                            className="w-11 h-11 flex items-center justify-center text-ink-500 hover:text-ink-900 rounded-r-xl transition"
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                    </div>

                                                    <span className="rs-money text-[15px] ml-auto">
                                                        {money(prix * a.quantite, devise)}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => removeArticle(a.id)}
                                                aria-label={`Retirer ${a.nom}`}
                                                className="rs-icon-btn self-start !w-9 !h-9 text-ink-300 hover:text-ramses-600"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {articles.length === 0 && (
                                <div className="rs-card text-center py-10">
                                    <div className="w-14 h-14 rounded-full bg-ink-50 flex items-center justify-center mx-auto mb-3">
                                        <ImageIcon size={22} className="text-ink-400" />
                                    </div>
                                    <p className="rs-h2 mb-1">Aucun article détecté</p>
                                    <p className="text-[13px] text-ink-400 max-w-[300px] mx-auto">
                                        Vos captures étaient peut-être trop floues ou coupées. Réessayez avec le panier
                                        entier bien visible.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ── Barre de soumission ────────────────────────────────────── */}
            {status === "reviewing" && (
                <div
                    className="fixed bottom-0 left-0 right-0 rs-surface border-t border-ink-100 z-20"
                    style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
                >
                    <div className="max-w-[560px] mx-auto px-4 pt-3 flex items-center gap-4">
                        <div className="min-w-0">
                            <p className="text-[11.5px] text-ink-400">
                                {articles.length} article{articles.length > 1 ? "s" : ""} · Total estimé
                            </p>
                            <p className="rs-money text-[20px]">{money(sousTotal, devise)}</p>
                        </div>
                        <button
                            onClick={soumettre}
                            disabled={articles.length === 0 || status === "submitting"}
                            className="rs-btn rs-btn--primary flex-1"
                        >
                            {status === "submitting" ? (
                                <><Loader2 size={17} className="animate-spin" /> Envoi…</>
                            ) : (
                                <>Soumettre <ArrowRight size={16} /></>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ValiderPanierShein;
