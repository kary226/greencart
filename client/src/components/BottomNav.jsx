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
    // ✅ ONGLET TENDRANCES SUPPRIMÉ
    {
      to: "/my-orders",
      label: "Commandes",
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#111" : "#888"} strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
          <circle cx="12" cy="15" r="1"/>
          <circle cx="16" cy="15" r="1"/>
          <circle cx="8" cy="15" r="1"/>
        </svg>
      ),
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
    "/cart",
    "/my-orders"
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