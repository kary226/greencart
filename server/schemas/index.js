import { z, idMongo, texte, quantite } from '../middlewares/valider.js';

// Schémas d'entrée des endpoints sensibles — authentification, argent,
// visibilité du catalogue. Déclarés ici plutôt que dispersés dans les
// contrôleurs, pour qu'on puisse lire d'un coup ce que le serveur accepte.
//
// Principe : liste blanche. Ce qui n'est pas déclaré est retiré de la
// requête avant d'atteindre le contrôleur — un champ glissé en plus
// (`role`, `statut`, `boutiqueId`) ne peut donc pas se retrouver dans un
// update par accident.

const ROLES_STAFF = [
    'admin', 'commercant', 'livreur', 'assistant_shein',
    'super_admin', 'finance_admin', 'warehouse_admin',
    'logistics_admin', 'catalog_admin', 'support_admin', 'read_only_auditor',
];

// ---- Staff ------------------------------------------------------------ //

export const schemaInvitation = z.object({
    email: z.string().trim().toLowerCase().email('Adresse e-mail invalide'),
    role: z.enum(ROLES_STAFF, { message: 'Rôle invalide' }),
});

export const schemaConnexionStaff = z.object({
    email: z.string().trim().toLowerCase().email('Adresse e-mail invalide'),
    // Pas de longueur minimale ici : un mot de passe trop court doit échouer
    // à la comparaison, pas être refusé en amont — sinon le message de
    // validation devient un oracle sur la politique de mots de passe.
    password: z.string().min(1, 'Mot de passe requis'),
    totpCode: z.string().trim().regex(/^\d{6}$/, "Code d'authentification invalide"),
});

export const schemaActivation = z.object({
    nom: texte(2, 80),
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').max(200),
});

export const schemaStatutStaff = z.object({
    statut: z.enum(['actif', 'suspendu'], { message: 'Statut invalide' }),
});

export const schemaRoleStaff = z.object({
    role: z.enum(ROLES_STAFF, { message: 'Rôle invalide' }),
});

// ---- Boutique --------------------------------------------------------- //

export const schemaStatutBoutique = z.object({
    statut: z.enum(['active', 'suspendue'], { message: 'Statut invalide' }),
    motif: z.string().trim().max(300).optional().default(''),
});

export const schemaAutorisationsBoutique = z.object({
    peutCreerProduits: z.boolean(),
});

// ---- Produit ---------------------------------------------------------- //

export const schemaStock = z.object({
    id: idMongo,
    stock: quantite.optional(),
    // `inStock` n'est utile qu'à false (retrait manuel de la vente) : à true,
    // la disponibilité se déduit des quantités.
    inStock: z.boolean().optional(),
    variants: z.array(z.object({
        color: z.string().nullable().optional(),
        size: z.string().nullable().optional(),
        stock: quantite,
    })).optional(),
});

export const schemaAffectationBoutique = z.object({
    id: idMongo,
    // Chaîne vide ou null = retour au catalogue principal.
    boutiqueId: z.union([idMongo, z.literal(''), z.null()]).optional(),
});

export const schemaIdParam = z.object({ id: idMongo });