import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Base MongoDB LOCALE et jetable, pour développer et tester sans jamais
// toucher à la base de production.
//
// Pourquoi pas simplement une autre base sur le cluster Atlas : parce que la
// protection ne doit pas dépendre d'une chaîne de connexion qu'on peut se
// tromper de copier. Ici, la base n'existe même pas sur Internet — il est
// matériellement impossible d'atteindre les vraies données depuis elle.
//
// Les données sont conservées entre deux démarrages (dbPath ci-dessous) :
// une base qui repart de zéro à chaque lancement rend le développement
// pénible, et rejouer un scénario impossible.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE_SERVEUR = path.resolve(__dirname, '..');

// Dossier de données, à côté du serveur et ignoré par git (.gitignore).
const DOSSIER_DONNEES = path.join(RACINE_SERVEUR, '.mongo-local');

// Port fixe : l'URI reste la même d'un lancement à l'autre, donc utilisable
// dans un .env, un client graphique (Compass) ou un script.
const PORT = 27018;
const NOM_BASE = 'ramci_local';

let instance = null;

/**
 * Démarre la base locale et renvoie son URI.
 * Idempotent : deux appels dans le même processus réutilisent l'instance.
 */
export const demarrerBaseLocale = async () => {
    if (instance) return instance.getUri(NOM_BASE);

    if (!fs.existsSync(DOSSIER_DONNEES)) {
        fs.mkdirSync(DOSSIER_DONNEES, { recursive: true });
    }

    instance = await MongoMemoryServer.create({
        instance: {
            port: PORT,
            dbName: NOM_BASE,
            dbPath: DOSSIER_DONNEES,
            // Sans wiredTiger, le moteur par défaut est en mémoire pure et
            // dbPath est ignoré : les données disparaîtraient à l'arrêt.
            storageEngine: 'wiredTiger',
        },
    });

    return instance.getUri(NOM_BASE);
};

export const arreterBaseLocale = async () => {
    if (!instance) return;
    // `false` = ne pas effacer le dossier de données.
    await instance.stop({ doCleanup: false, force: false });
    instance = null;
};

export const URI_LOCALE = `mongodb://127.0.0.1:${PORT}/${NOM_BASE}`;

/**
 * Garde-fou partagé par tous les scripts qui ÉCRIVENT massivement (semis,
 * remise à zéro). Une URI qui n'est pas manifestement locale est refusée.
 *
 * C'est la protection qui compte vraiment : le jour où quelqu'un lance le
 * semis avec le mauvais .env chargé, il ne doit pas vider la production.
 */
export const exigerBaseLocale = (uri) => {
    const estLocale = typeof uri === 'string'
        && /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri);

    if (!estLocale) {
        console.error('\n⛔ Refus : cette commande écrit massivement en base.');
        console.error(`   URI visée : ${uri || '(aucune)'}`);
        console.error('   Elle n\'est autorisée que sur une base locale (127.0.0.1).');
        console.error('   Lancez « npm run local » plutôt que de pointer un cluster distant.\n');
        process.exit(1);
    }
};
