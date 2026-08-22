import { v2 as cloudinary } from 'cloudinary';
import Boutique from '../models/Boutique.js';
import Product from '../models/Product.js';
import Wallet from '../models/Wallet.js';
import StaffUser from '../models/StaffUser.js';
import City from '../models/City.js';
import Commune from '../models/Commune.js';
import { assainirTexte } from '../utils/assainir.js';
import {
    assurerBoutiqueCommercant,
    invaliderCacheBoutiquesSuspendues,
} from '../services/boutiqueService.js';
import { journaliser } from '../services/journalService.js';

// GET /api/boutiques/moi — Récupérer sa propre boutique
//
// La boutique est créée à l'activation de l'invitation, mais on la
// (re)garantit ici : un compte plus ancien que la Phase 3, ou dont
// l'activation s'est interrompue après la création du compte, se retrouvait
// sinon définitivement bloqué sur « Aucune boutique associée » sans pouvoir
// rien y faire. Le commerçant renseigne ensuite lui-même nom, description,
// logo et zones de livraison.
export const getMaBoutique = async (req, res) => {
    try {
        await assurerBoutiqueCommercant(req.staffUser);

        const boutique = await Boutique.findOne({ ownerId: req.staffUser._id })
            .populate('zonesLivraison.cityId', 'name')
            .populate('zonesLivraison.communeId', 'name');

        if (!boutique) {
            return res.status(404).json({ success: false, message: 'Boutique non trouvée' });
        }
        return res.status(200).json({ success: true, boutique });
    } catch (error) {
        console.error('Erreur getMaBoutique:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// PATCH /api/boutiques/moi — Modifier sa boutique (multipart, champ "logo" optionnel)
export const updateMaBoutique = async (req, res) => {
    try {
        const { nom, description } = req.body;

        const boutique = await Boutique.findOne({ ownerId: req.staffUser._id });
        if (!boutique) {
            return res.status(404).json({ success: false, message: 'Boutique non trouvée' });
        }

        // Nom et description de boutique sont affichés en texte : on retire
        // toute balise à l'entrée (le nom sert aussi de titre de page, d'alt
        // d'image, de libellé dans le journal — autant de rendus hors React).
        if (nom) boutique.nom = assainirTexte(nom);
        if (description !== undefined) boutique.description = assainirTexte(description);

        // ✅ Upload direct du logo vers Cloudinary
        if (req.file) {
            if (boutique.logoPublicId) {
                try {
                    await cloudinary.uploader.destroy(boutique.logoPublicId);
                } catch (err) {
                    console.log('Erreur suppression ancien logo:', err.message);
                }
            }
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { resource_type: 'image', folder: 'boutiques/logos' },
                    (error, uploadResult) => (error ? reject(error) : resolve(uploadResult))
                );
                uploadStream.end(req.file.buffer);
            });
            boutique.logo = result.secure_url;
            boutique.logoPublicId = result.public_id;
        }

        await boutique.save();

        return res.status(200).json({
            success: true,
            message: 'Boutique mise à jour',
            boutique
        });
    } catch (error) {
        console.error('Erreur updateMaBoutique:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// PATCH /api/boutiques/moi/zones-livraison — Le commerçant choisit les
// villes/communes où il livre lui-même (pas de prix : les tarifs de
// livraison restent gérés uniquement par l'admin au niveau plateforme).
export const updateMesZonesLivraison = async (req, res) => {
    try {
        const { zones } = req.body; // [{ cityId, communeId | null }]
        if (!Array.isArray(zones)) {
            return res.status(400).json({ success: false, message: 'zones doit être un tableau' });
        }

        const boutique = await Boutique.findOne({ ownerId: req.staffUser._id });
        if (!boutique) {
            return res.status(404).json({ success: false, message: 'Boutique non trouvée' });
        }

        // Validation : chaque ville/commune doit exister réellement.
        const cityIds = [...new Set(zones.map((z) => z.cityId).filter(Boolean))];
        const communeIds = [...new Set(zones.map((z) => z.communeId).filter(Boolean))];
        const [villesValides, communesValides] = await Promise.all([
            City.find({ _id: { $in: cityIds } }).select('_id'),
            Commune.find({ _id: { $in: communeIds } }).select('_id'),
        ]);
        const villesValidesSet = new Set(villesValides.map((v) => v._id.toString()));
        const communesValidesSet = new Set(communesValides.map((c) => c._id.toString()));

        const zonesValidees = zones
            .filter((z) => z.cityId && villesValidesSet.has(z.cityId))
            .filter((z) => !z.communeId || communesValidesSet.has(z.communeId))
            .map((z) => ({ cityId: z.cityId, communeId: z.communeId || null }));

        boutique.zonesLivraison = zonesValidees;
        await boutique.save();

        return res.status(200).json({ success: true, message: 'Zones de livraison mises à jour', boutique });
    } catch (error) {
        console.error('Erreur updateMesZonesLivraison:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/boutiques/:id — Voir une boutique publique
export const getBoutiqueById = async (req, res) => {
    try {
        const { id } = req.params;
        // ⚠️ Route PUBLIQUE (aucune authentification) : ne sélectionner que
        // les champs destinés à la vitrine. Ne jamais populate() l'email du
        // propriétaire ici, et ne jamais renvoyer motifSuspension ou tout
        // autre champ interne — voir RAMCI-2026-xxx (Strix).
        const boutique = await Boutique.findById(id)
            .select('nom description logo statut zonesLivraison')
            .populate('zonesLivraison.cityId', 'name')
            .populate('zonesLivraison.communeId', 'name');
        if (!boutique) {
            return res.status(404).json({ success: false, message: 'Boutique non trouvée' });
        }

        // Une boutique suspendue disparaît de la vitrine publique : elle est
        // traitée comme inexistante, sans révéler qu'elle a été suspendue.
        if (boutique.statut === 'suspendue') {
            return res.status(404).json({ success: false, message: 'Boutique non trouvée' });
        }

        // Mêmes champs que ceux lus par ProductCard côté vitrine : sans
        // variants/stock, les cartes perdent pastilles de couleur et mention
        // « bientôt épuisé ».
        const produits = await Product.find({
            boutiqueId: id,
            inStock: true,
            isArchived: { $ne: true }
        })
            .select('name price offerPrice image categories salesCount variants stock inStock')
            .sort('-salesCount')
            .lean();

        return res.status(200).json({
            success: true,
            boutique,
            produits
        });
    } catch (error) {
        console.error('Erreur getBoutiqueById:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/boutiques/:id/apercu — Public
//
// Juste de quoi afficher la pastille « Vendu par » d'une fiche produit :
// nom et logo. Volontairement distinct de GET /:id, qui charge en plus tout
// le catalogue de la boutique — inutile (et coûteux) sur chaque fiche.
export const getBoutiqueApercu = async (req, res) => {
    try {
        const boutique = await Boutique.findById(req.params.id).select('nom logo statut').lean();

        // Une boutique suspendue n'existe pas côté vitrine.
        if (!boutique || boutique.statut === 'suspendue') {
            return res.status(404).json({ success: false, message: 'Boutique non trouvée' });
        }

        return res.status(200).json({
            success: true,
            boutique: { _id: boutique._id, nom: boutique.nom, logo: boutique.logo },
        });
    } catch (error) {
        console.error('Erreur getBoutiqueApercu:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/boutiques — Admin : vue d'ensemble des boutiques
//
// Chaque ligne porte de quoi décider sans avoir à ouvrir la boutique :
// le commerçant et l'état de son compte, le nombre d'articles en ligne, le
// solde du portefeuille (qui bloque une éventuelle suppression) et le
// chiffre d'affaires déjà réalisé.
export const listAllBoutiques = async (req, res) => {
    try {
        const boutiques = await Boutique.find()
            .populate('ownerId', 'nom email telephone statut derniereConnexion')
            .sort('-createdAt')
            .lean();

        const boutiqueIds = boutiques.map((b) => b._id);
        const ownerIds = boutiques.map((b) => b.ownerId?._id).filter(Boolean);

        const [produitsParBoutique, walletsParOwner] = await Promise.all([
            Product.aggregate([
                { $match: { boutiqueId: { $in: boutiqueIds } } },
                {
                    $group: {
                        _id: '$boutiqueId',
                        total: { $sum: 1 },
                        enLigne: {
                            $sum: { $cond: [{ $ne: ['$isArchived', true] }, 1, 0] },
                        },
                    },
                },
            ]),
            Wallet.find({ ownerId: { $in: ownerIds } }).select('ownerId solde').lean(),
        ]);

        const parBoutique = new Map(produitsParBoutique.map((p) => [p._id.toString(), p]));
        const parOwner = new Map(walletsParOwner.map((w) => [w.ownerId.toString(), w.solde]));

        const enrichies = boutiques.map((b) => {
            const stats = parBoutique.get(b._id.toString());
            return {
                ...b,
                nombreProduits: stats?.total || 0,
                produitsEnLigne: stats?.enLigne || 0,
                soldeWallet: b.ownerId ? (parOwner.get(b.ownerId._id.toString()) || 0) : 0,
            };
        });

        // Comptes commerçants sans boutique : normalement aucun (la boutique
        // est créée à l'activation, et réparée à la première ouverture de
        // l'espace commerçant). On les remonte quand même pour que l'admin
        // puisse débloquer la situation sans attendre la connexion du
        // commerçant.
        const idsAvecBoutique = boutiques.map((b) => b.ownerId?._id).filter(Boolean);
        const sansBoutique = await StaffUser.find({
            role: 'commercant',
            _id: { $nin: idsAvecBoutique },
        }).select('nom email statut createdAt').lean();

        return res.status(200).json({ success: true, boutiques: enrichies, sansBoutique });
    } catch (error) {
        console.error('Erreur listAllBoutiques:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/boutiques/options — Vendeur / admin : liste courte pour les
// sélecteurs « attribuer à une boutique » des formulaires produit.
// Volontairement minimaliste (id, nom, statut) : c'est une liste de choix,
// pas une vue de gestion — celle-ci reste réservée à l'admin.
export const listBoutiqueOptions = async (req, res) => {
    try {
        const boutiques = await Boutique.find()
            .select('nom statut')
            .populate('ownerId', 'nom')
            .sort('nom')
            .lean();

        return res.status(200).json({ success: true, boutiques });
    } catch (error) {
        console.error('Erreur listBoutiqueOptions:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// PATCH /api/boutiques/:id/autorisations — Admin
//
// Pour l'instant une seule autorisation : le droit de créer des articles.
// Le champ est nommé au pluriel et l'endpoint conçu pour en accueillir
// d'autres, plutôt que d'ajouter une route par droit.
// [PHASE 0] Journalisation ajoutée
export const updateAutorisationsBoutique = async (req, res) => {
    try {
        const { peutCreerProduits } = req.body;

        const boutique = await Boutique.findById(req.params.id);
        if (!boutique) {
            return res.status(404).json({ success: false, message: 'Boutique non trouvée' });
        }

        if (typeof peutCreerProduits === 'boolean') {
            boutique.peutCreerProduits = peutCreerProduits;
        }
        await boutique.save();

        // [PHASE 0] Journalisation
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'boutique.autorisations',
            cible: {
                id: boutique._id,
                libelle: boutique.nom,
            },
            note: `peutCreerProduits: ${boutique.peutCreerProduits}`,
        });

        return res.status(200).json({
            success: true,
            message: boutique.peutCreerProduits
                ? "Ajout d'articles activé pour cette boutique"
                : "Ajout d'articles désactivé pour cette boutique",
            boutique,
        });
    } catch (error) {
        console.error('Erreur updateAutorisationsBoutique:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// PATCH /api/boutiques/:id/statut — Admin : suspendre / réactiver
//
// Suspendre agit sur la VITRINE : les articles de la boutique sortent du
// catalogue public et le commerçant ne peut plus en publier. Son compte
// reste utilisable (il voit ses ventes passées, son portefeuille, et peut
// corriger sa fiche boutique) — pour couper l'accès complet, c'est le
// statut du COMPTE qu'il faut suspendre depuis la gestion des comptes.
// [PHASE 0] Journalisation ajoutée
export const updateBoutiqueStatut = async (req, res) => {
    try {
        const { id } = req.params;
        const { statut, motif } = req.body;

        if (!['active', 'suspendue'].includes(statut)) {
            return res.status(400).json({ success: false, message: 'Statut invalide' });
        }

        const boutique = await Boutique.findById(id);
        if (!boutique) {
            return res.status(404).json({ success: false, message: 'Boutique non trouvée' });
        }

        boutique.statut = statut;
        if (typeof motif === 'string') boutique.motifSuspension = statut === 'suspendue' ? motif.trim() : '';
        await boutique.save();

        // Le catalogue public lit une liste d'ids suspendus mise en cache :
        // sans invalidation, la suspension mettrait jusqu'à une minute à
        // se voir côté client.
        await invaliderCacheBoutiquesSuspendues();

        // [PHASE 0] Journalisation
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'boutique.statut',
            cible: {
                id: boutique._id,
                libelle: boutique.nom,
            },
            note: `Nouveau statut: ${statut}${motif ? ' - motif: ' + motif : ''}`,
        });

        return res.status(200).json({
            success: true,
            message: statut === 'suspendue' ? 'Boutique suspendue' : 'Boutique réactivée',
            boutique,
        });
    } catch (error) {
        console.error('Erreur updateBoutiqueStatut:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/boutiques — Admin : créer une boutique pour un commerçant
export const createBoutiqueForCommercial = async (req, res) => {
    try {
        const { ownerId, nom, description, logo } = req.body;

        if (!ownerId) {
            return res.status(400).json({ success: false, message: 'ownerId est requis' });
        }

        const commercial = await StaffUser.findOne({ _id: ownerId, role: 'commercant' });
        if (!commercial) {
            return res.status(404).json({ success: false, message: 'Commerçant non trouvé' });
        }

        const existing = await Boutique.findOne({ ownerId });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Ce commerçant a déjà une boutique' });
        }

        const boutique = await Boutique.create({
            nom: nom || `Boutique de ${commercial.nom}`,
            description: description || '',
            logo: logo || null,
            ownerId,
            statut: 'active',
        });

        commercial.boutiqueId = boutique._id;
        await commercial.save();

        return res.status(201).json({
            success: true,
            message: 'Boutique créée',
            boutique
        });
    } catch (error) {
        console.error('Erreur createBoutiqueForCommercial:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};