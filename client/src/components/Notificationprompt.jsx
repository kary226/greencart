import React, { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";

// Clé sessionStorage : une seule apparition par session d'onglet.
// sessionStorage est effacé quand l'onglet/le navigateur est fermé,
// donc la popup réapparaît à la prochaine visite, mais pas sur un
// simple refresh (F5) de la page en cours.
const SESSION_FLAG_KEY = "ramci_notif_prompt_shown";

const NotificationPrompt = () => {
    const { user, subscribeToPushNotifications } = useAppContext();
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Conditions pour proposer la popup automatique :
        // - utilisateur connecté (l'abonnement push est lié à un compte)
        // - navigateur supportant les notifications
        // - permission jamais tranchée ("default" = ni accordée ni refusée)
        //   -> si déjà "granted" ou "denied", on ne redemande jamais ici,
        //      exactement comme le bouton existant de la Navbar
        // - pas déjà montrée durant cette session d'onglet
        if (!user) return;
        if (typeof Notification === "undefined") return;
        if (Notification.permission !== "default") return;
        if (sessionStorage.getItem(SESSION_FLAG_KEY)) return;

        // Petit délai pour ne pas assaillir l'utilisateur dès le premier
        // rendu de la page (laisse le temps de voir le site apparaître).
        const timer = setTimeout(() => {
            setVisible(true);
            sessionStorage.setItem(SESSION_FLAG_KEY, "1");
        }, 1500);

        return () => clearTimeout(timer);
    }, [user]);

    const handleEnable = async () => {
        setLoading(true);
        await subscribeToPushNotifications();
        setLoading(false);
        setVisible(false);
    };

    const handleDismiss = () => {
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <>
            <div className="notif-prompt-overlay" onClick={handleDismiss} />
            <div className="notif-prompt-sheet" role="dialog" aria-live="polite">
                <div className="notif-prompt-handle" />

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

                .notif-prompt-sheet {
                    position: fixed;
                    left: 12px;
                    right: 12px;
                    bottom: calc(86px + env(safe-area-inset-bottom));
                    z-index: 2000;
                    background: #fff;
                    border-radius: 22px;
                    padding: 10px 22px 22px;
                    box-shadow: 0 -8px 40px rgba(0,0,0,0.18);
                    max-width: 480px;
                    margin: 0 auto;
                    animation: notifSlideUp 0.32s cubic-bezier(0.32, 0.72, 0, 1);
                }

                .notif-prompt-handle {
                    width: 36px;
                    height: 4px;
                    background: #e5e2dc;
                    border-radius: 4px;
                    margin: 6px auto 18px;
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
                    margin-bottom: 14px;
                }

                .notif-prompt-title {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 18px;
                    font-weight: 700;
                    color: #111;
                    margin: 0 0 6px;
                }

                .notif-prompt-text {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 14px;
                    color: #777;
                    line-height: 1.5;
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

                @keyframes notifSlideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            `}</style>
        </>
    );
};

export default NotificationPrompt;