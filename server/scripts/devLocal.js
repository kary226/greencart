import mongoose from 'mongoose';
import { demarrerBaseLocale, exigerBaseLocale } from './baseLocale.js';
import StaffUser from '../models/StaffUser.js';
import { semer } from './semisLocal.js';

// Lance le serveur RAMCI sur une base LOCALE, jamais sur la production.
//
//   npm run local
//
// Ce script fait trois choses, dans cet ordre :
//   1. démarre un MongoDB embarqué (aucune installation système requise) ;
//   2. remplit la base si elle est vide, sinon garde les données existantes ;
//   3. démarre le serveur habituel, qui lit MONGODB_URI comme d'ordinaire.
//
// Le point important : MONGODB_URI est écrasé AVANT que server.js ne soit
// importé. Le `.env` de production peut donc rester en place sans risque —
// dotenv n'écrase jamais une variable déjà définie.

const uri = await demarrerBaseLocale();

// Ceinture et bretelles : si un jour demarrerBaseLocale change et renvoie
// autre chose qu'une adresse locale, on s'arrête ici.
exigerBaseLocale(uri);

process.env.MONGODB_URI = uri;
// Le serveur refuse de démarrer sans JWT_SECRET ; en local, une valeur
// dédiée évite d'emprunter celle de production.
process.env.JWT_SECRET ||= 'secret-local-de-developpement-non-sensible-32c';
process.env.NODE_ENV ||= 'development';

console.log('\n🧪 Base locale : ' + uri);

await mongoose.connect(uri);
const dejaRempli = await StaffUser.countDocuments();
if (dejaRempli === 0) {
    console.log('   Base vide : remplissage initial...');
    await semer();
} else {
    console.log(`   ${dejaRempli} compte(s) staff déjà présents — données conservées.`);
    console.log('   Pour repartir de zéro : npm run local:reset\n');
}
await mongoose.disconnect();

// Import tardif volontaire : server.js se connecte à la base dès son
// chargement, il doit donc voir la bonne URI.
await import('../server.js');
