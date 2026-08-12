import { randomInt } from 'crypto';

/* ═══════════════════════════════════════════════════════════════════════
   Génération des codes article (SKU).

   Un code est fait pour être lu à voix haute au téléphone, recopié à la main
   sur un carton et retapé sans faute dans la recherche. L'alphabet exclut
   donc tout ce qui se confond :

     0/O   1/I/L   U (se lit « V » quand c'est écrit à la main)

   Il reste 30 caractères. Sur 6 positions, cela fait 729 millions de
   combinaisons — assez pour que le tirage aléatoire suffise, la collision
   étant de toute façon rattrapée par l'index unique en base.
   ═══════════════════════════════════════════════════════════════════════ */

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const PREFIXE = 'RMC';
const LONGUEUR = 6;

/** Forme canonique : majuscules, sans espaces, tirets internes conservés. */
export const normaliserSku = (valeur) => {
    if (valeur === null || valeur === undefined) return null;
    const s = String(valeur).trim().toUpperCase().replace(/\s+/g, '');
    return s.length ? s : null;
};

/**
 * Un code saisi à la main reste libre (le vendeur peut vouloir reprendre une
 * référence fournisseur), mais on refuse ce qui casserait la recherche ou
 * l'URL : on impose des caractères sobres et une longueur raisonnable.
 */
export const SKU_MOTIF = /^[A-Z0-9][A-Z0-9-]{1,23}$/;

export const skuEstValide = (sku) => SKU_MOTIF.test(sku);

/** Tire un code au format RMC-XXXXXX. */
export const genererSku = () => {
    let corps = '';
    for (let i = 0; i < LONGUEUR; i++) corps += ALPHABET[randomInt(ALPHABET.length)];
    return `${PREFIXE}-${corps}`;
};

/**
 * Tire un code encore libre en base.
 *
 * La boucle protège du cas improbable où le tirage tombe sur un code déjà
 * pris ; passé les tentatives, on allonge le code plutôt que d'échouer —
 * mieux vaut un code d'un caractère de plus qu'un produit non enregistrable.
 */
export const genererSkuUnique = async (Product, tentatives = 5) => {
    for (let i = 0; i < tentatives; i++) {
        const candidat = genererSku();
        const existe = await Product.exists({ sku: candidat });
        if (!existe) return candidat;
    }
    return `${genererSku()}${ALPHABET[randomInt(ALPHABET.length)]}`;
};

/**
 * Vérifie qu'un code saisi est libre. `exclureId` sert à la modification :
 * un produit n'entre pas en conflit avec lui-même.
 */
export const skuEstDisponible = async (Product, sku, exclureId = null) => {
    const filtre = { sku };
    if (exclureId) filtre._id = { $ne: exclureId };
    return !(await Product.exists(filtre));
};
