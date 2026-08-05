import { Redis } from '@upstash/redis';

// [PHASE 2 - PERF] Cache applicatif externe (Upstash Redis)
//
// Chaque invocation serverless (Vercel) repart de zéro : sans cache externe,
// une donnée peu volatile mais très lue (catégories, bannières, produits
// populaires, prix de livraison) est re-requêtée en base à chaque appel,
// même quand elle n'a pas changé depuis des heures.
//
// Upstash est choisi car son client fonctionne en HTTP/REST (pas de socket
// TCP persistant à maintenir), ce qui est le seul mode compatible avec des
// fonctions serverless qui démarrent et s'arrêtent en permanence.
//
// Ce module est volontairement tolérant à l'absence de configuration :
// si UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN ne sont pas définies
// (ex: environnement local sans Redis provisionné), toutes les fonctions
// ci-dessous deviennent des no-op silencieux — le site continue de
// fonctionner normalement, simplement sans ce niveau de cache. Rien ne
// casse tant qu'Upstash n'est pas explicitement configuré côté Vercel.

const isConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

const redis = isConfigured
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : null;

if (!isConfigured) {
    console.warn(
        '[cache] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN absentes : ' +
        'cache Redis désactivé (fonctionnement normal, juste sans ce cache).'
    );
}

/**
 * Récupère une valeur en cache. Retourne null si absente, expirée, ou si
 * Redis n'est pas configuré / injoignable (on ne fait jamais échouer la
 * requête à cause du cache).
 */
export async function getCached(key) {
    if (!redis) return null;
    try {
        return await redis.get(key);
    } catch (error) {
        console.error(`[cache] Erreur lecture "${key}":`, error.message);
        return null;
    }
}

/**
 * Écrit une valeur en cache avec une durée de vie en secondes.
 * Échoue silencieusement (log uniquement) : le cache est une optimisation,
 * jamais un point de défaillance pour la requête en cours.
 */
export async function setCached(key, value, ttlSeconds) {
    if (!redis) return;
    try {
        await redis.set(key, value, { ex: ttlSeconds });
    } catch (error) {
        console.error(`[cache] Erreur écriture "${key}":`, error.message);
    }
}

/**
 * Supprime une ou plusieurs clés (invalidation après une écriture admin :
 * ajout/modif/suppression d'une catégorie, bannière, prix de livraison...).
 */
export async function invalidateCache(...keys) {
    if (!redis || keys.length === 0) return;
    try {
        await redis.del(...keys);
    } catch (error) {
        console.error(`[cache] Erreur invalidation "${keys.join(', ')}":`, error.message);
    }
}

/**
 * Enveloppe "cache-aside" : lit le cache, sinon exécute fetchFn(), met en
 * cache le résultat, puis le retourne. Usage :
 *
 *   const categories = await withCache('categories:active', 300, () =>
 *       Category.find({ active: true }).sort({ order: 1 }).lean()
 *   );
 */
export async function withCache(key, ttlSeconds, fetchFn) {
    const cached = await getCached(key);
    if (cached !== null) return cached;

    const fresh = await fetchFn();
    await setCached(key, fresh, ttlSeconds);
    return fresh;
}

// Clés centralisées pour éviter les fautes de frappe entre les endpoints
// qui lisent (controllers get*) et ceux qui invalident (controllers add/
// update/delete/toggle*).
export const CACHE_KEYS = {
    categoriesActive: 'categories:active',
    bannersTop: 'banners:top',
    bannersBottom: 'banners:bottom',
    bannersAll: 'banners:all', // quand /api/banner est appelée sans filtre position
    bestSellers: 'products:bestsellers',
    deliveryTypesActive: 'delivery:types:active',
    deliveryPrices: (communeId, deliveryTypeId) => `delivery:price:${communeId}:${deliveryTypeId}`,
};