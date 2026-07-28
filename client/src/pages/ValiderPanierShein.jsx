import { useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";

const money = (n, devise) =>
    `${devise === "EUR" ? "€" : "$"}${Number(n || 0).toFixed(2)}`;

const IconUpload = () => (
    <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

const IconLink = () => (
    <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
);

const IconTrash = () => (
    <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
);

const IconCheck = () => (
    <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const IconArrow = () => (
    <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
    </svg>
);

const IconWarning = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

const ETAPES = [
    {
        id: "saisie",
        numero: 1,
        label: "Photos & lien",
    },
    {
        id: "reviewing",
        numero: 2,
        label: "Vérification",
    },
    {
        id: "submitted",
        numero: 3,
        label: "Confirmation",
    },
];

const ValiderPanierShein = () => {
    const { axios, user, setShowUserLogin, navigate } =
        useAppContext();

    const [images, setImages] = useState([]);
    const [lienPartage, setLienPartage] = useState("");
    const [status, setStatus] = useState("idle");
    const [articles, setArticles] = useState([]);
    const [captures, setCaptures] = useState([]);
    const [totalAffiche, setTotalAffiche] = useState(null);
    const [devise, setDevise] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [aEssaye, setAEssaye] = useState(false);

    const hasImages = images.length > 0;
    const hasLink = lienPartage.trim() !== "";
    const canAnalyze = hasImages && hasLink;

    const etapeActuelle =
        status === "submitted"
            ? "submitted"
            : status === "reviewing" ||
              status === "submitting"
            ? "reviewing"
            : "saisie";

    const handleFiles = (fileList) => {
        const files = Array.from(fileList).map((f) => ({
            id: crypto.randomUUID(),
            file: f,
            url: URL.createObjectURL(f),
        }));

        setImages((prev) => [...prev, ...files]);
    };

    const removeImage = (id) =>
        setImages((prev) =>
            prev.filter((img) => img.id !== id)
        );

    const onDrop = (e) => {
        e.preventDefault();
        setDragActive(false);

        if (e.dataTransfer.files?.length) {
            handleFiles(e.dataTransfer.files);
        }
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

            images.forEach((img) =>
                formData.append("captures", img.file)
            );

            formData.append(
                "lienPartage",
                lienPartage.trim()
            );

            const { data } = await axios.post(
                "/api/shein-cart/analyze",
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                }
            );

            if (data.success) {
                setArticles(
                    data.articles.map((a) => ({
                        ...a,
                        id: crypto.randomUUID(),
                    }))
                );

                setCaptures(data.captures);
                setTotalAffiche(data.totalAffiche);
                setDevise(data.devise ?? null);
                setStatus("reviewing");
            } else {
                toast.error(
                    data.message || "Extraction impossible"
                );
                setStatus("idle");
            }
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                    "Erreur pendant l'analyse"
            );
            setStatus("idle");
        }
    };

    const updateArticle = (id, field, value) => {
        setArticles((prev) =>
            prev.map((a) =>
                a.id === id
                    ? {
                          ...a,
                          [field]:
                              value === ""
                                  ? ""
                                  : Number(value),
                      }
                    : a
            )
        );
    };

    const ajusterQuantite = (id, delta) => {
        setArticles((prev) =>
            prev.map((a) => {
                if (a.id !== id) return a;

                const actuelle = Number(a.quantite) || 0;

                return {
                    ...a,
                    quantite: Math.max(
                        1,
                        actuelle + delta
                    ),
                };
            })
        );
    };

    const removeArticle = (id) =>
        setArticles((prev) =>
            prev.filter((a) => a.id !== id)
        );

    const sousTotal = articles.reduce(
        (sum, a) =>
            sum +
            (Number(
                a.prix_unitaire ?? a.prixUnitaire
            ) || 0) *
                (Number(a.quantite) || 0),
        0
    );

    const ecartTotal =
        totalAffiche != null &&
        Math.abs(sousTotal - totalAffiche) > 0.5;

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
                    prixUnitaire:
                        a.prix_unitaire ??
                        a.prixUnitaire,
                    prixOriginal:
                        a.prix_original ??
                        a.prixOriginal ??
                        null,
                    quantite: a.quantite,
                })),
            };

            const { data } = await axios.post(
                "/api/shein-cart/submit",
                payload
            );

            if (data.success) {
                toast.success(
                    "Panier soumis pour validation"
                );

                setStatus("submitted");

                setTimeout(
                    () => navigate("/mes-colis-shein"),
                    1200
                );
            } else {
                toast.error(
                    data.message || "Soumission impossible"
                );
                setStatus("reviewing");
            }
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                    "Erreur pendant la soumission"
            );
            setStatus("reviewing");
        }
    };

    const champImageInvalide =
        aEssaye && !hasImages;

    const champLienInvalide =
        aEssaye && !hasLink;

    return (
        <div className="vps-page">
            <div className="vps-heading">
                <div>
                    <span className="vps-kicker">
                        COMMANDE SHEIN
                    </span>

                    <h1 className="vps-title">
                        Valider le panier
                    </h1>

                    <p className="vps-subtitle">
                        Prépare ton panier pour que notre
                        équipe puisse le vérifier.
                    </p>
                </div>

                <div className="vps-heading-mark">
                    <span />
                </div>
            </div>

            <div
                className="vps-steps"
                aria-hidden="true"
            >
                {ETAPES.map((e, i) => {
                    const actif =
                        e.id === etapeActuelle;

                    const complet =
                        ETAPES.findIndex(
                            (x) =>
                                x.id === etapeActuelle
                        ) > i;

                    return (
                        <div
                            key={e.id}
                            className={`vps-step ${
                                actif ? "actif" : ""
                            } ${
                                complet ? "complet" : ""
                            }`}
                        >
                            <span className="vps-step-num">
                                {complet ? (
                                    <IconCheck />
                                ) : (
                                    e.numero
                                )}
                            </span>

                            <span className="vps-step-label">
                                {e.label}
                            </span>

                            {i <
                                ETAPES.length - 1 && (
                                <span className="vps-step-line" />
                            )}
                        </div>
                    );
                })}
            </div>

            {status === "submitted" ? (
                <div className="vps-card vps-confirm">
                    <div className="vps-confirm-icon">
                        <IconCheck />
                    </div>

                    <span className="vps-confirm-kicker">
                        DEMANDE ENREGISTRÉE
                    </span>

                    <p className="vps-confirm-title">
                        Panier soumis
                    </p>

                    <p className="vps-confirm-text">
                        Un agent vérifie ton panier. Tu
                        recevras ton devis sous peu.
                    </p>

                    <span className="vps-badge">
                        En attente de vérification
                    </span>

                    <button
                        className="vps-btn-secondary"
                        onClick={() =>
                            navigate("/mes-colis-shein")
                        }
                    >
                        Voir mes colis SHEIN
                        <IconArrow />
                    </button>
                </div>
            ) : (
                <>
                    <div className="vps-instruction">
                        <div className="vps-instruction-icon">
                            <IconWarning />
                        </div>

                        <div>
                            <strong>
                                Avant de commencer
                            </strong>

                            <p>
                                Sélectionne{" "}
                                <strong>« Tout »</strong>{" "}
                                dans ton panier SHEIN et
                                vérifie que le total
                                n'affiche pas{" "}
                                <strong>0.00</strong> avant
                                de capturer l'écran.
                            </p>
                        </div>
                    </div>

                    <div className="vps-card">
                        <div className="vps-section-header">
                            <div>
                                <span className="vps-section-index">
                                    01
                                </span>

                                <div>
                                    <div className="vps-field-label">
                                        Captures d'écran
                                    </div>

                                    <span className="vps-section-help">
                                        Ajoute les captures de
                                        ton panier SHEIN
                                    </span>
                                </div>
                            </div>

                            <span className="vps-required">
                                Obligatoire
                            </span>
                        </div>

                        <label
                            className={`vps-upload-zone ${
                                dragActive ? "drag" : ""
                            } ${
                                champImageInvalide
                                    ? "invalide"
                                    : ""
                            }`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragActive(true);
                            }}
                            onDragLeave={() =>
                                setDragActive(false)
                            }
                            onDrop={onDrop}
                        >
                            <span className="vps-upload-icon">
                                <IconUpload />
                            </span>

                            <span className="vps-upload-label">
                                Glisse tes captures ici
                            </span>

                            <span className="vps-upload-or">
                                ou clique pour choisir
                            </span>

                            <span className="vps-upload-sub">
                                PNG ou JPG · plusieurs images
                                acceptées
                            </span>

                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                hidden
                                onChange={(e) =>
                                    e.target.files &&
                                    handleFiles(
                                        e.target.files
                                    )
                                }
                            />
                        </label>

                        {champImageInvalide && (
                            <p className="vps-field-error">
                                Ajoute au moins une capture
                                d'écran
                            </p>
                        )}

                        {hasImages && (
                            <div className="vps-thumbs">
                                {images.map((img) => (
                                    <div
                                        key={img.id}
                                        className="vps-thumb"
                                    >
                                        <img
                                            src={img.url}
                                            alt=""
                                        />

                                        <div className="vps-thumb-overlay">
                                            <button
                                                onClick={() =>
                                                    removeImage(
                                                        img.id
                                                    )
                                                }
                                                aria-label="Supprimer"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <label className="vps-thumb vps-thumb-add">
                                    <span>+</span>

                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        hidden
                                        onChange={(e) =>
                                            e.target.files &&
                                            handleFiles(
                                                e.target.files
                                            )
                                        }
                                    />
                                </label>
                            </div>
                        )}

                        <div className="vps-divider" />

                        <div className="vps-section-header link-section">
                            <div>
                                <span className="vps-section-index">
                                    02
                                </span>

                                <div>
                                    <div className="vps-field-label">
                                        Lien de partage SHEIN
                                    </div>

                                    <span className="vps-section-help">
                                        Le lien permet de
                                        récupérer les
                                        informations du panier
                                    </span>
                                </div>
                            </div>

                            <span className="vps-required">
                                Obligatoire
                            </span>
                        </div>

                        <div
                            className={`vps-link-wrap ${
                                champLienInvalide
                                    ? "invalide"
                                    : ""
                            }`}
                        >
                            <IconLink />

                            <input
                                type="text"
                                placeholder="https://fr.shein.com/share/..."
                                value={lienPartage}
                                onChange={(e) =>
                                    setLienPartage(
                                        e.target.value
                                    )
                                }
                                className="vps-link-input"
                            />
                        </div>

                        {champLienInvalide && (
                            <p className="vps-field-error">
                                Colle le lien de partage de
                                ton panier
                            </p>
                        )}

                        <p className="vps-required-note">
                            Les deux éléments sont nécessaires
                            pour lancer l'analyse.
                        </p>

                        {status !== "reviewing" && (
                            <button
                                onClick={analyser}
                                disabled={
                                    status === "analyzing"
                                }
                                className="vps-btn-primary"
                            >
                                {status === "analyzing" ? (
                                    <span className="vps-spinner-wrap">
                                        <span className="vps-spinner" />
                                        Analyse en cours…
                                    </span>
                                ) : (
                                    <>
                                        Analyser mon panier
                                        <IconArrow />
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {status === "reviewing" && (
                        <div className="vps-results">
                            <div className="vps-results-heading">
                                <div>
                                    <span className="vps-kicker">
                                        ANALYSE TERMINÉE
                                    </span>

                                    <p className="vps-results-title">
                                        Vérifie ton panier
                                    </p>
                                </div>

                                <span className="vps-results-count">
                                    {articles.length} article
                                    {articles.length > 1
                                        ? "s"
                                        : ""}
                                </span>
                            </div>

                            {ecartTotal && (
                                <div className="vps-warning">
                                    <IconWarning />

                                    <span>
                                        Le total calculé (
                                        {money(
                                            sousTotal,
                                            devise
                                        )}
                                        ) diffère du total
                                        affiché sur ton panier
                                        (
                                        {money(
                                            totalAffiche,
                                            devise
                                        )}
                                        ). Vérifie les
                                        quantités — l'agent
                                        confirmera à la
                                        validation.
                                    </span>
                                </div>
                            )}

                            {articles.map((a, index) => (
                                <div
                                    key={a.id}
                                    className="vps-card vps-article"
                                >
                                    <div className="vps-article-number">
                                        {String(index + 1).padStart(
                                            2,
                                            "0"
                                        )}
                                    </div>

                                    <div className="vps-article-info">
                                        <p className="vps-shop">
                                            {a.boutique}
                                        </p>

                                        <p className="vps-name">
                                            {a.nom}
                                        </p>

                                        {a.variante && (
                                            <p className="vps-variant">
                                                {a.variante}
                                            </p>
                                        )}

                                        <div className="vps-fields">
                                            <label className="vps-price-field">
                                                <span className="vps-currency">
                                                    {devise ===
                                                    "EUR"
                                                        ? "€"
                                                        : "$"}
                                                </span>

                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={
                                                        a.prix_unitaire ??
                                                        a.prixUnitaire
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        updateArticle(
                                                            a.id,
                                                            "prix_unitaire",
                                                            e.target
                                                                .value
                                                        )
                                                    }
                                                />
                                            </label>

                                            <div className="vps-stepper">
                                                <button
                                                    onClick={() =>
                                                        ajusterQuantite(
                                                            a.id,
                                                            -1
                                                        )
                                                    }
                                                    aria-label="Diminuer"
                                                >
                                                    −
                                                </button>

                                                <span>
                                                    {a.quantite}
                                                </span>

                                                <button
                                                    onClick={() =>
                                                        ajusterQuantite(
                                                            a.id,
                                                            1
                                                        )
                                                    }
                                                    aria-label="Augmenter"
                                                >
                                                    +
                                                </button>
                                            </div>

                                            <span className="vps-line-total">
                                                {money(
                                                    (a.prix_unitaire ??
                                                        a.prixUnitaire) *
                                                        a.quantite,
                                                    devise
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        className="vps-remove"
                                        onClick={() =>
                                            removeArticle(
                                                a.id
                                            )
                                        }
                                        aria-label="Retirer"
                                    >
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
                        <div className="vps-total-block">
                            <p className="vps-total-label">
                                Total estimé
                            </p>

                            <p className="vps-total-value">
                                {money(
                                    sousTotal,
                                    devise
                                )}
                            </p>

                            <span>
                                {articles.length} article
                                {articles.length > 1
                                    ? "s"
                                    : ""}
                            </span>
                        </div>

                        <button
                            onClick={soumettre}
                            disabled={
                                articles.length === 0 ||
                                status === "submitting"
                            }
                            className="vps-btn-primary vps-submit"
                        >
                            {status === "submitting"
                                ? "Envoi…"
                                : (
                                    <>
                                        Soumettre
                                        <IconArrow />
                                    </>
                                )}
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                .vps-page {
                    --black: #070707;
                    --black-soft: #0d0d0d;
                    --surface: #131313;
                    --surface-2: #181818;
                    --surface-3: #202020;
                    --border: #292929;
                    --white: #f7f7f7;
                    --muted: #858585;
                    --muted-2: #5d5d5d;
                    --red: #e50914;
                    --red-hover: #ff1c28;

                    max-width: 560px;
                    margin: 0 auto;
                    padding: 0 14px 120px;
                    font-family: Inter, "DM Sans", sans-serif;
                    color: var(--white);
                    background: var(--black);
                    min-height: 100%;
                }

                .vps-heading {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    padding: 18px 2px 20px;
                }

                .vps-kicker {
                    display: block;
                    color: #e50914;
                    font-size: 8.5px;
                    font-weight: 800;
                    letter-spacing: 1.4px;
                    text-transform: uppercase;
                    margin-bottom: 5px;
                }

                .vps-title {
                    font-size: 24px;
                    line-height: 1.1;
                    font-weight: 760;
                    letter-spacing: -.8px;
                    color: #fff;
                    margin: 0;
                }

                .vps-subtitle {
                    max-width: 320px;
                    color: #666;
                    font-size: 11px;
                    line-height: 1.5;
                    margin: 7px 0 0;
                }

                .vps-heading-mark {
                    width: 44px;
                    height: 44px;
                    border: 1px solid #292929;
                    background: #111;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .vps-heading-mark span {
                    width: 13px;
                    height: 13px;
                    border-radius: 50%;
                    background: #e50914;
                    box-shadow: 0 0 0 7px rgba(229,9,20,.08);
                }

                .vps-steps {
                    display: flex;
                    align-items: flex-start;
                    margin-bottom: 18px;
                    padding: 0 5px;
                }

                .vps-step {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    position: relative;
                    flex: 1;
                }

                .vps-step-num {
                    width: 28px;
                    height: 28px;
                    border-radius: 9px;
                    background: #151515;
                    border: 1px solid #292929;
                    color: #555;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    font-weight: 750;
                    margin-bottom: 6px;
                    transition: .2s;
                    z-index: 1;
                }

                .vps-step-num svg {
                    width: 14px;
                    height: 14px;
                }

                .vps-step.actif .vps-step-num {
                    background: #e50914;
                    border-color: #e50914;
                    color: #fff;
                    box-shadow: 0 5px 15px rgba(229,9,20,.2);
                }

                .vps-step.complet .vps-step-num {
                    background: #252525;
                    border-color: #444;
                    color: #eee;
                }

                .vps-step-label {
                    font-size: 9px;
                    color: #555;
                    text-align: center;
                    font-weight: 650;
                }

                .vps-step.actif .vps-step-label {
                    color: #ddd;
                }

                .vps-step.complet .vps-step-label {
                    color: #888;
                }

                .vps-step-line {
                    position: absolute;
                    top: 14px;
                    left: calc(50% + 18px);
                    right: calc(-50% + 18px);
                    height: 1px;
                    background: #262626;
                }

                .vps-step.complet .vps-step-line {
                    background: #555;
                }

                .vps-instruction {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    background: #151111;
                    border: 1px solid #342020;
                    border-radius: 13px;
                    padding: 12px 13px;
                    margin-bottom: 12px;
                    color: #aaa;
                }

                .vps-instruction-icon {
                    width: 28px;
                    height: 28px;
                    border-radius: 8px;
                    background: rgba(229,9,20,.08);
                    border: 1px solid rgba(229,9,20,.18);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #e50914;
                    flex-shrink: 0;
                }

                .vps-instruction-icon svg {
                    width: 14px;
                    height: 14px;
                }

                .vps-instruction strong {
                    color: #ddd;
                    font-size: 10.5px;
                }

                .vps-instruction p {
                    margin: 4px 0 0;
                    font-size: 10.5px;
                    line-height: 1.5;
                }

                .vps-card {
                    background: #111;
                    border: 1px solid #252525;
                    border-radius: 16px;
                    padding: 16px;
                    margin-bottom: 12px;
                    box-shadow: 0 12px 35px rgba(0,0,0,.12);
                }

                .vps-section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 10px;
                    margin-bottom: 10px;
                }

                .vps-section-header > div {
                    display: flex;
                    align-items: flex-start;
                    gap: 9px;
                }

                .vps-section-index {
                    color: #555;
                    font-size: 9px;
                    font-weight: 800;
                    padding-top: 1px;
                }

                .vps-field-label {
                    font-size: 11.5px;
                    font-weight: 700;
                    color: #eee;
                    margin-bottom: 2px;
                }

                .vps-section-help {
                    color: #5f5f5f;
                    font-size: 9px;
                    line-height: 1.4;
                }

                .vps-required {
                    font-size: 7.5px;
                    font-weight: 750;
                    letter-spacing: .55px;
                    text-transform: uppercase;
                    color: #ff5961;
                    background: rgba(229,9,20,.08);
                    border: 1px solid rgba(229,9,20,.16);
                    padding: 4px 6px;
                    border-radius: 20px;
                    white-space: nowrap;
                }

                .vps-upload-zone {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    border: 1px dashed #333;
                    background: #0d0d0d;
                    border-radius: 13px;
                    padding: 30px 12px;
                    cursor: pointer;
                    transition: .18s;
                    color: #777;
                }

                .vps-upload-zone:hover,
                .vps-upload-zone.drag {
                    border-color: #e50914;
                    background: #120c0c;
                }

                .vps-upload-zone.invalide {
                    border-color: #713033;
                }

                .vps-upload-icon {
                    width: 38px;
                    height: 38px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #777;
                    border-radius: 11px;
                    background: #181818;
                    border: 1px solid #292929;
                    margin-bottom: 5px;
                }

                .vps-upload-zone:hover .vps-upload-icon,
                .vps-upload-zone.drag .vps-upload-icon {
                    color: #e50914;
                    border-color: rgba(229,9,20,.25);
                }

                .vps-upload-label {
                    font-size: 11.5px;
                    font-weight: 650;
                    color: #ddd;
                }

                .vps-upload-or {
                    color: #777;
                    font-size: 9.5px;
                }

                .vps-upload-sub {
                    font-size: 8.5px;
                    color: #4f4f4f;
                    margin-top: 3px;
                }

                .vps-field-error {
                    font-size: 9.5px;
                    color: #e9565d;
                    margin: 6px 2px 0;
                }

                .vps-thumbs {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 7px;
                    margin-top: 10px;
                }

                .vps-thumb {
                    position: relative;
                    aspect-ratio: 1;
                    border-radius: 9px;
                    overflow: hidden;
                    background: #181818;
                    border: 1px solid #292929;
                }

                .vps-thumb img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .vps-thumb-overlay {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    justify-content: flex-end;
                    align-items: flex-start;
                    padding: 4px;
                    background: linear-gradient(
                        180deg,
                        rgba(0,0,0,.5),
                        transparent 45%
                    );
                }

                .vps-thumb button {
                    background: rgba(0,0,0,.75);
                    color: #fff;
                    border: 1px solid rgba(255,255,255,.12);
                    border-radius: 6px;
                    width: 20px;
                    height: 20px;
                    font-size: 13px;
                    cursor: pointer;
                    line-height: 1;
                }

                .vps-thumb-add {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px dashed #333;
                    cursor: pointer;
                    color: #555;
                    font-size: 20px;
                    transition: .15s;
                }

                .vps-thumb-add:hover {
                    border-color: #e50914;
                    color: #e50914;
                }

                .vps-divider {
                    height: 1px;
                    background: #222;
                    margin: 17px 0;
                }

                .vps-link-wrap {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border: 1px solid #292929;
                    background: #0d0d0d;
                    border-radius: 11px;
                    padding: 10px 12px;
                    transition: .16s;
                    color: #666;
                }

                .vps-link-wrap:focus-within {
                    border-color: #555;
                    color: #e50914;
                }

                .vps-link-wrap.invalide {
                    border-color: #713033;
                }

                .vps-link-input {
                    flex: 1;
                    min-width: 0;
                    border: none;
                    outline: none;
                    font-size: 11px;
                    color: #eee;
                    background: none;
                }

                .vps-link-input::placeholder {
                    color: #4e4e4e;
                }

                .vps-required-note {
                    font-size: 8.5px;
                    color: #505050;
                    text-align: center;
                    margin: 10px 0 0;
                }

                .vps-btn-primary {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    background: #e50914;
                    color: #fff;
                    border: none;
                    border-radius: 11px;
                    padding: 12px 15px;
                    font-size: 11.5px;
                    font-weight: 750;
                    cursor: pointer;
                    margin-top: 14px;
                    transition: .17s;
                    box-shadow: 0 8px 22px rgba(229,9,20,.14);
                }

                .vps-btn-primary:hover:not(:disabled) {
                    background: #ff1b26;
                    transform: translateY(-1px);
                }

                .vps-btn-primary:active:not(:disabled) {
                    transform: scale(.985);
                }

                .vps-btn-primary:disabled {
                    opacity: .4;
                    cursor: default;
                    box-shadow: none;
                }

                .vps-btn-secondary {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    background: #181818;
                    border: 1px solid #303030;
                    color: #eee;
                    border-radius: 11px;
                    padding: 12px 15px;
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                    margin-top: 18px;
                    transition: .16s;
                }

                .vps-btn-secondary:hover {
                    border-color: #555;
                    background: #202020;
                }

                .vps-spinner-wrap {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .vps-spinner {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    border: 2px solid rgba(255,255,255,.3);
                    border-top-color: #fff;
                    animation: vps-spin .7s linear infinite;
                }

                @keyframes vps-spin {
                    to {
                        transform: rotate(360deg);
                    }
                }

                .vps-results {
                    margin-top: 18px;
                }

                .vps-results-heading {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    margin: 0 3px 10px;
                }

                .vps-results-title {
                    font-size: 15px;
                    font-weight: 750;
                    color: #eee;
                    margin: 0;
                }

                .vps-results-count {
                    font-size: 9px;
                    color: #777;
                    border: 1px solid #292929;
                    background: #111;
                    padding: 5px 8px;
                    border-radius: 20px;
                }

                .vps-warning {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    background: #17130b;
                    border: 1px solid #382d18;
                    color: #a38a55;
                    border-radius: 12px;
                    padding: 11px 12px;
                    font-size: 10px;
                    line-height: 1.45;
                    margin-bottom: 10px;
                }

                .vps-warning svg {
                    flex-shrink: 0;
                    margin-top: 1px;
                }

                .vps-article {
                    display: flex;
                    gap: 9px;
                    transition: .15s;
                }

                .vps-article:hover {
                    border-color: #383838;
                }

                .vps-article-number {
                    color: #444;
                    font-size: 9px;
                    font-weight: 800;
                    padding-top: 2px;
                }

                .vps-article-info {
                    flex: 1;
                    min-width: 0;
                }

                .vps-shop {
                    font-size: 8px;
                    color: #555;
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: .7px;
                    font-weight: 700;
                }

                .vps-name {
                    font-size: 12px;
                    font-weight: 700;
                    color: #eee;
                    margin: 3px 0 2px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .vps-variant {
                    font-size: 9.5px;
                    color: #666;
                    margin: 0 0 10px;
                }

                .vps-fields {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    flex-wrap: wrap;
                }

                .vps-price-field {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    border: 1px solid #2b2b2b;
                    background: #0d0d0d;
                    border-radius: 7px;
                    padding: 5px 7px;
                }

                .vps-price-field .vps-currency {
                    font-size: 10px;
                    color: #666;
                }

                .vps-price-field input {
                    width: 52px;
                    border: none;
                    outline: none;
                    background: transparent;
                    color: #eee;
                    font-size: 11px;
                    padding: 0;
                }

                .vps-stepper {
                    display: flex;
                    align-items: center;
                    border: 1px solid #2b2b2b;
                    background: #0d0d0d;
                    border-radius: 7px;
                    overflow: hidden;
                }

                .vps-stepper button {
                    width: 25px;
                    height: 25px;
                    border: none;
                    background: #181818;
                    color: #aaa;
                    font-size: 14px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .vps-stepper button:hover {
                    background: #252525;
                    color: #fff;
                }

                .vps-stepper span {
                    width: 25px;
                    text-align: center;
                    font-size: 10px;
                    font-weight: 700;
                    color: #eee;
                }

                .vps-line-total {
                    margin-left: auto;
                    font-size: 12px;
                    font-weight: 750;
                    color: #ff4750;
                }

                .vps-remove {
                    background: none;
                    border: none;
                    color: #555;
                    cursor: pointer;
                    align-self: flex-start;
                    padding: 2px;
                    transition: .15s;
                }

                .vps-remove:hover {
                    color: #e50914;
                }

                .vps-sticky-bar {
                    position: fixed;
                    bottom: 65px;
                    left: 0;
                    right: 0;
                    background: rgba(7,7,7,.88);
                    backdrop-filter: blur(15px);
                    border-top: 1px solid #292929;
                    padding: 10px 14px;
                    padding-bottom: calc(
                        10px + env(safe-area-inset-bottom)
                    );
                    z-index: 150;
                }

                .vps-sticky-inner {
                    max-width: 560px;
                    margin: 0 auto;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .vps-total-block {
                    min-width: 105px;
                }

                .vps-total-label {
                    font-size: 8px;
                    color: #666;
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: .5px;
                }

                .vps-total-value {
                    font-size: 16px;
                    font-weight: 800;
                    color: #fff;
                    margin: 2px 0;
                }

                .vps-total-block > span {
                    font-size: 8px;
                    color: #555;
                }

                .vps-submit {
                    flex: 1;
                    margin-top: 0;
                    width: auto;
                }

                .vps-confirm {
                    text-align: center;
                    padding: 42px 22px;
                    margin-top: 15px;
                }

                .vps-confirm-icon {
                    width: 56px;
                    height: 56px;
                    border-radius: 16px;
                    background: rgba(229,9,20,.08);
                    border: 1px solid rgba(229,9,20,.2);
                    color: #e50914;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 17px;
                }

                .vps-confirm-kicker {
                    display: block;
                    color: #e50914;
                    font-size: 8px;
                    font-weight: 800;
                    letter-spacing: 1.1px;
                    margin-bottom: 6px;
                }

                .vps-confirm-title {
                    font-size: 18px;
                    font-weight: 750;
                    color: #fff;
                    margin: 0 0 6px;
                }

                .vps-confirm-text {
                    max-width: 280px;
                    margin: 0 auto 15px;
                    font-size: 11px;
                    line-height: 1.55;
                    color: #777;
                }

                .vps-badge {
                    display: inline-block;
                    font-size: 8.5px;
                    font-weight: 650;
                    background: #181818;
                    border: 1px solid #292929;
                    color: #888;
                    border-radius: 40px;
                    padding: 6px 10px;
                }

                @media (min-width: 700px) {
                    .vps-page {
                        max-width: 640px;
                        padding-left: 0;
                        padding-right: 0;
                    }

                    .vps-sticky-inner {
                        max-width: 640px;
                    }
                }

                @media (max-width: 420px) {
                    .vps-page {
                        padding-left: 9px;
                        padding-right: 9px;
                    }

                    .vps-heading-mark {
                        width: 38px;
                        height: 38px;
                    }

                    .vps-subtitle {
                        max-width: 250px;
                    }

                    .vps-required {
                        display: none;
                    }

                    .vps-line-total {
                        width: 100%;
                        margin-left: 0;
                    }
                }
            `}</style>
        </div>
    );
};

export default ValiderPanierShein;