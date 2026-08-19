import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import mongoose from 'mongoose';
import { exigerBaseLocale } from './baseLocale.js';

import StaffUser from '../models/StaffUser.js';
import Boutique from '../models/Boutique.js';
import Wallet from '../models/Wallet.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import City from '../models/City.js';
import Commune from '../models/Commune.js';
import User from '../models/User.js';
import JournalAction from '../models/JournalAction.js';

// Jeu de données de démarrage pour la base LOCALE.
//
// Il ne cherche pas à ressembler à la production : il cherche à couvrir les
// cas qui se cassent. D'où deux commerçants aux droits différents, et des
// articles d'origines différentes dans la même boutique — c'est là que
// vivent les règles récentes (verrouillage plateforme, droit de création).
//
// Secrets volontairement fixes et publics : ils n'ouvrent qu'une base qui
// n'existe que sur cette machine. Aucun d'eux ne doit jamais être réutilisé
// ailleurs.

export const MOT_DE_PASSE = 'MotDePasseLocal123';
export const SECRET_2FA_ADMIN = 'JBSWY3DPEHPK3PXP'; // secret de démonstration otplib

const COMPTES = {
    admin: 'admin@local.test',
    commercantOuvert: 'boutique-ouverte@local.test',
    commercantFerme: 'boutique-fermee@local.test',
    client: 'client@local.test',
};

const vider = async () => {
    await Promise.all([
        StaffUser.deleteMany({}),
        Boutique.deleteMany({}),
        Wallet.deleteMany({}),
        Product.deleteMany({}),
        Category.deleteMany({}),
        City.deleteMany({}),
        Commune.deleteMany({}),
        User.deleteMany({}),
        JournalAction.deleteMany({}),
    ]);
};

const creerStaff = async (email, nom, role, secret2FA) => StaffUser.create({
    email,
    password: await bcrypt.hash(MOT_DE_PASSE, 10),
    nom,
    role,
    statut: 'actif',
    totpSecret: secret2FA || authenticator.generateSecret(),
});

/**
 * Remplit la base locale. Détruit tout ce qu'elle contient au passage —
 * d'où le garde-fou en tête de fichier.
 */
export const semer = async ({ silencieux = false } = {}) => {
    const journal = silencieux ? () => {} : console.log;

    await vider();

    // ---- Lieux (nécessaires aux adresses et aux zones de livraison) ----
    const abidjan = await City.create({ name: 'Abidjan', order: 1 });
    const communes = await Commune.insertMany(
        ['Cocody', 'Yopougon', 'Plateau', 'Marcory'].map((name, i) => ({
            name, cityId: abidjan._id, order: i,
        }))
    );

    // ---- Catégories ----
    const categories = await Category.insertMany([
        { name: 'Robes', slug: 'robes', order: 1 },
        { name: 'Chaussures', slug: 'chaussures', order: 2 },
        { name: 'Accessoires', slug: 'accessoires', order: 3 },
    ]);

    // ---- Staff ----
    const admin = await creerStaff(COMPTES.admin, 'Admin Local', 'admin', SECRET_2FA_ADMIN);
    const commercantA = await creerStaff(COMPTES.commercantOuvert, 'Awa Koné', 'commercant');
    const commercantB = await creerStaff(COMPTES.commercantFerme, 'Bakary Traoré', 'commercant');

    // Deux boutiques aux droits opposés : c'est ce qui permet de vérifier
    // d'un coup d'œil que le droit de création est bien respecté.
    const boutiqueA = await Boutique.create({
        nom: 'Chez Awa',
        description: 'Prêt-à-porter féminin, livraison sur Abidjan.',
        ownerId: commercantA._id,
        statut: 'active',
        peutCreerProduits: true,
        zonesLivraison: [
            { cityId: abidjan._id, communeId: communes[0]._id },
            { cityId: abidjan._id, communeId: communes[1]._id },
        ],
    });
    const boutiqueB = await Boutique.create({
        nom: 'Bakary Shop',
        description: "Accessoires et petite maroquinerie.",
        ownerId: commercantB._id,
        statut: 'active',
        peutCreerProduits: false,
    });

    await StaffUser.updateOne({ _id: commercantA._id }, { boutiqueId: boutiqueA._id });
    await StaffUser.updateOne({ _id: commercantB._id }, { boutiqueId: boutiqueB._id });

    await Wallet.create([
        { ownerId: commercantA._id, solde: 45000 },
        { ownerId: commercantB._id, solde: 0 },
    ]);

    // ---- Articles ----
    const image = ['https://res.cloudinary.com/demo/image/upload/v1/sample.jpg'];

    // Catalogue principal (aucune boutique) — le cas historique.
    const catalogue = await Product.insertMany(
        Array.from({ length: 14 }).map((_, i) => ({
            name: `Article plateforme ${i + 1}`,
            sku: `PLT-${String(i + 1).padStart(3, '0')}`,
            description: 'Article du catalogue principal, sans boutique.',
            price: 15000 + i * 500,
            offerPrice: 12000 + i * 500,
            image,
            categories: [categories[i % 3].slug],
            stock: 10,
            inStock: true,
            boutiqueId: null,
            origine: 'plateforme',
        }))
    );

    // Article SAISI par le commerçant : il en garde la main complète.
    const sien = await Product.create({
        name: 'Robe wax sur mesure',
        sku: 'AWA-001',
        description: 'Créée et photographiée par la boutique.',
        price: 25000,
        offerPrice: 22000,
        image,
        categories: ['robes'],
        variants: [
            { color: 'Rouge', colorCode: '#E31E24', size: 'M', price: 25000, offerPrice: 22000, stock: 4 },
            { color: 'Rouge', colorCode: '#E31E24', size: 'L', price: 25000, offerPrice: 22000, stock: 2 },
        ],
        stock: 6,
        inStock: true,
        boutiqueId: boutiqueA._id,
        origine: 'commercant',
    });

    // Article saisi par la PLATEFORME puis confié à la boutique : prix et
    // médias verrouillés côté commerçant.
    const confie = await Product.create({
        name: 'Sandales cuir (fourni plateforme)',
        sku: 'PLT-AWA-01',
        description: 'Fiche créée par la plateforme, confiée à la boutique.',
        price: 30000,
        offerPrice: 27000,
        image,
        categories: ['chaussures'],
        variants: [
            { color: 'Noir', colorCode: '#0B0B0D', size: '38', price: 30000, offerPrice: 27000, stock: 3 },
            { color: 'Noir', colorCode: '#0B0B0D', size: '39', price: 30000, offerPrice: 27000, stock: 0 },
        ],
        stock: 3,
        inStock: true,
        boutiqueId: boutiqueA._id,
        origine: 'plateforme',
    });

    // ---- Client ----
    const client = await User.create({
        name: 'Client Local',
        email: COMPTES.client,
        password: await bcrypt.hash(MOT_DE_PASSE, 10),
        phone: '0700000000',
    });

    journal('\n─────────────────────────────────────────────');
    journal('  Base locale remplie');
    journal('─────────────────────────────────────────────');
    journal(`  Catalogue principal : ${catalogue.length} articles`);
    journal(`  Boutique « ${boutiqueA.nom} » : 2 articles (1 à elle, 1 de la plateforme)`);
    journal(`  Boutique « ${boutiqueB.nom} » : aucun article, création interdite`);
    journal('');
    journal(`  Mot de passe commun : ${MOT_DE_PASSE}`);
    journal('');
    journal(`  Admin staff      ${COMPTES.admin}`);
    journal(`     secret 2FA    ${SECRET_2FA_ADMIN}`);
    journal(`     code du moment ${authenticator.generate(SECRET_2FA_ADMIN)}`);
    journal(`  Commerçant (peut créer)      ${COMPTES.commercantOuvert}`);
    journal(`     secret 2FA    ${commercantA.totpSecret}`);
    journal(`  Commerçant (ne peut pas)     ${COMPTES.commercantFerme}`);
    journal(`     secret 2FA    ${commercantB.totpSecret}`);
    journal(`  Client boutique  ${COMPTES.client}`);
    journal('─────────────────────────────────────────────\n');

    return { admin, commercantA, commercantB, boutiqueA, boutiqueB, client, sien, confie, categories };
};

// Exécution directe : node scripts/semisLocal.js
const estAppelDirect = process.argv[1] && process.argv[1].endsWith('semisLocal.js');
if (estAppelDirect) {
    const uri = process.env.MONGODB_URI;
    exigerBaseLocale(uri);

    await mongoose.connect(uri);
    await semer();
    await mongoose.disconnect();
    process.exit(0);
}
