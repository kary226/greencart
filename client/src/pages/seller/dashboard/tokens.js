/* ═══════════════════════════════════════════════════════════════════════
   Jetons graphiques — miroir JS des variables CSS de ramses.css, parce que
   Recharts veut des couleurs littérales et ne lit pas les `var()`.

   Fichier séparé des composants : exporter une constante depuis un module
   qui exporte aussi des composants casse le Fast Refresh de Vite.

   La rampe rouge a été validée par le validateur du système de dataviz
   (rampe ordinale, surface #FFFFFF) : luminosité monotone, écarts ≥ 0.06,
   extrémité claire à 2,11:1 sur blanc, une seule teinte (8° d'écart).
   ═══════════════════════════════════════════════════════════════════════ */
export const T = {
    accent: '#E31E24',    // ramses-600 — teinte unique des graphiques
    rampe: ['#FF9497', '#FA5A5F', '#E31E24', '#9C1116'],
    attenue: '#8A8A93',   // ink-400 — série de contexte (période précédente)
    grille: '#EDEDEF',    // ink-100 — filet, jamais en pointillés
    surface: '#FFFFFF',
    texte: '#5F5F68',     // ink-500
    texteFort: '#0B0B0D', // ink-900
    ok: '#0E9F6E',
    warn: '#D97706',
};
