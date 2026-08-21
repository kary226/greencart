// Vérification de bout en bout du circuit d'argent multi-boutiques.
//
//   node scripts/verifierFluxArgent.mjs   (serveur démarré via « npm run local »)
//
// Rejoue le parcours complet : commande chez deux boutiques -> crédit en
// attente -> confirmations des commerçants -> validation admin -> fonds
// retirables. Vérifie à chaque étape les MONTANTS RÉELS en base, pas
// seulement les codes HTTP.

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import StaffUser from '../models/StaffUser.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Boutique from '../models/Boutique.js';
import Order from '../models/Order.js';
import Wallet from '../models/Wallet.js';
import Address from '../models/Address.js';

const BASE = process.argv[2] || 'http://localhost:4000';
const URI = 'mongodb://127.0.0.1:27018/ramci_local';
const MDP = 'MotDePasseLocal123';

let ok = 0, ko = 0;
const v = (libelle, condition, detail = '') => {
    if (condition) { console.log(`✅ ${libelle}`); ok += 1; }
    else { console.log(`🔴 ${libelle}${detail ? ' — ' + detail : ''}`); ko += 1; }
};

const client = () => {
    const cookies = new Map();
    return async (chemin, options = {}) => {
        const entete = [...cookies.entries()].map(([k, x]) => `${k}=${x}`).join('; ');
        const res = await fetch(BASE + chemin, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(entete ? { Cookie: entete } : {}),
                ...(options.headers || {}),
            },
        });
        for (const c of (res.headers.getSetCookie?.() || [])) {
            const [n, val] = c.split(';')[0].split('=');
            cookies.set(n, val);
        }
        let data = {};
        try { data = await res.json(); } catch { /* non JSON */ }
        return { status: res.status, data };
    };
};

const soldes = async (ownerId) => {
    const w = await Wallet.findOne({ ownerId });
    if (!w) return { solde: 0, enAttente: 0 };
    await w.recalculerSoldes();
    return { solde: w.solde, enAttente: w.soldeEnAttente };
};

const run = async () => {
    try { await fetch(BASE); } catch {
        console.log('❌ Serveur injoignable — lancez « npm run local ».');
        process.exit(1);
    }
    await mongoose.connect(URI);

    // ── Préparation : deux boutiques avec un article chacune ────────────
    const admin = await StaffUser.findOne({ email: 'admin@local.test' });
    const awa = await StaffUser.findOne({ email: 'boutique-ouverte@local.test' });
    const bakary = await StaffUser.findOne({ email: 'boutique-fermee@local.test' });
    const bAwa = await Boutique.findOne({ ownerId: awa._id });
    const bBakary = await Boutique.findOne({ ownerId: bakary._id });

    const artAwa = await Product.findOne({ boutiqueId: bAwa._id, origine: 'commercant' });
    // Bakary n'a pas d'article dans le semis : on lui en crée un.
    const artBakary = await Product.findOneAndUpdate(
        { sku: 'FLUX-BAK-01' },
        {
            $setOnInsert: {
                name: 'Sac cuir Bakary', sku: 'FLUX-BAK-01', description: 'test flux',
                price: 15000, offerPrice: 15000, image: ['x.jpg'], categories: ['accessoires'],
                stock: 10, inStock: true, boutiqueId: bBakary._id, origine: 'commercant',
            },
        },
        { upsert: true, new: true }
    );

    const acheteur = await User.findOneAndUpdate(
        { email: 'flux@local.test' },
        { $setOnInsert: { name: 'Acheteur Flux', email: 'flux@local.test', password: await bcrypt.hash(MDP, 10) } },
        { upsert: true, new: true }
    );

    const avantAwa = await soldes(awa._id);
    const avantBakary = await soldes(bakary._id);

    // ── 1. Commande multi-boutiques ─────────────────────────────────────
    const cClient = client();
    await cClient('/api/user/login', { method: 'POST', body: JSON.stringify({ email: acheteur.email, password: MDP }) });

    // `address` est une REFERENCE vers une adresse enregistree, pas un objet.
    const adresse = await Address.findOneAndUpdate(
        { userId: acheteur._id.toString(), street: 'Rue Flux' },
        {
            $setOnInsert: {
                userId: acheteur._id.toString(), firstName: 'Acheteur', lastName: 'Flux',
                street: 'Rue Flux', phone: '0700000000',
            },
        },
        { upsert: true, new: true }
    );

    const r = await cClient('/api/order/cod', {
        method: 'POST',
        body: JSON.stringify({
            items: [
                { product: artAwa._id.toString(), quantity: 1 },
                { product: artBakary._id.toString(), quantity: 2 },
            ],
            address: adresse._id.toString(),
            deliveryType: null,
        }),
    });
    v('La commande multi-boutiques est acceptée', r.data.success === true, JSON.stringify(r.data).slice(0, 120));

    const commande = await Order.findOne({ userId: acheteur._id.toString() }).sort('-createdAt');
    const attenduAwa = artAwa.offerPrice * 1;
    const attenduBakary = artBakary.offerPrice * 2;

    // ── 2. Crédit EN ATTENTE immédiat ───────────────────────────────────
    const apresCommandeAwa = await soldes(awa._id);
    const apresCommandeBakary = await soldes(bakary._id);

    v('Awa voit sa part créditée en attente dès la commande',
        apresCommandeAwa.enAttente === avantAwa.enAttente + attenduAwa,
        `${apresCommandeAwa.enAttente} (attendu ${avantAwa.enAttente + attenduAwa})`);
    v('Bakary voit SA part, calculée sur la quantité commandée',
        apresCommandeBakary.enAttente === avantBakary.enAttente + attenduBakary,
        `${apresCommandeBakary.enAttente} (attendu ${avantBakary.enAttente + attenduBakary})`);
    v('Rien n_est encore retirable pour Awa',
        apresCommandeAwa.solde === avantAwa.solde,
        `${apresCommandeAwa.solde}`);

    // ── 3. Confidentialité de la vue commerçant ─────────────────────────
    const cAwa = client();
    await cAwa('/api/staff/login', {
        method: 'POST',
        body: JSON.stringify({ email: awa.email, password: MDP, totpCode: authenticator.generate(awa.totpSecret) }),
    });
    const ventes = await cAwa('/api/order/commercant/mes-ventes');
    const vente = (ventes.data.orders || []).find((o) => o._id === commande._id.toString());
    const brut = JSON.stringify(vente || {});

    v('Le commerçant retrouve la commande dans ses ventes', Boolean(vente));
    v('Aucune information client ne fuite (adresse, téléphone, nom)',
        !brut.includes('0700000000') && !brut.includes('Acheteur') && !/address/i.test(brut),
        brut.slice(0, 150));
    v('Le commerçant ne voit QUE son article',
        vente?.articles?.length === 1 && vente.articles[0].sku === artAwa.sku,
        JSON.stringify(vente?.articles?.map((a) => a.sku)));
    v('Le commerçant ne voit pas le montant total de la commande',
        vente?.montantBoutique === attenduAwa && !brut.includes(String(commande.amount)),
        `montantBoutique=${vente?.montantBoutique}`);
    v('Le statut affiché lui dit quoi faire', vente?.statut?.cle === 'a_confirmer', vente?.statut?.libelle);

    // ── 4. Validation admin refusée tant que tous n'ont pas confirmé ────
    const cAdmin = client();
    await cAdmin('/api/staff/login', {
        method: 'POST',
        body: JSON.stringify({ email: admin.email, password: MDP, totpCode: authenticator.generate(admin.totpSecret) }),
    });

    let vAdmin = await cAdmin('/api/order/admin/confirmer', {
        method: 'POST', body: JSON.stringify({ orderId: commande._id.toString() }),
    });
    v('L_admin ne peut pas valider avant les confirmations des commerçants',
        vAdmin.status === 409, `${vAdmin.status} ${vAdmin.data.message}`);

    // ── 5. Confirmations des commerçants ────────────────────────────────
    const confAwa = await cAwa('/api/order/commercant/confirmer', {
        method: 'POST', body: JSON.stringify({ orderId: commande._id.toString() }),
    });
    v('Awa confirme sa part', confAwa.data.success === true);
    v('La commande reste incomplète tant que Bakary n_a pas confirmé',
        confAwa.data.toutesConfirmees === false, `enAttenteDe=${confAwa.data.enAttenteDe}`);

    // Un commerçant NON concerné ne doit pas pouvoir confirmer une commande
    // qui ne le regarde pas — ici Bakary l'est, on teste donc le doublon.
    const doublon = await cAwa('/api/order/commercant/confirmer', {
        method: 'POST', body: JSON.stringify({ orderId: commande._id.toString() }),
    });
    const cmdApresDoublon = await Order.findById(commande._id);
    v('Une double confirmation n_ajoute pas de ligne en double',
        cmdApresDoublon.confirmationsBoutiques.filter(
            (c) => c.boutiqueId.toString() === bAwa._id.toString()).length === 1,
        `${cmdApresDoublon.confirmationsBoutiques.length} confirmation(s)`);

    const cBakary = client();
    await cBakary('/api/staff/login', {
        method: 'POST',
        body: JSON.stringify({ email: bakary.email, password: MDP, totpCode: authenticator.generate(bakary.totpSecret) }),
    });
    const confBak = await cBakary('/api/order/commercant/confirmer', {
        method: 'POST', body: JSON.stringify({ orderId: commande._id.toString() }),
    });
    v('Bakary confirme, la commande devient prête', confBak.data.toutesConfirmees === true);

    // ── 6. Validation admin -> libération des fonds ─────────────────────
    const aValider = await cAdmin('/api/order/admin/a-valider');
    const ligne = (aValider.data.orders || []).find((o) => o._id === commande._id.toString());
    v('L_admin voit la commande comme prête à valider', ligne?.toutesConfirmees === true);

    vAdmin = await cAdmin('/api/order/admin/confirmer', {
        method: 'POST', body: JSON.stringify({ orderId: commande._id.toString() }),
    });
    v('L_admin valide la commande', vAdmin.data.success === true, JSON.stringify(vAdmin.data).slice(0, 120));

    const finalAwa = await soldes(awa._id);
    const finalBakary = await soldes(bakary._id);

    v('Les fonds d_Awa sont passés en disponible',
        finalAwa.solde === avantAwa.solde + attenduAwa,
        `disponible=${finalAwa.solde} (attendu ${avantAwa.solde + attenduAwa})`);
    v('Le solde en attente d_Awa est retombé',
        finalAwa.enAttente === avantAwa.enAttente,
        `enAttente=${finalAwa.enAttente}`);
    v('Les fonds de Bakary sont passés en disponible',
        finalBakary.solde === avantBakary.solde + attenduBakary,
        `disponible=${finalBakary.solde}`);
    v('Aucun argent créé ni perdu au transfert',
        (finalAwa.solde + finalAwa.enAttente) === (apresCommandeAwa.solde + apresCommandeAwa.enAttente),
        `avant=${apresCommandeAwa.solde + apresCommandeAwa.enAttente} après=${finalAwa.solde + finalAwa.enAttente}`);

    // ── 7. Double validation impossible ─────────────────────────────────
    const rejeu = await cAdmin('/api/order/admin/confirmer', {
        method: 'POST', body: JSON.stringify({ orderId: commande._id.toString() }),
    });
    const apresRejeu = await soldes(awa._id);
    v('Valider deux fois ne crédite pas deux fois',
        rejeu.status === 409 && apresRejeu.solde === finalAwa.solde,
        `${rejeu.status}, solde=${apresRejeu.solde}`);

    // ── 8. Retrait : uniquement sur le disponible ───────────────────────
    const tropGrand = await cAwa('/api/retraits', {
        method: 'POST',
        body: JSON.stringify({ montant: finalAwa.solde + 10000, moyenPaiement: 'Wave 0700000000' }),
    });
    v('Un retrait supérieur au disponible est refusé',
        tropGrand.data.success === false, tropGrand.data.message);

    // ── Nettoyage ───────────────────────────────────────────────────────
    await Order.deleteMany({ userId: acheteur._id.toString() });
    await Address.deleteMany({ userId: acheteur._id.toString() });
    await User.deleteOne({ email: 'flux@local.test' });
    await Product.deleteOne({ sku: 'FLUX-BAK-01' });
    await mongoose.disconnect();

    console.log('\n──────────────────────────────────────────────');
    console.log(`  ${ok} vérification(s) OK · ${ko} problème(s)`);
    console.log('──────────────────────────────────────────────\n');
    process.exit(ko > 0 ? 1 : 0);
};

run().catch(async (e) => {
    console.error('Erreur pendant la vérification :', e);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    process.exit(1);
});
