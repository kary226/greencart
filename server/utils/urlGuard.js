import dns from 'dns';
import net from 'net';

// Erreur d'URL refusée par le garde. Le `.code` permet au contrôleur
// appelant de répondre 400 (erreur du client) plutôt que 500 (panne
// serveur) : une adresse interdite est une mauvaise saisie, pas un bug.
class UrlBloqueeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UrlBloqueeError';
        this.code = 'URL_BLOQUEE';
    }
}
export const estErreurUrlBloquee = (e) => e?.code === 'URL_BLOQUEE';

/* ═══════════════════════════════════════════════════════════════════════
   Garde anti-SSRF pour les requêtes sortantes déclenchées par une URL
   fournie par un utilisateur (import de produit depuis un lien).

   Sans ce garde, « va chercher cette page » permet de viser l'intérieur de
   l'infrastructure : http://127.0.0.1:6379 (Redis), http://10.x (réseau
   privé), ou l'endpoint de métadonnées du cloud en 169.254.169.254 qui
   distribue des jetons d'identité.

   Deux protections complémentaires :
     1. l'hôte est résolu en DNS et TOUTES ses adresses sont vérifiées —
        un nom de domaine public peut parfaitement pointer vers 127.0.0.1 ;
     2. chaque redirection est revalidée — sinon une URL publique anodine
        peut rediriger vers une adresse interne (le contrôle initial ne
        servirait alors à rien).
   ═══════════════════════════════════════════════════════════════════════ */

const estIPv4Privee = (ip) => {
    const o = ip.split('.').map(Number);
    if (o.length !== 4 || o.some(n => Number.isNaN(n))) return true; // au moindre doute, on refuse
    const [a, b] = o;
    if (a === 0) return true;                     // 0.0.0.0/8
    if (a === 10) return true;                    // privé
    if (a === 127) return true;                   // loopback
    if (a === 169 && b === 254) return true;      // link-local + métadonnées cloud
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true;                    // multicast et réservé
    return false;
};

const estIPv6Privee = (ip) => {
    const x = ip.toLowerCase().replace(/^\[|\]$/g, '');
    if (x === '::1' || x === '::') return true;                 // loopback / non spécifié
    if (x.startsWith('fe80') || x.startsWith('fc') || x.startsWith('fd')) return true; // link-local, ULA
    // IPv4 encapsulée en IPv6 (::ffff:127.0.0.1)
    const m = x.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return estIPv4Privee(m[1]);
    return false;
};

export const estAdresseInterne = (ip) => {
    if (!ip) return true;
    if (net.isIPv4(ip)) return estIPv4Privee(ip);
    if (net.isIPv6(ip)) return estIPv6Privee(ip);
    return true;
};

/**
 * Valide une URL destinée à une requête sortante.
 * Lève une erreur explicite si elle vise l'intérieur de l'infrastructure.
 */
export const verifierUrlSortante = async (urlBrute) => {
    let u;
    try {
        u = new URL(urlBrute);
    } catch {
        throw new UrlBloqueeError('URL invalide');
    }

    if (!['http:', 'https:'].includes(u.protocol)) {
        throw new UrlBloqueeError('Seules les URL http(s) sont autorisées');
    }

    const hote = u.hostname.replace(/^\[|\]$/g, '');

    // Adresse IP écrite en clair : on tranche sans passer par le DNS.
    if (net.isIP(hote)) {
        if (estAdresseInterne(hote)) throw new UrlBloqueeError('Adresse réseau non autorisée');
        return u;
    }

    if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(hote)) {
        throw new UrlBloqueeError('Adresse réseau non autorisée');
    }

    let adresses;
    try {
        adresses = await dns.promises.lookup(hote, { all: true });
    } catch {
        throw new UrlBloqueeError('Domaine introuvable');
    }
    if (!adresses.length || adresses.some(a => estAdresseInterne(a.address))) {
        throw new UrlBloqueeError('Adresse réseau non autorisée');
    }

    return u;
};

/**
 * Options axios communes aux appels sortants : redirections limitées et
 * revalidées une par une (`beforeRedirect` vient de follow-redirects, que
 * axios utilise sous le capot).
 *
 * Note : la revalidation est synchrone ici, donc sans résolution DNS — elle
 * bloque les redirections vers une IP interne littérale. La résolution
 * complète reste faite sur l'URL de départ.
 */
export const optionsSortantesSures = (extra = {}) => ({
    maxRedirects: 3,
    beforeRedirect: (options) => {
        const hote = String(options.hostname || options.host || '').replace(/^\[|\]$/g, '');
        if (net.isIP(hote) && estAdresseInterne(hote)) {
            throw new UrlBloqueeError('Redirection vers une adresse réseau non autorisée');
        }
        if (/^(localhost|.*\.local|.*\.internal)$/i.test(hote)) {
            throw new UrlBloqueeError('Redirection vers une adresse réseau non autorisée');
        }
    },
    ...extra,
});
