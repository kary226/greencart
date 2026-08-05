// ⚡ PHASE 1 - Transformations Cloudinary à la volée
//
// Les images produits/bannières sont hébergées sur Cloudinary et servies à
// leur résolution d'upload d'origine (souvent plusieurs Mo). Cloudinary
// permet d'appliquer des transformations directement dans l'URL, sans
// retoucher les images stockées : format auto (WebP/AVIF si supporté),
// qualité auto, et une largeur adaptée au contexte d'affichage.
//
// Une URL Cloudinary "brute" ressemble à :
//   https://res.cloudinary.com/<cloud>/image/upload/v169.../nom.jpg
// On insère les paramètres juste après le segment "/upload/" :
//   https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,w_400/v169.../nom.jpg

const CLOUDINARY_UPLOAD_MARKER = "/upload/";

/**
 * Retourne une URL Cloudinary optimisée (f_auto, q_auto, largeur adaptée).
 * Si l'URL fournie n'est pas une URL Cloudinary reconnaissable (ex: image
 * locale, placeholder, ou déjà transformée), elle est retournée telle quelle.
 *
 * @param {string} url - URL d'origine de l'image (product.image[i], banner.image, ...)
 * @param {Object} [options]
 * @param {number} [options.width] - Largeur cible en px (utile pour le srcset responsive)
 * @param {string} [options.quality='auto'] - q_auto, q_auto:eco, q_auto:good...
 * @param {string} [options.crop='limit'] - Empêche l'agrandissement au-delà de l'original
 * @returns {string}
 */
export function getOptimizedImageUrl(url, options = {}) {
  if (!url || typeof url !== "string") return url;

  const markerIndex = url.indexOf(CLOUDINARY_UPLOAD_MARKER);
  if (markerIndex === -1) return url; // Pas une URL Cloudinary standard

  const { width, quality = "auto", crop = "limit" } = options;

  const params = ["f_auto", `q_${quality}`];
  if (width) params.push(`w_${Math.round(width)}`, `c_${crop}`);

  const insertAt = markerIndex + CLOUDINARY_UPLOAD_MARKER.length;
  return `${url.slice(0, insertAt)}${params.join(",")}/${url.slice(insertAt)}`;
}

// Largeurs de référence pour les contextes récurrents du site.
// Multipliées par ~1.5-2x la taille d'affichage réelle pour rester nettes
// sur les écrans à forte densité (Retina) sans télécharger l'original.
export const IMAGE_PRESETS = {
  thumbnail: 100,  // miniature panier / commande / liste seller
  card: 500,       // carte produit dans une grille (Home, AllProducts, ProductCategory)
  detail: 900,      // image principale sur la fiche produit
  banner: 1400,     // bannières pleine largeur
};

/**
 * Raccourci : getPresetImageUrl(url, 'card')
 */
export function getPresetImageUrl(url, preset) {
  return getOptimizedImageUrl(url, { width: IMAGE_PRESETS[preset] });
}