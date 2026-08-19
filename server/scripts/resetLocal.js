import mongoose from 'mongoose';
import { demarrerBaseLocale, arreterBaseLocale, exigerBaseLocale } from './baseLocale.js';
import { semer } from './semisLocal.js';

// Remet la base LOCALE à son état de départ.
//
//   npm run local:reset
//
// Utile après avoir cassé des données en testant, ou avant de rejouer un
// scénario depuis le début. Ne touche évidemment jamais à la production :
// l'URI est produite ici et revérifiée par exigerBaseLocale.

const uri = await demarrerBaseLocale();
exigerBaseLocale(uri);

await mongoose.connect(uri);
await semer();
await mongoose.disconnect();
await arreterBaseLocale();

process.exit(0);
