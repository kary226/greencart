import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { Home, LayoutGrid, ReceiptText, Package, User } from "lucide-react";
import "../styles/bottom-nav.css";

/**
 * Barre de navigation basse.
 *
 * Cinq onglets, pas six. L'ancienne version en comptait six, ce qui posait
 * deux problèmes :
 *
 *   1. À six, chaque onglet tombe sous 60 px de large sur un écran de
 *      360 px, et les libellés à 10,5 px se chevauchent. Les recommandations
 *      iOS comme Material plafonnent à cinq.
 *   2. L'onglet « Commandes » pointait vers /my-orders, chemin présent dans
 *      la liste `hideOnPaths` : appuyer dessus faisait DISPARAÎTRE la barre,
 *      et l'utilisateur se retrouvait sans navigation. Le chemin a été retiré
 *      de la liste, la barre reste donc visible sur la page des commandes.
 *
 * « Favoris » est l'onglet qui saute : c'est la destination la moins
 * fréquente des six, et elle reste accessible depuis le cœur de chaque carte
 * produit ainsi que depuis l'espace « Moi ». Pour la remettre, il suffit
 * d'ajouter une entrée au tableau `tabs` ci-dessous — et d'en retirer une.
 */
/** Une commande encore en cours : le client peut avoir quelque chose à y voir. */
const EN_COURS = [
  'Order Placed', 'Checking Availability', 'Confirmed',
  'Collecting', 'Ready for Shipment', 'Shipped', 'Out for Delivery',
];

const BottomNav = () => {
  const { colisShein, colisSheinActif, orders } = useAppContext();
  const location = useLocation();

  const colisActifsCount = colisShein?.filter(c => c.statut !== "livre" && c.statut !== "annule").length || 0;

  // L'onglet Commandes ne portait aucun indicateur : le client devait
  // l'ouvrir pour savoir si quelque chose avait bougé. On compte ses
  // commandes encore en cours — pas les livrées ni les annulées, qui
  // n'attendent plus rien de lui.
  //
  // Volontairement PAS un compteur de « non lu » : ça supposerait de
  // mémoriser ce qu'il a déjà vu, pour une valeur faible ici. Le nombre de
  // commandes en cours répond à la vraie question — « où en sont mes
  // achats ? » — sans inventer un état de lecture.
  const commandesEnCours = orders?.filter(o => EN_COURS.includes(o.status)).length || 0;

  // L'onglet Colis n'apparaît que si l'admin a activé la section. Filtré
  // ici plutôt que masqué en CSS : la barre reste équilibrée à 4 onglets.
  const tabs = [
    { to: "/", label: "Accueil", Icon: Home, exact: true },
    { to: "/categories", label: "Catégories", Icon: LayoutGrid },
    { to: "/my-orders", label: "Commandes", Icon: ReceiptText, badge: commandesEnCours },
    colisSheinActif && { to: "/mes-colis-shein", label: "Colis", Icon: Package, badge: colisActifsCount },
    { to: "/account", label: "Moi", Icon: User },
  ].filter(Boolean);

  // Masquée là où un autre élément occupe déjà le bas de l'écran (barre de
  // commande du panier, barre d'achat de la fiche produit) ou là où la
  // navigation client n'a pas lieu d'être (back-office).
  // `/my-orders` a été RETIRÉ de cette liste : c'est une destination de la
  // barre, l'y masquer était un cul-de-sac.
  const hideOnPaths = ["/seller", "/staff", "/commercant", "/livreur", "/cart", "/colis-shein/", "/valider-panier-shein"];
  const shouldHide = hideOnPaths.some(path => location.pathname.startsWith(path));
  const isProductPage = /^\/products\/[^/]+\/[^/]+$/.test(location.pathname);

  if (shouldHide || isProductPage) return null;

  return (
    <nav className="bnav" aria-label="Navigation principale">
      {tabs.map(({ to, label, Icon, badge, exact }) => {
        const isActive = exact
          ? location.pathname === to
          : location.pathname.startsWith(to);

        return (
          <NavLink
            key={to}
            to={to}
            className={`bnav__tab${isActive ? " is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="bnav__pill">
              {/* L'icône se remplit quand l'onglet est actif : la forme
                  change en plus de la couleur, l'état ne repose donc pas
                  uniquement sur la teinte. */}
              <Icon size={21} strokeWidth={isActive ? 2.3 : 1.8} />

              {badge > 0 && (
                <span className="bnav__badge" aria-hidden="true">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>

            <span className="bnav__label">{label}</span>

            {/* Le compteur est répété en texte pour les lecteurs d'écran :
                le badge visuel est en aria-hidden car « 3 » seul ne veut
                rien dire hors contexte. */}
            {badge > 0 && (
              <span className="sr-only">{badge} en cours</span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};

export default BottomNav;