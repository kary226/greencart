import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const BottomNav = () => {
  const { cartItems } = useAppContext();
  const location = useLocation();
  const cartCount = cartItems ? Object.values(cartItems).reduce((a, b) => a + b, 0) : 0;

  const tabs = [
    {
      to: "/",
      label: "Acheter",
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#111" : "none"} stroke={active ? "#111" : "#888"} strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
      ),
    },
    {
      to: "/categories",
      label: "Catégories",
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#111" : "#888"} strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
    {
      to: "/products?sort=newest",
      label: "Tendances",
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#111" : "#888"} strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ),
    },
    {
      to: "/cart",
      label: "Panier",
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#111" : "#888"} strokeWidth="2">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
      ),
      badge: cartCount,
    },
    {
      to: "/account",
      label: "Moi",
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#111" : "#888"} strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ];

  // Ne pas afficher sur les pages suivantes
  const hideOnPaths = [
    "/seller",
    "/product/",
    "/products/",
    "/cart"  // ← AJOUTÉ : cacher le BottomNav sur la page panier
  ];
  
  const shouldHide = hideOnPaths.some(path => location.pathname.startsWith(path));
  
  // Cacher aussi sur la page produit via regex
  const isProductPage = /^\/products\/[^/]+\/[^/]+$/.test(location.pathname);
  
  if (shouldHide || isProductPage || location.pathname.startsWith("/seller")) return null;

  return (
    <>
      <nav className="bottom-nav">
        {tabs.map((tab) => {
          const isActive = tab.to === "/" ? location.pathname === "/" : location.pathname.startsWith(tab.to.split("?")[0]);
          return (
            <NavLink key={tab.to} to={tab.to} className="bnav-tab" aria-label={tab.label}>
              <div className="bnav-icon-wrap">
                {tab.icon(isActive)}
                {tab.badge > 0 && <span className="bnav-badge">{tab.badge}</span>}
              </div>
              <span className={`bnav-label${isActive ? " active" : ""}`}>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <style>{`
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0; right: 0;
          z-index: 200;
          background: #fff;
          border-top: 1px solid #e8e8e8;
          display: flex;
          align-items: stretch;
          height: 60px;
          padding-bottom: env(safe-area-inset-bottom);
        }
        .bnav-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          text-decoration: none;
          padding: 6px 0;
          position: relative;
        }
        .bnav-icon-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bnav-badge {
          position: absolute;
          top: -5px; right: -8px;
          background: #e53935;
          color: #fff;
          font-size: 9px;
          font-weight: 700;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 3px;
        }
        .bnav-label {
          font-size: 10px;
          color: #999;
          font-weight: 400;
          line-height: 1;
          transition: color .15s;
        }
        .bnav-label.active {
          color: #111;
          font-weight: 700;
        }
        body { padding-bottom: 60px; }
      `}</style>
    </>
  );
};

export default BottomNav;