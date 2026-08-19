// Erreur applicative typée — pratique 2.2 / 2.3 de nodebestpractices.
//
// Le code distinguait mal deux familles d'erreurs très différentes :
//   - l'erreur ATTENDUE (« ce code promo n'existe pas », « boutique
//     suspendue ») : le serveur va parfaitement bien, il faut répondre au
//     client avec le bon statut HTTP et un message lisible ;
//   - le BUG (undefined qui traîne, requête malformée en base) : le message
//     ne doit jamais fuiter au client, et il faut une trace complète.
//
// Sans cette distinction, chaque contrôleur renvoyait `error.message` en 500
// — ce qui expose des détails internes et transforme une règle métier en
// « Erreur interne du serveur ».
export class AppError extends Error {
    /**
     * @param {string} message  message destiné au client (donc lisible)
     * @param {number} statusCode  statut HTTP à renvoyer
     * @param {object} [details]  informations structurées optionnelles
     */
    constructor(message, statusCode = 400, details = undefined) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        // Marqueur lu par le gestionnaire central : « erreur prévue, pas un
        // plantage ». Tout ce qui ne le porte pas est traité comme un bug.
        this.isOperational = true;
        if (details) this.details = details;

        Error.captureStackTrace?.(this, AppError);
    }
}

/** Raccourcis pour les cas les plus fréquents, afin d'éviter les statuts au hasard. */
export const erreurValidation = (message, details) => new AppError(message, 400, details);
export const erreurAuthentification = (message = 'Non authentifié') => new AppError(message, 401);
export const erreurAcces = (message = 'Accès refusé') => new AppError(message, 403);
export const erreurIntrouvable = (message = 'Ressource introuvable') => new AppError(message, 404);
export const erreurConflit = (message) => new AppError(message, 409);

/**
 * Une erreur est « opérationnelle » si elle a été levée volontairement par le
 * code métier. Tout le reste (TypeError, erreur de driver, etc.) est un bug :
 * on log la pile complète et on répond un message générique.
 */
export const estOperationnelle = (error) => Boolean(error?.isOperational);

export default AppError;
