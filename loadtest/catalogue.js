import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import {
    BASE_URL, PROFILE, stages, thresholds, headers,
    resetServerMetrics, printServerMetrics,
} from './lib/config.js';

// [PHASE 3 - OBSERVABILITÉ] Scénario « catalogue » — 100 % lecture.
//
// Reproduit le parcours du visiteur qui arrive sur l'accueil puis navigue :
// bannières + catégories + premiers produits, puis une page de listing, puis
// une fiche produit. C'est le parcours le plus fréquent du site, et celui
// que les Phases 0 (Cache-Control), 1 (bundle, images) et 2 (Redis) visaient.
//
// Aucune écriture en base : ce scénario est le seul qu'on puisse lancer sans
// risque contre n'importe quel environnement.

const homeTime = new Trend('parcours_accueil_ms', true);
const listTime = new Trend('parcours_listing_ms', true);
const detailTime = new Trend('parcours_fiche_produit_ms', true);

export const options = {
    stages: stages(),
    thresholds: thresholds({
        // Seuils par étape : l'accueil enchaîne 3 appels, la fiche produit
        // est le point de conversion — on lui demande d'être plus rapide.
        'parcours_accueil_ms': ['p(95)<1200'],
        'parcours_fiche_produit_ms': ['p(95)<600'],
    }),
};

export function setup() {
    console.log(`\nScénario CATALOGUE — profil "${PROFILE}" — cible ${BASE_URL}\n`);
    resetServerMetrics(http);

    // On récupère de vrais identifiants produits une seule fois : faire
    // tourner le test sur des IDs inexistants mesurerait le chemin d'erreur
    // (rapide, car il ne touche presque pas la base) et donnerait des
    // chiffres flatteurs mais faux.
    const res = http.get(`${BASE_URL}/api/product/list?page=1&limit=24`, { headers: headers() });
    if (res.status !== 200) {
        throw new Error(`Impossible de récupérer le catalogue (HTTP ${res.status}) : ${res.body}`);
    }

    const products = res.json('products') || [];
    const ids = products.map((p) => p._id).filter(Boolean);

    if (ids.length === 0) {
        throw new Error('Aucun produit renvoyé par /api/product/list — base vide ?');
    }

    console.log(`→ ${ids.length} produits utilisés comme jeu de test`);
    return { productIds: ids };
}

export default function (data) {
    const h = headers();

    group('Accueil', () => {
        const start = Date.now();

        // Ce que charge réellement la page d'accueil, en parallèle côté
        // navigateur — d'où le batch plutôt que trois appels en série.
        const responses = http.batch([
            ['GET', `${BASE_URL}/api/banner/list`, null, { headers: h }],
            ['GET', `${BASE_URL}/api/category/list`, null, { headers: h }],
            ['GET', `${BASE_URL}/api/product/bestsellers`, null, { headers: h }],
        ]);

        homeTime.add(Date.now() - start);

        check(responses[0], { 'bannières: 200': (r) => r.status === 200 });
        check(responses[1], { 'catégories: 200': (r) => r.status === 200 });
        check(responses[2], { 'bestsellers: 200': (r) => r.status === 200 });
    });

    sleep(Math.random() * 2 + 1); // temps de lecture de la page

    group('Listing produits', () => {
        // Page aléatoire entre 1 et 3 : rester sur la page 1 masquerait le
        // coût du `skip` de pagination sur les pages suivantes.
        const page = Math.floor(Math.random() * 3) + 1;
        const res = http.get(`${BASE_URL}/api/product/list?page=${page}&limit=12`, { headers: h });

        listTime.add(res.timings.duration);
        check(res, {
            'listing: 200': (r) => r.status === 200,
            'listing: produits renvoyés': (r) => Array.isArray(r.json('products')),
        });
    });

    sleep(Math.random() * 2 + 1);

    group('Fiche produit', () => {
        const id = data.productIds[Math.floor(Math.random() * data.productIds.length)];
        const res = http.get(`${BASE_URL}/api/product/id?id=${id}`, { headers: h });

        detailTime.add(res.timings.duration);
        check(res, {
            'fiche: 200': (r) => r.status === 200,
            'fiche: produit renvoyé': (r) => r.json('success') === true,
        });
    });

    sleep(Math.random() * 3 + 1);
}

export function teardown() {
    printServerMetrics(http);
}
