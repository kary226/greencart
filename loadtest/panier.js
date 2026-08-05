import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import {
    BASE_URL, PROFILE, stages, thresholds, headers, authHeaders,
    isProductionTarget, loginOnce, resetServerMetrics, printServerMetrics,
} from './lib/config.js';

// [PHASE 3 - OBSERVABILITÉ] Scénario « panier » — lecture + écriture légère.
//
// Reproduit ce que fait un client entre la fiche produit et le checkout :
// il consulte un produit, met à jour son panier (POST /api/cart/update, qui
// réécrit le champ cartItems de son document User), puis récupère ses
// adresses et les options de livraison.
//
// ⚠️ Ce scénario ÉCRIT en base : il modifie le panier du compte de test.
// Il refuse donc de démarrer contre la production. Aucune commande n'est
// créée ici — voir commande.js pour ça.
//
// Tous les VUs partagent le même compte de test : c'est volontaire et c'est
// même le pire cas, puisque toutes les écritures ciblent le même document
// Mongo (contention maximale sur une seule ligne).

const cartUpdateTime = new Trend('panier_maj_ms', true);
const checkoutPrepTime = new Trend('panier_preparation_checkout_ms', true);

export const options = {
    stages: stages(),
    thresholds: thresholds({
        'panier_maj_ms': ['p(95)<700'],
    }),
};

export function setup() {
    if (isProductionTarget()) {
        throw new Error(
            `REFUS : ${BASE_URL} ressemble à la production et ce scénario écrit en base.\n` +
            'Visez un environnement de préproduction via BASE_URL.'
        );
    }

    console.log(`\nScénario PANIER — profil "${PROFILE}" — cible ${BASE_URL}\n`);
    resetServerMetrics(http);

    const token = loginOnce(http, check);

    const res = http.get(`${BASE_URL}/api/product/list?page=1&limit=24`, { headers: headers() });
    const ids = (res.json('products') || []).map((p) => p._id).filter(Boolean);
    if (ids.length === 0) {
        throw new Error('Aucun produit disponible pour remplir le panier.');
    }

    console.log(`→ Connecté, ${ids.length} produits disponibles`);
    return { token, productIds: ids };
}

export default function (data) {
    const h = authHeaders(data.token);

    group('Consultation produit', () => {
        const id = data.productIds[Math.floor(Math.random() * data.productIds.length)];
        const res = http.get(`${BASE_URL}/api/product/id?id=${id}`, { headers: headers() });
        check(res, { 'fiche: 200': (r) => r.status === 200 });
    });

    sleep(Math.random() * 2 + 1);

    group('Mise à jour panier', () => {
        // Panier de 1 à 4 articles distincts, taille réaliste et qui fait
        // varier le coût du recalcul côté commande.
        const size = Math.floor(Math.random() * 4) + 1;
        const cartItems = {};
        for (let i = 0; i < size; i++) {
            const id = data.productIds[Math.floor(Math.random() * data.productIds.length)];
            cartItems[id] = Math.floor(Math.random() * 3) + 1;
        }

        const res = http.post(
            `${BASE_URL}/api/cart/update`,
            JSON.stringify({ cartItems }),
            { headers: h }
        );

        cartUpdateTime.add(res.timings.duration);
        check(res, {
            'panier: 200': (r) => r.status === 200,
            'panier: succès': (r) => r.json('success') === true,
        });
    });

    sleep(Math.random() * 2 + 1);

    group('Préparation checkout', () => {
        const start = Date.now();

        // Ce que la page de commande charge avant d'afficher le formulaire.
        const responses = http.batch([
            ['GET', `${BASE_URL}/api/address/get`, null, { headers: h }],
            ['GET', `${BASE_URL}/api/delivery/types`, null, { headers: headers() }],
        ]);

        checkoutPrepTime.add(Date.now() - start);

        check(responses[0], {
            'adresses: 200': (r) => r.status === 200,
            'adresses: liste renvoyée': (r) => Array.isArray(r.json('addresses')),
        });
        check(responses[1], { 'types de livraison: 200': (r) => r.status === 200 });
    });

    sleep(Math.random() * 3 + 1);
}

export function teardown() {
    printServerMetrics(http);
}
