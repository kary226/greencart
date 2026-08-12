import React from 'react';
import {
    ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { T } from './tokens';
import { formaterCompact, formaterMontant } from './metrics';

/* ═══════════════════════════════════════════════════════════════════════
   Graphiques.

   Parti pris : une seule teinte partout. Les séries de ce tableau de bord
   encodent une *grandeur* (combien), pas une *identité* (laquelle) — le rôle
   de la couleur est donc séquentiel, et une palette catégorielle y serait un
   contresens. Le seul endroit à deux séries est la comparaison de périodes,
   traitée en « emphase » : la période courante en accent, la précédente en
   gris de contexte.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Infobulle ────────────────────────────────────────────────────────── */

const Infobulle = ({ active, payload, label, devise }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rs-float rounded-xl px-3 py-2 text-[12px]">
            <p className="text-ink-400 mb-1">{label}</p>
            {payload.map((e) => (
                <p key={e.dataKey} className="flex items-center gap-2 text-ink-800 font-semibold">
                    <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: e.stroke }} />
                    {e.name} : {formaterMontant(e.value, devise)}
                </p>
            ))}
        </div>
    );
};

/* ── Évolution du chiffre d'affaires ──────────────────────────────────── */

export const CourbeCA = ({ donnees, devise, comparaison }) => (
    /* La hauteur inclut la bande des libellés d'axe : un conteneur calé sur
       le seul tracé fait apparaître une mini-barre de défilement dans la
       carte (anti-pattern connu). */
    <div className="px-2 pb-2" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={donnees} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="lavisCA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.accent} stopOpacity={0.14} />
                        <stop offset="100%" stopColor={T.accent} stopOpacity={0} />
                    </linearGradient>
                </defs>
                {/* Filet plein, jamais en pointillés — le pointillé se lit
                    comme un seuil ou une projection. */}
                <CartesianGrid stroke={T.grille} strokeDasharray="0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: T.texte }}
                       axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: T.texte }} axisLine={false} tickLine={false}
                       width={52} tickFormatter={formaterCompact} />
                <Tooltip content={<Infobulle devise={devise} />} cursor={{ stroke: T.grille, strokeWidth: 1 }} />
                {comparaison && (
                    <Line type="monotone" dataKey="caPrec" name="Période précédente"
                          stroke={T.attenue} strokeWidth={2} dot={false}
                          activeDot={{ r: 4, fill: T.attenue, stroke: T.surface, strokeWidth: 2 }} />
                )}
                <Area type="monotone" dataKey="ca" name="Période courante"
                      stroke={T.accent} strokeWidth={2} fill="url(#lavisCA)"
                      dot={false} activeDot={{ r: 5, fill: T.accent, stroke: T.surface, strokeWidth: 2 }} />
            </ComposedChart>
        </ResponsiveContainer>
    </div>
);

/* Légende : obligatoire dès deux séries, l'identité ne doit jamais reposer
   sur la seule couleur. Une série unique s'en passe — le titre la nomme. */
export const LegendeCA = ({ comparaison }) => (
    <div className="flex items-center gap-4 px-4 pb-3 text-[11.5px] text-ink-500">
        <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-3 h-[2px] rounded" style={{ background: T.accent }} />
            Période courante
        </span>
        {comparaison && (
            <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="w-3 h-[2px] rounded" style={{ background: T.attenue }} />
                Période précédente
            </span>
        )}
    </div>
);

/* ── Barres horizontales ──────────────────────────────────────────────── */

/**
 * Liste étiquetée portant une barre de grandeur. Choisie plutôt qu'un
 * graphique à barres classique parce que les libellés sont longs et que la
 * valeur reste lisible en clair : rien n'est enfermé dans une infobulle.
 *
 * Une seule teinte pour toutes les barres. Colorer chaque barre selon sa
 * valeur ré-encoderait en couleur ce que la longueur dit déjà.
 */
export const BarresHorizontales = ({ lignes, formater = (v) => v.toLocaleString('fr-FR'), vide }) => {
    const max = Math.max(...lignes.map(l => l.valeur), 0);
    if (!lignes.length || max === 0) {
        return <p className="px-4 py-8 text-center text-[13px] text-ink-400">{vide || 'Aucune donnée sur la période.'}</p>;
    }
    return (
        <ul className="px-4 pb-4 grid gap-2.5">
            {lignes.map((l) => (
                <li key={l.cle || l.label}>
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className="text-[13px] text-ink-700 truncate">{l.label}</span>
                        <span className="text-[13px] font-semibold text-ink-900 tabular-nums shrink-0">
                            {formater(l.valeur)}
                        </span>
                    </div>
                    {/* Piste = un cran de surface, pas un gris plus foncé que
                        la barre elle-même. */}
                    <div className="h-2 rounded-full bg-ink-50 overflow-hidden">
                        <div
                            className="h-2"
                            style={{
                                width: `${Math.max((l.valeur / max) * 100, l.valeur > 0 ? 2 : 0)}%`,
                                background: T.accent,
                                /* Extrémité arrondie côté donnée, carrée à la
                                   ligne de base (spec des marques). */
                                borderRadius: '0 4px 4px 0',
                            }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
};

/* ── Part-à-tout : moyens de paiement ─────────────────────────────────── */

/**
 * Barre empilée horizontale plutôt qu'un camembert : à trois parts dont deux
 * souvent proches, un camembert ne se lit pas. Les segments sont séparés par
 * un écart de 2px en couleur de surface, jamais par un contour.
 *
 * La rampe est ordinale (une teinte, du clair au foncé) et a passé le
 * validateur : monotone, écarts suffisants, extrémité claire à 2,11:1.
 */
export const PartsPaiement = ({ parts }) => {
    const total = parts.reduce((s, p) => s + p.valeur, 0);
    if (!total) return <p className="px-4 py-8 text-center text-[13px] text-ink-400">Aucune commande sur la période.</p>;

    const teinte = (i) => T.rampe[Math.min(i + 1, T.rampe.length - 1)];

    return (
        <div className="px-4 pb-4">
            <div className="flex w-full h-3 rounded-full overflow-hidden" style={{ gap: 2 }}>
                {parts.map((p, i) => (
                    <div key={p.cle} style={{ flex: `${p.valeur} 0 0`, background: teinte(i) }} />
                ))}
            </div>
            <ul className="grid gap-2 mt-3">
                {parts.map((p, i) => (
                    <li key={p.cle} className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="flex items-center gap-2 min-w-0">
                            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ background: teinte(i) }} />
                            <span className="text-ink-700 truncate">{p.label}</span>
                        </span>
                        <span className="text-ink-900 font-semibold tabular-nums shrink-0">
                            {p.valeur}
                            <span className="text-ink-400 font-medium ml-1.5">
                                {Math.round((p.valeur / total) * 100)} %
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};
