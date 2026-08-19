import { z } from 'zod';
import { erreurValidation } from '../utils/AppError.js';

// Validation des entrées à la frontière HTTP — pratique 2.11 « fail fast »
// de nodebestpractices.
//
// Jusqu'ici chaque contrôleur revalidait à la main (`typeof x !== 'string'`),
// de façon inégale : certains champs étaient contrôlés, d'autres non, et la
// même règle était réécrite à trois endroits. Un schéma déclaré une fois,
// appliqué avant le contrôleur, supprime cette classe entière d'oublis.
//
// Le schéma sert AUSSI de filtre : ce qui n'y figure pas est retiré de la
// requête. Un champ inattendu (`role: 'admin'`, `boutiqueId` glissé par un
// client) n'atteint donc jamais la logique métier.

/**
 * Fabrique un middleware qui valide une partie de la requête.
 *
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body'|'query'|'params'} source
 */
export const valider = (schema, source = 'body') => (req, res, next) => {
    const resultat = schema.safeParse(req[source]);

    if (!resultat.success) {
        const details = resultat.error.issues.map((issue) => ({
            champ: issue.path.join('.') || source,
            message: issue.message,
        }));

        // Un seul message lisible en tête, le détail par champ à côté : le
        // client peut afficher l'un ou l'autre selon son formulaire.
        return next(erreurValidation(details[0]?.message || 'Données invalides', details));
    }

    // req.query est un accesseur en lecture seule sur Express 5 ; on ne
    // réaffecte que ce qui peut l'être, et on expose systématiquement le
    // résultat validé sous req.valide.
    req.valide = resultat.data;
    if (source !== 'query') req[source] = resultat.data;

    next();
};

// ---- Briques réutilisables ------------------------------------------- //

/** Identifiant MongoDB. Rejette tout ce qui n'a pas la forme attendue. */
export const idMongo = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Identifiant invalide');

/** Chaîne obligatoire, bornée : une longueur non bornée est un vecteur d'abus. */
export const texte = (min = 1, max = 200) =>
    z.string().trim().min(min, `Ce champ doit contenir au moins ${min} caractère(s)`).max(max);

/** Montant en francs CFA : entier positif, jamais négatif. */
export const montant = z.coerce.number().int().min(0, 'Le montant ne peut pas être négatif');

/** Quantité de stock. */
export const quantite = z.coerce.number().int().min(0, 'La quantité ne peut pas être négative');

export { z };
