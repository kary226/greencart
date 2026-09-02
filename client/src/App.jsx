import React, { Suspense, lazy, useEffect } from 'react';
import Navbar from './components/Navbar';
import { Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import { Toaster } from "react-hot-toast";
import SonNotifications from "./components/SonNotifications";
import Footer from './components/Footer';
import { useAppContext } from './context/AppContext';
import Login from './components/Login';
import AllProducts from './pages/AllProducts';
import ProductCategory from './pages/ProductCategory';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import AddAddress from './pages/AddAddress';
import MyOrders from './pages/MyOrders';
import OrderDetail from './pages/OrderDetail';
import Wishlist from './pages/Wishlist';
import Account from './pages/Account';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AllCategories from './pages/AllCategories';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentError from './pages/PaymentError';
import Loading from './components/Loading';
import BottomNav from './components/BottomNav';
import InstallApp from './pages/InstallApp';
import NotificationPrompt from './components/Notificationprompt';
import PageLoader from './components/PageLoader';

// ─── [PHASE 3] Super Admin Layout ────────────────────────────────────

const SuperAdminLayout = lazy(() => import('./components/SuperAdminLayout'));
const StaffLogin = lazy(() => import('./pages/staff/StaffLogin'));

// Pages admin unifiées (Phase 3)
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
// [RAMCI §14] Console : ce que le compte connecté doit faire maintenant.
const AdminConsole = lazy(() => import('./pages/admin/Console'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AddProduct = lazy(() => import('./pages/seller/AddProduct'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const AdminClients = lazy(() => import('./pages/admin/Clients'));
const AdminBanners = lazy(() => import('./pages/admin/Banners'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminCoupons = lazy(() => import('./pages/admin/Coupons'));
const AdminLocations = lazy(() => import('./pages/admin/Locations'));
const AdminDeliveries = lazy(() => import('./pages/admin/Deliveries'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminApprovals = lazy(() => import('./pages/admin/Approvals'));
const AdminComptes = lazy(() => import('./pages/admin/AdminComptes'));
const AdminCommandes = lazy(() => import('./pages/admin/AdminCommandes'));
const AdminBoutiques = lazy(() => import('./pages/admin/AdminBoutiques'));
const AdminJournal = lazy(() => import('./pages/admin/AdminJournal'));
const AdminRetraits = lazy(() => import('./pages/admin/AdminRetraits'));

// Phase 4
const AdminWarehouse = lazy(() => import('./pages/admin/Warehouse'));
const AdminReturns = lazy(() => import('./pages/admin/Returns'));

// Phase 5
const AdminRefunds = lazy(() => import('./pages/admin/Refunds'));

// RCOINS
const AdminRcoins = lazy(() => import('./pages/admin/Rcoins'));
const AdminRcoinsTransactions = lazy(() => import('./pages/admin/RcoinsTransactions'));

// Phase 6
const AdminReconciliation = lazy(() => import('./pages/admin/Reconciliation'));

// Portefeuilles commerçants
const AdminWallets = lazy(() => import('./pages/admin/Wallets'));

// Colis SHEIN — intégré à la console admin (au lieu de /seller)
const AdminColisShein = lazy(() => import('./pages/seller/ColisSheinManager'));

// ─── Espaces Commerçant / Livreur / Assistant (conservés) ────────────

const CommercantLayout = lazy(() => import('./pages/commercant/CommercantLayout'));
const DashboardCommercant = lazy(() => import('./pages/commercant/Dashboard'));
const Boutique = lazy(() => import('./pages/commercant/Boutique'));
const Produits = lazy(() => import('./pages/commercant/Produits'));
const Commandes = lazy(() => import('./pages/commercant/Commandes'));
const ProduitForm = lazy(() => import('./pages/commercant/ProduitForm'));
const CodesPromo = lazy(() => import('./pages/commercant/CodesPromo'));
const Portefeuille = lazy(() => import('./pages/commercant/Portefeuille'));
const DemandeRetrait = lazy(() => import('./pages/commercant/DemandeRetrait'));

const MesLivraisons = lazy(() => import('./pages/livreur/MesLivraisons'));
const LivraisonDetail = lazy(() => import('./pages/livreur/LivraisonDetail'));
const Collectes = lazy(() => import('./pages/livreur/Collectes'));

const Conversations = lazy(() => import('./pages/assistant/Conversations'));
const ChatDetail = lazy(() => import('./pages/assistant/ChatDetail'));

// ─── Colis Shein (client) ─────────────────────────────────────────────

const ValiderPanierShein = lazy(() => import('./pages/ValiderPanierShein'));
const ColisSheinConversation = lazy(() => import('./pages/ColisSheinConversation'));
const ColisSheinDetailPage = lazy(() => import('./pages/ColisSheinDetailPage'));
const MesColisShein = lazy(() => import('./pages/MesColisShein'));

// ─── Boutique vitrine publique ────────────────────────────────────────

const BoutiqueVitrine = lazy(() => import('./pages/BoutiqueVitrine'));

// ─── ScrollToTop intelligent ──────────────────────────────────────────

const useSmartScroll = () => {
  const location = useLocation();
  const navigationKey = location.key;

  useEffect(() => {
    const savedPosition = sessionStorage.getItem(`scrollPos-${navigationKey}`);
    if (savedPosition !== null) {
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedPosition, 10));
      });
    } else {
      window.scrollTo(0, 0);
    }

    const handleBeforeUnload = () => {
      sessionStorage.setItem(`scrollPos-${navigationKey}`, window.scrollY.toString());
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      sessionStorage.setItem(`scrollPos-${navigationKey}`, window.scrollY.toString());
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [navigationKey]);
};

// ─── App ──────────────────────────────────────────────────────────────

const App = () => {
  const location = useLocation();
  const { showUserLogin, user } = useAppContext();

  useSmartScroll();

  // Détection des espaces
  const isAdminPath = location.pathname.startsWith("/admin");
  const isCommercantPath = location.pathname.startsWith("/commercant");
  const isLivreurPath = location.pathname.startsWith("/livreur");
  const isAssistantPath = location.pathname.startsWith("/assistant");
  const isColisSheinPath =
    location.pathname === "/mes-colis-shein" ||
    location.pathname === "/valider-panier-shein" ||
    location.pathname.startsWith("/colis-shein/");
  const isChatFullScreenPath = location.pathname.startsWith("/colis-shein/");

  // Affichage des éléments
  const showFooter = !isAdminPath && !isColisSheinPath && !isLivreurPath && !isCommercantPath && !isAssistantPath;
  const showBottomNav = !isAdminPath && !isLivreurPath && !isCommercantPath && !isAssistantPath && !isChatFullScreenPath && !(showUserLogin && !user);
  const showNavbar = !isAdminPath && !isChatFullScreenPath && !isLivreurPath && !isCommercantPath && !isAssistantPath && !(showUserLogin && !user);

  return (
    <div className='text-default min-h-screen text-gray-700 bg-white'>

      {showNavbar && <Navbar />}
      {showUserLogin && !user ? <Login /> : null}
      {!isAdminPath && <NotificationPrompt />}

      {/* Le son des messages, branché une fois pour toutes sur le flux de
          toasts — voir components/SonNotifications.jsx. */}
      <SonNotifications />

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2500,
          style: {
            background: '#111111',
            color: '#ffffff',
            borderRadius: '40px',
            padding: '12px 20px',
            fontSize: '13px',
            fontWeight: '500',
            fontFamily: 'DM Sans, sans-serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#ffffff' },
          },
          error: {
            iconTheme: { primary: '#e53935', secondary: '#ffffff' },
            style: { background: '#111111', color: '#ffffff' },
          },
          loading: {
            style: { background: '#111111', color: '#ffffff' },
          },
        }}
      />

      <div className={`${isAdminPath || isChatFullScreenPath || isLivreurPath || isCommercantPath || isAssistantPath ? "" : "px-4 pb-20"}`}>
        <Suspense fallback={<PageLoader />}>
          <Routes>

            {/* ─── Routes publiques ────────────────────────────────────── */}
            <Route path='/' element={<Home />} />
            <Route path='/products' element={<AllProducts />} />
            <Route path='/products/:category' element={<ProductCategory />} />
            <Route path='/products/:category/:id' element={<ProductDetails />} />
            <Route path='/cart' element={<Cart />} />
            <Route path='/add-address' element={<AddAddress />} />
            <Route path='/my-orders' element={<MyOrders />} />
            <Route path='/my-orders/:orderId' element={<OrderDetail />} />
            <Route path='/loader' element={<Loading />} />
            <Route path='/categories' element={<AllCategories />} />
            <Route path='/wishlist' element={<Wishlist />} />
            <Route path='/account' element={<Account />} />
            <Route path='/payment/success' element={<PaymentSuccess />} />
            <Route path='/payment/error' element={<PaymentError />} />
            <Route path='/forgot-password' element={<ForgotPassword />} />
            <Route path='/reset-password' element={<ResetPassword />} />
            <Route path='/install' element={<InstallApp />} />
            <Route path='/boutique/:id' element={<BoutiqueVitrine />} />

            {/* ─── Colis Shein (client) ────────────────────────────────── */}
            <Route path='/valider-panier-shein' element={<ValiderPanierShein />} />
            <Route path='/mes-colis-shein' element={<MesColisShein />} />
            <Route path='/colis-shein/:id' element={<ColisSheinConversation />} />
            <Route path='/colis-shein/:id/detail' element={<ColisSheinDetailPage />} />

            {/* ─── [PHASE 3 + 4 + 5 + 6] SUPER ADMIN ──────────────────── */}
            <Route path='/staff/login' element={<StaffLogin />} />
            <Route path='/admin' element={<SuperAdminLayout />}>
              {/* [RAMCI §14] La console est la page d'accueil : on arrive sur
                  « ce qu'il y a à faire », pas sur des chiffres. Le tableau
                  de bord reste accessible pour le pilotage. */}
              <Route index element={<AdminConsole />} />
              <Route path='console' element={<AdminConsole />} />
              <Route path='dashboard' element={<AdminDashboard />} />
              <Route path='products' element={<AdminProducts />} />
              <Route path='products/add' element={<AddProduct />} />
              <Route path='products/edit/:id' element={<AddProduct />} />
              <Route path='orders' element={<AdminOrders />} />
              <Route path='clients' element={<AdminClients />} />
              <Route path='banners' element={<AdminBanners />} />
              <Route path='categories' element={<AdminCategories />} />
              <Route path='coupons' element={<AdminCoupons />} />
              <Route path='locations' element={<AdminLocations />} />
              <Route path='deliveries' element={<AdminDeliveries />} />
              <Route path='settings' element={<AdminSettings />} />
              <Route path='settings/thresholds' element={<AdminSettings />} />
              <Route path='approvals' element={<AdminApprovals />} />
              <Route path='staff' element={<AdminComptes />} />
              <Route path='commandes' element={<AdminCommandes />} />
              <Route path='boutiques' element={<AdminBoutiques />} />
              <Route path='audit' element={<AdminJournal />} />
              <Route path='withdrawals' element={<AdminRetraits />} />
              {/* Alias français : les liens de la console et du guide
                  parlent de « retraits », pas de « withdrawals ». */}
              <Route path='retraits' element={<AdminRetraits />} />

              {/* Phase 4 */}
              <Route path='warehouse' element={<AdminWarehouse />} />
              <Route path='warehouse/scans' element={<AdminWarehouse />} />
              <Route path='returns' element={<AdminReturns />} />
              <Route path='returns/:id' element={<AdminReturns />} />

              {/* Phase 5 */}
              <Route path='refunds' element={<AdminRefunds />} />

              {/* RCOINS */}
              <Route path='rcoins' element={<AdminRcoins />} />
              <Route path='rcoins/transactions' element={<AdminRcoinsTransactions />} />

              {/* Phase 6 */}
              <Route path='reconciliation' element={<AdminReconciliation />} />

              {/* Portefeuilles commerçants */}
              <Route path='wallets' element={<AdminWallets />} />

              {/* Colis SHEIN */}
              <Route path='colis-shein' element={<AdminColisShein />} />

              {/* Adresse /admin inconnue. Sans cette ligne, React Router ne
                  rendait pas le layout du tout : l'utilisateur tombait sur
                  une page entièrement blanche, sans menu ni explication.
                  Rattachée ici, elle passe par la garde de SuperAdminLayout,
                  qui refuse toute route non déclarée et affiche pourquoi. */}
              <Route path='*' element={null} />
            </Route>

            {/* ─── Commerçant ──────────────────────────────────────────── */}
            <Route path='/commercant' element={<CommercantLayout />}>
              <Route path='dashboard' element={<DashboardCommercant />} />
              <Route path='boutique' element={<Boutique />} />
              <Route path='produits' element={<Produits />} />
              <Route path='commandes' element={<Commandes />} />
              <Route path='produits/ajouter' element={<ProduitForm />} />
              <Route path='produits/editer/:id' element={<ProduitForm />} />
              <Route path='codes-promo' element={<CodesPromo />} />
              <Route path='portefeuille' element={<Portefeuille />} />
              <Route path='retraits' element={<DemandeRetrait />} />
            </Route>

            {/* ─── Livreur ────────────────────────────────────────────── */}
            <Route path='/livreur/mes-livraisons' element={<MesLivraisons />} />
            <Route path='/livreur/collectes' element={<Collectes />} />
            <Route path='/livreur/commande/:orderId' element={<LivraisonDetail />} />

            {/* ─── Assistant Shein ────────────────────────────────────── */}
            <Route path='/assistant/conversations' element={<Conversations />} />
            <Route path='/assistant/conversation/:id' element={<ChatDetail />} />

          </Routes>
        </Suspense>
      </div>

      {showFooter && <Footer />}
      {showBottomNav && <BottomNav />}
    </div>
  );
};

export default App;