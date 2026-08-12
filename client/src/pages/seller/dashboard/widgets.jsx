import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { T } from './tokens';

/* ── Carte de section ─────────────────────────────────────────────────── */

export const Carte = ({ titre, sousTitre, action, children, className = '' }) => (
    <section className={`rs-card !p-0 overflow-hidden ${className}`}>
        {(titre || action) && (
            <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
                <div className="min-w-0">
                    {titre && <h2 className="rs-h2">{titre}</h2>}
                    {sousTitre && <p className="text-[12px] text-ink-400 mt-0.5">{sousTitre}</p>}
                </div>
                {action}
            </header>
        )}
        {children}
    </section>
);

export const Vide = ({ children }) => (
    <p className="px-4 py-10 text-center text-[13px] text-ink-400">{children}</p>
);

/* ── Sparkline ────────────────────────────────────────────────────────── */

/**
 * Courbe de contexte, en teinte atténuée, avec le dernier point en accent.
 * Purement décorative au sens de l'accessibilité : la valeur et le delta sont
 * déjà écrits en toutes lettres au-dessus, donc `aria-hidden`.
 */
export const Sparkline = ({ serie = [], hauteur = 28 }) => {
    if (serie.length < 2) return <div style={{ height: hauteur }} />;
    const L = 100;
    const max = Math.max(...serie);
    const min = Math.min(...serie);
    const etendue = max - min || 1;
    const pas = L / (serie.length - 1);
    const y = (v) => hauteur - 2 - ((v - min) / etendue) * (hauteur - 4);
    const points = serie.map((v, i) => `${i * pas},${y(v)}`).join(' ');
    const dernierX = (serie.length - 1) * pas;

    return (
        <svg aria-hidden="true" viewBox={`0 0 ${L} ${hauteur}`} preserveAspectRatio="none"
             style={{ width: '100%', height: hauteur, overflow: 'visible' }}>
            <polyline points={points} fill="none" stroke={T.attenue} strokeWidth="2"
                      strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {/* Anneau de 2px en couleur de surface : le point reste lisible
                là où il croise la courbe (spec des marques). */}
            <circle cx={dernierX} cy={y(serie[serie.length - 1])} r="3"
                    fill={T.accent} stroke={T.surface} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
    );
};

/* ── Tuile de statistique ─────────────────────────────────────────────── */

/**
 * `delta === null` signifie « pas de base de comparaison » (période
 * précédente vide, ou filtre « Tout ») — on n'affiche alors aucune variation
 * plutôt qu'un pourcentage inventé.
 *
 * La couleur du delta suit *le sens métier*, pas le signe : une hausse du
 * taux d'annulation est mauvaise. Et le mauvais se signale en `warn-500`,
 * jamais en rouge — le rouge est la marque (DESIGN.md §7).
 */
export const Tuile = ({ label, valeur, unite, delta, deltaLabel, hausseEstBonne = true, serie, note }) => {
    const neutre = delta === null || delta === undefined || Math.abs(delta) < 0.5;
    const bon = delta > 0 === hausseEstBonne;
    const couleur = neutre ? 'text-ink-400' : bon ? 'text-ok-500' : 'text-warn-500';
    const Fleche = neutre ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

    return (
        <div className="rs-card flex flex-col justify-between gap-3">
            <div>
                <p className="text-[12px] text-ink-500">{label}</p>
                {/* Chiffres proportionnels : `tabular-nums` fait paraître un
                    grand nombre distendu (spec des figures). */}
                <p className="text-[24px] font-extrabold leading-tight tracking-[-0.024em] text-ink-900 mt-1">
                    {valeur}
                    {unite && <span className="text-[14px] font-bold text-ink-400 ml-1">{unite}</span>}
                </p>
                {(delta !== undefined || note) && (
                    <p className={`flex items-center gap-1 text-[11.5px] font-semibold mt-1.5 ${couleur}`}>
                        {delta !== undefined && delta !== null && (
                            <>
                                <Fleche aria-hidden="true" size={13} />
                                {Math.abs(delta) < 0.5 ? 'stable' : `${Math.abs(delta).toFixed(0)} %`}
                                <span className="font-medium text-ink-400">{deltaLabel}</span>
                            </>
                        )}
                        {(delta === null || delta === undefined) && note && (
                            <span className="font-medium text-ink-400">{note}</span>
                        )}
                    </p>
                )}
            </div>
            {serie && serie.length > 1 && <Sparkline serie={serie} />}
        </div>
    );
};

/* ── Badge de statut ──────────────────────────────────────────────────── */

const TON_STATUT = {
    'Delivered': 'rs-badge--ok',
    'Cancelled': 'rs-badge--done',
    'Returned': 'rs-badge--warn',
    'pending_payment': 'rs-badge--warn',
    'Out for Delivery': 'rs-badge--info',
    'Shipped': 'rs-badge--info',
};

export const BadgeStatut = ({ statut, label }) => (
    <span className={`rs-badge ${TON_STATUT[statut] || 'rs-badge--neutral'}`}>{label}</span>
);

/* ── Vue tableau ──────────────────────────────────────────────────────── */

/**
 * Jumelle accessible de chaque graphique. Le système de dataviz l'impose :
 * une infobulle ne doit jamais être le seul moyen d'atteindre une valeur.
 */
export const TableauDonnees = ({ colonnes, lignes }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
            <thead>
                <tr className="border-b border-ink-100">
                    {colonnes.map((c, i) => (
                        <th key={c.cle} scope="col"
                            className={`px-4 py-2 font-semibold text-ink-500 ${i === 0 ? 'text-left' : 'text-right'}`}>
                            {c.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {lignes.map((l, i) => (
                    <tr key={i} className="border-b border-ink-100 last:border-0">
                        {colonnes.map((c, j) => (
                            <td key={c.cle}
                                className={`px-4 py-2 ${j === 0
                                    ? 'text-ink-800 font-medium'
                                    : 'text-right text-ink-600 tabular-nums'}`}>
                                {c.rendu ? c.rendu(l) : l[c.cle]}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);
