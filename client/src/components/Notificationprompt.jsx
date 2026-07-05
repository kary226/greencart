import React, { useEffect, useState, useRef } from "react";
import { useAppContext } from "../context/AppContext";

// [FIX] localStorage (et non sessionStorage) : la valeur doit survivre à la
// fermeture de l'onglet/du navigateur pour que le cooldown de 2h ait un sens
// sur plusieurs sessions ("l'utilisateur se connecte 2h plus tard").
const LAST_DISMISS_KEY = "ramci_notif_prompt_last_dismiss";
// Délai avant réapparition après un clic sur "Plus tard".
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 heures
// Petit délai avant la toute première apparition, pour laisser le temps de
// voir le site avant de proposer la popup.
const INITIAL_DELAY_MS = 1500;
// Fréquence de re-vérification pendant qu'un onglet reste ouvert longtemps
// (permet à la popup de réapparaître sans que l'utilisateur ait à recharger
// la page une fois les 2h de cooldown écoulées).
const RECHECK_INTERVAL_MS = 60 * 1000; // 1 minute

const getLastDismiss = () => {
    const raw = localStorage.getItem(LAST_DISMISS_KEY);
    const ts = raw ? parseInt(raw, 10) : NaN;
    return Number.isNaN(ts) ? null : ts;
};

const cooldownElapsed = () => {
    const lastDismiss = getLastDismiss();
    if (lastDismiss === null) return true;
    return Date.now() - lastDismiss >= COOLDOWN_MS;
};

const NotificationPrompt = () => {
    const { user, subscribeToPushNotifications } = useAppContext();
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const shownOnceRef = useRef(false);

    useEffect(() => {
        // Conditions pour proposer la popup automatique :
        // - utilisateur connecté (l'abonnement push est lié à un compte)
        // - navigateur supportant les notifications
        // - permission jamais tranchée ("default" = ni accordée ni refusée)
        //   -> si déjà "granted" ou "denied", on ne redemande jamais ici,
        //      exactement comme le bouton existant de la Navbar
        // - le cooldown de 2h depuis le dernier "Plus tard" est écoulé
        //   (ou l'utilisateur n'a encore jamais cliqué sur "Plus tard")
        const canShow = () =>
            !!user &&
            typeof Notification !== "undefined" &&
            Notification.permission === "default" &&
            cooldownElapsed();

        const tryShow = () => {
            if (!canShow()) {
                setVisible(false);
                return;
            }
            setVisible(true);
        };

        // Première apparition : petit délai, une seule fois par montage.
        let initialTimer;
        if (!shownOnceRef.current) {
            initialTimer = setTimeout(() => {
                shownOnceRef.current = true;
                tryShow();
            }, INITIAL_DELAY_MS);
        } else {
            tryShow();
        }

        // Revérifie régulièrement : si le cooldown de 2h se termine pendant
        // que l'onglet reste ouvert, la popup réapparaît sans attendre un
        // rechargement de page.
        const interval = setInterval(tryShow, RECHECK_INTERVAL_MS);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
        };
    }, [user]);

    const handleEnable = async () => {
        setLoading(true);
        const result = await subscribeToPushNotifications();
        setLoading(false);
        setVisible(false);
        // Si accepté, Notification.permission passe à "granted" : la popup ne
        // sera plus jamais proposée (voir canShow ci-dessus). Si l'utilisateur
        // a refusé la popup native du navigateur, permission passe à "denied"
        // et on ne redemande plus non plus. On ne pose donc le cooldown que
        // dans handleDismiss, pas ici.
        void result;
    };

    // [FIX] "Plus tard" = on cache la popup ET on mémorise l'instant du clic
    // (persistant, via localStorage) pour ne pas la réafficher avant 2h.
    // Après ces 2h, elle réapparaît, et ainsi de suite jusqu'à ce que
    // l'utilisateur clique sur "Activer".
    const handleDismiss = () => {
        localStorage.setItem(LAST_DISMISS_KEY, String(Date.now()));
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <>
            <div className="notif-prompt-overlay" onClick={handleDismiss} />
            <div className="notif-prompt-modal" role="dialog" aria-live="polite" aria-modal="true">
                <div className="notif-prompt-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                </div>

                <h3 className="notif-prompt-title">Activer les notifications ?</h3>
                <p className="notif-prompt-text">
                    Soyez informé en temps réel du statut de vos commandes, des promos et des nouveautés RAMCI.
                </p>

                <div className="notif-prompt-actions">
                    <button className="notif-prompt-btn-dismiss" onClick={handleDismiss} disabled={loading}>
                        Plus tard
                    </button>
                    <button className="notif-prompt-btn-enable" onClick={handleEnable} disabled={loading}>
                        {loading ? "..." : "Activer"}
                    </button>
                </div>
            </div>

            <style>{`
                .notif-prompt-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.35);
                    z-index: 1100;
                    animation: notifFadeIn 0.25s ease;
                }

                .notif-prompt-modal {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 2000;
                    background: #fff;
                    border-radius: 22px;
                    padding: 26px 24px 24px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.22);
                    width: calc(100% - 40px);
                    max-width: 380px;
                    animation: notifPopIn 0.28s cubic-bezier(0.32, 0.72, 0, 1);
                }

                .notif-prompt-icon {
                    width: 52px;
                    height: 52px;
                    border-radius: 16px;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 14px;
                }

                .notif-prompt-title {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 18px;
                    font-weight: 700;
                    color: #111;
                    text-align: center;
                    margin: 0 0 6px;
                }

                .notif-prompt-text {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 14px;
                    color: #777;
                    line-height: 1.5;
                    text-align: center;
                    margin: 0 0 20px;
                }

                .notif-prompt-actions {
                    display: flex;
                    gap: 10px;
                }

                .notif-prompt-btn-dismiss,
                .notif-prompt-btn-enable {
                    flex: 1;
                    padding: 13px 16px;
                    border-radius: 40px;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    transition: opacity 0.2s, transform 0.15s;
                }
                .notif-prompt-btn-dismiss:disabled,
                .notif-prompt-btn-enable:disabled {
                    opacity: 0.6;
                    cursor: default;
                }

                .notif-prompt-btn-dismiss {
                    background: #f5f3f0;
                    color: #555;
                }
                .notif-prompt-btn-dismiss:not(:disabled):hover {
                    background: #ece9e4;
                }

                .notif-prompt-btn-enable {
                    background: #111;
                    color: #fff;
                }
                .notif-prompt-btn-enable:not(:disabled):hover {
                    transform: scale(1.02);
                }

                @keyframes notifFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes notifPopIn {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.92);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                }
            `}</style>
        </>
    );
};

export default NotificationPrompt;