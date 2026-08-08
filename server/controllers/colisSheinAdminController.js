import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import ColisShein from "../models/ColisShein.js";
import MessageColis from "../models/MessageColis.js";
import Setting from "../models/Setting.js";

const ArticleSheinInputSchema = ["boutique", "nom", "variante", "prixUnitaire", "prixOriginal", "quantite"];

// Poste un message "devis" auto-généré dans le chat — la carte apparaît dans la
// conversation avec un bouton de paiement, en plus (pas à la place) du bouton
// fixe en haut de la page client.
const posterDevisMessage = async (colisId, montant, libelle, paymentType, detail = null) => {
    // Les anciens devis du même type (même paymentType) deviennent obsolètes —
    // pas de suppression, ils gardent leur trace, mais plus de bouton "Payer"
    // et plus de badge "payé" hérité à tort.
    await MessageColis.updateMany(
        { colisId, type: "devis", "payload.paymentType": paymentType },
        { $set: { "payload.superseded": true } }
    );
    await MessageColis.create({
        colisId,
        expediteurRole: "agent",
        expediteurId: process.env.SELLER_EMAIL,
        type: "devis",
        payload: { montant, libelle, paymentType, detail },
    });
};

// Poste un badge système (confirmation) — visible des deux côtés, sans bulle orientée.
export const posterMessageSysteme = async (colisId, texte) => {
    await MessageColis.create({ colisId, expediteurRole: "systeme", type: "systeme", texte });
};

// POST /api/shein-cart/admin/:id/estimation-arrivee
// Renseigné juste après le paiement du premier devis (acompte) : une fenêtre
// large "arrivée estimée à Abidjan" (achat + transit), affichée au client en
// attendant l'arrivée réelle en entrepôt. Indépendante de la confirmation
// d'arrivée elle-même (voir updateStatutColis, statut "en_entrepot").
export const definirEstimationArrivee = async (req, res) => {
    try {
        const { dateDebut, dateFin } = req.body;
        const colis = await ColisShein.findById(req.params.id);
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });

        if (!dateDebut || !dateFin) {
            return res.status(400).json({ success: false, message: "Les deux dates sont requises" });
        }
        const debut = new Date(dateDebut);
        const fin = new Date(dateFin);
        if (isNaN(debut.getTime()) || isNaN(fin.getTime())) {
            return res.status(400).json({ success: false, message: "Dates invalides" });
        }
        if (fin < debut) {
            return res.status(400).json({ success: false, message: "La date de fin doit être après la date de début" });
        }

        colis.estimationArrivee.dateDebut = debut;
        colis.estimationArrivee.dateFin = fin;
        colis.estimationArrivee.confirmee = false;
        colis.estimationArrivee.dateConfirmee = null;
        colis.historique.push({
            action: "estimation_arrivee",
            agent: process.env.SELLER_EMAIL,
            note: `Arrivée estimée à Abidjan entre le ${debut.toLocaleDateString("fr-FR")} et le ${fin.toLocaleDateString("fr-FR")}`,
        });
        await colis.save();

        const fmt = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
        await posterMessageSysteme(
            colis._id,
            `🚚 Commande validée — arrivée estimée à Abidjan entre le ${fmt(debut)} et le ${fmt(fin)}`
        );

        res.json({ success: true, colis });
    } catch (error) {
        console.error("Erreur definirEstimationArrivee:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/shein-cart/admin/all?statut=soumis (statut optionnel)
export const getAllColisAdmin = async (req, res) => {
    try {
        const filtre = req.query.statut ? { statut: req.query.statut } : {};
        const colisRaw = await ColisShein.find(filtre).populate("userId", "name email").sort({ updatedAt: -1 });
        const colis = colisRaw.map((c) => {
            const obj = c.toObject();
            obj.nonLu = !!(c.dernierMessageClientAt && (!c.adminDernierLu || c.dernierMessageClientAt > c.adminDernierLu));
            return obj;
        });
        res.json({ success: true, colis });
    } catch (error) {
        console.error("Erreur getAllColisAdmin:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/shein-cart/admin/:id
export const getColisAdminById = async (req, res) => {
    try {
        const colis = await ColisShein.findById(req.params.id).populate("userId", "name email");
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });
        res.json({ success: true, colis });
    } catch (error) {
        console.error("Erreur getColisAdminById:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/shein-cart/admin/:id/validate
// L'agent envoie les articles corrigés (peut être identique à l'extraction si rien à changer).
// Le taux de change vient du Setting global — jamais du client, jamais modifiable après coup
// pour CE colis une fois figé ici (tauxApplique).
export const validateColis = async (req, res) => {
    try {
        const { articles, devise } = req.body;
        const colis = await ColisShein.findById(req.params.id);
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });

        if (!Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({ success: false, message: "Aucun article à valider" });
        }

        // Si l'admin corrige/fournit la devise dans ce même appel (cas où l'extraction
        // ne l'avait pas détectée), on l'applique avant de calculer le FCFA.
        if (devise === "USD" || devise === "EUR") colis.devise = devise;

        const articlesValides = articles.map((a) => ({
            boutique: a.boutique || "",
            nom: a.nom || "",
            variante: a.variante || "",
            prixUnitaire: Number(a.prixUnitaire) || 0,
            prixOriginal: a.prixOriginal != null ? Number(a.prixOriginal) : null,
            quantite: Number(a.quantite) || 1,
        }));

        const montantArticles = articlesValides.reduce((sum, a) => sum + a.prixUnitaire * a.quantite, 0);

        // La devise est obligatoire pour calculer un montant FCFA — jamais de devis
        // à 0 FCFA envoyé silencieusement. Si l'extraction ne l'a pas détectée,
        // on bloque et on demande à l'admin de la préciser (voir champ devise ci-dessus).
        if (!colis.devise) {
            return res.status(400).json({
                success: false,
                message: "Devise inconnue pour ce colis — précise USD ou EUR avant d'envoyer le devis.",
            });
        }

        const setting = await Setting.findOne({ key: "sheinExchangeRates" });
        const taux = setting?.value?.[colis.devise.toLowerCase()];
        if (!taux) {
            return res.status(400).json({
                success: false,
                message: `Aucun taux configuré pour ${colis.devise}. Renseigne-le dans la barre en haut avant de valider.`,
            });
        }
        const tauxApplique = taux;
        const montantArticlesFCFA = montantArticles * taux;

        colis.articlesValides = articlesValides;
        colis.devis.montantArticles = montantArticles;
        colis.devis.tauxApplique = tauxApplique;
        colis.devis.montantArticlesFCFA = montantArticlesFCFA;

        // Paiement n°1 : uniquement le prix des articles, rien à voir avec la livraison
        // qui n'est connue qu'après la pesée. Figé ici — un changement ultérieur du
        // taux de change n'affecte plus ce montant pour ce colis.
        colis.devis.montantInitial = Math.round(montantArticlesFCFA || 0);
        colis.paiement.acompteMontant = colis.devis.montantInitial;

        // Si le client avait déjà payé une version précédente de ce devis (admin
        // revenu en arrière pour corriger), on remet le paiement à zéro — le montant
        // a changé, l'ancien paiement ne couvre plus forcément le bon total.
        const etaitDejaPaye = colis.paiement.acomptePaye;
        if (etaitDejaPaye) {
            colis.paiement.acomptePaye = false;
            colis.paiement.acompteDate = null;
        }

        colis.statut = "devis_envoye";
        colis.historique.push({
            action: "validation_agent",
            agent: process.env.SELLER_EMAIL,
            note: etaitDejaPaye
                ? `Devis corrigé après un paiement déjà reçu — nouveau montant à payer : ${colis.devis.montantInitial} FCFA`
                : `Panier vérifié — prix des articles à payer : ${colis.devis.montantInitial} FCFA`,
        });

        await colis.save();
        await posterDevisMessage(colis._id, colis.devis.montantInitial, "Prix des articles", "shein_acompte");
        res.json({ success: true, colis });
    } catch (error) {
        console.error("Erreur validateColis:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/shein-cart/admin/:id/statut — transitions génériques pour la suite du parcours
export const updateStatutColis = async (req, res) => {
    try {
        const { statut, note, poidsReel, tauxParKilo, fraisLivraisonAbidjan, dateLivraisonDebut, dateLivraisonFin } = req.body;
        const colis = await ColisShein.findById(req.params.id);
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });

        const statutsValides = ColisShein.schema.path("statut").enumValues;
        if (!statutsValides.includes(statut)) {
            return res.status(400).json({ success: false, message: "Statut invalide" });
        }

        // Passage en livraison : la fenêtre estimée (ex. 12/01/2026 → 19/01/2026)
        // est obligatoire — jamais de statut "en_livraison" sans date annoncée au client.
        if (statut === "en_livraison") {
            if (!dateLivraisonDebut || !dateLivraisonFin) {
                return res.status(400).json({ success: false, message: "Dates de livraison estimées requises (début et fin)" });
            }
            const debut = new Date(dateLivraisonDebut);
            const fin = new Date(dateLivraisonFin);
            if (isNaN(debut.getTime()) || isNaN(fin.getTime())) {
                return res.status(400).json({ success: false, message: "Dates de livraison invalides" });
            }
            if (fin < debut) {
                return res.status(400).json({ success: false, message: "La date de fin doit être après la date de début" });
            }
            colis.livraison.dateDebut = debut;
            colis.livraison.dateFin = fin;
        }

        // Pesée : deuxième devis, indépendant du premier — uniquement kilo + livraison Abidjan,
        // jamais le prix des articles (déjà payé au paiement n°1).
        if (statut === "pese") {
            if (poidsReel == null || (tauxParKilo == null && !colis.devis.tauxParKilo)) {
                return res.status(400).json({ success: false, message: "Poids réel et taux au kilo requis pour cette étape" });
            }
            colis.devis.poidsReel = Number(poidsReel);
            if (tauxParKilo != null) colis.devis.tauxParKilo = Number(tauxParKilo);
            if (fraisLivraisonAbidjan != null) colis.devis.fraisLivraisonEstime = Number(fraisLivraisonAbidjan);

            const fraisTransport = colis.devis.poidsReel * colis.devis.tauxParKilo;
            colis.devis.montantFinal = fraisTransport + (colis.devis.fraisLivraisonEstime || 0);
            colis.paiement.soldeMontant = colis.devis.montantFinal;

            // Même logique que pour le paiement articles — une pesée corrigée après
            // un paiement déjà reçu invalide ce paiement pour le nouveau montant.
            if (colis.paiement.soldePaye) {
                colis.paiement.soldePaye = false;
                colis.paiement.soldeDate = null;
            }
        }

        // Arrivée à l'entrepôt d'Abidjan — on "confirme" l'estimation posée plus tôt
        // (si elle existe), quel que soit le résultat : la confirmation n'est jamais
        // bloquée par l'estimation, elle sert juste à donner un retour honnête au client.
        if (statut === "en_entrepot") {
            colis.estimationArrivee.confirmee = true;
            colis.estimationArrivee.dateConfirmee = new Date();
        }

        colis.statut = statut;
        colis.historique.push({
            action: `statut_${statut}`,
            agent: process.env.SELLER_EMAIL,
            note: note || "",
        });

        await colis.save();
        if (statut === "pese") {
            const detail = `${colis.devis.poidsReel} kg × ${colis.devis.tauxParKilo} FCFA/kg + ${colis.devis.fraisLivraisonEstime || 0} FCFA livraison Abidjan`;
            await posterDevisMessage(colis._id, colis.paiement.soldeMontant, "Livraison (poids + Abidjan)", "shein_solde", detail);
        }
        if (statut === "en_livraison") {
            const fmt = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
            await posterMessageSysteme(
                colis._id,
                `📦 Colis en cours de livraison — livraison estimée entre le ${fmt(colis.livraison.dateDebut)} et le ${fmt(colis.livraison.dateFin)}`
            );
        }
        if (statut === "en_entrepot") {
            const estimation = colis.estimationArrivee;
            let texte = "📍 Colis arrivé à l'entrepôt d'Abidjan !";
            if (estimation?.dateFin) {
                const enAvance = new Date() < estimation.dateFin;
                texte += enAvance ? " (avant la date estimée 🎉)" : " (l'estimation initiale a pris un peu de retard, merci de votre patience)";
            }
            await posterMessageSysteme(colis._id, texte);
        }
        res.json({ success: true, colis });
    } catch (error) {
        console.error("Erreur updateStatutColis:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/shein-cart/admin/:id/messages
// Marque la conversation comme lue par l'agent — fait disparaître le badge "non lu" de la liste.
export const getMessagesAdmin = async (req, res) => {
    try {
        const colis = await ColisShein.findById(req.params.id);
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });
        const messages = await MessageColis.find({ colisId: req.params.id }).sort({ createdAt: 1 });
        colis.adminDernierLu = new Date();
        await colis.save();
        res.json({ success: true, messages });
    } catch (error) {
        console.error("Erreur getMessagesAdmin:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/shein-cart/admin/:id/messages — texte et/ou image
export const sendMessageAgent = async (req, res) => {
    try {
        const { texte } = req.body;
        const colis = await ColisShein.findById(req.params.id);
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });

        if ((!texte || !texte.trim()) && !req.file) {
            return res.status(400).json({ success: false, message: "Message vide" });
        }

        let imageUrl = null;
        if (req.file) {
            imageUrl = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { resource_type: "image", folder: "shein-chat" },
                    (error, result) => (error ? reject(error) : resolve(result.secure_url))
                );
                stream.end(req.file.buffer);
            });
        }

        const message = await MessageColis.create({
            colisId: req.params.id,
            expediteurRole: "agent",
            expediteurId: process.env.SELLER_EMAIL,
            texte: texte?.trim() || "",
            imageUrl,
        });

        const now = new Date();
        colis.dernierMessageAgentAt = now;
        colis.adminDernierLu = now;
        await colis.save();

        res.json({ success: true, message });
    } catch (error) {
        console.error("Erreur sendMessageAgent:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/shein-cart/admin/:id/typing — signal léger "l'agent écrit", même logique
// que setClientTyping côté client (updateOne, pas de validation complète du document).
export const setAgentTyping = async (req, res) => {
    try {
        await ColisShein.updateOne({ _id: req.params.id }, { agentTypingAt: new Date() });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// =============================================================
// ✅ PHASE 5 : FONCTIONS POUR ASSISTANT SHEIN
// =============================================================

// RÉCUPÉRER LES CONVERSATIONS (Assistant/Admin)
export const getConversations = async (req, res) => {
    try {
        const { statut, agentAssigneld } = req.query;
        const filter = {};

        if (statut) filter.statut = statut;

        if (req.staffUser.role === 'assistant_shein') {
            filter.agentAssigneld = req.staffUser._id;
        } else if (agentAssigneld) {
            filter.agentAssigneld = agentAssigneld;
        }

        const conversations = await ColisShein.find(filter)
            .populate('agentAssigneld', 'nom email')
            .populate('creePar', 'nom email')
            .populate('userId', 'name email')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            conversations,
        });
    } catch (error) {
        console.error('Erreur getConversations:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// DÉTAIL D'UNE CONVERSATION (Assistant/Admin)
export const getConversationDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const conversation = await ColisShein.findById(id)
            .populate('agentAssigneld', 'nom email')
            .populate('creePar', 'nom email')
            .populate('userId', 'name email');

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation non trouvée' });
        }

        if (req.staffUser.role === 'assistant_shein') {
            if (conversation.agentAssigneld?._id.toString() !== req.staffUser._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Vous n\'avez pas accès à cette conversation',
                });
            }
        }

        return res.status(200).json({
            success: true,
            conversation,
        });
    } catch (error) {
        console.error('Erreur getConversationDetail:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ASSIGNER UNE CONVERSATION (Admin uniquement)
export const assignerConversation = async (req, res) => {
    try {
        const { colisId, assistantId } = req.body;

        if (!colisId || !assistantId) {
            return res.status(400).json({
                success: false,
                message: 'colisId et assistantId requis',
            });
        }

        const assistant = await StaffUser.findOne({
            _id: assistantId,
            role: 'assistant_shein',
            statut: 'actif',
        });

        if (!assistant) {
            return res.status(404).json({
                success: false,
                message: 'Assistant non trouvé ou inactif',
            });
        }

        const conversation = await ColisShein.findByIdAndUpdate(
            colisId,
            { agentAssigneld: assistantId },
            { new: true }
        ).populate('agentAssigneld', 'nom email');

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation non trouvée',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Conversation assignée avec succès',
            conversation,
        });
    } catch (error) {
        console.error('Erreur assignerConversation:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// LISTE DES ASSISTANTS DISPONIBLES (Admin)
export const getAssistantsDisponibles = async (req, res) => {
    try {
        const assistants = await StaffUser.find({
            role: 'assistant_shein',
            statut: 'actif',
        }).select('nom email');

        const assistantsWithCount = await Promise.all(
            assistants.map(async (assistant) => {
                const count = await ColisShein.countDocuments({
                    agentAssigneld: assistant._id,
                    statut: { $nin: ['livre', 'annule'] },
                });
                return {
                    ...assistant.toObject(),
                    conversationsEnCours: count,
                };
            })
        );

        return res.status(200).json({
            success: true,
            assistants: assistantsWithCount,
        });
    } catch (error) {
        console.error('Erreur getAssistantsDisponibles:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// STATISTIQUES (Admin)
export const getConversationStats = async (req, res) => {
    try {
        const total = await ColisShein.countDocuments();
        const enAttente = await ColisShein.countDocuments({
            statut: { $in: ['soumis', 'en_verification'] },
        });
        const enCours = await ColisShein.countDocuments({
            statut: { $in: ['devis_envoye', 'acompte_paye', 'achete', 'en_entrepot', 'pese', 'solde_du', 'solde_paye', 'en_livraison'] },
        });
        const termines = await ColisShein.countDocuments({
            statut: { $in: ['livre', 'annule'] },
        });
        const sansAgent = await ColisShein.countDocuments({
            agentAssigneld: null,
            statut: { $nin: ['livre', 'annule'] },
        });

        return res.status(200).json({
            success: true,
            stats: {
                total,
                enAttente,
                enCours,
                termines,
                sansAgent,
            },
        });
    } catch (error) {
        console.error('Erreur getConversationStats:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// CRÉER UNE CONVERSATION (Admin)
export const createConversation = async (req, res) => {
    try {
        const {
            userId,
            numeroSuivi,
            devise,
            lienPartage,
            captures,
            extraction,
            articlesValides,
            statut,
        } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId est requis',
            });
        }

        const conversation = await ColisShein.create({
            userId,
            numeroSuivi: numeroSuivi || undefined,
            devise: devise || null,
            lienPartage: lienPartage || '',
            captures: captures || [],
            extraction: extraction || { articles: [], totalAffiche: null },
            articlesValides: articlesValides || [],
            statut: statut || 'soumis',
            creePar: req.staffUser._id,
        });

        return res.status(201).json({
            success: true,
            message: 'Conversation créée avec succès',
            conversation,
        });
    } catch (error) {
        console.error('Erreur createConversation:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// SUPPRIMER UNE CONVERSATION (Admin)
export const deleteConversation = async (req, res) => {
    try {
        const { id } = req.params;

        const conversation = await ColisShein.findById(id);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation non trouvée',
            });
        }

        await MessageColis.deleteMany({ colisId: id });
        await ColisShein.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: 'Conversation supprimée avec succès',
        });
    } catch (error) {
        console.error('Erreur deleteConversation:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// METTRE À JOUR LE STATUT D'UNE CONVERSATION
export const updateConversationStatut = async (req, res) => {
    try {
        const { id } = req.params;
        const { statut, note } = req.body;

        const validStatuses = [
            'soumis', 'en_verification', 'devis_envoye',
            'acompte_paye', 'achete', 'en_entrepot', 'pese',
            'solde_du', 'solde_paye', 'en_livraison',
            'livre', 'annule'
        ];

        if (!validStatuses.includes(statut)) {
            return res.status(400).json({
                success: false,
                message: 'Statut invalide',
            });
        }

        const conversation = await ColisShein.findById(id);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation non trouvée',
            });
        }

        if (req.staffUser.role === 'assistant_shein') {
            if (conversation.agentAssigneld?.toString() !== req.staffUser._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Vous n\'avez pas accès à cette conversation',
                });
            }
        }

        const ancienStatut = conversation.statut;
        conversation.statut = statut;

        conversation.historique.push({
            action: `Statut changé de "${ancienStatut}" à "${statut}"`,
            agent: req.staffUser.email || req.staffUser.nom,
            note: note || '',
        });

        await conversation.save();

        await MessageColis.create({
            colisId: id,
            expediteurRole: 'systeme',
            expediteurId: null,
            agentStaffId: null,
            texte: `📌 Statut mis à jour : ${statut}`,
            type: 'systeme',
            payload: {},
        });

        return res.status(200).json({
            success: true,
            message: 'Statut mis à jour avec succès',
            conversation,
        });
    } catch (error) {
        console.error('Erreur updateConversationStatut:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};