import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";

const DECLENCHEURS = [
    { value: "manuel", label: "Manuel — jamais déclenché tout seul" },
    { value: "colis_livre", label: "Automatique — dès qu'un colis SHEIN est livré" },
    { value: "commande_livree", label: "Automatique — dès qu'une commande est livrée" },
];

const nouvelleQuestion = (n) => ({ id: `q${n}`, libelle: "", type: "etoiles" });

const Etoiles = ({ valeur }) => (
    <span className="qa-etoiles-lecture">
        {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={n <= Math.round(valeur || 0) ? "pleine" : ""}>★</span>
        ))}
    </span>
);

const QuestionnairesAdmin = () => {
    const { axios } = useAppContext();
    const [liste, setListe] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creation, setCreation] = useState(false);
    const [form, setForm] = useState({ titre: "", description: "", declencheur: "manuel", questions: [nouvelleQuestion(1)] });
    const [selectionId, setSelectionId] = useState(null);
    const [stats, setStats] = useState(null);
    const [chargementStats, setChargementStats] = useState(false);

    const charger = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get("/api/questionnaire/admin/all");
            if (data.success) setListe(data.questionnaires);
        } catch {
            toast.error("Erreur de chargement");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { charger(); }, []);

    const ouvrirStats = async (id) => {
        setSelectionId(id);
        setChargementStats(true);
        try {
            const { data } = await axios.get(`/api/questionnaire/admin/${id}/stats`);
            if (data.success) setStats(data);
        } catch {
            toast.error("Erreur de chargement des statistiques");
        } finally {
            setChargementStats(false);
        }
    };

    const toggleActif = async (id) => {
        try {
            const { data } = await axios.post(`/api/questionnaire/admin/${id}/toggle`);
            if (data.success) {
                toast.success(data.questionnaire.actif ? "Questionnaire activé" : "Questionnaire désactivé");
                charger();
            }
        } catch {
            toast.error("Erreur");
        }
    };

    const supprimer = async (id) => {
        if (!window.confirm("Supprimer ce questionnaire et toutes ses réponses ?")) return;
        try {
            const { data } = await axios.delete(`/api/questionnaire/admin/${id}`);
            if (data.success) {
                toast.success("Supprimé");
                if (selectionId === id) { setSelectionId(null); setStats(null); }
                charger();
            }
        } catch {
            toast.error("Erreur de suppression");
        }
    };

    const ajouterQuestion = () => setForm((p) => ({ ...p, questions: [...p.questions, nouvelleQuestion(p.questions.length + 1)] }));
    const supprimerQuestion = (i) => setForm((p) => ({ ...p, questions: p.questions.filter((_, idx) => idx !== i) }));
    const majQuestion = (i, champ, valeur) => setForm((p) => ({
        ...p, questions: p.questions.map((q, idx) => (idx === i ? { ...q, [champ]: valeur } : q)),
    }));

    const creer = async () => {
        if (!form.titre.trim()) return toast.error("Titre requis");
        if (form.questions.some((q) => !q.libelle.trim())) return toast.error("Chaque question a besoin d'un libellé");
        try {
            const { data } = await axios.post("/api/questionnaire/admin/create", form);
            if (data.success) {
                toast.success("Questionnaire créé");
                setCreation(false);
                setForm({ titre: "", description: "", declencheur: "manuel", questions: [nouvelleQuestion(1)] });
                charger();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur de création");
        }
    };

    return (
        <div className="qa-page">
            <div className="qa-header">
                <div>
                    <h2>Enquêtes de satisfaction</h2>
                    <p>Crée des questionnaires en étoiles pour ton service, la livraison, ou autre — les réponses sont comptabilisées automatiquement.</p>
                </div>
                <button className="qa-btn-primary" onClick={() => setCreation(true)}>+ Nouveau questionnaire</button>
            </div>

            <div className="qa-layout">
                <div className="qa-liste">
                    {loading ? (
                        <p className="qa-empty">Chargement…</p>
                    ) : liste.length === 0 ? (
                        <p className="qa-empty">Aucun questionnaire pour le moment.</p>
                    ) : (
                        liste.map((q) => (
                            <div key={q._id} className={`qa-item ${selectionId === q._id ? "active" : ""}`} onClick={() => ouvrirStats(q._id)}>
                                <div className="qa-item-top">
                                    <strong>{q.titre}</strong>
                                    <span className={`qa-badge ${q.actif ? "on" : "off"}`}>{q.actif ? "Actif" : "Inactif"}</span>
                                </div>
                                <div className="qa-item-meta">
                                    {q.totalReponses} réponse{q.totalReponses > 1 ? "s" : ""}
                                    {q.moyenneEtoiles != null && <> · <Etoiles valeur={q.moyenneEtoiles} /> {q.moyenneEtoiles}/5</>}
                                </div>
                                <div className="qa-item-actions" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => toggleActif(q._id)}>{q.actif ? "Désactiver" : "Activer"}</button>
                                    <button className="qa-danger" onClick={() => supprimer(q._id)}>Supprimer</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="qa-detail">
                    {chargementStats ? (
                        <p className="qa-empty">Chargement des statistiques…</p>
                    ) : !stats ? (
                        <p className="qa-empty">Sélectionne un questionnaire pour voir ses résultats</p>
                    ) : (
                        <>
                            <h3>{stats.questionnaire.titre}</h3>
                            <div className="qa-stats-top">
                                <div className="qa-stat-card">
                                    <span className="qa-stat-value">{stats.moyenneGlobale}/5</span>
                                    <span className="qa-stat-label">Moyenne globale</span>
                                    <Etoiles valeur={stats.moyenneGlobale} />
                                </div>
                                <div className="qa-stat-card">
                                    <span className="qa-stat-value">{stats.totalReponses}</span>
                                    <span className="qa-stat-label">Réponses reçues</span>
                                </div>
                            </div>

                            <div className="qa-distribution">
                                {[5, 4, 3, 2, 1].map((n) => {
                                    const total = Object.values(stats.distribution).reduce((a, b) => a + b, 0) || 1;
                                    const pct = Math.round(((stats.distribution[n] || 0) / total) * 100);
                                    return (
                                        <div key={n} className="qa-dist-row">
                                            <span>{n} ★</span>
                                            <div className="qa-dist-bar"><div style={{ width: `${pct}%` }} /></div>
                                            <span className="qa-dist-count">{stats.distribution[n] || 0}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <h4>Par question</h4>
                            {stats.statsParQuestion.map((q) => (
                                <div key={q.id} className="qa-question-stat">
                                    <div className="qa-question-stat-top">
                                        <span>{q.libelle}</span>
                                        {q.moyenne != null && <span><Etoiles valeur={q.moyenne} /> {q.moyenne}/5</span>}
                                    </div>
                                    {q.commentaires.length > 0 && (
                                        <ul className="qa-commentaires">
                                            {q.commentaires.slice(0, 5).map((c, i) => <li key={i}>"{c}"</li>)}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {creation && (
                <div className="qa-modal-overlay" onClick={() => setCreation(false)}>
                    <div className="qa-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Nouveau questionnaire</h3>
                        <label>Titre</label>
                        <input value={form.titre} onChange={(e) => setForm((p) => ({ ...p, titre: e.target.value }))} placeholder="Ex. Ton avis sur notre service" />
                        <label>Description (optionnel)</label>
                        <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Une phrase d'intro" />
                        <label>Déclenchement</label>
                        <select value={form.declencheur} onChange={(e) => setForm((p) => ({ ...p, declencheur: e.target.value }))}>
                            {DECLENCHEURS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>

                        <label>Questions</label>
                        {form.questions.map((q, i) => (
                            <div key={q.id} className="qa-question-row">
                                <input value={q.libelle} onChange={(e) => majQuestion(i, "libelle", e.target.value)} placeholder={`Question ${i + 1}`} />
                                <select value={q.type} onChange={(e) => majQuestion(i, "type", e.target.value)}>
                                    <option value="etoiles">Étoiles</option>
                                    <option value="texte">Texte libre</option>
                                </select>
                                {form.questions.length > 1 && <button onClick={() => supprimerQuestion(i)}>✕</button>}
                            </div>
                        ))}
                        <button className="qa-btn-secondary" onClick={ajouterQuestion}>+ Ajouter une question</button>

                        <div className="qa-modal-actions">
                            <button className="qa-btn-secondary" onClick={() => setCreation(false)}>Annuler</button>
                            <button className="qa-btn-primary" onClick={creer}>Créer</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .qa-page { padding: 24px; max-width: 1100px; }
                .qa-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 22px; }
                .qa-header h2 { margin: 0 0 4px; font-size: 20px; }
                .qa-header p { margin: 0; color: #888; font-size: 13px; max-width: 480px; }
                .qa-btn-primary { background: #111; color: #fff; border: none; border-radius: 10px; padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
                .qa-btn-secondary { background: #f1ede4; color: #333; border: none; border-radius: 10px; padding: 9px 16px; font-size: 12.5px; cursor: pointer; }
                .qa-layout { display: grid; grid-template-columns: 320px 1fr; gap: 18px; align-items: start; }
                .qa-liste { display: flex; flex-direction: column; gap: 10px; }
                .qa-item { background: #fff; border: 1px solid #eee5d8; border-radius: 14px; padding: 14px; cursor: pointer; transition: border-color .15s; }
                .qa-item.active { border-color: #111; }
                .qa-item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
                .qa-badge { font-size: 10.5px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
                .qa-badge.on { background: #eef7f0; color: #256029; }
                .qa-badge.off { background: #f1ede4; color: #999; }
                .qa-item-meta { font-size: 11.5px; color: #888; margin-bottom: 8px; }
                .qa-item-actions { display: flex; gap: 8px; }
                .qa-item-actions button { font-size: 11px; padding: 5px 10px; border-radius: 8px; border: 1px solid #e5e0d8; background: #fff; cursor: pointer; }
                .qa-item-actions .qa-danger { color: #c0392b; border-color: #f3d4cf; }
                .qa-detail { background: #fff; border: 1px solid #eee5d8; border-radius: 14px; padding: 20px; min-height: 300px; }
                .qa-empty { color: #999; font-size: 13px; text-align: center; padding: 40px 0; }
                .qa-stats-top { display: flex; gap: 14px; margin: 14px 0 20px; }
                .qa-stat-card { flex: 1; background: #f9f7f2; border-radius: 12px; padding: 14px; text-align: center; }
                .qa-stat-value { display: block; font-size: 24px; font-weight: 700; }
                .qa-stat-label { display: block; font-size: 11px; color: #888; margin: 2px 0 6px; }
                .qa-etoiles-lecture span { color: #ddd5c4; font-size: 14px; }
                .qa-etoiles-lecture span.pleine { color: #f5a623; }
                .qa-distribution { margin-bottom: 24px; }
                .qa-dist-row { display: flex; align-items: center; gap: 10px; font-size: 12px; margin-bottom: 6px; }
                .qa-dist-row span:first-child { width: 30px; color: #888; }
                .qa-dist-bar { flex: 1; height: 8px; background: #f1ede4; border-radius: 4px; overflow: hidden; }
                .qa-dist-bar div { height: 100%; background: #f5a623; }
                .qa-dist-count { width: 24px; text-align: right; color: #888; }
                .qa-question-stat { border-top: 1px solid #f1ede4; padding: 12px 0; }
                .qa-question-stat-top { display: flex; justify-content: space-between; font-size: 13px; }
                .qa-commentaires { margin: 8px 0 0; padding-left: 18px; font-size: 12px; color: #666; }
                .qa-commentaires li { margin-bottom: 4px; }

                .qa-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 50; }
                .qa-modal { background: #fff; border-radius: 16px; padding: 22px; width: 420px; max-height: 85vh; overflow-y: auto; }
                .qa-modal h3 { margin: 0 0 14px; }
                .qa-modal label { display: block; font-size: 12px; font-weight: 600; color: #555; margin: 12px 0 5px; }
                .qa-modal input, .qa-modal select { width: 100%; border: 1px solid #e5e0d8; border-radius: 10px; padding: 9px 11px; font-size: 13px; box-sizing: border-box; }
                .qa-question-row { display: flex; gap: 6px; margin-bottom: 8px; }
                .qa-question-row input { flex: 1; }
                .qa-question-row select { width: 110px; flex-shrink: 0; }
                .qa-question-row button { flex-shrink: 0; border: none; background: #f1ede4; border-radius: 8px; width: 32px; cursor: pointer; }
                .qa-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }

                @media (max-width: 800px) {
                    .qa-layout { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default QuestionnairesAdmin;