import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import {
    BASE_URL, PROFILE, stages, thresholds, headers, authHeaders,
    isProductionTarget, loginOnce, resetServerMetrics, printServerMetrics,
} from './lib/config.js';

// [PHASE 3 - OBSERVABILITÉ] Scénario « commande » — le chemin critique.
//
// C'est le parcours que la Phase 0 a optimisé (suppression des N+1 dans
// placeOrderCOD / reduceVariantStock / crediterWallets). Sans ce scénario,
// impossible de prouver que le passage à `Product.find({$in})` + `bulkWrite`
// a réellement fait gagner quelque chose sous charge.
//
// ══════════════════════════════════════════════════════════════════════
// ⚠️  CE SCÉNARIO CRÉE DE VRAIES COMMANDES ET DÉCRÉMENTE DU VRAI STOCK.
//
// Trois verrous avant de pouvoir le lancer :
//   1. BASE_URL ne doit pas pointer vers la production ;
//   2. CONFIRM_WRITES=oui doit être passé explicitement ;
//   3. un compte de test dédié (TEST_EMAIL / TEST_PASSWORD) est obligatoire.
//
// Après le run, nettoyez les commandes générées — la requête de suppression
// est donnée dans loadtest/README.md.
// ══════════════════════════════════════════════════════════════════════

const orderTime = new Trend('commande_creation_ms', true);
const ordersCreated = new Counter('commandes_creees');
const ordersRejected = new Counter('commandes_rejetees');

export const options = {
    stages: stages(),
    thresholds: thresholds({
        // La création de commande est plus lourde qu'une lecture : on lui
        // accorde plus de marge, mais elle reste le point à surveiller.
        'commande_creation_ms': ['p(95)<2000'],
    }),
};

export function setup() {
    if (isProductionTarget()) {
        throw new Error(
            `REFUS : ${BASE_URL} ressemble à la production.\n` +
            'Ce scénario crée de vraies commandes et décrémente du stock. ' +
            'Visez un environnement de préproduction via BASE_URL.'
        );
    }

    if (__ENV.CONFIRM_WRITES !== 'oui') {
        throw new Error(
            'REFUS : ce scénario écrit des commandes en base.\n' +
            'Relancez avec CONFIRM_WRITES=oui si c\'est bien ce que vous voulez, ' +
            'et lisez la section « nettoyage » de loadtest/README.md avant.'
        );
    }

    console.log(`\nScénario COMMANDE — profil "${PROFILE}" — cible ${BASE_URL}`);
    console.log('⚠️  Des commandes réelles vont être créées sur cet environnement.\n');
    resetServerMetrics(http);

    const token = loginOnce(http, check);
    const h = authHeaders(token);

    // Adresse de livraison : soit fournie explicitement, soit la première du
    // compte de test. Sans adresse, placeOrderCOD renvoie 400 et le test ne
    // mesurerait que le chemin de validation.
    let addressId = __ENV.TEST_ADDRESS_ID;
    if (!addressId) {
        const res = http.get(`${BASE_URL}/api/address/get`, { headers: h });
        addressId = res.json('addresses')?.[0]?._id;
    }
    if (!addressId) {
        throw new Error(
            'Aucune adresse trouvée pour le compte de test. ' +
            'Créez-en une depuis le site, ou passez TEST_ADDRESS_ID.'
        );
    }

    // Type de livraison actif (le nom, pas l'id : c'est ce qu'attend
    // placeOrderCOD, qui fait un DeliveryType.findOne({ name })).
    const typesRes = http.get(`${BASE_URL}/api/delivery/types`, { headers: headers() });
    const deliveryType = __ENV.TEST_DELIVERY_TYPE || typesRes.json('types')?.[0]?.name || null;

    const productsRes = http.get(`${BASE_URL}/api/product/list?page=1&limit=24`, { headers: headers() });
    const ids = (productsRes.json('products') || []).map((p) => p._id).filter(Boolean);
    if (ids.length === 0) {
        throw new Error('Aucun produit disponible pour construire une commande.');
    }

    console.log(`→ Adresse ${addressId} — livraison "${deliveryType}" — ${ids.length} produits`);
    return { token, addressId, deliveryType, productIds: ids };
}

export default function (data) {
    const h = authHeaders(data.token);

    group('Passage de commande (COD)', () => {
        // Panier de 3 à 5 articles : c'est précisément la taille où le N+1
        // corrigé en Phase 0 coûtait le plus cher (un aller-retour Mongo par
        // article, en série). Un panier à 1 article ne montrerait rien.
        const size = Math.floor(Math.random() * 3) + 3;
        const chosen = new Set();
        while (chosen.size < Math.min(size, data.productIds.length)) {
            chosen.add(data.productIds[Math.floor(Math.random() * data.productIds.length)]);
        }

        const items = [...chosen].map((id) => ({
            product: id,
            quantity: Math.floor(Math.random() * 2) + 1,
        }));

        const payload = {
            items,
            address: data.addressId,
            ...(data.deliveryType ? { deliveryType: data.deliveryType } : {}),
        };

        const res = http.post(`${BASE_URL}/api/order/cod`, JSON.stringify(payload), { headers: h });

        orderTime.add(res.timings.duration);

        const created = check(res, {
            'commande: HTTP 200': (r) => r.status === 200,
            'commande: succès': (r) => r.json('success') === true,
        });

        if (created) ordersCreated.add(1);
        else {
            ordersRejected.add(1);
            // Un échec isolé (rupture de stock) est normal ; un échec massif
            // signale un vrai problème. On journalise le tout premier corps
            // reçu pour donner le motif sans noyer la sortie sous 500 lignes.
            if (__VU === 1 && __ITER === 0) {
                console.log(`Commande refusée (HTTP ${res.status}) : ${res.body}`);
            }
        }
    });

    // Pause longue : personne ne passe une commande toutes les 2 secondes.
    // L'objectif est de mesurer la latence du chemin de commande sous charge
    // concurrente, pas de générer le maximum de commandes possible.
    sleep(Math.random() * 5 + 3);
}

export function teardown() {
    printServerMetrics(http);
    console.log('\n⚠️  Pensez à supprimer les commandes de test (voir loadtest/README.md).');
}
