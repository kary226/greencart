import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";
// [PHASE 1 - PERF] Transformation Cloudinary (f_auto, q_auto, largeur adaptée)
import { getPresetImageUrl } from "../../utils/cloudinaryImage";
// Habillage RAMSES de la console (voir DESIGN.md a la racine).
import "../../styles/colis-shein-manager.css";

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

    // --- Messages automatiques par statut (Setting "sheinMessagesStatut") ---
    // Un seul message par statut, envoyé au client dès que le colis y passe.
    // Ne couvre pas "soumis" (message de bienvenue ci-dessus), ni
    // "devis_envoye" / "pese" / "en_livraison" / "en_entrepot" (postent déjà
    // un message dédié avec devis ou dates — voir colisSheinAdminController.js).
    const MESSAGES_STATUT_LABELS = {
        en_verification: "En vérification",
        acompte_paye: "Acompte payé",
        achete: "Acheté chez SHEIN",
        solde_du: "Solde à régler",
        solde_paye: "Solde réglé",
        livre: "Livré",
    };
    const MESSAGES_STATUT_DEFAUT = {
        en_verification: "Nous vérifions actuellement la disponibilité de vos articles, un devis vous sera envoyé très prochainement.",
        acompte_paye: "Merci, votre acompte a bien été reçu ! Nous procédons à l'achat de vos articles chez SHEIN.",
        achete: "Vos articles ont été achetés chez SHEIN ! Ils seront bientôt en route vers notre entrepôt à Abidjan.",
        solde_du: "Le solde de livraison de votre colis est maintenant disponible et à régler.",
        solde_paye: "Merci, votre solde a bien été reçu ! Votre colis va être préparé pour la livraison.",
        livre: "Votre colis vous a été livré. Merci pour votre confiance et à bientôt sur RAMCI !",
    };
    const [messagesStatut, setMessagesStatut] = useState(MESSAGES_STATUT_DEFAUT);
    const [messagesStatutSaved, setMessagesStatutSaved] = useState(MESSAGES_STATUT_DEFAUT);
    const [savingMessagesStatut, setSavingMessagesStatut] = useState(false);
    const messagesStatutModifie = JSON.stringify(messagesStatut) !== JSON.stringify(messagesStatutSaved);

    const fetchMessagesStatut = async () => {
        try {
            const { data } = await axios.get("/api/setting/sheinMessagesStatut");
            if (data.success && data.data) {
                const fusion = { ...MESSAGES_STATUT_DEFAUT, ...data.data };
                setMessagesStatut(fusion);
                setMessagesStatutSaved(fusion);
            }
        } catch (error) {
            // pas encore configuré — reste sur les textes par défaut
        }
    };

    const enregistrerMessagesStatut = async () => {
        setSavingMessagesStatut(true);
        try {
            const { data } = await axios.post("/api/setting/update", { key: "sheinMessagesStatut", value: messagesStatut });
            if (data.success) {
                toast.success("Messages automatiques enregistrés");
                setMessagesStatutSaved(messagesStatut);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error("Erreur d'enregistrement des messages");
        } finally {
            setSavingMessagesStatut(false);
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

    useEffect(() => { fetchTaux(); fetchHoraires(); fetchMessageBienvenue(); fetchMessagesStatut(); }, []);
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
            <div className="csm-tabs">
                <button className={`csm-tab ${vue === "suivi" ? "active" : ""}`} onClick={() => setVue("suivi")}>Suivi des colis</button>
                <button className={`csm-tab ${vue === "livraisons" ? "active" : ""}`} onClick={() => setVue("livraisons")}>Livraisons en cours</button>
                <button className={`csm-tab ${vue === "avis" ? "active" : ""}`} onClick={() => setVue("avis")}>⭐ Avis clients{statsAvis.total > 0 ? ` (${statsAvis.total})` : ""}</button>
                <button className={`csm-tab ${vue === "parametres" ? "active" : ""}`} onClick={() => setVue("parametres")}>⚙️ Réglages</button>
            </div>

            {vue === "parametres" ? (
                <div className="csm-parametres">
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

                    <div className="csm-taux-bar" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
                        <span className="csm-taux-label">Messages automatiques par statut</span>
                        <p className="csm-horaires-info" style={{ margin: 0 }}>
                            Envoyé automatiquement au client dès que le colis passe à ce statut.
                        </p>

                        {Object.keys(MESSAGES_STATUT_LABELS).map((cle) => (
                            <div key={cle} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#374151" }}>
                                    {MESSAGES_STATUT_LABELS[cle]}
                                </span>
                                <textarea
                                    value={messagesStatut[cle] ?? ""}
                                    onChange={(e) => setMessagesStatut((p) => ({ ...p, [cle]: e.target.value }))}
                                    rows={2}
                                    maxLength={500}
                                    style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e5c6c6", fontFamily: "inherit", fontSize: "13px", resize: "vertical" }}
                                />
                            </div>
                        ))}

                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <button onClick={enregistrerMessagesStatut} disabled={!messagesStatutModifie || savingMessagesStatut} className="csm-taux-save">
                                {savingMessagesStatut ? "Enregistrement…" : "Enregistrer les messages"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : vue === "livraisons" ? (
                <div className="csm-livraisons">
                    {loadingLivraisons ? (
                        <p className="csm-empty">Chargement…</p>
                    ) : colisLivraison.length === 0 ? (
                        <p className="csm-empty">Aucun colis en cours de livraison</p>
                    ) : (
                        <div className="csm-table-scroll">
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
                        </div>
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
                <div className={`csm-liste ${selection ? "csm-liste-hidden-mobile" : ""}`}>
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

                <div className={`csm-detail ${!selection ? "csm-detail-hidden-mobile" : ""}`}>
                    {!selection ? (
                        <p className="csm-empty">Sélectionne un colis dans la liste</p>
                    ) : (
                        <>
                            <button type="button" className="csm-back-mobile" onClick={() => setSelection(null)}>
                                ← Retour à la liste
                            </button>
                            <div className="csm-detail-header">
                                <h3>{selection.numeroSuivi}</h3>
                                <span className="csm-badge">{selection.statut}</span>
                            </div>
                            <p className="csm-lien"><a href={selection.lienPartage} target="_blank" rel="noreferrer">Lien du panier</a></p>

                            <div className="csm-captures">
                                {selection.captures.map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noreferrer"><img src={getPresetImageUrl(url, 'thumbnail')} alt={`capture ${i + 1}`} loading="lazy" /></a>
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
                                                {m.imageUrl && <img src={getPresetImageUrl(m.imageUrl, 'thumbnail')} alt="" loading="lazy" className="csm-msg-img" onClick={() => window.open(m.imageUrl, "_blank")} />}
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

        </div>
    );
};

export default ColisSheinManager;