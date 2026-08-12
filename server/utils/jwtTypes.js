/* ═══════════════════════════════════════════════════════════════════════
   Typage des jetons JWT.

   Les trois espaces (client, vendeur technique, staff) sont signés avec le
   MÊME `JWT_SECRET`. Rien, dans le jeton lui-même, ne disait donc à quel
   espace il appartenait : seule la forme du payload et la recherche en base
   qui suit les distinguaient.

   Ça tenait, mais par accident plutôt que par construction — un jeton client
   présenté comme jeton staff n'échouait que parce que son identifiant est
   introuvable dans la collection StaffUser. Le jour où une collection est
   fusionnée, ou où un middleware oublie sa recherche, la séparation tombe.

   On ajoute donc un claim `typ` à la signature, vérifié à chaque entrée.

   ─── Pourquoi strict d'emblée ─────────────────────────────────────────
   Un jeton dépourvu de `typ` ne peut être qu'un jeton émis AVANT ce
   changement. Les refuser déconnecte donc toutes les sessions ouvertes au
   moment du déploiement — ce qui aurait normalement imposé une semaine de
   tolérance, le temps que les jetons (valables 7 jours) expirent d'eux-mêmes.

   Ici, le site n'a aucun utilisateur en production au moment du
   déploiement : il n'y a aucune session à ménager, et la version tolérante
   n'aurait fait qu'affaiblir la vérification sans bénéfice. On refuse donc
   d'emblée tout jeton non typé.
   ═══════════════════════════════════════════════════════════════════════ */

export const TYPE_CLIENT = 'user';
export const TYPE_VENDEUR = 'seller';
export const TYPE_STAFF = 'staff';

/**
 * @param {object} decode  payload déjà vérifié par jwt.verify
 * @param {string} attendu TYPE_CLIENT | TYPE_VENDEUR | TYPE_STAFF
 * @returns {boolean} true si le jeton peut servir sur cet espace
 */
export const verifierType = (decode, attendu) => decode?.typ === attendu;
