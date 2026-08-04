// [PHASE 0 - PERF] Middleware Cache-Control pour les endpoints publics en
// lecture seule (produits, catégories, bannières, types/tarifs de
// livraison...). Ces routes ne dépendent pas de l'utilisateur connecté et
// changent rarement : elles peuvent donc être servies depuis le edge de
// Vercel / le cache du navigateur pendant quelques minutes, avec
// revalidation en arrière-plan (stale-while-revalidate) pour ne jamais
// bloquer un visiteur sur du contenu périmé plus de quelques secondes.
//
// Usage : router.get('/list', cacheControl(120), controller)
// -> "public, max-age=120, stale-while-revalidate=300"
export const cacheControl = (maxAgeSeconds = 60, staleWhileRevalidateSeconds = maxAgeSeconds * 5) => (req, res, next) => {
    res.set(
        'Cache-Control',
        `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`
    );
    next();
};

export default cacheControl;