import { useEffect, useRef, useState } from "react";
import {
    useParams,
    useSearchParams,
    useNavigate
} from "react-router-dom";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";

const money = (n, devise) => {
    const symbole = devise === "EUR" ? "€" : "$";
    return `${symbole}${Number(n || 0).toFixed(2)}`;
};

const fcfa = (n) =>
    `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

const dateCourte = (d) =>
    new Date(d).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });

const estDansHoraires = (horaires, maintenant) => {
    if (!horaires?.ouverture || !horaires?.fermeture) {
        return true;
    }

    const now = new Date(maintenant);

    const [hO, mO] =
        horaires.ouverture.split(":").map(Number);

    const [hF, mF] =
        horaires.fermeture.split(":").map(Number);

    const minutesMaintenant =
        now.getHours() * 60 + now.getMinutes();

    const minutesOuverture =
        hO * 60 + mO;

    const minutesFermeture =
        hF * 60 + mF;

    if (minutesFermeture > minutesOuverture) {
        return (
            minutesMaintenant >= minutesOuverture &&
            minutesMaintenant < minutesFermeture
        );
    }

    return (
        minutesMaintenant >= minutesOuverture ||
        minutesMaintenant < minutesFermeture
    );
};

const STATUT_LABELS = {
    soumis: "En attente de vérification par un agent",
    en_verification: "En cours de vérification",
    devis_envoye: "Devis validé — acompte à régler",
    acompte_paye: "Acompte reçu — commande en cours",
    achete: "Article(s) acheté(s) chez SHEIN",
    en_entrepot: "Arrivé en entrepôt — en attente de pesée",
    pese: "Pesé — solde à régler",
    solde_du: "Solde à régler",
    solde_paye: "Solde réglé — préparation livraison",
    en_livraison: "En cours de livraison",
    livre: "Livré",
    annule: "Annulé",
};

const STATUT_ORDER = [
    "soumis",
    "en_verification",
    "devis_envoye",
    "acompte_paye",
    "achete",
    "en_entrepot",
    "pese",
    "solde_du",
    "solde_paye",
    "en_livraison",
    "livre",
];

const TYPING_TTL_MS = 4000;
const POLL_MS = 3000;
const TYPING_SIGNAL_THROTTLE_MS = 2200;

const memeJour = (a, b) =>
    new Date(a).toDateString() ===
    new Date(b).toDateString();

const libelleJour = (date) => {
    const d = new Date(date);

    const hier = new Date();
    hier.setDate(hier.getDate() - 1);

    if (memeJour(d, new Date())) {
        return "Aujourd'hui";
    }

    if (memeJour(d, hier)) {
        return "Hier";
    }

    return d.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
    });
};

const CocheSimple = () => (
    <svg
        width="14"
        height="10"
        viewBox="0 0 16 11"
        fill="none"
    >
        <path
            d="M1 5.5L5 9.5L15 0.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const CocheDouble = () => (
    <svg
        width="18"
        height="10"
        viewBox="0 0 20 11"
        fill="none"
    >
        <path
            d="M1 5.5L5 9.5L11 1.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        />

        <path
            d="M6 5.5L10 9.5L19 0.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const Etoile = ({ remplie }) => (
    <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill={remplie ? "#f5a623" : "none"}
        stroke={remplie ? "#f5a623" : "#ccc"}
        strokeWidth="1.5"
    >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
);

const ColisSheinDetail = () => {
    const { id } = useParams();
    const { axios, user } = useAppContext();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] =
        useSearchParams();

    const [payingAcompte, setPayingAcompte] =
        useState(false);

    const [payingSolde, setPayingSolde] =
        useState(false);

    const [horaires, setHoraires] =
        useState(null);

    const [colis, setColis] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [messages, setMessages] =
        useState([]);

    const [texte, setTexte] =
        useState("");

    const [envoi, setEnvoi] =
        useState(false);

    const [infosOuvertes, setInfosOuvertes] =
        useState(false);

    const [imageChoisie, setImageChoisie] =
        useState(null);

    const [maintenant, setMaintenant] =
        useState(Date.now());

    const [avisEnCours, setAvisEnCours] =
        useState({});

    const [envoiAvis, setEnvoiAvis] =
        useState(null);

    const messagesContainerRef =
        useRef(null);

    const pollRef =
        useRef(null);

    const tickRef =
        useRef(null);

    const premierChargement =
        useRef(true);

    const fileInputRef =
        useRef(null);

    const dernierSignalFrappe =
        useRef(0);

    const fetchColis = async () => {
        try {
            const { data } =
                await axios.get(
                    `/api/shein-cart/${id}`
                );

            if (data.success) {
                setColis(data.colis);
            }
        } catch (error) {
            toast.error(
                "Impossible de charger ce colis"
            );
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async () => {
        try {
            const { data } =
                await axios.get(
                    `/api/shein-cart/${id}/messages`
                );

            if (data.success) {
                setMessages(data.messages);
            }
        } catch (error) {
            // Le polling réessaiera automatiquement.
        }
    };

    useEffect(() => {
        axios
            .get("/api/setting/sheinHoraires")
            .then(({ data }) => {
                if (data.success && data.data) {
                    setHoraires(data.data);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!user) return;

        fetchColis();
        fetchMessages();

        pollRef.current = setInterval(() => {
            fetchMessages();
            fetchColis();
        }, POLL_MS);

        return () => {
            clearInterval(pollRef.current);
        };
    }, [id, user]);

    useEffect(() => {
        tickRef.current = setInterval(() => {
            setMaintenant(Date.now());
        }, 1000);

        return () => {
            clearInterval(tickRef.current);
        };
    }, []);

    useEffect(() => {
        if (
            colis &&
            (
                colis.statut === "livre" ||
                colis.statut === "annule"
            ) &&
            pollRef.current
        ) {
            clearInterval(pollRef.current);
        }
    }, [colis?.statut]);

    const agentEnTrainDecrire =
        !!colis?.agentTypingAt &&
        maintenant -
            new Date(
                colis.agentTypingAt
            ).getTime() <
            TYPING_TTL_MS;

    useEffect(() => {
        const el =
            messagesContainerRef.current;

        if (!el) return;

        el.scrollTop = el.scrollHeight;

        premierChargement.current = false;
    }, [messages, agentEnTrainDecrire]);

    const choisirImage = (e) => {
        const file =
            e.target.files?.[0];

        if (file) {
            setImageChoisie(file);
        }
    };

    const signalerFrappe = () => {
        const t = Date.now();

        if (
            t -
                dernierSignalFrappe.current <
            TYPING_SIGNAL_THROTTLE_MS
        ) {
            return;
        }

        dernierSignalFrappe.current = t;

        axios
            .post(`/api/shein-cart/${id}/typing`)
            .catch(() => {});
    };

    const envoyerMessage = async (e) => {
        e.preventDefault();

        if (
            (!texte.trim() && !imageChoisie) ||
            envoi
        ) {
            return;
        }

        setEnvoi(true);

        try {
            const formData =
                new FormData();

            if (texte.trim()) {
                formData.append(
                    "texte",
                    texte.trim()
                );
            }

            if (imageChoisie) {
                formData.append(
                    "image",
                    imageChoisie
                );
            }

            const { data } =
                await axios.post(
                    `/api/shein-cart/${id}/messages`,
                    formData,
                    {
                        headers: {
                            "Content-Type":
                                "multipart/form-data",
                        },
                    }
                );

            if (data.success) {
                setMessages((prev) => [
                    ...prev,
                    data.message,
                ]);

                setTexte("");
                setImageChoisie(null);

                if (fileInputRef.current) {
                    fileInputRef.current.value =
                        "";
                }
            } else {
                toast.error(
                    data.message ||
                    "Envoi impossible"
                );
            }
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                "Erreur d'envoi"
            );
        } finally {
            setEnvoi(false);
        }
    };

    const choisirEtoiles = (
        messageId,
        etoiles
    ) => {
        setAvisEnCours((prev) => ({
            ...prev,
            [messageId]: {
                ...prev[messageId],
                etoiles,
            },
        }));
    };

    const changerCommentaireAvis = (
        messageId,
        commentaire
    ) => {
        setAvisEnCours((prev) => ({
            ...prev,
            [messageId]: {
                ...prev[messageId],
                commentaire,
            },
        }));
    };

    const envoyerAvis = async (
        messageId
    ) => {
        const brouillon =
            avisEnCours[messageId];

        if (!brouillon?.etoiles) {
            toast.error(
                "Choisis une note avant d'envoyer"
            );
            return;
        }

        setEnvoiAvis(messageId);

        try {
            const { data } =
                await axios.post(
                    `/api/shein-cart/${id}/avis`,
                    {
                        messageId,
                        etoiles:
                            brouillon.etoiles,
                        commentaire:
                            brouillon.commentaire ||
                            "",
                    }
                );

            if (data.success) {
                toast.success(
                    "Merci pour ton avis !"
                );

                setMessages((prev) =>
                    prev.map((m) =>
                        m._id === messageId
                            ? {
                                ...m,
                                payload: {
                                    ...m.payload,
                                    repondu: true,
                                    etoilesDonnees:
                                        brouillon.etoiles,
                                },
                            }
                            : m
                    )
                );

                fetchMessages();
            } else {
                toast.error(
                    data.message ||
                    "Envoi impossible"
                );
            }
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                "Erreur d'envoi"
            );
        } finally {
            setEnvoiAvis(null);
        }
    };

    useEffect(() => {
        const paiement =
            searchParams.get("paiement");

        if (paiement === "succes") {
            toast.success(
                "Paiement confirmé"
            );

            fetchColis();

            setSearchParams(
                {},
                { replace: true }
            );
        } else if (paiement === "erreur") {
            toast.error(
                "Le paiement n'a pas abouti — réessaie"
            );

            setSearchParams(
                {},
                { replace: true }
            );
        }
    }, []);

    const payerAcompte = async () => {
        setPayingAcompte(true);

        try {
            const { data } =
                await axios.post(
                    `/api/shein-cart/${id}/pay-acompte`
                );

            if (data.success) {
                window.location.href =
                    data.checkout_url;
            } else {
                toast.error(
                    data.message ||
                    "Paiement impossible"
                );
            }
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                "Erreur de paiement"
            );
        } finally {
            setPayingAcompte(false);
        }
    };

    const payerSolde = async () => {
        setPayingSolde(true);

        try {
            const { data } =
                await axios.post(
                    `/api/shein-cart/${id}/pay-solde`
                );

            if (data.success) {
                window.location.href =
                    data.checkout_url;
            } else {
                toast.error(
                    data.message ||
                    "Paiement impossible"
                );
            }
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                "Erreur de paiement"
            );
        } finally {
            setPayingSolde(false);
        }
    };

    if (loading) {
        return (
            <div className="csd-loading">
                Chargement…
            </div>
        );
    }

    if (!colis) {
        return (
            <div className="csd-loading">
                Colis introuvable
            </div>
        );
    }

    const etapeActuelle =
        STATUT_ORDER.indexOf(
            colis.statut
        );

    const chatFerme =
        colis.statut === "livre" ||
        colis.statut === "annule";

    const tauxApplique =
        colis.devis?.tauxApplique ||
        null;

    const serviceOuvert =
        estDansHoraires(
            horaires,
            maintenant
        );

    return (
        <div className="csd-page">
            <div className="csd-header">
                <button
                    className="csd-back"
                    onClick={() =>
                        navigate(
                            "/mes-colis-shein"
                        )
                    }
                    aria-label="Retour"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>

                <div className="csd-header-titre">
                    <p className="csd-numero">
                        {colis.numeroSuivi}
                    </p>

                    <h1 className="csd-statut">
                        {STATUT_LABELS[
                            colis.statut
                        ] ||
                            colis.statut}
                    </h1>
                </div>

                <button
                    className={`csd-toggle ${
                        infosOuvertes
                            ? "open"
                            : ""
                    }`}
                    onClick={() =>
                        setInfosOuvertes(
                            (v) => !v
                        )
                    }
                    aria-label="Détails du colis"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
            </div>

            {!serviceOuvert && (
                <div className="csd-horaires-banner">
                    Service fermé
                    {horaires?.ouverture
                        ? ` — réouverture à ${horaires.ouverture}`
                        : ""}
                    . Tu peux quand même
                    écrire, on te répondra à la
                    réouverture.
                </div>
            )}

            {colis.estimationArrivee?.dateDebut &&
                colis.estimationArrivee?.dateFin &&
                !colis.estimationArrivee
                    ?.confirmee && (
                    <div className="csd-arrivee-banner">
                        Arrivée estimée à Abidjan
                        entre le{" "}
                        <strong>
                            {dateCourte(
                                colis
                                    .estimationArrivee
                                    .dateDebut
                            )}
                        </strong>{" "}
                        et le{" "}
                        <strong>
                            {dateCourte(
                                colis
                                    .estimationArrivee
                                    .dateFin
                            )}
                        </strong>
                    </div>
                )}

            {colis.statut === "en_livraison" &&
                colis.livraison?.dateDebut &&
                colis.livraison?.dateFin && (
                    <div className="csd-livraison-banner">
                        Livraison estimée entre le{" "}
                        <strong>
                            {dateCourte(
                                colis.livraison
                                    .dateDebut
                            )}
                        </strong>{" "}
                        et le{" "}
                        <strong>
                            {dateCourte(
                                colis.livraison
                                    .dateFin
                            )}
                        </strong>
                    </div>
                )}

            {colis.statut ===
                "devis_envoye" &&
                !colis.paiement
                    ?.acomptePaye &&
                colis.devis
                    ?.montantInitial > 0 && (
                    <button
                        className="csd-pay-btn"
                        onClick={
                            payerAcompte
                        }
                        disabled={
                            payingAcompte
                        }
                    >
                        {payingAcompte
                            ? "Redirection…"
                            : `Payer les articles — ${fcfa(
                                colis.devis
                                    .montantInitial
                            )}`}
                    </button>
                )}

            {(colis.statut === "pese" ||
                colis.statut ===
                    "solde_du") &&
                !colis.paiement
                    ?.soldePaye &&
                colis.paiement
                    ?.soldeMontant > 0 && (
                    <button
                        className="csd-pay-btn"
                        onClick={
                            payerSolde
                        }
                        disabled={
                            payingSolde
                        }
                    >
                        {payingSolde
                            ? "Redirection…"
                            : `Payer la livraison — ${fcfa(
                                colis.paiement
                                    .soldeMontant
                            )}`}
                    </button>
                )}

            <div
                className={`csd-infos ${
                    infosOuvertes
                        ? "open"
                        : ""
                }`}
            >
                {colis.statut !==
                    "annule" && (
                    <div className="csd-progress">
                        {STATUT_ORDER.map(
                            (s, i) => (
                                <div
                                    key={s}
                                    className={`csd-dot ${
                                        i <=
                                        etapeActuelle
                                            ? "done"
                                            : ""
                                    }`}
                                />
                            )
                        )}
                    </div>
                )}

                <div className="csd-card">
                    <p className="csd-card-title">
                        Articles
                    </p>

                    {colis.articlesValides.map(
                        (a, i) => (
                            <div
                                key={i}
                                className="csd-article"
                            >
                                <div>
                                    <p className="csd-article-nom">
                                        {a.nom}
                                    </p>

                                    <p className="csd-article-variante">
                                        {a.variante} ·
                                        x{a.quantite}
                                    </p>
                                </div>

                                <div className="csd-article-prix-bloc">
                                    <span className="csd-article-prix">
                                        {money(
                                            a.prixUnitaire *
                                                a.quantite,
                                            colis.devise
                                        )}
                                    </span>

                                    {tauxApplique && (
                                        <span className="csd-article-fcfa">
                                            ≈{" "}
                                            {fcfa(
                                                a.prixUnitaire *
                                                    a.quantite *
                                                    tauxApplique
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    )}

                    <div className="csd-total-row">
                        <span>
                            Total articles
                        </span>

                        <strong>
                            {money(
                                colis.devis
                                    ?.montantArticles,
                                colis.devise
                            )}
                        </strong>
                    </div>

                    {colis.devis
                        ?.montantArticlesFCFA !=
                        null && (
                        <div className="csd-total-row csd-fcfa">
                            <span>
                                Équivalent
                            </span>

                            <strong>
                                {fcfa(
                                    colis.devis
                                        .montantArticlesFCFA
                                )}
                            </strong>
                        </div>
                    )}
                </div>
            </div>

            <div className="csd-chat-zone">
                <div
                    className="csd-messages"
                    ref={
                        messagesContainerRef
                    }
                >
                    {messages.length === 0 &&
                        !agentEnTrainDecrire && (
                            <div className="csd-chat-empty-state">
                                <div className="csd-chat-empty-icon">
                                    <svg
                                        width="22"
                                        height="22"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.7"
                                    >
                                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6A8.38 8.38 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8v.5Z" />
                                    </svg>
                                </div>

                                <p>
                                    Aucun message
                                    pour l'instant
                                </p>

                                <span>
                                    Pose ta question
                                    à l'agent ici.
                                </span>
                            </div>
                        )}

                    {messages.map(
                        (m, idx) => {
                            const precedent =
                                messages[
                                    idx - 1
                                ];

                            const nouveauJour =
                                !precedent ||
                                !memeJour(
                                    precedent.createdAt,
                                    m.createdAt
                                );

                            if (
                                m.type ===
                                "systeme"
                            ) {
                                return (
                                    <div
                                        key={m._id}
                                        className="csd-msg-wrap"
                                    >
                                        {nouveauJour && (
                                            <div className="csd-day-divider">
                                                <span>
                                                    {libelleJour(
                                                        m.createdAt
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                        <div className="csd-badge-systeme">
                                            {m.texte}
                                        </div>
                                    </div>
                                );
                            }

                            if (
                                m.type ===
                                "devis"
                            ) {
                                if (
                                    m.payload
                                        ?.superseded
                                ) {
                                    return (
                                        <div
                                            key={
                                                m._id
                                            }
                                            className="csd-msg-wrap"
                                        >
                                            {nouveauJour && (
                                                <div className="csd-day-divider">
                                                    <span>
                                                        {libelleJour(
                                                            m.createdAt
                                                        )}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="csd-devis-card csd-devis-remplace">
                                                <p className="csd-devis-libelle">
                                                    {
                                                        m
                                                            .payload
                                                            ?.libelle
                                                    }
                                                </p>

                                                <p className="csd-devis-montant-barre">
                                                    {fcfa(
                                                        m
                                                            .payload
                                                            ?.montant
                                                    )}
                                                </p>

                                                <span className="csd-devis-remplace-tag">
                                                    Devis remplacé
                                                    par une
                                                    version plus
                                                    récente
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }

                                const dejaPayee =
                                    m.payload
                                        ?.paymentType ===
                                    "shein_acompte"
                                        ? colis
                                            .paiement
                                            ?.acomptePaye
                                        : colis
                                            .paiement
                                            ?.soldePaye;

                                return (
                                    <div
                                        key={m._id}
                                        className="csd-msg-wrap"
                                    >
                                        {nouveauJour && (
                                            <div className="csd-day-divider">
                                                <span>
                                                    {libelleJour(
                                                        m.createdAt
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                        <div className="csd-devis-card">
                                            <div className="csd-devis-top">
                                                <span className="csd-devis-kicker">
                                                    Proposition
                                                </span>

                                                <span className="csd-devis-status-dot" />
                                            </div>

                                            <p className="csd-devis-libelle">
                                                {
                                                    m
                                                        .payload
                                                        ?.libelle
                                                }
                                            </p>

                                            <p className="csd-devis-montant">
                                                {fcfa(
                                                    m
                                                        .payload
                                                        ?.montant
                                                )}
                                            </p>

                                            {m
                                                .payload
                                                ?.detail && (
                                                <p className="csd-devis-detail">
                                                    {
                                                        m
                                                            .payload
                                                            .detail
                                                    }
                                                </p>
                                            )}

                                            {dejaPayee ? (
                                                <span className="csd-devis-paye">
                                                    Payé
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={
                                                        m
                                                            .payload
                                                            ?.paymentType ===
                                                        "shein_acompte"
                                                            ? payerAcompte
                                                            : payerSolde
                                                    }
                                                    disabled={
                                                        payingAcompte ||
                                                        payingSolde
                                                    }
                                                >
                                                    Payer maintenant
                                                </button>
                                            )}

                                            <span className="csd-msg-heure">
                                                {new Date(
                                                    m.createdAt
                                                ).toLocaleTimeString(
                                                    "fr-FR",
                                                    {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    }
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                );
                            }

                            if (
                                m.type ===
                                "avis"
                            ) {
                                if (
                                    m.payload
                                        ?.superseded
                                ) {
                                    return null;
                                }

                                if (
                                    m.payload
                                        ?.repondu
                                ) {
                                    return (
                                        <div
                                            key={
                                                m._id
                                            }
                                            className="csd-msg-wrap"
                                        >
                                            {nouveauJour && (
                                                <div className="csd-day-divider">
                                                    <span>
                                                        {libelleJour(
                                                            m.createdAt
                                                        )}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="csd-avis-card csd-avis-repondu">
                                                <p className="csd-avis-libelle">
                                                    Merci
                                                    pour ton
                                                    avis
                                                </p>

                                                <div className="csd-avis-etoiles-lecture">
                                                    {[
                                                        1,
                                                        2,
                                                        3,
                                                        4,
                                                        5,
                                                    ].map(
                                                        (
                                                            n
                                                        ) => (
                                                            <Etoile
                                                                key={
                                                                    n
                                                                }
                                                                remplie={
                                                                    n <=
                                                                    m
                                                                        .payload
                                                                        .etoilesDonnees
                                                                }
                                                            />
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                const brouillon =
                                    avisEnCours[
                                        m._id
                                    ] || {};

                                return (
                                    <div
                                        key={m._id}
                                        className="csd-msg-wrap"
                                    >
                                        {nouveauJour && (
                                            <div className="csd-day-divider">
                                                <span>
                                                    {libelleJour(
                                                        m.createdAt
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                        <div className="csd-avis-card">
                                            <p className="csd-avis-libelle">
                                                {m
                                                    .payload
                                                    ?.libelle ||
                                                    "Comment s'est passée votre expérience ?"}
                                            </p>

                                            <div className="csd-avis-etoiles">
                                                {[
                                                    1,
                                                    2,
                                                    3,
                                                    4,
                                                    5,
                                                ].map(
                                                    (
                                                        n
                                                    ) => (
                                                        <button
                                                            key={
                                                                n
                                                            }
                                                            type="button"
                                                            onClick={() =>
                                                                choisirEtoiles(
                                                                    m._id,
                                                                    n
                                                                )
                                                            }
                                                            aria-label={`${n} étoiles`}
                                                        >
                                                            <Etoile
                                                                remplie={
                                                                    n <=
                                                                    (brouillon.etoiles ||
                                                                        0)
                                                                }
                                                            />
                                                        </button>
                                                    )
                                                )}
                                            </div>

                                            <textarea
                                                placeholder="Un commentaire ? (optionnel)"
                                                value={
                                                    brouillon.commentaire ||
                                                    ""
                                                }
                                                onChange={(
                                                    e
                                                ) =>
                                                    changerCommentaireAvis(
                                                        m._id,
                                                        e
                                                            .target
                                                            .value
                                                    )
                                                }
                                                rows={2}
                                            />

                                            <button
                                                className="csd-avis-envoyer"
                                                onClick={() =>
                                                    envoyerAvis(
                                                        m._id
                                                    )
                                                }
                                                disabled={
                                                    envoiAvis ===
                                                    m._id
                                                }
                                            >
                                                {envoiAvis ===
                                                m._id
                                                    ? "Envoi…"
                                                    : "Envoyer mon avis"}
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            const estClient =
                                m.expediteurRole ===
                                "client";

                            const lu =
                                estClient &&
                                colis.adminDernierLu &&
                                new Date(
                                    m.createdAt
                                ) <=
                                    new Date(
                                        colis.adminDernierLu
                                    );

                            return (
                                <div
                                    key={m._id}
                                    className="csd-msg-wrap"
                                >
                                    {nouveauJour && (
                                        <div className="csd-day-divider">
                                            <span>
                                                {libelleJour(
                                                    m.createdAt
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    <div
                                        className={`csd-msg ${
                                            estClient
                                                ? "csd-msg-client"
                                                : "csd-msg-agent"
                                        }`}
                                    >
                                        {!estClient && (
                                            <span className="csd-agent-label">
                                                Agent
                                            </span>
                                        )}

                                        {m.imageUrl && (
                                            <img
                                                src={
                                                    m.imageUrl
                                                }
                                                alt=""
                                                className="csd-msg-img"
                                                onClick={() =>
                                                    window.open(
                                                        m.imageUrl,
                                                        "_blank"
                                                    )
                                                }
                                            />
                                        )}

                                        {m.texte && (
                                            <p>
                                                {m.texte}
                                            </p>
                                        )}

                                        <span className="csd-msg-meta">
                                            <span className="csd-msg-heure">
                                                {new Date(
                                                    m.createdAt
                                                ).toLocaleTimeString(
                                                    "fr-FR",
                                                    {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    }
                                                )}
                                            </span>

                                            {estClient && (
                                                <span
                                                    className={`csd-check ${
                                                        lu
                                                            ? "csd-check-lu"
                                                            : ""
                                                    }`}
                                                    aria-label={
                                                        lu
                                                            ? "Lu"
                                                            : "Envoyé"
                                                    }
                                                >
                                                    {lu ? (
                                                        <CocheDouble />
                                                    ) : (
                                                        <CocheSimple />
                                                    )}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            );
                        }
                    )}

                    {agentEnTrainDecrire && (
                        <div
                            className="csd-msg csd-msg-agent csd-typing"
                            aria-label="L'agent écrit"
                        >
                            <span className="csd-typing-dot" />
                            <span className="csd-typing-dot" />
                            <span className="csd-typing-dot" />
                        </div>
                    )}
                </div>

                {chatFerme ? (
                    <div className="csd-chat-closed">
                        {colis.statut === "livre"
                            ? "Colis livré — conversation clôturée"
                            : "Colis annulé — conversation clôturée"}
                    </div>
                ) : (
                    <form
                        className="csd-chat-form"
                        onSubmit={
                            envoyerMessage
                        }
                    >
                        {imageChoisie && (
                            <div className="csd-preview">
                                <img
                                    src={URL.createObjectURL(
                                        imageChoisie
                                    )}
                                    alt=""
                                />

                                <button
                                    type="button"
                                    onClick={() => {
                                        setImageChoisie(
                                            null
                                        );

                                        if (
                                            fileInputRef.current
                                        ) {
                                            fileInputRef.current.value =
                                                "";
                                        }
                                    }}
                                    aria-label="Supprimer l'image"
                                >
                                    ×
                                </button>
                            </div>
                        )}

                        <div className="csd-chat-row">
                            <label className="csd-attach-btn">
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                </svg>

                                <input
                                    ref={
                                        fileInputRef
                                    }
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={
                                        choisirImage
                                    }
                                />
                            </label>

                            <input
                                type="text"
                                placeholder="Écris un message…"
                                value={texte}
                                onChange={(e) => {
                                    setTexte(
                                        e.target.value
                                    );

                                    if (
                                        e.target.value.trim()
                                    ) {
                                        signalerFrappe();
                                    }
                                }}
                                maxLength={2000}
                            />

                            <button
                                type="submit"
                                disabled={
                                    (!texte.trim() &&
                                        !imageChoisie) ||
                                    envoi
                                }
                                className="csd-send-btn"
                                aria-label="Envoyer"
                            >
                                <svg
                                    width="17"
                                    height="17"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M22 2L11 13" />
                                    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                                </svg>
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <style>{`
                .csd-page {
                    --csd-bg: #f5f7fa;
                    --csd-card: #ffffff;
                    --csd-border: #e7ebf0;
                    --csd-text: #101828;
                    --csd-muted: #667085;
                    --csd-blue: #2563eb;
                    --csd-blue-soft: #eff6ff;
                    --csd-green: #12b76a;

                    max-width: 760px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    height: calc(100vh - 70px);
                    height: calc(100dvh - 70px);
                    padding: 0 14px;
                    font-family: Inter, "DM Sans", system-ui, sans-serif;
                    color: var(--csd-text);
                    background: var(--csd-bg);
                }

                .csd-loading {
                    min-height: 300px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--csd-muted);
                    font-size: 14px;
                    font-weight: 600;
                }

                .csd-header {
                    display: flex;
                    align-items: center;
                    gap: 11px;
                    padding: 14px 0 12px;
                    flex-shrink: 0;
                }

                .csd-back,
                .csd-toggle {
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    border: 1px solid var(--csd-border);
                    background: #fff;
                    color: #344054;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: .18s ease;
                    flex-shrink: 0;
                }

                .csd-back:hover,
                .csd-toggle:hover {
                    background: #f8fafc;
                    border-color: #cfd6df;
                }

                .csd-header-titre {
                    flex: 1;
                    min-width: 0;
                }

                .csd-numero {
                    margin: 0 0 3px;
                    color: #98a2b3;
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: .6px;
                    text-transform: uppercase;
                }

                .csd-statut {
                    margin: 0;
                    font-size: 14px;
                    line-height: 1.3;
                    font-weight: 800;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .csd-toggle svg {
                    transition: transform .2s ease;
                }

                .csd-toggle.open svg {
                    transform: rotate(180deg);
                }

                .csd-horaires-banner,
                .csd-arrivee-banner,
                .csd-livraison-banner {
                    border-radius: 12px;
                    padding: 10px 13px;
                    font-size: 11.5px;
                    line-height: 1.45;
                    margin-bottom: 9px;
                    flex-shrink: 0;
                }

                .csd-horaires-banner {
                    color: #7a5b00;
                    background: #fffaeb;
                    border: 1px solid #fedf89;
                }

                .csd-arrivee-banner,
                .csd-livraison-banner {
                    color: #1e40af;
                    background: #eff6ff;
                    border: 1px solid #dbeafe;
                }

                .csd-pay-btn {
                    width: 100%;
                    border: none;
                    border-radius: 12px;
                    background: var(--csd-text);
                    color: #fff;
                    padding: 12px 14px;
                    font-size: 12.5px;
                    font-weight: 800;
                    cursor: pointer;
                    margin-bottom: 9px;
                    box-shadow: 0 7px 18px rgba(16,24,40,.12);
                    transition: transform .15s ease, background .15s ease;
                }

                .csd-pay-btn:hover:not(:disabled) {
                    background: #1d2939;
                }

                .csd-pay-btn:active:not(:disabled) {
                    transform: scale(.99);
                }

                .csd-pay-btn:disabled {
                    opacity: .55;
                    cursor: default;
                }

                .csd-infos {
                    max-height: 0;
                    opacity: 0;
                    overflow: hidden;
                    transition: max-height .3s ease, opacity .2s ease;
                    flex-shrink: 0;
                }

                .csd-infos.open {
                    max-height: 500px;
                    opacity: 1;
                    overflow-y: auto;
                    padding-bottom: 9px;
                }

                .csd-progress {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    padding: 5px 2px 12px;
                }

                .csd-dot {
                    flex: 1;
                    height: 4px;
                    border-radius: 999px;
                    background: #e4e7ec;
                    transition: background .2s ease;
                }

                .csd-dot.done {
                    background: var(--csd-blue);
                }

                .csd-card {
                    background: #fff;
                    border: 1px solid var(--csd-border);
                    border-radius: 16px;
                    padding: 14px;
                    box-shadow: 0 5px 18px rgba(16,24,40,.035);
                }

                .csd-card-title {
                    margin: 0 0 11px;
                    font-size: 11px;
                    font-weight: 850;
                    color: #475467;
                    text-transform: uppercase;
                    letter-spacing: .55px;
                }

                .csd-article {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 15px;
                    padding: 10px 0;
                    border-top: 1px solid #f0f2f5;
                }

                .csd-article:first-of-type {
                    border-top: none;
                    padding-top: 0;
                }

                .csd-article-nom {
                    margin: 0 0 3px;
                    font-size: 12.5px;
                    font-weight: 750;
                }

                .csd-article-variante {
                    margin: 0;
                    font-size: 10.5px;
                    color: #98a2b3;
                }

                .csd-article-prix-bloc {
                    text-align: right;
                    flex-shrink: 0;
                }

                .csd-article-prix {
                    display: block;
                    font-size: 12.5px;
                    font-weight: 800;
                }

                .csd-article-fcfa {
                    display: block;
                    margin-top: 2px;
                    color: #98a2b3;
                    font-size: 9.5px;
                }

                .csd-total-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-top: 1px solid #e9edf2;
                    padding-top: 11px;
                    margin-top: 4px;
                    font-size: 11.5px;
                    color: #667085;
                }

                .csd-total-row strong {
                    color: var(--csd-text);
                    font-size: 13px;
                }

                .csd-total-row.csd-fcfa {
                    border-top: none;
                    margin-top: 5px;
                    padding-top: 0;
                }

                .csd-total-row.csd-fcfa strong {
                    color: var(--csd-blue);
                }

                .csd-chat-zone {
                    min-height: 0;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: #fff;
                    border: 1px solid var(--csd-border);
                    border-radius: 20px 20px 14px 14px;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(16,24,40,.045);
                }

                .csd-messages {
                    flex: 1;
                    min-height: 0;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                    padding: 18px 13px 12px;
                    background:
                        radial-gradient(circle at 10% 0%, rgba(37,99,235,.035), transparent 28%),
                        #fbfcfe;
                    scrollbar-width: thin;
                    scrollbar-color: #d0d5dd transparent;
                }

                .csd-chat-empty-state {
                    min-height: 230px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    color: #667085;
                }

                .csd-chat-empty-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 15px;
                    background: #eff6ff;
                    color: var(--csd-blue);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 12px;
                }

                .csd-chat-empty-state p {
                    margin: 0 0 4px;
                    color: #344054;
                    font-size: 13px;
                    font-weight: 800;
                }

                .csd-chat-empty-state span {
                    font-size: 11px;
                    color: #98a2b3;
                }

                .csd-msg-wrap {
                    margin-bottom: 8px;
                }

                .csd-day-divider {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 16px 0 12px;
                    color: #98a2b3;
                    font-size: 9.5px;
                    font-weight: 750;
                    text-transform: uppercase;
                    letter-spacing: .5px;
                }

                .csd-day-divider::before,
                .csd-day-divider::after {
                    content: "";
                    height: 1px;
                    flex: 1;
                    background: #eaecf0;
                }

                .csd-badge-systeme {
                    width: fit-content;
                    max-width: 85%;
                    margin: 8px auto;
                    background: #f2f4f7;
                    border: 1px solid #eaecf0;
                    color: #667085;
                    border-radius: 999px;
                    padding: 6px 10px;
                    text-align: center;
                    font-size: 9.5px;
                    line-height: 1.4;
                }

                .csd-msg {
                    position: relative;
                    width: fit-content;
                    max-width: 78%;
                    padding: 9px 11px 7px;
                    border-radius: 16px;
                    box-shadow: 0 2px 8px rgba(16,24,40,.045);
                    animation: csd-message-in .18s ease;
                }

                @keyframes csd-message-in {
                    from {
                        opacity: 0;
                        transform: translateY(4px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .csd-msg-client {
                    margin-left: auto;
                    background: #111827;
                    color: #fff;
                    border-bottom-right-radius: 5px;
                }

                .csd-msg-agent {
                    margin-right: auto;
                    background: #fff;
                    color: #1d2939;
                    border: 1px solid #e5e7eb;
                    border-bottom-left-radius: 5px;
                }

                .csd-agent-label {
                    display: block;
                    color: var(--csd-blue);
                    font-size: 8.5px;
                    font-weight: 850;
                    margin-bottom: 4px;
                    text-transform: uppercase;
                    letter-spacing: .5px;
                }

                .csd-msg p {
                    margin: 0;
                    white-space: pre-wrap;
                    word-break: break-word;
                    font-size: 12.5px;
                    line-height: 1.48;
                }

                .csd-msg-img {
                    display: block;
                    max-width: 230px;
                    max-height: 280px;
                    border-radius: 11px;
                    object-fit: cover;
                    cursor: pointer;
                    margin-bottom: 5px;
                }

                .csd-msg-meta {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 4px;
                    margin-top: 4px;
                    min-height: 10px;
                }

                .csd-msg-heure {
                    font-size: 8.5px;
                    opacity: .58;
                }

                .csd-check {
                    display: inline-flex;
                    color: rgba(255,255,255,.55);
                }

                .csd-check-lu {
                    color: #93c5fd;
                }

                .csd-typing {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 11px 13px;
                    width: 48px;
                }

                .csd-typing-dot {
                    width: 5px;
                    height: 5px;
                    border-radius: 50%;
                    background: #98a2b3;
                    animation: csd-typing 1.1s infinite ease-in-out;
                }

                .csd-typing-dot:nth-child(2) {
                    animation-delay: .15s;
                }

                .csd-typing-dot:nth-child(3) {
                    animation-delay: .3s;
                }

                @keyframes csd-typing {
                    0%, 60%, 100% {
                        transform: translateY(0);
                        opacity: .45;
                    }
                    30% {
                        transform: translateY(-3px);
                        opacity: 1;
                    }
                }

                .csd-devis-card {
                    position: relative;
                    max-width: 86%;
                    margin: 7px auto;
                    padding: 16px;
                    background: linear-gradient(145deg, #ffffff, #f8fbff);
                    border: 1px solid #dbe7f8;
                    border-radius: 17px;
                    box-shadow: 0 8px 22px rgba(37,99,235,.07);
                }

                .csd-devis-top {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 7px;
                }

                .csd-devis-kicker {
                    color: var(--csd-blue);
                    font-size: 8.5px;
                    font-weight: 850;
                    text-transform: uppercase;
                    letter-spacing: .7px;
                }

                .csd-devis-status-dot {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: #22c55e;
                    box-shadow: 0 0 0 4px #dcfce7;
                }

                .csd-devis-libelle {
                    margin: 0 0 5px;
                    font-size: 12px;
                    font-weight: 750;
                    color: #344054;
                }

                .csd-devis-montant {
                    margin: 0;
                    font-size: 23px;
                    line-height: 1.1;
                    font-weight: 900;
                    letter-spacing: -.6px;
                    color: #101828;
                }

                .csd-devis-detail {
                    margin: 9px 0 12px;
                    color: #667085;
                    font-size: 10.5px;
                    line-height: 1.5;
                }

                .csd-devis-card button {
                    width: 100%;
                    border: none;
                    border-radius: 10px;
                    padding: 10px 12px;
                    background: var(--csd-blue);
                    color: #fff;
                    font-size: 11px;
                    font-weight: 800;
                    cursor: pointer;
                    transition: background .15s ease;
                }

                .csd-devis-card button:hover:not(:disabled) {
                    background: #1d4ed8;
                }

                .csd-devis-card button:disabled {
                    opacity: .55;
                }

                .csd-devis-paye {
                    display: inline-flex;
                    align-items: center;
                    border-radius: 999px;
                    background: #ecfdf3;
                    color: #027a48;
                    padding: 6px 10px;
                    font-size: 10px;
                    font-weight: 800;
                }

                .csd-devis-remplace {
                    opacity: .65;
                    background: #f8fafc;
                    border-color: #e5e7eb;
                }

                .csd-devis-montant-barre {
                    margin: 0 0 8px;
                    color: #98a2b3;
                    font-size: 15px;
                    font-weight: 800;
                    text-decoration: line-through;
                }

                .csd-devis-remplace-tag {
                    display: block;
                    color: #667085;
                    font-size: 9px;
                    line-height: 1.4;
                }

                .csd-avis-card {
                    max-width: 88%;
                    margin: 7px auto;
                    background: #fff;
                    border: 1px solid #e5e7eb;
                    border-radius: 17px;
                    padding: 15px;
                    box-shadow: 0 7px 20px rgba(16,24,40,.045);
                }

                .csd-avis-repondu {
                    background: #fbfefc;
                    border-color: #d1fadf;
                }

                .csd-avis-libelle {
                    margin: 0 0 9px;
                    font-size: 12px;
                    font-weight: 750;
                    color: #344054;
                }

                .csd-avis-etoiles {
                    display: flex;
                    gap: 1px;
                    margin-bottom: 9px;
                }

                .csd-avis-etoiles button {
                    border: none;
                    background: none;
                    padding: 0;
                    cursor: pointer;
                    display: flex;
                }

                .csd-avis-etoiles-lecture {
                    display: flex;
                    gap: 0;
                }

                .csd-avis-card textarea {
                    width: 100%;
                    box-sizing: border-box;
                    resize: vertical;
                    border: 1px solid #d0d5dd;
                    border-radius: 10px;
                    outline: none;
                    padding: 9px 10px;
                    font-family: inherit;
                    font-size: 11px;
                    color: #101828;
                    margin-bottom: 8px;
                    transition: border-color .15s, box-shadow .15s;
                }

                .csd-avis-card textarea:focus {
                    border-color: #60a5fa;
                    box-shadow: 0 0 0 3px rgba(37,99,235,.08);
                }

                .csd-avis-envoyer {
                    width: 100%;
                    border: none;
                    border-radius: 10px;
                    padding: 10px;
                    background: #101828;
                    color: #fff;
                    font-size: 10.5px;
                    font-weight: 800;
                    cursor: pointer;
                }

                .csd-chat-form {
                    flex-shrink: 0;
                    padding: 10px;
                    background: rgba(255,255,255,.96);
                    border-top: 1px solid #eaecf0;
                }

                .csd-preview {
                    position: relative;
                    width: 70px;
                    height: 70px;
                    border-radius: 10px;
                    overflow: hidden;
                    margin: 0 0 8px 4px;
                    border: 1px solid #e5e7eb;
                }

                .csd-preview img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .csd-preview button {
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    width: 20px;
                    height: 20px;
                    border: none;
                    border-radius: 6px;
                    background: rgba(17,24,39,.82);
                    color: #fff;
                    cursor: pointer;
                    font-size: 13px;
                    line-height: 1;
                }

                .csd-chat-row {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    min-height: 46px;
                    border: 1px solid #dfe3e8;
                    border-radius: 15px;
                    background: #f8fafc;
                    padding: 4px;
                    transition: border-color .18s, box-shadow .18s, background .18s;
                }

                .csd-chat-row:focus-within {
                    border-color: #93c5fd;
                    background: #fff;
                    box-shadow: 0 0 0 4px rgba(37,99,235,.07);
                }

                .csd-attach-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #667085;
                    cursor: pointer;
                    transition: background .15s, color .15s;
                    flex-shrink: 0;
                }

                .csd-attach-btn:hover {
                    color: var(--csd-blue);
                    background: #eff6ff;
                }

                .csd-chat-row > input {
                    flex: 1;
                    min-width: 0;
                    border: none;
                    outline: none;
                    background: transparent;
                    color: #101828;
                    font-family: inherit;
                    font-size: 12.5px;
                    padding: 0 3px;
                }

                .csd-chat-row > input::placeholder {
                    color: #98a2b3;
                }

                .csd-send-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 11px;
                    border: none;
                    background: var(--csd-blue);
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    flex-shrink: 0;
                    transition: background .15s, transform .1s, opacity .15s;
                }

                .csd-send-btn:hover:not(:disabled) {
                    background: #1d4ed8;
                }

                .csd-send-btn:active:not(:disabled) {
                    transform: scale(.94);
                }

                .csd-send-btn:disabled {
                    opacity: .35;
                    cursor: default;
                }

                .csd-chat-closed {
                    flex-shrink: 0;
                    text-align: center;
                    border-top: 1px solid #eaecf0;
                    background: #f8fafc;
                    color: #667085;
                    padding: 12px;
                    font-size: 10.5px;
                    font-weight: 700;
                }

                @media (max-width: 600px) {
                    .csd-page {
                        padding-left: 9px;
                        padding-right: 9px;
                    }

                    .csd-chat-zone {
                        border-radius: 18px 18px 12px 12px;
                    }

                    .csd-msg {
                        max-width: 84%;
                    }

                    .csd-devis-card,
                    .csd-avis-card {
                        max-width: 94%;
                    }
                }

                @media (max-width: 380px) {
                    .csd-page {
                        padding-left: 7px;
                        padding-right: 7px;
                    }

                    .csd-header {
                        gap: 8px;
                    }

                    .csd-back,
                    .csd-toggle {
                        width: 36px;
                        height: 36px;
                        border-radius: 10px;
                    }

                    .csd-statut {
                        font-size: 12px;
                    }

                    .csd-msg {
                        max-width: 88%;
                    }
                }
            `}</style>
        </div>
    );
};

export default ColisSheinDetail;