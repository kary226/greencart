import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import { extrairePanier } from "../services/sheinExtraction.js";

// [SHEIN-SCAN] Banc d'évaluation de l'extraction de paniers.
//
// On ne peut pas « entraîner » le modèle de vision : il n'y a ni pipeline
// d'entraînement ni poids à ajuster. Ce qu'on peut faire — et qui produit le
// même effet — c'est constituer un jeu de cas étiquetés et mesurer chaque
// changement de prompt, de modèle ou de niveau d'effort contre ce jeu.
// Sans ça, toute modification du prompt est un pari.
//
// Usage :
//   node scripts/evalSheinExtraction.js
//   node scripts/evalSheinExtraction.js --cas=panier-coupon-haut
//   SHEIN_VISION_EFFORT=medium node scripts/evalSheinExtraction.js
//   SHEIN_VISION_MODEL=claude-sonnet-5 node scripts/evalSheinExtraction.js
//
// Chaque cas est un .json dans fixtures/shein/ décrivant les captures à
// charger et le résultat attendu. Voir fixtures/shein/README.md.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOSSIER_CAS = path.join(__dirname, "..", "fixtures", "shein");

const MIME_PAR_EXT = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
};

// Normalisation des noms pour l'appariement : les noms SHEIN sont tronqués à
// une largeur qui dépend de la capture, donc « 1pc Two Tone Satin Hat Silk
// Bonnet S... » et « 1pc Two Tone Satin Hat Silk Bo... » désignent le même
// article. On compare sur un préfixe normalisé plutôt qu'à l'identique.
const normaliserNom = (s) =>
    String(s || "")
        .toLowerCase()
        .replace(/[.…]+$/, "")
        .replace(/[^a-z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const memeArticle = (a, b) => {
    const na = normaliserNom(a);
    const nb = normaliserNom(b);
    if (!na || !nb) return false;
    const court = na.length < nb.length ? na : nb;
    const long = na.length < nb.length ? nb : na;
    // Un préfixe de 15 caractères suffit à discriminer des produits SHEIN
    // tout en absorbant les différences de troncature.
    return long.startsWith(court.slice(0, Math.min(15, court.length)));
};

const chargerCas = (fichier) => {
    const cas = JSON.parse(fs.readFileSync(fichier, "utf8"));
    const captures = cas.captures.map((nom) => {
        const chemin = path.join(DOSSIER_CAS, nom);
        if (!fs.existsSync(chemin)) {
            throw new Error(
                `Capture manquante : ${nom}\n` +
                `  Attendue dans ${DOSSIER_CAS}\n` +
                "  Voir fixtures/shein/README.md pour savoir quelle image y placer."
            );
        }
        return {
            buffer: fs.readFileSync(chemin),
            mimetype: MIME_PAR_EXT[path.extname(nom).toLowerCase()] || "image/png",
        };
    });
    return { ...cas, fichier: path.basename(fichier), captures };
};

const comparer = (attendu, obtenu) => {
    const erreurs = [];
    const scores = { champs: 0, champsOk: 0 };

    const verifier = (libelle, att, obt, egal = (x, y) => x === y) => {
        scores.champs += 1;
        if (egal(att, obt)) scores.champsOk += 1;
        else erreurs.push(`${libelle} : attendu ${JSON.stringify(att)}, obtenu ${JSON.stringify(obt)}`);
    };

    const memeMontant = (x, y) =>
        x == null && y == null ? true : x != null && y != null && Math.abs(x - y) < 0.005;

    verifier("devise", attendu.devise, obtenu.devise);
    verifier("coupon_applique", attendu.coupon_applique, obtenu.couponApplique);
    verifier("total_affiche", attendu.total_affiche, obtenu.totalAffiche, memeMontant);
    verifier("nb_articles_panier", attendu.nb_articles_panier ?? null, obtenu.nbArticlesPanier ?? null);

    // Appariement des articles
    const restants = [...obtenu.articles];
    const apparies = [];
    const manquants = [];

    for (const att of attendu.articles) {
        const i = restants.findIndex((o) => memeArticle(att.nom, o.nom));
        if (i === -1) manquants.push(att);
        else apparies.push([att, restants.splice(i, 1)[0]]);
    }
    const enTrop = restants;

    for (const att of manquants) erreurs.push(`ARTICLE MANQUANT : ${att.nom}`);
    for (const o of enTrop) erreurs.push(`ARTICLE EN TROP : ${o.nom} (${o.boutique})`);

    for (const [att, obt] of apparies) {
        const p = `« ${att.nom.slice(0, 32)} »`;
        verifier(`${p} boutique`, att.boutique, obt.boutique);
        verifier(`${p} prix_unitaire`, att.prix_unitaire, obt.prix_unitaire, memeMontant);
        verifier(`${p} prix_original`, att.prix_original ?? null, obt.prix_original ?? null, memeMontant);
        verifier(`${p} quantite`, att.quantite, obt.quantite);
        if (att.variante != null) verifier(`${p} variante`, att.variante, obt.variante);
    }

    return {
        erreurs,
        nbAttendus: attendu.articles.length,
        nbObtenus: obtenu.articles.length,
        nbApparies: apparies.length,
        nbManquants: manquants.length,
        nbEnTrop: enTrop.length,
        champs: scores.champs,
        champsOk: scores.champsOk,
    };
};

const main = async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error("ANTHROPIC_API_KEY absente du .env — impossible de lancer l'évaluation.");
        process.exit(1);
    }

    const filtre = process.argv.find((a) => a.startsWith("--cas="))?.split("=")[1];

    if (!fs.existsSync(DOSSIER_CAS)) {
        console.error(`Dossier de cas introuvable : ${DOSSIER_CAS}`);
        process.exit(1);
    }

    const fichiers = fs
        .readdirSync(DOSSIER_CAS)
        .filter((f) => f.endsWith(".json"))
        .filter((f) => !filtre || f.includes(filtre))
        .map((f) => path.join(DOSSIER_CAS, f));

    if (fichiers.length === 0) {
        console.error("Aucun cas de test trouvé.");
        process.exit(1);
    }

    console.log(`\nModèle : ${process.env.SHEIN_VISION_MODEL || "claude-opus-5"}`);
    console.log(`Effort : ${process.env.SHEIN_VISION_EFFORT || "high"}`);
    console.log(`Cas    : ${fichiers.length}\n`);

    const totaux = {
        champs: 0, champsOk: 0,
        attendus: 0, apparies: 0, manquants: 0, enTrop: 0,
        casOk: 0, duree: 0, tokensEntree: 0,
    };

    for (const fichier of fichiers) {
        let cas;
        try {
            cas = chargerCas(fichier);
        } catch (e) {
            console.log(`⏭  ${path.basename(fichier)} — ignoré\n   ${e.message}\n`);
            continue;
        }

        const debut = Date.now();
        let obtenu;
        try {
            obtenu = await extrairePanier(cas.captures);
        } catch (e) {
            console.log(`✗  ${cas.nom} — ÉCHEC D'EXTRACTION : ${e.message}\n`);
            continue;
        }
        const duree = Date.now() - debut;

        const r = comparer(cas.attendu, obtenu);
        totaux.champs += r.champs;
        totaux.champsOk += r.champsOk;
        totaux.attendus += r.nbAttendus;
        totaux.apparies += r.nbApparies;
        totaux.manquants += r.nbManquants;
        totaux.enTrop += r.nbEnTrop;
        totaux.duree += duree;
        totaux.tokensEntree += obtenu.usage?.entree || 0;

        const parfait = r.erreurs.length === 0;
        if (parfait) totaux.casOk += 1;

        const pct = Math.round((r.champsOk / r.champs) * 100);
        console.log(
            `${parfait ? "✓" : "✗"}  ${cas.nom}  —  ${r.champsOk}/${r.champs} champs (${pct}%)  ` +
            `· ${r.nbApparies}/${r.nbAttendus} articles` +
            `${r.nbEnTrop ? ` · ${r.nbEnTrop} en trop` : ""}` +
            `  · ${(duree / 1000).toFixed(1)}s`
        );
        if (cas.note) console.log(`   ↳ ${cas.note}`);
        for (const e of r.erreurs) console.log(`   • ${e}`);
        if (obtenu.alertes?.length) {
            for (const a of obtenu.alertes) console.log(`   ⚠ ${a}`);
        }
        console.log();
    }

    const pctChamps = totaux.champs ? Math.round((totaux.champsOk / totaux.champs) * 100) : 0;
    const rappel = totaux.attendus ? Math.round((totaux.apparies / totaux.attendus) * 100) : 0;

    console.log("─".repeat(64));
    console.log(`Cas parfaits      : ${totaux.casOk}/${fichiers.length}`);
    console.log(`Exactitude champs : ${totaux.champsOk}/${totaux.champs} (${pctChamps}%)`);
    console.log(`Rappel articles   : ${totaux.apparies}/${totaux.attendus} (${rappel}%)`);
    console.log(`Articles en trop  : ${totaux.enTrop}`);
    console.log(`Durée totale      : ${(totaux.duree / 1000).toFixed(1)}s`);
    console.log(`Tokens en entrée  : ${totaux.tokensEntree}`);
    console.log("─".repeat(64));

    // Sortie non nulle si un cas échoue : permet de brancher le banc sur une
    // CI plus tard, ou simplement de scripter une comparaison avant/après.
    process.exit(totaux.casOk === fichiers.length ? 0 : 1);
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
