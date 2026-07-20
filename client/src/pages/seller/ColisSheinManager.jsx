import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";

const STATUTS = [
    "soumis", "en_verification", "devis_envoye", "acompte_paye",
    "achete", "en_entrepot", "pese", "solde_du", "solde_paye", "en_livraison", "livre", "annule",
];

const money = (n, devise) => `${devise === "EUR" ? "€" : "$"}${Number(n || 0).toFixed(2)}`;

const ColisSheinManager = () => {
    const { axios } = useAppContext();
    const [colisListe, setColisListe] = useState([]);
    const [filtreStatut, setFiltreStatut] = useState("soumis");
    const [selection, setSelection] = useState(null);
    const [articlesEdit, setArticlesEdit] = useState([]);
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState([]);
    const [texte, setTexte] = useState("");
    const [imageChoisie, setImageChoisie] = useState(null);
    const [envoi, setEnvoi] = useState(false);

    const messagesContainerRef = useRef(null);
    const fileInputRef = useRef(null);

    // --- Taux de change (Setting "sheinExchangeRates") ---
    const [taux, setTaux] = useState({ usd: "", eur: "" });
    const [tauxSaved, setTauxSaved] = useState({ usd: "", eur: "" });
    const [savingTaux, setSavingTaux] = useState(false);

    const fetchTaux = async () => {
        try {
            const { data } = await axios.get("/api/setting/sheinExchangeRates");
            if (data.success && data.data) {
                setTaux({ usd: data.data.usd ?? "", eur: data.data.eur ?? "" });
                setTauxSaved({ usd: data.data.usd ?? "", eur: data.data.eur ?? "" });
            }
        } catch (error) {
            // pas encore configuré
        }
    };

    const enregistrerTaux = async () => {
        setSavingTaux(true);
        try {
            const value = { usd: Number(taux.usd) || 0, eur: Number(taux.eur) || 0 };
            const { data } = await axios.post("/api/setting/update", { key: "sheinExchangeRates", value });
            if (data.success) {
                toast.success("Taux de change enregistrés");
                setTauxSaved({ usd: value.usd, eur: value.eur });
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error("Erreur d'enregistrement du taux");
        } finally {
            setSavingTaux(false);
        }
    };

    const tauxModifie = taux.usd != tauxSaved.usd || taux.eur != tauxSaved.eur;

    const fetchListe = async (statut) => {
        setLoading(true);
        try {
            const url = statut ? `/api/shein-cart/admin/all?statut=${statut}` : "/api/shein-cart/admin/all";
            const { data } = await axios.get(url);
            if (data.success) setColisListe(data.colis);
        } catch (error) {
            toast.error("Erreur de chargement");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTaux(); }, []);
    useEffect(() => { fetchListe(filtreStatut); }, [filtreStatut]);

    // Rafraîchit la liste en arrière-plan pour que les badges "non lu" apparaissent
    // sans que l'admin ait besoin de changer de filtre manuellement.
    useEffect(() => {
        const interval = setInterval(() => fetchListe(filtreStatut), 15000);
        return () => clearInterval(interval);
    }, [filtreStatut]);

    useEffect(() => {
        const el = messagesContainerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages]);

    const ouvrirColis = async (id) => {
        try {
            const { data } = await axios.get(`/api/shein-cart/admin/${id}`);
            if (data.success) {
                setSelection(data.colis);
                setArticlesEdit(data.colis.articlesValides.map((a) => ({ ...a })));
            }
            const msgRes = await axios.get(`/api/shein-cart/admin/${id}/messages`);
            if (msgRes.data.success) setMessages(msgRes.data.messages);
            // le GET messages ci-dessus marque déjà adminDernierLu côté serveur —
            // on met juste à jour localement pour faire disparaître le badge tout de suite
            setColisListe((prev) => prev.map((c) => (c._id === id ? { ...c, nonLu: false } : c)));
        } catch (error) {
            toast.error("Impossible d'ouvrir ce colis");
        }
    };

    const updateArticle = (index, field, value) => {
        setArticlesEdit((prev) =>
            prev.map((a, i) => (i === index ? { ...a, [field]: field === "boutique" || field === "nom" || field === "variante" ? value : Number(value) } : a))
        );
    };

    const validerDevis = async () => {
        try {
            const { data } = await axios.post(`/api/shein-cart/admin/${selection._id}/validate`, { articles: articlesEdit, pourcentageAcompte });
            if (data.success) {
                toast.success("Devis validé");
                setSelection(data.colis);
                fetchListe(filtreStatut);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur de validation");
        }
    };

    const changerStatut = async (statut) => {
        const note = window.prompt(`Note pour ce changement vers "${statut}" (optionnel) :`) || "";
        try {
            const { data } = await axios.post(`/api/shein-cart/admin/${selection._id}/statut`, { statut, note });
            if (data.success) {
                toast.success("Statut mis à jour");
                setSelection(data.colis);
                fetchListe(filtreStatut);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur de statut");
        }
    };

    const marquerPese = async () => {
        const poidsReel = window.prompt("Poids réel (kg) ?");
        if (!poidsReel) return;
        const tauxParKilo = window.prompt("Taux par kilo (FCFA) ?", selection?.devis?.tauxParKilo || "");
        if (!tauxParKilo) return;
        const fraisLivraisonAbidjan = window.prompt("Frais de livraison à Abidjan (FCFA) ?", selection?.devis?.fraisLivraisonEstime || "0");
        if (fraisLivraisonAbidjan == null) return;
        try {
            const { data } = await axios.post(`/api/shein-cart/admin/${selection._id}/statut`, { statut: "pese", poidsReel, tauxParKilo, fraisLivraisonAbidjan });
            if (data.success) {
                toast.success("Pesée enregistrée, montant à payer calculé");
                setSelection(data.colis);
                fetchListe(filtreStatut);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur de pesée");
        }
    };

    const choisirImage = (e) => {
        const file = e.target.files?.[0];
        if (file) setImageChoisie(file);
    };

    const envoyerMessage = async () => {
        if ((!texte.trim() && !imageChoisie) || envoi) return;
        setEnvoi(true);
        try {
            const formData = new FormData();
            if (texte.trim()) formData.append("texte", texte.trim());
            if (imageChoisie) formData.append("image", imageChoisie);

            const { data } = await axios.post(`/api/shein-cart/admin/${selection._id}/messages`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            if (data.success) {
                setMessages((prev) => [...prev, data.message]);
                setTexte("");
                setImageChoisie(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        } catch (error) {
            toast.error("Erreur d'envoi");
        } finally {
            setEnvoi(false);
        }
    };

    return (
        <div className="csm-page">
            <div className="csm-taux-bar">
                <span className="csm-taux-label">Taux de change (FCFA)</span>
                <label>1 $ = <input type="number" value={taux.usd} onChange={(e) => setTaux((p) => ({ ...p, usd: e.target.value }))} placeholder="ex. 620" /></label>
                <label>1 € = <input type="number" value={taux.eur} onChange={(e) => setTaux((p) => ({ ...p, eur: e.target.value }))} placeholder="ex. 670" /></label>
                <button onClick={enregistrerTaux} disabled={!tauxModifie || savingTaux} className="csm-taux-save">
                    {savingTaux ? "Enregistrement…" : "Enregistrer"}
                </button>
                {(!tauxSaved.usd || !tauxSaved.eur) && (
                    <span className="csm-taux-warning">Non configuré — la validation de devis sera bloquée</span>
                )}
            </div>

            <div className="csm-wrap">
                <div className="csm-liste">
                    <h2>Colis SHEIN</h2>
                    <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
                        <option value="">Tous les statuts</option>
                        {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>

                    {loading ? <p className="csm-empty">Chargement…</p> : colisListe.length === 0 ? (
                        <p className="csm-empty">Aucun colis</p>
                    ) : (
                        colisListe.map((c) => (
                            <button
                                key={c._id}
                                className={`csm-item ${selection?._id === c._id ? "active" : ""}`}
                                onClick={() => ouvrirColis(c._id)}
                            >
                                <span className="csm-item-top">
                                    <span className="csm-item-numero">{c.numeroSuivi}</span>
                                    {c.nonLu && <span className="csm-item-dot" title="Nouveau message du client" />}
                                </span>
                                <span className="csm-item-client">{c.userId?.name || c.userId?.email}</span>
                                <span className="csm-item-statut">{c.statut}</span>
                            </button>
                        ))
                    )}
                </div>

                <div className="csm-detail">
                    {!selection ? (
                        <p className="csm-empty">Sélectionne un colis dans la liste</p>
                    ) : (
                        <>
                            <div className="csm-detail-header">
                                <h3>{selection.numeroSuivi}</h3>
                                <span className="csm-badge">{selection.statut}</span>
                            </div>
                            <p className="csm-lien"><a href={selection.lienPartage} target="_blank" rel="noreferrer">Lien du panier</a></p>

                            <div className="csm-captures">
                                {selection.captures.map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`capture ${i + 1}`} /></a>
                                ))}
                            </div>

                            <h4>Articles (édition)</h4>
                            {articlesEdit.map((a, i) => (
                                <div key={i} className="csm-article-row">
                                    <input value={a.nom} onChange={(e) => updateArticle(i, "nom", e.target.value)} className="csm-nom" />
                                    <input type="number" step="0.01" value={a.prixUnitaire} onChange={(e) => updateArticle(i, "prixUnitaire", e.target.value)} className="csm-prix" />
                                    <input type="number" value={a.quantite} onChange={(e) => updateArticle(i, "quantite", e.target.value)} className="csm-qte" />
                                    <span className="csm-souligne">{money(a.prixUnitaire * a.quantite, selection.devise)}</span>
                                </div>
                            ))}

                            <div className="csm-acompte-row">
                                <label>Acompte <input type="number" min="0" max="100" value={pourcentageAcompte} onChange={(e) => setPourcentageAcompte(e.target.value)} />%</label>
                            </div>

                            <div className="csm-actions">
                                <button onClick={validerDevis} className="csm-btn-primary">Valider le devis</button>
                                <button onClick={marquerPese} className="csm-btn-secondary">Enregistrer la pesée</button>
                            </div>

                            <div className="csm-statuts">
                                {STATUTS.map((s) => (
                                    <button key={s} className={`csm-statut-btn ${selection.statut === s ? "active" : ""}`} onClick={() => changerStatut(s)}>{s}</button>
                                ))}
                            </div>

                            {selection.devis?.montantArticlesFCFA != null && (
                                <p className="csm-fcfa">
                                    Total FCFA : {Math.round(selection.devis.montantArticlesFCFA).toLocaleString("fr-FR")} FCFA (taux {selection.devis.tauxApplique} / {selection.devise})
                                </p>
                            )}
                            {selection.devis?.montantInitial > 0 && (
                                <p className="csm-fcfa">
                                    Paiement articles {selection.paiement?.acomptePaye ? "reçu" : "attendu"} : {Math.round(selection.devis.montantInitial).toLocaleString("fr-FR")} FCFA
                                </p>
                            )}
                            {selection.paiement?.soldeMontant > 0 && (
                                <p className="csm-fcfa">
                                    Paiement livraison {selection.paiement?.soldePaye ? "reçu" : "attendu"} : {Math.round(selection.paiement.soldeMontant).toLocaleString("fr-FR")} FCFA
                                </p>
                            )}

                            <h4>Chat</h4>
                            <div className="csm-chat">
                                <div className="csm-chat-messages" ref={messagesContainerRef}>
                                    {messages.map((m) => (
                                        <div key={m._id} className={`csm-msg ${m.expediteurRole}`}>
                                            {m.imageUrl && <img src={m.imageUrl} alt="" className="csm-msg-img" onClick={() => window.open(m.imageUrl, "_blank")} />}
                                            {m.texte && <p>{m.texte}</p>}
                                            <span className="csm-msg-heure">
                                                {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {imageChoisie && (
                                    <div className="csm-preview">
                                        <img src={URL.createObjectURL(imageChoisie)} alt="" />
                                        <button onClick={() => { setImageChoisie(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>✕</button>
                                    </div>
                                )}
                                <div className="csm-chat-input">
                                    <label className="csm-attach">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                        </svg>
                                        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={choisirImage} />
                                    </label>
                                    <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Répondre au client…" onKeyDown={(e) => e.key === "Enter" && envoyerMessage()} />
                                    <button onClick={envoyerMessage} disabled={(!texte.trim() && !imageChoisie) || envoi}>Envoyer</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <style>{`
        .csm-page { font-family: 'DM Sans', sans-serif; }
        .csm-taux-bar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; background: #fff; border-bottom: 1px solid #f0ede8; padding: 12px 20px; }
        .csm-taux-label { font-size: 12px; font-weight: 700; color: #111; text-transform: uppercase; letter-spacing: .5px; }
        .csm-taux-bar label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #555; }
        .csm-taux-bar input { width: 70px; padding: 5px 8px; border: 1px solid #e5e0d8; border-radius: 6px; font-size: 13px; }
        .csm-taux-save { background: #111; color: #fff; border: none; border-radius: 20px; padding: 6px 14px; font-size: 12px; cursor: pointer; }
        .csm-taux-save:disabled { opacity: .4; cursor: default; }
        .csm-taux-warning { font-size: 11.5px; color: #c62828; }
        .csm-wrap { display: flex; gap: 20px; padding: 20px; }
        .csm-liste { width: 280px; flex-shrink: 0; }
        .csm-liste h2 { font-size: 16px; margin: 0 0 10px; }
        .csm-liste select { width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #e5e0d8; margin-bottom: 10px; }
        .csm-item { display: flex; flex-direction: column; width: 100%; text-align: left; background: #fff; border: 1px solid #f0ede8; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; cursor: pointer; }
        .csm-item.active { border-color: #e53935; }
        .csm-item-top { display: flex; align-items: center; gap: 6px; }
        .csm-item-numero { font-size: 12px; font-weight: 700; color: #111; }
        .csm-item-dot { width: 8px; height: 8px; border-radius: 50%; background: #e53935; }
        .csm-item-client { font-size: 12px; color: #666; }
        .csm-item-statut { font-size: 11px; color: #e53935; margin-top: 2px; }
        .csm-empty { color: #999; font-size: 13px; }
        .csm-detail { flex: 1; background: #fff; border: 1px solid #f0ede8; border-radius: 12px; padding: 18px; }
        .csm-detail-header { display: flex; align-items: center; gap: 10px; }
        .csm-badge { font-size: 11px; background: #f7f5f2; padding: 4px 10px; border-radius: 20px; }
        .csm-lien a { font-size: 12px; color: #e53935; }
        .csm-captures { display: flex; gap: 8px; margin: 10px 0; flex-wrap: wrap; }
        .csm-captures img { width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid #f0ede8; }
        .csm-article-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
        .csm-nom { flex: 1; padding: 6px 8px; border: 1px solid #e5e0d8; border-radius: 6px; font-size: 12.5px; }
        .csm-prix, .csm-qte { width: 60px; padding: 6px; border: 1px solid #e5e0d8; border-radius: 6px; font-size: 12.5px; }
        .csm-souligne { width: 70px; text-align: right; font-size: 12.5px; font-weight: 600; }
        .csm-actions { display: flex; gap: 10px; margin: 14px 0; }
        .csm-btn-primary { background: #111; color: #fff; border: none; border-radius: 20px; padding: 9px 16px; font-size: 12.5px; cursor: pointer; }
        .csm-btn-secondary { background: #f7f5f2; border: none; border-radius: 20px; padding: 9px 16px; font-size: 12.5px; cursor: pointer; }
        .csm-statuts { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
        .csm-statut-btn { font-size: 11px; padding: 5px 10px; border-radius: 14px; border: 1px solid #e5e0d8; background: #fff; cursor: pointer; }
        .csm-statut-btn.active { background: #111; color: #fff; border-color: #111; }
        .csm-fcfa { font-size: 13px; font-weight: 600; color: #e53935; }
        .csm-acompte-row { margin-bottom: 8px; }
        .csm-acompte-row label { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #555; }
        .csm-acompte-row input { width: 50px; padding: 5px 7px; border: 1px solid #e5e0d8; border-radius: 6px; font-size: 12.5px; }
        .csm-chat { border: 1px solid #f0ede8; border-radius: 12px; overflow: hidden; }
        .csm-chat-messages { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 10px; }
        .csm-msg { padding: 6px 10px; font-size: 12.5px; max-width: 75%; position: relative; }
        .csm-msg p { margin: 0; }
        .csm-msg-heure { display: block; font-size: 9.5px; opacity: .55; margin-top: 3px; text-align: right; }
        .csm-msg-img { width: 100px; border-radius: 8px; display: block; margin-bottom: 4px; cursor: pointer; }
        .csm-msg.client { background: #f7f5f2; align-self: flex-start; border-radius: 14px 14px 14px 3px; }
        .csm-msg.agent { background: #111; color: #fff; align-self: flex-end; border-radius: 14px 14px 3px 14px; }
        .csm-preview { position: relative; width: 50px; margin: 0 10px; }
        .csm-preview img { width: 50px; height: 50px; object-fit: cover; border-radius: 8px; }
        .csm-preview button { position: absolute; top: -5px; right: -5px; background: #111; color: #fff; border: none; border-radius: 50%; width: 16px; height: 16px; font-size: 9px; cursor: pointer; }
        .csm-chat-input { display: flex; align-items: center; gap: 8px; border-top: 1px solid #f0ede8; padding: 8px 10px; }
        .csm-attach { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: #f7f5f2; cursor: pointer; flex-shrink: 0; }
        .csm-chat-input input[type="text"], .csm-chat-input input:not([type]) { flex: 1; padding: 8px 10px; border-radius: 20px; border: 1px solid #e5e0d8; font-size: 12.5px; }
        .csm-chat-input button { background: #111; color: #fff; border: none; border-radius: 20px; padding: 8px 14px; font-size: 12.5px; cursor: pointer; }
        .csm-chat-input button:disabled { opacity: .4; cursor: default; }
      `}</style>
        </div>
    );
};

export default ColisSheinManager;