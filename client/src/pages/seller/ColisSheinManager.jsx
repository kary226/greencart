import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";

const STATUTS = [
    "soumis", "en_verification", "devis_envoye", "acompte_paye",
    "achete", "en_entrepot", "pese", "solde_du", "solde_paye", "en_livraison", "livre", "annule",
];

const STATUT_LABELS = {
    soumis: "Soumis — à vérifier",
    en_verification: "En cours de vérification",
    devis_envoye: "Devis envoyé — en attente de paiement",
    acompte_paye: "Articles payés",
    achete: "Acheté chez SHEIN",
    en_entrepot: "En entrepôt",
    pese: "Pesé — en attente de paiement",
    solde_du: "Livraison due",
    solde_paye: "Livraison payée",
    en_livraison: "En livraison",
    livre: "Livré",
    annule: "Annulé",
};

// Une seule action "évidente" par étape — ce que l'admin doit faire ensuite,
// sans avoir à deviner parmi 12 statuts. Les étapes sans action ici sont des
// étapes d'attente (paiement du client, traité automatiquement par le webhook).
const PROCHAINE_ACTION = {
    acompte_paye: { label: "Marquer comme acheté chez SHEIN", cible: "achete" },
    achete: { label: "✅ Confirmer l'arrivée à Abidjan", cible: "en_entrepot" },
    solde_paye: { label: "Marquer en cours de livraison", cible: "en_livraison" },
    en_livraison: { label: "Marquer livré", cible: "livre" },
};

const money = (n, devise) => `${devise === "EUR" ? "€" : "$"}${Number(n || 0).toFixed(2)}`;
const dateCourteFr = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

const ColisSheinManager = () => {
    const { axios } = useAppContext();
    const [colisListe, setColisListe] = useState([]);
    const [filtreStatut, setFiltreStatut] = useState("soumis");
    const [selection, setSelection] = useState(null);
    const [articlesEdit, setArticlesEdit] = useState([]);
    const [deviseEdit, setDeviseEdit] = useState(null);
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState([]);
    const [texte, setTexte] = useState("");
    const [imageChoisie, setImageChoisie] = useState(null);
    const [envoi, setEnvoi] = useState(false);
    const [reponsesRapides, setReponsesRapides] = useState([]);
    const [gererReponses, setGererReponses] = useState(false);
    const [nouvelleReponse, setNouvelleReponse] = useState("");

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
    const totalArticlesEdit = articlesEdit.reduce((sum, a) => sum + (Number(a.prixUnitaire) || 0) * (Number(a.quantite) || 0), 0);
    const tauxDisponible = deviseEdit ? Number(tauxSaved[deviseEdit.toLowerCase()]) || null : null;

    // --- Horaires de service (Setting "sheinHoraires") ---
    const [horaires, setHoraires] = useState({ ouverture: "08:00", fermeture: "19:00" });
    const [horairesSaved, setHorairesSaved] = useState({ ouverture: "08:00", fermeture: "19:00" });
    const [savingHoraires, setSavingHoraires] = useState(false);
    const horairesModifie = horaires.ouverture !== horairesSaved.ouverture || horaires.fermeture !== horairesSaved.fermeture;

    const fetchHoraires = async () => {
        try {
            const { data } = await axios.get("/api/setting/sheinHoraires");
            if (data.success && data.data) {
                setHoraires({ ouverture: data.data.ouverture || "08:00", fermeture: data.data.fermeture || "19:00" });
                setHorairesSaved({ ouverture: data.data.ouverture || "08:00", fermeture: data.data.fermeture || "19:00" });
            }
        } catch (error) {
            // pas encore configuré — reste sur la valeur par défaut 8h-19h
        }
    };

    const enregistrerHoraires = async () => {
        setSavingHoraires(true);
        try {
            const { data } = await axios.post("/api/setting/update", { key: "sheinHoraires", value: horaires });
            if (data.success) {
                toast.success("Horaires de service enregistrés");
                setHorairesSaved(horaires);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error("Erreur d'enregistrement des horaires");
        } finally {
            setSavingHoraires(false);
        }
    };

    // --- Message de bienvenue automatique (Setting "sheinMessageBienvenue") ---
    const MESSAGE_BIENVENUE_DEFAUT =
        "Merci pour votre commande ! Elle a bien été reçue et un agent vous répondra très prochainement pour vous envoyer votre devis.";
    const [messageBienvenue, setMessageBienvenue] = useState(MESSAGE_BIENVENUE_DEFAUT);
    const [messageBienvenueSaved, setMessageBienvenueSaved] = useState(MESSAGE_BIENVENUE_DEFAUT);
    const [savingMessageBienvenue, setSavingMessageBienvenue] = useState(false);
    const messageBienvenueModifie = messageBienvenue !== messageBienvenueSaved;

    const fetchMessageBienvenue = async () => {
        try {
            const { data } = await axios.get("/api/setting/sheinMessageBienvenue");
            if (data.success && data.data) {
                setMessageBienvenue(data.data);
                setMessageBienvenueSaved(data.data);
            }
        } catch (error) {
            // pas encore configuré — reste sur le texte par défaut
        }
    };

    const enregistrerMessageBienvenue = async () => {
        setSavingMessageBienvenue(true);
        try {
            const { data } = await axios.post("/api/setting/update", { key: "sheinMessageBienvenue", value: messageBienvenue });
            if (data.success) {
                toast.success("Message de bienvenue enregistré");
                setMessageBienvenueSaved(messageBienvenue);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error("Erreur d'enregistrement du message");
        } finally {
            setSavingMessageBienvenue(false);
        }
    };

    // --- Vue "Livraisons" : suivi des dates estimées pour tous les colis en cours de livraison ---
    const [vue, setVue] = useState("suivi"); // "suivi" | "livraisons"
    const [colisLivraison, setColisLivraison] = useState([]);
    const [loadingLivraisons, setLoadingLivraisons] = useState(false);

    const fetchLivraisons = async () => {
        setLoadingLivraisons(true);
        try {
            const { data } = await axios.get("/api/shein-cart/admin/all?statut=en_livraison");
            if (data.success) {
                const tries = [...data.colis].sort((a, b) => new Date(a.livraison?.dateFin || 0) - new Date(b.livraison?.dateFin || 0));
                setColisLivraison(tries);
            }
        } catch (error) {
            toast.error("Erreur de chargement des livraisons");
        } finally {
            setLoadingLivraisons(false);
        }
    };

    useEffect(() => { if (vue === "livraisons") fetchLivraisons(); }, [vue]);

    // --- Vue "Avis clients" : moyenne, distribution par étoile, derniers commentaires ---
    const [statsAvis, setStatsAvis] = useState({ total: 0, moyenne: 0, distribution: {} });
    const [listeAvis, setListeAvis] = useState([]);
    const [loadingAvis, setLoadingAvis] = useState(false);

    const fetchStatsAvis = async () => {
        setLoadingAvis(true);
        try {
            const { data } = await axios.get("/api/shein-cart/admin/avis/stats");
            if (data.success) {
                setStatsAvis(data.stats);
                setListeAvis(data.avis);
            }
        } catch (error) {
            toast.error("Erreur de chargement des avis");
        } finally {
            setLoadingAvis(false);
        }
    };

    useEffect(() => { if (vue === "avis") fetchStatsAvis(); }, [vue]);

    const joursRestants = (dateFin) => {
        if (!dateFin) return null;
        const diff = Math.ceil((new Date(dateFin) - new Date()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    // --- Estimation d'arrivée à Abidjan (posée juste après le paiement de l'acompte) ---
    const [arriveeModal, setArriveeModal] = useState(false);
    const [arriveeForm, setArriveeForm] = useState({ dateDebut: "", dateFin: "" });

    const ouvrirModalArrivee = () => {
        const dansCinqJours = new Date();
        dansCinqJours.setDate(dansCinqJours.getDate() + 5);
        const dansDixJours = new Date();
        dansDixJours.setDate(dansDixJours.getDate() + 10);
        setArriveeForm({
            dateDebut: selection?.estimationArrivee?.dateDebut ? new Date(selection.estimationArrivee.dateDebut).toISOString().slice(0, 10) : dansCinqJours.toISOString().slice(0, 10),
            dateFin: selection?.estimationArrivee?.dateFin ? new Date(selection.estimationArrivee.dateFin).toISOString().slice(0, 10) : dansDixJours.toISOString().slice(0, 10),
        });
        setArriveeModal(true);
    };

    const confirmerEstimationArrivee = async () => {
        const { dateDebut, dateFin } = arriveeForm;
        if (!dateDebut || !dateFin) {
            toast.error("Les deux dates sont requises");
            return;
        }
        if (new Date(dateFin) < new Date(dateDebut)) {
            toast.error("La date de fin doit être après la date de début");
            return;
        }
        try {
            const { data } = await axios.post(`/api/shein-cart/admin/${selection._id}/estimation-arrivee`, { dateDebut, dateFin });
            if (data.success) {
                toast.success("Estimation communiquée au client");
                setSelection(data.colis);
                setArriveeModal(false);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur d'enregistrement");
        }
    };

    // --- Raccourci "Demander un avis" (carte étoiles envoyée dans le chat) ---
    const [envoiDemandeAvis, setEnvoiDemandeAvis] = useState(false);

    const demanderAvisClient = async () => {
        setEnvoiDemandeAvis(true);
        try {
            const { data } = await axios.post(`/api/shein-cart/admin/${selection._id}/demander-avis`);
            if (data.success) {
                toast.success("Demande d'avis envoyée au client");
                setMessages((prev) => [...prev, data.message]);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur d'envoi");
        } finally {
            setEnvoiDemandeAvis(false);
        }
    };
    const [livraisonModal, setLivraisonModal] = useState(false);
    const [livraisonForm, setLivraisonForm] = useState({ dateDebut: "", dateFin: "" });

    const ouvrirModalLivraison = () => {
        const dansUneSemaine = new Date();
        dansUneSemaine.setDate(dansUneSemaine.getDate() + 7);
        const dansDeuxSemaines = new Date();
        dansDeuxSemaines.setDate(dansDeuxSemaines.getDate() + 14);
        setLivraisonForm({
            dateDebut: selection?.livraison?.dateDebut ? new Date(selection.livraison.dateDebut).toISOString().slice(0, 10) : dansUneSemaine.toISOString().slice(0, 10),
            dateFin: selection?.livraison?.dateFin ? new Date(selection.livraison.dateFin).toISOString().slice(0, 10) : dansDeuxSemaines.toISOString().slice(0, 10),
        });
        setLivraisonModal(true);
    };

    const confirmerLivraison = async () => {
        const { dateDebut, dateFin } = livraisonForm;
        if (!dateDebut || !dateFin) {
            toast.error("Les deux dates sont requises");
            return;
        }
        if (new Date(dateFin) < new Date(dateDebut)) {
            toast.error("La date de fin doit être après la date de début");
            return;
        }
        try {
            const { data } = await axios.post(`/api/shein-cart/admin/${selection._id}/statut`, {
                statut: "en_livraison", dateLivraisonDebut: dateDebut, dateLivraisonFin: dateFin,
            });
            if (data.success) {
                toast.success("Livraison en cours — dates communiquées au client");
                setSelection(data.colis);
                fetchListe(filtreStatut);
                setLivraisonModal(false);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur d'enregistrement");
        }
    };

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

    useEffect(() => { fetchTaux(); fetchHoraires(); fetchMessageBienvenue(); }, []);
    useEffect(() => {
        axios.get("/api/setting/sheinReponsesRapides")
            .then(({ data }) => { if (data.success && Array.isArray(data.data)) setReponsesRapides(data.data); })
            .catch(() => {});
    }, []);

    const sauvegarderReponsesRapides = async (liste) => {
        try {
            const { data } = await axios.post("/api/setting/update", { key: "sheinReponsesRapides", value: liste });
            if (data.success) setReponsesRapides(liste);
        } catch (error) {
            toast.error("Erreur d'enregistrement");
        }
    };

    const ajouterReponseRapide = () => {
        if (!nouvelleReponse.trim()) return;
        sauvegarderReponsesRapides([...reponsesRapides, nouvelleReponse.trim()]);
        setNouvelleReponse("");
    };

    const supprimerReponseRapide = (index) => {
        sauvegarderReponsesRapides(reponsesRapides.filter((_, i) => i !== index));
    };
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
                setDeviseEdit(data.colis.devise || null);
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
            const { data } = await axios.post(`/api/shein-cart/admin/${selection._id}/validate`, { articles: articlesEdit, devise: deviseEdit });
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

    const changerStatut = async (statut, silencieux = false) => {
        // Le passage en livraison exige une fenêtre de dates estimée — on passe
        // toujours par la modale dédiée plutôt qu'un changement de statut direct.
        if (statut === "en_livraison") {
            ouvrirModalLivraison();
            return;
        }
        const note = silencieux ? "" : (window.prompt(`Note pour ce changement vers "${statut}" (optionnel) :`) || "");
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

    const [peseeModal, setPeseeModal] = useState(false);
    const [peseeForm, setPeseeForm] = useState({ poidsReel: "", tauxParKilo: "", fraisLivraisonAbidjan: "0" });

    const ouvrirModalPesee = () => {
        setPeseeForm({
            poidsReel: "",
            tauxParKilo: selection?.devis?.tauxParKilo || "",
            fraisLivraisonAbidjan: selection?.devis?.fraisLivraisonEstime || "0",
        });
        setPeseeModal(true);
    };

    const confirmerPesee = async () => {
        const { poidsReel, tauxParKilo, fraisLivraisonAbidjan } = peseeForm;
        if (!poidsReel || !tauxParKilo) {
            toast.error("Poids et taux au kilo requis");
            return;
        }
        try {
            const { data } = await axios.post(`/api/shein-cart/admin/${selection._id}/statut`, {
                statut: "pese", poidsReel, tauxParKilo, fraisLivraisonAbidjan,
            });
            if (data.success) {
                toast.success("Pesée enregistrée, devis livraison envoyé dans le chat");
                setSelection(data.colis);
                fetchListe(filtreStatut);
                setPeseeModal(false);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Erreur de pesée");
        }
    };

    const peseeTotal = (Number(peseeForm.poidsReel) || 0) * (Number(peseeForm.tauxParKilo) || 0) + (Number(peseeForm.fraisLivraisonAbidjan) || 0);

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

            <div className="csm-taux-bar">
                <span className="csm-taux-label">Horaires de service</span>
                <label>Ouverture <input type="time" value={horaires.ouverture} onChange={(e) => setHoraires((p) => ({ ...p, ouverture: e.target.value }))} /></label>
                <label>Fermeture <input type="time" value={horaires.fermeture} onChange={(e) => setHoraires((p) => ({ ...p, fermeture: e.target.value }))} /></label>
                <button onClick={enregistrerHoraires} disabled={!horairesModifie || savingHoraires} className="csm-taux-save">
                    {savingHoraires ? "Enregistrement…" : "Enregistrer"}
                </button>
                <span className="csm-horaires-info">Le client voit "Fermé" en dehors de cette plage</span>
            </div>

            <div className="csm-taux-bar" style={{ flexDirection: "column", alignItems: "stretch", gap: "8px" }}>
                <span className="csm-taux-label">Message de bienvenue automatique</span>
                <p className="csm-horaires-info" style={{ margin: 0 }}>
                    Envoyé automatiquement au client dès qu'il soumet une commande, avant qu'un agent ne réponde.
                </p>
                <textarea
                    value={messageBienvenue}
                    onChange={(e) => setMessageBienvenue(e.target.value)}
                    rows={3}
                    maxLength={500}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e5c6c6", fontFamily: "inherit", fontSize: "13px", resize: "vertical" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button onClick={enregistrerMessageBienvenue} disabled={!messageBienvenueModifie || savingMessageBienvenue} className="csm-taux-save">
                        {savingMessageBienvenue ? "Enregistrement…" : "Enregistrer"}
                    </button>
                    <span className="csm-horaires-info">{messageBienvenue.length}/500</span>
                </div>
            </div>

            <div className="csm-tabs">
                <button className={`csm-tab ${vue === "suivi" ? "active" : ""}`} onClick={() => setVue("suivi")}>Suivi des colis</button>
                <button className={`csm-tab ${vue === "livraisons" ? "active" : ""}`} onClick={() => setVue("livraisons")}>Livraisons en cours</button>
                <button className={`csm-tab ${vue === "avis" ? "active" : ""}`} onClick={() => setVue("avis")}>⭐ Avis clients{statsAvis.total > 0 ? ` (${statsAvis.total})` : ""}</button>
            </div>

            {vue === "livraisons" ? (
                <div className="csm-livraisons">
                    {loadingLivraisons ? (
                        <p className="csm-empty">Chargement…</p>
                    ) : colisLivraison.length === 0 ? (
                        <p className="csm-empty">Aucun colis en cours de livraison</p>
                    ) : (
                        <table className="csm-livraisons-table">
                            <thead>
                                <tr>
                                    <th>Colis</th>
                                    <th>Client</th>
                                    <th>Livraison estimée</th>
                                    <th>Statut</th>
                                </tr>
                            </thead>
                            <tbody>
                                {colisLivraison.map((c) => {
                                    const jours = joursRestants(c.livraison?.dateFin);
                                    return (
                                        <tr key={c._id}>
                                            <td>{c.numeroSuivi}</td>
                                            <td>{c.userId?.name || c.userId?.email}</td>
                                            <td>
                                                {c.livraison?.dateDebut && c.livraison?.dateFin
                                                    ? `${dateCourteFr(c.livraison.dateDebut)} → ${dateCourteFr(c.livraison.dateFin)}`
                                                    : "—"}
                                            </td>
                                            <td>
                                                {jours == null ? "—" : jours < 0 ? (
                                                    <span className="csm-retard">En retard de {Math.abs(jours)}j</span>
                                                ) : jours === 0 ? (
                                                    <span className="csm-aujourdhui">Aujourd'hui</span>
                                                ) : (
                                                    <span>Dans {jours}j</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : vue === "avis" ? (
                <div className="csm-avis-overview">
                    {loadingAvis ? (
                        <p className="csm-empty">Chargement…</p>
                    ) : statsAvis.total === 0 ? (
                        <p className="csm-empty">Aucun avis reçu pour l'instant — utilise le raccourci "⭐ Demander un avis" dans une conversation.</p>
                    ) : (
                        <>
                            <div className="csm-avis-summary">
                                <div className="csm-avis-moyenne">
                                    <span className="csm-avis-moyenne-chiffre">{statsAvis.moyenne}</span>
                                    <div className="csm-avis-moyenne-etoiles">
                                        {[1, 2, 3, 4, 5].map((n) => (
                                            <span key={n} className={n <= Math.round(statsAvis.moyenne) ? "pleine" : "vide"}>★</span>
                                        ))}
                                    </div>
                                    <span className="csm-avis-moyenne-total">{statsAvis.total} avis</span>
                                </div>
                                <div className="csm-avis-distribution">
                                    {[5, 4, 3, 2, 1].map((n) => {
                                        const count = statsAvis.distribution[n] || 0;
                                        const pct = statsAvis.total > 0 ? Math.round((count / statsAvis.total) * 100) : 0;
                                        return (
                                            <div key={n} className="csm-avis-bar-row">
                                                <span className="csm-avis-bar-label">{n}★</span>
                                                <div className="csm-avis-bar-track"><div className="csm-avis-bar-fill" style={{ width: `${pct}%` }} /></div>
                                                <span className="csm-avis-bar-count">{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="csm-avis-liste">
                                {listeAvis.map((a) => (
                                    <div key={a._id} className="csm-avis-item">
                                        <div className="csm-avis-item-top">
                                            <span className="csm-avis-item-etoiles">{"★".repeat(a.etoiles)}{"☆".repeat(5 - a.etoiles)}</span>
                                            <span className="csm-avis-item-date">{dateCourteFr(a.createdAt)}</span>
                                        </div>
                                        <p className="csm-avis-item-meta">{a.userId?.name || a.userId?.email || "Client"} · {a.colisId?.numeroSuivi || "—"}</p>
                                        {a.commentaire && <p className="csm-avis-item-comment">"{a.commentaire}"</p>}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            ) : (
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

                            <div className="csm-etape-actuelle">
                                <span className="csm-etape-label">Étape actuelle</span>
                                <p className="csm-etape-value">{STATUT_LABELS[selection.statut] || selection.statut}</p>
                            </div>

                            {selection.estimationArrivee?.dateDebut && selection.estimationArrivee?.dateFin && (
                                <div className={`csm-livraison-info ${selection.estimationArrivee.confirmee ? "csm-arrivee-confirmee" : ""}`}>
                                    <span>
                                        🚚 Arrivée Abidjan estimée : {dateCourteFr(selection.estimationArrivee.dateDebut)} → {dateCourteFr(selection.estimationArrivee.dateFin)}
                                        {selection.estimationArrivee.confirmee && ` — confirmée le ${dateCourteFr(selection.estimationArrivee.dateConfirmee)}`}
                                    </span>
                                    {!selection.estimationArrivee.confirmee && (
                                        <button className="csm-btn-secondary" onClick={ouvrirModalArrivee}>Modifier</button>
                                    )}
                                </div>
                            )}

                            {selection.livraison?.dateDebut && selection.livraison?.dateFin && (
                                <div className="csm-livraison-info">
                                    <span>📦 Livraison estimée : {dateCourteFr(selection.livraison.dateDebut)} → {dateCourteFr(selection.livraison.dateFin)}</span>
                                    <button className="csm-btn-secondary" onClick={ouvrirModalLivraison}>Modifier</button>
                                </div>
                            )}

                            {(selection.statut === "soumis" || selection.statut === "en_verification") && (
                                <>
                                    <h4>Articles à vérifier</h4>
                                    {articlesEdit.map((a, i) => (
                                        <div key={i} className="csm-article-row">
                                            <input value={a.nom} onChange={(e) => updateArticle(i, "nom", e.target.value)} className="csm-nom" />
                                            <input type="number" step="0.01" value={a.prixUnitaire} onChange={(e) => updateArticle(i, "prixUnitaire", e.target.value)} className="csm-prix" />
                                            <input type="number" value={a.quantite} onChange={(e) => updateArticle(i, "quantite", e.target.value)} className="csm-qte" />
                                            <span className="csm-souligne">{money(a.prixUnitaire * a.quantite, deviseEdit)}</span>
                                        </div>
                                    ))}

                                    <div className="csm-devise-row">
                                        <label>Devise</label>
                                        <select value={deviseEdit || ""} onChange={(e) => setDeviseEdit(e.target.value || null)}>
                                            <option value="">Non détectée — à choisir</option>
                                            <option value="USD">USD ($)</option>
                                            <option value="EUR">EUR (€)</option>
                                        </select>
                                        {!deviseEdit && <span className="csm-devise-warning">Requis pour calculer le FCFA</span>}
                                    </div>

                                    <div className="csm-apercu-total">
                                        <div>
                                            <span>Total articles</span>
                                            <strong>{money(totalArticlesEdit, deviseEdit)}</strong>
                                        </div>
                                        <div>
                                            <span>Équivalent FCFA</span>
                                            <strong className={!tauxDisponible ? "csm-fcfa-manquant" : ""}>
                                                {tauxDisponible ? `${Math.round(totalArticlesEdit * tauxDisponible).toLocaleString("fr-FR")} FCFA` : "Taux manquant"}
                                            </strong>
                                        </div>
                                    </div>

                                    <button onClick={validerDevis} className="csm-btn-guide" disabled={!deviseEdit || !tauxDisponible}>
                                        Envoyer le devis des articles au client
                                    </button>
                                </>
                            )}

                            {selection.statut === "en_entrepot" && (
                                <button onClick={ouvrirModalPesee} className="csm-btn-guide">Enregistrer la pesée et envoyer le devis livraison</button>
                            )}

                            {(selection.statut === "acompte_paye" || selection.statut === "achete") && (
                                <button onClick={ouvrirModalArrivee} className="csm-btn-secondary csm-btn-full">
                                    📅 {selection.estimationArrivee?.dateDebut ? "Modifier" : "Définir"} l'estimation d'arrivée à Abidjan
                                </button>
                            )}

                            {PROCHAINE_ACTION[selection.statut] && (
                                <button onClick={() => changerStatut(PROCHAINE_ACTION[selection.statut].cible, true)} className="csm-btn-guide">
                                    {PROCHAINE_ACTION[selection.statut].label}
                                </button>
                            )}

                            {(selection.statut === "devis_envoye" || selection.statut === "pese") && (
                                <p className="csm-attente">En attente du paiement du client — la suite se fera automatiquement dès confirmation GeniusPay.</p>
                            )}

                            <details className="csm-avance">
                                <summary>Options avancées (correction manuelle du statut)</summary>
                                <div className="csm-statuts">
                                    {STATUTS.map((s) => (
                                        <button key={s} className={`csm-statut-btn ${selection.statut === s ? "active" : ""}`} onClick={() => changerStatut(s)}>{s}</button>
                                    ))}
                                </div>
                                {articlesEdit.length > 0 && selection.statut !== "soumis" && selection.statut !== "en_verification" && (
                                    <>
                                        <p className="csm-avance-titre">Articles (si correction nécessaire)</p>
                                        {articlesEdit.map((a, i) => (
                                            <div key={i} className="csm-article-row">
                                                <input value={a.nom} onChange={(e) => updateArticle(i, "nom", e.target.value)} className="csm-nom" />
                                                <input type="number" step="0.01" value={a.prixUnitaire} onChange={(e) => updateArticle(i, "prixUnitaire", e.target.value)} className="csm-prix" />
                                                <input type="number" value={a.quantite} onChange={(e) => updateArticle(i, "quantite", e.target.value)} className="csm-qte" />
                                            </div>
                                        ))}
                                        <button onClick={validerDevis} className="csm-btn-secondary">Renvoyer un devis corrigé</button>
                                    </>
                                )}
                            </details>

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
                                    {messages.map((m) => {
                                        if (m.type === "systeme") {
                                            return <div key={m._id} className="csm-badge-systeme">{m.texte}</div>;
                                        }
                                        if (m.type === "devis") {
                                            return (
                                                <div key={m._id} className="csm-devis-card">
                                                    <span>{m.payload?.libelle}</span>
                                                    <strong>{Math.round(m.payload?.montant || 0).toLocaleString("fr-FR")} FCFA</strong>
                                                    {m.payload?.detail && <em>{m.payload.detail}</em>}
                                                </div>
                                            );
                                        }
                                        if (m.type === "avis") {
                                            return (
                                                <div key={m._id} className="csm-avis-card-admin">
                                                    <span>⭐ Demande d'avis envoyée</span>
                                                    {m.payload?.repondu ? (
                                                        <strong>{"⭐".repeat(m.payload.etoilesDonnees)} ({m.payload.etoilesDonnees}/5)</strong>
                                                    ) : (
                                                        <em>En attente de réponse du client</em>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={m._id} className={`csm-msg ${m.expediteurRole}`}>
                                                {m.imageUrl && <img src={m.imageUrl} alt="" className="csm-msg-img" onClick={() => window.open(m.imageUrl, "_blank")} />}
                                                {m.texte && <p>{m.texte}</p>}
                                                <span className="csm-msg-heure">
                                                    {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="csm-quick-replies">
                                    {reponsesRapides.map((r, i) => (
                                        <button key={i} onClick={() => setTexte(r)}>{r}</button>
                                    ))}
                                    <button className="csm-quick-avis" onClick={demanderAvisClient} disabled={envoiDemandeAvis}>
                                        ⭐ Demander un avis
                                    </button>
                                    <button className="csm-quick-edit" onClick={() => setGererReponses(true)}>⚙</button>
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
                                {reponsesRapides.length === 0 && (
                                    <button className="csm-manage-replies-empty" onClick={() => setGererReponses(true)}>+ Configurer des réponses rapides</button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
            )}

            {arriveeModal && (
                <div className="csm-modal-overlay" onClick={() => setArriveeModal(false)}>
                    <div className="csm-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Estimation d'arrivée à Abidjan</h3>
                        <p className="csm-modal-hint">Fenêtre large (achat + transit) communiquée au client en attendant l'arrivée réelle en entrepôt.</p>
                        <div className="csm-pesee-field">
                            <label>Arrivée à partir du</label>
                            <input type="date" value={arriveeForm.dateDebut} onChange={(e) => setArriveeForm((p) => ({ ...p, dateDebut: e.target.value }))} autoFocus />
                        </div>
                        <div className="csm-pesee-field">
                            <label>Jusqu'au</label>
                            <input type="date" value={arriveeForm.dateFin} onChange={(e) => setArriveeForm((p) => ({ ...p, dateFin: e.target.value }))} />
                        </div>
                        <div className="csm-pesee-actions">
                            <button className="csm-btn-secondary" onClick={() => setArriveeModal(false)}>Annuler</button>
                            <button className="csm-btn-primary" onClick={confirmerEstimationArrivee}>Confirmer et prévenir le client</button>
                        </div>
                    </div>
                </div>
            )}

            {livraisonModal && (
                <div className="csm-modal-overlay" onClick={() => setLivraisonModal(false)}>
                    <div className="csm-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Fenêtre de livraison estimée</h3>
                        <p className="csm-modal-hint">Ces dates seront communiquées au client dans le chat.</p>
                        <div className="csm-pesee-field">
                            <label>Livraison à partir du</label>
                            <input type="date" value={livraisonForm.dateDebut} onChange={(e) => setLivraisonForm((p) => ({ ...p, dateDebut: e.target.value }))} autoFocus />
                        </div>
                        <div className="csm-pesee-field">
                            <label>Jusqu'au</label>
                            <input type="date" value={livraisonForm.dateFin} onChange={(e) => setLivraisonForm((p) => ({ ...p, dateFin: e.target.value }))} />
                        </div>
                        <div className="csm-pesee-actions">
                            <button className="csm-btn-secondary" onClick={() => setLivraisonModal(false)}>Annuler</button>
                            <button className="csm-btn-primary" onClick={confirmerLivraison}>Confirmer et prévenir le client</button>
                        </div>
                    </div>
                </div>
            )}

            {peseeModal && (
                <div className="csm-modal-overlay" onClick={() => setPeseeModal(false)}>
                    <div className="csm-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Enregistrer la pesée</h3>
                        <div className="csm-pesee-field">
                            <label>Poids réel (kg)</label>
                            <input type="number" step="0.1" value={peseeForm.poidsReel} onChange={(e) => setPeseeForm((p) => ({ ...p, poidsReel: e.target.value }))} autoFocus />
                        </div>
                        <div className="csm-pesee-field">
                            <label>Taux par kilo (FCFA)</label>
                            <input type="number" value={peseeForm.tauxParKilo} onChange={(e) => setPeseeForm((p) => ({ ...p, tauxParKilo: e.target.value }))} />
                        </div>
                        <div className="csm-pesee-field">
                            <label>Frais de livraison à Abidjan (FCFA)</label>
                            <input type="number" value={peseeForm.fraisLivraisonAbidjan} onChange={(e) => setPeseeForm((p) => ({ ...p, fraisLivraisonAbidjan: e.target.value }))} />
                        </div>
                        <div className="csm-pesee-total">Total à payer : <strong>{Math.round(peseeTotal).toLocaleString("fr-FR")} FCFA</strong></div>
                        <div className="csm-pesee-actions">
                            <button className="csm-btn-secondary" onClick={() => setPeseeModal(false)}>Annuler</button>
                            <button className="csm-btn-primary" onClick={confirmerPesee}>Confirmer et envoyer le devis</button>
                        </div>
                    </div>
                </div>
            )}

            {gererReponses && (
                <div className="csm-modal-overlay" onClick={() => setGererReponses(false)}>
                    <div className="csm-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Réponses rapides</h3>
                        <div className="csm-modal-add">
                            <input
                                value={nouvelleReponse}
                                onChange={(e) => setNouvelleReponse(e.target.value)}
                                placeholder="Ex. Merci, nous confirmons votre commande sous 24h"
                                onKeyDown={(e) => e.key === "Enter" && ajouterReponseRapide()}
                            />
                            <button onClick={ajouterReponseRapide}>Ajouter</button>
                        </div>
                        <div className="csm-modal-liste">
                            {reponsesRapides.length === 0 ? (
                                <p className="csm-empty">Aucune réponse enregistrée</p>
                            ) : (
                                reponsesRapides.map((r, i) => (
                                    <div key={i} className="csm-modal-item">
                                        <span>{r}</span>
                                        <button onClick={() => supprimerReponseRapide(i)}>✕</button>
                                    </div>
                                ))
                            )}
                        </div>
                        <button className="csm-modal-close" onClick={() => setGererReponses(false)}>Fermer</button>
                    </div>
                </div>
            )}

            <style>{`
        .csm-page { font-family: 'DM Sans', sans-serif; }
        .csm-taux-bar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; background: #fff; border-bottom: 1px solid #f0ede8; padding: 12px 20px; }
        .csm-taux-label { font-size: 12px; font-weight: 700; color: #111; text-transform: uppercase; letter-spacing: .5px; }
        .csm-taux-bar label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #555; }
        .csm-taux-bar input { width: 70px; padding: 5px 8px; border: 1px solid #e5e0d8; border-radius: 6px; font-size: 13px; }
        .csm-taux-save { background: #111; color: #fff; border: none; border-radius: 20px; padding: 6px 14px; font-size: 12px; cursor: pointer; }
        .csm-taux-save:disabled { opacity: .4; cursor: default; }
        .csm-taux-warning { font-size: 11.5px; color: #c62828; }
        .csm-horaires-info { font-size: 11.5px; color: #999; }
        .csm-tabs { display: flex; gap: 6px; padding: 12px 20px 0; }
        .csm-tab { background: #f7f5f2; border: none; border-radius: 20px; padding: 8px 16px; font-size: 12.5px; font-weight: 600; color: #666; cursor: pointer; }
        .csm-tab.active { background: #111; color: #fff; }
        .csm-livraisons { padding: 20px; }
        .csm-livraisons-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #f0ede8; border-radius: 10px; overflow: hidden; }
        .csm-livraisons-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #999; padding: 10px 14px; background: #f7f5f2; }
        .csm-livraisons-table td { padding: 10px 14px; font-size: 13px; border-top: 1px solid #f0ede8; }
        .csm-retard { color: #c62828; font-weight: 600; }
        .csm-aujourdhui { color: #e53935; font-weight: 600; }
        .csm-livraison-info { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #eef7f0; color: #256029; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; font-size: 12.5px; }
        .csm-livraison-info button { flex-shrink: 0; padding: 5px 12px !important; font-size: 11.5px !important; }
        .csm-livraison-info.csm-arrivee-confirmee { background: #f7f5f2; color: #666; }
        .csm-btn-full { width: 100%; margin-bottom: 8px; text-align: center; }
        .csm-modal-hint { font-size: 12px; color: #999; margin: -6px 0 14px; }
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
        .csm-etape-actuelle { background: #f7f5f2; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; }
        .csm-etape-label { font-size: 10.5px; color: #999; text-transform: uppercase; letter-spacing: .5px; }
        .csm-etape-value { font-size: 14px; font-weight: 700; color: #111; margin: 2px 0 0; }
        .csm-btn-guide { display: block; width: 100%; background: #e53935; color: #fff; border: none; border-radius: 10px; padding: 12px; font-size: 13px; font-weight: 600; cursor: pointer; margin: 12px 0; }
        .csm-btn-guide:disabled { opacity: .4; cursor: default; }
        .csm-devise-row { display: flex; align-items: center; gap: 8px; margin: 10px 0; }
        .csm-devise-row label { font-size: 12.5px; color: #555; }
        .csm-devise-row select { padding: 6px 10px; border: 1px solid #e5e0d8; border-radius: 8px; font-size: 12.5px; }
        .csm-devise-warning { font-size: 11px; color: #c62828; }
        .csm-apercu-total { display: flex; gap: 20px; background: #f7f5f2; border-radius: 10px; padding: 12px 14px; margin: 10px 0; }
        .csm-apercu-total > div { flex: 1; }
        .csm-apercu-total span { display: block; font-size: 10.5px; color: #999; text-transform: uppercase; letter-spacing: .5px; }
        .csm-apercu-total strong { font-size: 15px; color: #111; }
        .csm-fcfa-manquant { color: #c62828 !important; font-size: 12px !important; }
        .csm-attente { font-size: 12.5px; color: #999; background: #fdf1f0; border-radius: 10px; padding: 10px 14px; margin: 12px 0; }
        .csm-avance { margin: 14px 0; border: 1px solid #f0ede8; border-radius: 10px; padding: 10px 14px; }
        .csm-avance summary { font-size: 12px; color: #999; cursor: pointer; }
        .csm-avance-titre { font-size: 11.5px; color: #999; margin: 10px 0 6px; }
        .csm-pesee-field { margin-bottom: 10px; }
        .csm-pesee-field label { display: block; font-size: 11.5px; color: #666; margin-bottom: 4px; }
        .csm-pesee-field input { width: 100%; padding: 8px 10px; border: 1px solid #e5e0d8; border-radius: 8px; font-size: 13px; }
        .csm-pesee-total { text-align: center; font-size: 14px; margin: 12px 0; padding: 10px; background: #f7f5f2; border-radius: 8px; }
        .csm-pesee-actions { display: flex; gap: 10px; }
        .csm-pesee-actions button { flex: 1; }
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
        .csm-badge-systeme { align-self: center; background: #f0ede8; color: #888; font-size: 10.5px; padding: 4px 10px; border-radius: 20px; margin: 2px 0; }
        .csm-devis-card { align-self: center; width: 85%; background: #fff; border: 1.5px solid #e53935; border-radius: 10px; padding: 8px 10px; text-align: center; }
        .csm-devis-card span { display: block; font-size: 10px; color: #999; text-transform: uppercase; }
        .csm-devis-card strong { font-size: 14px; color: #111; }
        .csm-devis-card em { display: block; font-size: 9.5px; color: #aaa; font-style: normal; margin-top: 2px; }
        .csm-avis-card-admin { display: flex; flex-direction: column; gap: 3px; background: #fff8e6; border: 1px solid #f5e3ae; border-radius: 10px; padding: 8px 12px; font-size: 12px; align-self: flex-start; max-width: 240px; }
        .csm-avis-card-admin strong { color: #8a6100; }
        .csm-avis-card-admin em { color: #999; font-style: normal; }
        .csm-quick-avis { background: #fff8e6 !important; border-color: #f5e3ae !important; color: #8a6100 !important; font-weight: 600 !important; }
        .csm-avis-overview { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        .csm-avis-summary { display: flex; gap: 32px; background: #fff; border: 1px solid #f0ede8; border-radius: 12px; padding: 20px; flex-wrap: wrap; }
        .csm-avis-moyenne { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 120px; }
        .csm-avis-moyenne-chiffre { font-size: 40px; font-weight: 800; color: #111; line-height: 1; }
        .csm-avis-moyenne-etoiles { font-size: 18px; letter-spacing: 2px; }
        .csm-avis-moyenne-etoiles .pleine { color: #f5a623; }
        .csm-avis-moyenne-etoiles .vide { color: #ddd; }
        .csm-avis-moyenne-total { font-size: 11.5px; color: #999; }
        .csm-avis-distribution { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 6px; justify-content: center; }
        .csm-avis-bar-row { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: #666; }
        .csm-avis-bar-label { width: 20px; }
        .csm-avis-bar-track { flex: 1; height: 8px; background: #f0ede8; border-radius: 4px; overflow: hidden; }
        .csm-avis-bar-fill { height: 100%; background: #f5a623; border-radius: 4px; }
        .csm-avis-bar-count { width: 22px; text-align: right; }
        .csm-avis-liste { display: flex; flex-direction: column; gap: 10px; }
        .csm-avis-item { background: #fff; border: 1px solid #f0ede8; border-radius: 10px; padding: 12px 16px; }
        .csm-avis-item-top { display: flex; justify-content: space-between; align-items: center; }
        .csm-avis-item-etoiles { color: #f5a623; letter-spacing: 1px; }
        .csm-avis-item-date { font-size: 11px; color: #999; }
        .csm-avis-item-meta { font-size: 11.5px; color: #888; margin: 4px 0 0; }
        .csm-avis-item-comment { font-size: 13px; color: #333; margin: 6px 0 0; font-style: italic; }
        .csm-quick-replies { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 10px 0; border-top: 1px solid #f0ede8; }
        .csm-quick-replies button { background: #f7f5f2; border: 1px solid #e5e0d8; border-radius: 14px; padding: 5px 10px; font-size: 11px; color: #555; cursor: pointer; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .csm-quick-edit { background: none !important; border: none !important; font-size: 13px !important; padding: 4px 6px !important; }
        .csm-manage-replies-empty { width: 100%; background: none; border: none; color: #999; font-size: 11px; padding: 8px; cursor: pointer; text-decoration: underline; }
        .csm-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 300; }
        .csm-modal { background: #fff; border-radius: 14px; padding: 20px; width: 360px; max-width: 90vw; }
        .csm-modal h3 { margin: 0 0 12px; font-size: 15px; }
        .csm-modal-add { display: flex; gap: 8px; margin-bottom: 14px; }
        .csm-modal-add input { flex: 1; padding: 8px 10px; border: 1px solid #e5e0d8; border-radius: 8px; font-size: 12.5px; }
        .csm-modal-add button { background: #111; color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 12px; cursor: pointer; }
        .csm-modal-liste { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
        .csm-modal-item { display: flex; justify-content: space-between; align-items: center; background: #f7f5f2; border-radius: 8px; padding: 8px 10px; font-size: 12.5px; }
        .csm-modal-item button { background: none; border: none; color: #c62828; cursor: pointer; font-size: 12px; }
        .csm-modal-close { width: 100%; background: #f7f5f2; border: none; border-radius: 20px; padding: 9px; font-size: 12.5px; cursor: pointer; }
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