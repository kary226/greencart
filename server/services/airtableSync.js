import axios from 'axios';
import Product from '../models/Product.js';
import Boutique from '../models/Boutique.js';

// ---------------------------------------------------------------------------
// Synchro catalogue -> Airtable (base "Ramci Produits", table "Produits").
//
// Principe : Ramci (MongoDB) reste la seule source de vérité. Airtable n'est
// qu'un miroir en lecture pour le récap/reporting. On pousse vers Airtable
// (jamais l'inverse) via un "upsert" sur le champ caché "ID Ramci" — Airtable
// crée la ligne si elle n'existe pas encore, la met à jour sinon. On n'a donc
// jamais besoin de connaître/stocker l'ID de la ligne Airtable côté Mongo.
//
// Déclenchement :
//  - automatique (fire-and-forget) après ajout/modif/suppression d'un
//    produit et après chaque commande (vente => stock + salesCount changent)
//  - manuel via le bouton "Synchroniser" (resyncAllProducts), qui repousse
//    tout le catalogue et attend le résultat pour informer l'admin.
//
// Toute erreur de sync (token absent, Airtable down, etc.) est avalée et
// journalisée : la disponibilité d'Airtable ne doit jamais faire échouer une
// requête produit/commande côté Ramci.
// ---------------------------------------------------------------------------

const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
const UPSERT_MERGE_FIELD = 'ID Ramci';
const BATCH_SIZE = 10; // limite imposée par l'API Airtable par requête

const getConfig = () => {
    const token = process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableId = process.env.AIRTABLE_TABLE_ID;
    if (!token || !baseId || !tableId) return null;
    return { token, baseId, tableId };
};

const airtableClient = (config) => axios.create({
    baseURL: `${AIRTABLE_API_BASE}/${config.baseId}/${config.tableId}`,
    headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
    },
    timeout: 15000,
});

// Résume les tailles/couleurs présentes sur un produit, qu'il soit simple,
// multi-tailles ou multi-variantes.
const resumerTaillesEtCouleurs = (product) => {
    const variants = product.variants || [];

    const tailles = new Set();
    const couleurs = new Set();

    if (variants.length > 0) {
        variants.forEach(v => {
            if (v.size) tailles.add(v.size);
            if (v.color) couleurs.add(v.color);
        });
    } else if (product.size) {
        tailles.add(product.size);
    }

    return {
        tailles: [...tailles].join(', '),
        couleurs: [...couleurs].join(', '),
    };
};

const quantiteRestante = (product) => {
    const variants = product.variants || [];
    if (variants.length > 0) {
        return variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    }
    return product.stock || 0;
};

// Construit l'objet "fields" attendu par Airtable pour un produit donné.
// `boutiqueNom` est pré-résolu par l'appelant pour éviter un aller-retour
// Mongo par produit lors d'une resynchro complète.
const construireChamps = (product, boutiqueNom) => {
    const { tailles, couleurs } = resumerTaillesEtCouleurs(product);
    const restante = quantiteRestante(product);
    const prixAchat = product.purchasePrice || 0;
    const prixVente = product.offerPrice || product.price || 0;

    return {
        'Nom': product.name || '',
        'Code produit': product.sku || '',
        'Lien supplémentaire': product.externalLink || undefined,
        "Prix d'achat": prixAchat,
        'Prix de vente': prixVente,
        'Prix barré': product.price || 0,
        'Quantité restante': restante,
        'Quantité vendue': product.salesCount || 0,
        'Tailles': tailles,
        'Couleurs': couleurs,
        'Catégories': (product.categories || []).join(', '),
        'En stock': !!product.inStock,
        'Boutique': boutiqueNom || '',
        'Marge estimée': prixAchat ? Math.max(0, prixVente - prixAchat) : 0,
        [UPSERT_MERGE_FIELD]: product._id.toString(),
        'Dernière synchro': new Date().toISOString(),
    };
};

const resoudreNomBoutique = async (boutiqueId) => {
    if (!boutiqueId) return '';
    try {
        const boutique = await Boutique.findById(boutiqueId).select('nom').lean();
        return boutique?.nom || '';
    } catch {
        return '';
    }
};

const upsertBatch = async (client, records) => {
    if (records.length === 0) return;
    await client.patch('', {
        performUpsert: { fieldsToMergeOn: [UPSERT_MERGE_FIELD] },
        records: records.map(fields => ({ fields })),
        typecast: true,
    });
};

// Synchronise UN produit (après ajout/modif/vente/changement de stock).
// Fire-and-forget côté appelant : cette fonction n'est jamais censée faire
// échouer la requête qui l'a déclenchée.
export const syncProductToAirtable = async (productId) => {
    const config = getConfig();
    if (!config) return; // Airtable non configuré, on ignore silencieusement

    try {
        const product = await Product.findById(productId).lean();
        if (!product) return;

        const boutiqueNom = await resoudreNomBoutique(product.boutiqueId);
        const client = airtableClient(config);
        await upsertBatch(client, [construireChamps(product, boutiqueNom)]);
    } catch (error) {
        console.error('❌ Erreur syncProductToAirtable:', error.response?.data || error.message);
    }
};

// Synchronise plusieurs produits d'un coup (ex : après une commande qui
// touche plusieurs articles). Fire-and-forget également.
export const syncManyProductsToAirtable = async (productIds) => {
    const config = getConfig();
    if (!config || !productIds?.length) return;

    try {
        const uniqueIds = [...new Set(productIds.map(id => id.toString()))];
        const products = await Product.find({ _id: { $in: uniqueIds } }).lean();
        if (products.length === 0) return;

        const boutiqueIds = [...new Set(products.filter(p => p.boutiqueId).map(p => p.boutiqueId.toString()))];
        const boutiques = boutiqueIds.length
            ? await Boutique.find({ _id: { $in: boutiqueIds } }).select('nom').lean()
            : [];
        const nomParBoutique = new Map(boutiques.map(b => [b._id.toString(), b.nom]));

        const client = airtableClient(config);
        const champs = products.map(p => construireChamps(
            p,
            p.boutiqueId ? nomParBoutique.get(p.boutiqueId.toString()) : ''
        ));

        for (let i = 0; i < champs.length; i += BATCH_SIZE) {
            await upsertBatch(client, champs.slice(i, i + BATCH_SIZE));
        }
    } catch (error) {
        console.error('❌ Erreur syncManyProductsToAirtable:', error.response?.data || error.message);
    }
};

// Supprime la ligne Airtable correspondant à un produit supprimé sur Ramci.
export const deleteProductFromAirtable = async (productId) => {
    const config = getConfig();
    if (!config) return;

    try {
        const client = airtableClient(config);
        const formula = `{${UPSERT_MERGE_FIELD}} = "${productId.toString()}"`;
        const { data } = await client.get('', { params: { filterByFormula: formula, maxRecords: 1 } });

        const record = data?.records?.[0];
        if (record) {
            await client.delete('', { params: { 'records[]': record.id } });
        }
    } catch (error) {
        console.error('❌ Erreur deleteProductFromAirtable:', error.response?.data || error.message);
    }
};

// Resynchro complète du catalogue — utilisée par le bouton "Synchroniser".
// Contrairement aux fonctions ci-dessus, celle-ci PROPAGE ses erreurs : un
// clic manuel doit informer l'admin en cas d'échec plutôt que d'échouer en
// silence.
export const resyncAllProducts = async (boutiqueId = null) => {
    const config = getConfig();
    if (!config) {
        const error = new Error("Synchro Airtable non configurée (variables d'environnement manquantes).");
        error.code = 'AIRTABLE_NOT_CONFIGURED';
        throw error;
    }

    const filter = boutiqueId ? { boutiqueId } : {};
    const products = await Product.find(filter).lean();

    const boutiqueIds = [...new Set(products.filter(p => p.boutiqueId).map(p => p.boutiqueId.toString()))];
    const boutiques = boutiqueIds.length
        ? await Boutique.find({ _id: { $in: boutiqueIds } }).select('nom').lean()
        : [];
    const nomParBoutique = new Map(boutiques.map(b => [b._id.toString(), b.nom]));

    const client = airtableClient(config);
    const champs = products.map(p => construireChamps(
        p,
        p.boutiqueId ? nomParBoutique.get(p.boutiqueId.toString()) : ''
    ));

    for (let i = 0; i < champs.length; i += BATCH_SIZE) {
        await upsertBatch(client, champs.slice(i, i + BATCH_SIZE));
    }

    return { total: products.length };
};