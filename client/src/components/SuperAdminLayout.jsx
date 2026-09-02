import { useState, useEffect, useMemo } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import toast from "react-hot-toast";
// La table des espaces sert au menu ET à la garde des routes : une seule
// source, pour que masquer et interdire ne puissent pas diverger.
import { menuPour, droitsPourChemin, aLeDroit as compteALeDroit } from "../utils/espaces";
import {
    Menu, X as CloseIcon, LogOut, ListChecks, LayoutDashboard, ShoppingBag,
    PackageCheck, Truck, Tags, Users, Wallet, ShieldAlert, ScrollText,
    ShoppingCart, Settings, ChevronDown,
    ShieldX,
} from "lucide-react";

/** Le nom d'icône de la table est résolu ici : utils/espaces.js ne doit
    dépendre d'aucun composant, pour rester testable seul. */
const ICONES = {
    ListChecks, LayoutDashboard, ShoppingBag, PackageCheck, Truck,
    Tags, Users, Wallet, ShieldAlert, ScrollText, ShoppingCart, Settings,
};

/**
 * Console d'administration — ossature commune à tous les rôles.
 *
 * LE MENU EST CONSTRUIT DEPUIS LES PERMISSIONS, ENTRÉE PAR ENTRÉE.
 *
 * Auparavant, seule la RUBRIQUE était filtrée : ses sous-entrées
 * s'affichaient toutes dès que la rubrique passait. Deux conséquences,
 * l'une et l'autre constatées en croisant chaque rôle avec chaque écran :
 *
 *   · des écrans inatteignables — l'Admin Entrepôt avait le droit de
 *     scanner, mais l'entrepôt était rangé sous « Logistique », conditionnée
 *     à `deliveries.view` qu'il n'a pas ; l'Admin Finance ne pouvait
 *     atteindre ni le rapprochement ni les commandes à valider ;
 *
 *   · des liens morts — une rubrique ouverte sur une permission de lecture
 *     affichait des sous-entrées que le compte ne pouvait pas utiliser.
 *
 * Règle désormais : chaque entrée porte le droit qui la rend UTILE, et une
 * rubrique n'apparaît que si au moins une de ses entrées est visible.
 */

/**
 * Refus lisible plutôt qu'écran cassé. On ne renvoie pas vers l'accueil sans
 * rien dire : quelqu'un qui suit un lien reçu d'un collègue doit comprendre
 * pourquoi il n'entre pas, sinon il croit à une panne et recommence.
 */
const AccesRefuse = () => (
    <div className="grid place-items-center px-6 py-20">
        <div className="max-w-sm text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 grid place-items-center">
                <ShieldX size={22} className="text-gray-400" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">
                Cette page ne fait pas partie de votre espace
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Votre rôle ne couvre pas cet écran. Si vous en avez besoin pour
                votre travail, demandez au Super Admin de vérifier vos droits.
            </p>
            <Link
                to="/admin/console"
                className="inline-flex items-center h-10 px-4 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition"
            >
                Retour à mon espace
            </Link>
        </div>
    </div>
);

const SuperAdminLayout = () => {
    const { axios, navigate } = useAppContext();
    const location = useLocation();
    const [tiroirOuvert, setTiroirOuvert] = useState(false);
    const [staffUser, setStaffUser] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [roleLibelle, setRoleLibelle] = useState('');
    const [repliees, setRepliees] = useState({});
    const [chargement, setChargement] = useState(true);

    // Fermer le tiroir dès qu'on navigue
    useEffect(() => { setTiroirOuvert(false); }, [location.pathname]);

    // Empêcher le défilement derrière le tiroir
    useEffect(() => {
        document.body.style.overflow = tiroirOuvert ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [tiroirOuvert]);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axios.get('/api/staff/is-auth');
                if (data.success) setStaffUser(data.staffUser);

                // Les droits et le libellé viennent de /mes-droits, qui les
                // sert depuis configs/roles.js. On ne les lit plus sur
                // is-auth : cette réponse ne les portait pas, et le menu
                // restait vide pour tous les rôles hors Super Admin.
                const { data: droits } = await axios.get('/api/console/mes-droits');
                if (droits.success) {
                    setPermissions(droits.permissions || []);
                    setRoleLibelle(droits.roleLibelle || '');
                }
            } catch (error) {
                console.error('Erreur chargement staff:', error);
            } finally {
                setChargement(false);
            }
        })();
    }, [axios]);

    const menu = useMemo(
        () => menuPour(staffUser?.role, permissions),
        [permissions, staffUser?.role]
    );

    /**
     * La page demandée est-elle permise ?
     *
     * Masquer une rubrique ne protégeait rien : l'adresse restait tapable, et
     * l'écran s'affichait — vide ou en erreur, puisque le serveur refusait
     * ses données. On refuse maintenant franchement, avec un message qui dit
     * quoi faire plutôt qu'une page cassée.
     *
     * Tant que les droits ne sont pas chargés (`chargement`), on n'affiche ni
     * la page ni le refus : conclure trop tôt ferait clignoter un « accès
     * refusé » à quelqu'un de parfaitement autorisé.
     */
    const pagePermise = compteALeDroit(
        staffUser?.role,
        permissions,
        droitsPourChemin(location.pathname)
    );

    const estActive = (chemin) => {
        const base = chemin.split('?')[0];
        return location.pathname === base
            || (base !== '/admin/console' && location.pathname.startsWith(base + '/'));
    };

    const rubriqueActive = (rubrique) => rubrique.entrees
        ? rubrique.entrees.some((e) => estActive(e.chemin))
        : estActive(rubrique.chemin);

    const seDeconnecter = async () => {
        try {
            await axios.get('/api/staff/logout');
            toast.success('Déconnexion réussie');
            navigate('/staff/login');
        } catch (error) {
            toast.error(error.message);
        }
    };

    const initiales = (staffUser?.nom || '?')
        .split(' ').filter(Boolean).slice(0, 2)
        .map((mot) => mot[0].toUpperCase()).join('');

    /** Identité : en en-tête sur grand écran, en tête du tiroir sur mobile. */
    const Identite = () => (
        <div className="flex items-center gap-2.5 min-w-0">
            <div
                className="w-9 h-9 shrink-0 bg-red-500 rounded-full grid place-items-center text-white font-semibold text-sm"
                title={staffUser?.nom || ''}
            >
                {initiales}
            </div>
            <div className="min-w-0 leading-tight">
                <p className="text-sm font-medium text-gray-800 truncate">{staffUser?.nom || ''}</p>
                <p className="text-[11px] text-gray-500 truncate">{roleLibelle || staffUser?.role || ''}</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">

            {/* ── En-tête ─────────────────────────────────────────────── */}
            <header className="sticky top-0 z-30 flex items-center justify-between gap-2 px-3 sm:px-6 py-3 bg-white border-b border-gray-200">
                <div className="flex items-center gap-2 min-w-0">
                    <button
                        onClick={() => setTiroirOuvert(true)}
                        className="lg:hidden shrink-0 w-10 h-10 grid place-items-center rounded-xl text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition -ml-1"
                        aria-label="Ouvrir le menu"
                    >
                        <Menu size={21} />
                    </button>
                    <Link to="/" className="shrink-0" aria-label="Retour à la boutique">
                        <img src="/logo.png" alt="RAMCI" className="h-6 sm:h-7 w-auto" />
                    </Link>
                    <span className="hidden md:block text-sm font-semibold text-gray-700 ml-1">
                        Console
                    </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {/* Sous sm, l'identité est reprise en tête du tiroir —
                        là où il y a la place de la lire. */}
                    <div className="hidden sm:block"><Identite /></div>
                    <button
                        onClick={seDeconnecter}
                        className="flex items-center gap-2 px-3 sm:px-4 h-10 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 active:bg-gray-300 transition"
                    >
                        <LogOut size={16} />
                        <span className="hidden sm:inline">Déconnexion</span>
                    </button>
                </div>
            </header>

            <div className="flex">
                {tiroirOuvert && (
                    <div
                        className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                        onClick={() => setTiroirOuvert(false)}
                        aria-hidden="true"
                    />
                )}

                {/* ── Menu latéral ────────────────────────────────────── */}
                <aside
                    className={`
                        fixed lg:sticky inset-y-0 lg:top-[65px] left-0 z-40 lg:z-0
                        w-[17rem] lg:w-64 shrink-0 bg-white border-r border-gray-200
                        h-dvh lg:h-[calc(100dvh-65px)] flex flex-col
                        transition-transform duration-200 ease-out
                        ${tiroirOuvert ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
                    `}
                >
                    <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 lg:hidden">
                        <Identite />
                        <button
                            onClick={() => setTiroirOuvert(false)}
                            className="w-9 h-9 shrink-0 grid place-items-center rounded-xl text-gray-500 hover:bg-gray-100 transition"
                            aria-label="Fermer le menu"
                        >
                            <CloseIcon size={18} />
                        </button>
                    </div>

                    <nav className="flex-1 py-3 px-2 overflow-y-auto overscroll-contain">
                        {menu.map((rubrique) => {
                            const Icone = ICONES[rubrique.icone];

                            if (!rubrique.entrees) {
                                return (
                                    <NavLink
                                        key={rubrique.chemin}
                                        to={rubrique.chemin}
                                        className={({ isActive }) => `
                                            flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium transition
                                            ${isActive ? "bg-red-50 text-red-600" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}
                                        `}
                                    >
                                        <Icone size={18} className="shrink-0" />
                                        <span className="truncate">{rubrique.titre}</span>
                                    </NavLink>
                                );
                            }

                            const repliee = repliees[rubrique.titre];
                            const active = rubriqueActive(rubrique);

                            return (
                                <div key={rubrique.titre} className="mb-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setRepliees((r) => ({ ...r, [rubrique.titre]: !r[rubrique.titre] }))}
                                        aria-expanded={!repliee}
                                        className={`
                                            w-full flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium transition
                                            ${active ? "text-red-600" : "text-gray-600 hover:bg-gray-50"}
                                        `}
                                    >
                                        <Icone size={18} className="shrink-0" />
                                        <span className="truncate flex-1 text-left">{rubrique.titre}</span>
                                        <ChevronDown
                                            size={15}
                                            className={`shrink-0 text-gray-400 transition-transform ${repliee ? '-rotate-90' : ''}`}
                                        />
                                    </button>

                                    {!repliee && (
                                        <div className="mt-0.5 mb-1 ml-[1.4rem] pl-3 border-l border-gray-200 space-y-0.5">
                                            {rubrique.entrees.map((entree) => (
                                                <NavLink
                                                    key={entree.chemin}
                                                    to={entree.chemin}
                                                    className={({ isActive }) => `
                                                        block px-3 h-9 leading-9 rounded-lg text-[13px] truncate transition
                                                        ${isActive
                                                            ? "bg-red-50 text-red-600 font-medium"
                                                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}
                                                    `}
                                                >
                                                    {entree.label}
                                                </NavLink>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>

                    <div className="px-4 py-3 border-t border-gray-100 text-[11px] text-gray-400">
                        {roleLibelle || staffUser?.role || ''}
                    </div>
                </aside>

                {/* ── Contenu ─────────────────────────────────────────── */}
                <main className="flex-1 min-w-0">
                    {chargement ? null : pagePermise ? <Outlet /> : <AccesRefuse />}
                </main>
            </div>
        </div>
    );
};

export default SuperAdminLayout;
