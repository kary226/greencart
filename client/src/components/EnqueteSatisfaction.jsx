import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";

// Petite carte d'avis en étoiles, autonome — se charge elle-même via l'API
// (le déclencheur détermine quel questionnaire actif proposer, ex. "colis_livre"),
// se cache si aucun questionnaire actif n'existe ou si le client a déjà répondu.
// contexteId sert à retrouver le colis/la commande concerné(e) et à empêcher un
// second avis pour le même élément.
const Etoiles = ({ valeur, onChange }) => (
    <div className="enq-etoiles">
        {[1, 2, 3, 4, 5].map((n) => (
            <button
                key={n}
                type="button"
                className={`enq-etoile ${n <= valeur ? "pleine" : ""}`}
                onClick={() => onChange(n)}
                aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
            >
                ★
            </button>
        ))}
    </div>
);

const EnqueteSatisfaction = ({ declencheur, contexteType, contexteId }) => {
    const { axios, user } = useAppContext();
    const [questionnaire, setQuestionnaire] = useState(null);
    const [reponses, setReponses] = useState({});
    const [commentaire, setCommentaire] = useState("");
    const [envoi, setEnvoi] = useState(false);
    const [envoye, setEnvoye] = useState(false);
    const [masque, setMasque] = useState(false);

    useEffect(() => {
        axios.get(`/api/questionnaire/actif?declencheur=${declencheur}`)
            .then(({ data }) => { if (data.success && data.questionnaire) setQuestionnaire(data.questionnaire); else setMasque(true); })
            .catch(() => setMasque(true));
    }, [declencheur]);

    if (masque || !questionnaire || !user) return null;

    const noter = (questionId, valeur) => setReponses((p) => ({ ...p, [questionId]: valeur }));

    const envoyer = async () => {
        const questionsEtoiles = questionnaire.questions.filter((q) => q.type === "etoiles");
        if (questionsEtoiles.some((q) => !reponses[q.id])) {
            toast.error("Merci de noter chaque question avant d'envoyer");
            return;
        }
        setEnvoi(true);
        try {
            const payload = questionnaire.questions.map((q) => ({
                questionId: q.id,
                etoiles: q.type === "etoiles" ? reponses[q.id] : undefined,
                texte: q.type === "texte" ? commentaire : undefined,
            }));
            const { data } = await axios.post(`/api/questionnaire/${questionnaire._id}/repondre`, {
                userId: user._id,
                userName: user.name,
                reponses: payload,
                contexteType,
                contexteId,
            });
            if (data.success) {
                setEnvoye(true);
                toast.success("Merci pour ton avis !");
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur d'envoi");
        } finally {
            setEnvoi(false);
        }
    };

    if (envoye) {
        return (
            <div className="enq-card enq-merci">
                🌟 Merci pour ton avis, ça nous aide à nous améliorer !
                <style>{`.enq-merci { background: #eef7f0; color: #256029; border-radius: 14px; padding: 16px; text-align: center; font-size: 13.5px; font-weight: 600; margin: 12px 0; }`}</style>
            </div>
        );
    }

    return (
        <div className="enq-card">
            <h4>{questionnaire.titre}</h4>
            {questionnaire.description && <p className="enq-desc">{questionnaire.description}</p>}

            {questionnaire.questions.map((q) => (
                <div key={q.id} className="enq-question">
                    <span>{q.libelle}</span>
                    {q.type === "etoiles" ? (
                        <Etoiles valeur={reponses[q.id] || 0} onChange={(v) => noter(q.id, v)} />
                    ) : (
                        <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Ton commentaire (optionnel)" rows={2} />
                    )}
                </div>
            ))}

            <button className="enq-btn" onClick={envoyer} disabled={envoi}>{envoi ? "Envoi…" : "Envoyer mon avis"}</button>

            <style>{`
                .enq-card { background: #fff; border: 1px solid #eee5d8; border-radius: 16px; padding: 16px; margin: 12px 0; }
                .enq-card h4 { margin: 0 0 4px; font-size: 14px; }
                .enq-desc { margin: 0 0 12px; font-size: 12px; color: #888; }
                .enq-question { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; font-size: 13px; color: #333; }
                .enq-question textarea { border: 1px solid #e5e0d8; border-radius: 10px; padding: 8px 10px; font-size: 13px; font-family: inherit; resize: vertical; }
                .enq-etoiles { display: flex; gap: 4px; }
                .enq-etoile { background: none; border: none; font-size: 26px; line-height: 1; color: #ddd5c4; cursor: pointer; padding: 0; transition: color .15s, transform .1s; }
                .enq-etoile:hover { transform: scale(1.12); }
                .enq-etoile.pleine { color: #f5a623; }
                .enq-btn { width: 100%; padding: 11px; border-radius: 12px; border: none; background: #111; color: #fff; font-weight: 600; font-size: 13px; cursor: pointer; }
                .enq-btn:disabled { opacity: .6; cursor: default; }
            `}</style>
        </div>
    );
};

export default EnqueteSatisfaction;