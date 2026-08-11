import React, { useState } from "react";

// Badges colorés (couleur de marque + initiale) plutôt que les vrais logos,
// qui sont des marques déposées qu'on ne reproduit pas dans le code — même
// principe que le sélecteur de Cart.jsx.
const OPERATEURS = [
    { key: "orange", label: "Orange Money", initial: "O", bg: "#FF6600" },
    { key: "wave", label: "Wave", initial: "W", bg: "#1DA1F2" },
    { key: "mtn", label: "MTN MoMo", initial: "M", bg: "#FFCC00", text: "#1a1a1a" },
    { key: "moov", label: "Moov Money", initial: "M", bg: "#F26522" },
    { key: "djamo", label: "Djamo", initial: "d", bg: "#6C3AC7" },
];

/**
 * Modale de choix d'opérateur Mobile Money avant paiement Jèko — Jèko exige
 * de connaître l'opérateur AVANT l'appel API (contrairement à GeniusPay qui
 * proposait un choix générique sur sa propre page).
 *
 * Props :
 *  - open : bool
 *  - onClose : () => void
 *  - onConfirm : (operateurKey) => void  — appelé avec l'opérateur choisi
 *  - montantLabel : string affiché en tête ("Payer les articles — 12 000 FCFA")
 *  - loading : bool — désactive les boutons pendant la redirection
 */
export default function JekoOperatorModal({ open, onClose, onConfirm, montantLabel, loading }) {
    const [selected, setSelected] = useState("");

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "flex", alignItems: "flex-end" }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: "#fff", width: "100%", borderRadius: "16px 16px 0 0", padding: "20px 16px calc(20px + env(safe-area-inset-bottom))" }}
            >
                <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>Choisir un opérateur</p>
                {montantLabel && <p style={{ fontSize: 12.5, color: "#8a8a8a", margin: "0 0 14px" }}>{montantLabel}</p>}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {OPERATEURS.map(({ key, label, initial, bg, text }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setSelected(key)}
                            style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "10px 12px", borderRadius: 10,
                                border: selected === key ? "2px solid #e53935" : "2px solid #eee",
                                background: selected === key ? "#fdecea" : "transparent",
                                fontSize: 13, fontWeight: 600, color: selected === key ? "#c62828" : "#333",
                                textAlign: "left", cursor: "pointer",
                            }}
                        >
                            <span style={{ width: 26, height: 26, borderRadius: "50%", background: bg, color: text || "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                                {initial}
                            </span>
                            {label}
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    disabled={!selected || loading}
                    onClick={() => onConfirm(selected)}
                    style={{
                        width: "100%", marginTop: 16, padding: "13px", borderRadius: 999,
                        border: "none", background: !selected || loading ? "#f0a8a5" : "#e53935",
                        color: "#fff", fontWeight: 700, fontSize: 14, cursor: !selected || loading ? "default" : "pointer",
                    }}
                >
                    {loading ? "Redirection…" : "Continuer"}
                </button>
            </div>
        </div>
    );
}