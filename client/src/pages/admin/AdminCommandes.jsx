import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import AdminNav from './AdminNav';
import {
    PackageCheck, ShieldAlert, Loader2, CheckCircle2, AlertTriangle, Store,
} from 'lucide-react';

// Validation des commandes — l'étape qui rend l'argent des commerçants
// retirable.
//
// C'est le geste qui manquait à tout le circuit : sans lui, un colis peut
// rester confirmé par le commerçant sans que son solde ne devienne jamais
// disponible. Une commande peut mélanger plusieurs boutiques (ex : un
// article Boutique A + un article Boutique B dans le même panier) — chacune
// doit confirmer avant que l'admin ne libère les fonds, sauf cas de
// "forçage" explicite (commerçant injoignable, colis déjà parti malgré
// tout...).

const ONGLETS = [
    { value: 'pretes', label: 'Libérables' },
    { value: 'attente', label: 'En attente' },
    { value: 'toutes', label: 'Toutes' },
];

const AdminCommandes = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [authorized, setAuthorized] = useState(null);
    const [moi, setMoi] = useState(null);

    const [orders, setOrders] = useState([]);
    const [pretes, setPretes] = useState(0);
    const [loading, setLoading] = useState(true);
    const [onglet, setOnglet] = useState('pretes');
    const [actionEnCours, setActionEnCours] = useState(null);

    const charger = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/api/order/admin/a-valider');
            if (data.success) {
                setOrders(data.orders || []);
                setPretes(data.pretes || 0);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    }, [axios]);

    useEffect(() => {
        (async () => {
            try {
                // [RAMCI §16] On demande les DROITS, pas le rôle.
                // Commandes : Opérations, Support et Finance en ont besoin.
                // Le test précédent (`role in ['admin','super_admin']`)
                // refusait cet écran à des comptes que le serveur autorise :
                // l'utilisateur voyait « accès refusé » sans comprendre
                // pourquoi, puisque ses permissions étaient bonnes.
                const { data } = await axios.get('/api/console/mes-droits');
                const droits = data.permissions || [];
                const autorise = data.estArbitre
                    || droits.includes('admin.all')
                    || ['orders.view', 'orders.edit'].some((p) => droits.includes(p));

                if (data.success && autorise) {
                    setMoi(data);
                    setAuthorized(true);
                } else {
                    setAuthorized(false);
                }
            } catch (error) {
                console.error('Erreur vérification authentification admin:', error);
                setAuthorized(false);
            }
        })();
    }, [axios]);

    useEffect(() => { if (authorized) charger(); }, [authorized, charger]);

    const valider = async (orderId, forcer = false) => {
        setActionEnCours(orderId);
        try {
            const { data } = await axios.post('/api/order/admin/confirmer', { orderId, forcer });
            if (data.success) {
                toast.success(data.message);
                charger();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setActionEnCours(null);
        }
    };

    const filtrees = useMemo(() => {
        if (onglet === 'pretes') return orders.filter((o) => o.liberation?.eligible);
        if (onglet === 'attente') return orders.filter((o) => !o.liberation?.eligible);
        return orders;
    }, [orders, onglet]);

    if (authorized === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-ink-50">
                <Loader2 className="animate-spin text-ramses-600" size={28} />
            </div>
        );
    }

    if (authorized === false) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
                <div className="text-center max-w-sm">
                    <ShieldAlert size={44} className="text-ramses-600 mx-auto mb-3" />
                    <h1 className="text-lg font-bold text-ink-900">Accès refusé</h1>
                    <p className="text-sm text-ink-500 mt-1 mb-5">Cette page est réservée aux comptes admin.</p>
                    <button onClick={() => navigate('/staff/login')} className="px-4 py-2 bg-ramses-600 text-white rounded-xl text-sm font-medium hover:bg-ramses-700 transition">
                        Aller à la connexion
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ink-50">
            <AdminNav titre="Commandes à valider" sousTitre={`${moi?.nom || ''} · ${moi?.roleLibelle || ''}`} />

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                <div className="grid grid-cols-2 gap-3 max-w-md">
                    <div className={`bg-white rounded-2xl border p-4 ${pretes > 0 ? 'border-ok-500/40' : 'border-ink-100'}`}>
                        <div className="flex items-center gap-2 text-xs text-ink-400"><CheckCircle2 size={14} /> Prêtes à valider</div>
                        <p className={`text-2xl font-bold mt-1 ${pretes > 0 ? 'text-ok-500' : 'text-ink-700'}`}>{pretes}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-100 p-4">
                        <div className="flex items-center gap-2 text-xs text-ink-400"><PackageCheck size={14} /> Total en file</div>
                        <p className="text-2xl font-bold mt-1 text-ink-700">{orders.length}</p>
                    </div>
                </div>

                {pretes > 0 && (
                    <div className="bg-ok-50 border border-ok-500/30 rounded-2xl p-4 flex items-start gap-2.5">
                        <CheckCircle2 size={18} className="text-ok-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-ok-500">
                            {pretes} commande{pretes > 1 ? 's sont' : ' est'} livrée{pretes > 1 ? 's' : ''}, délai de sécurité écoulé et prête{pretes > 1 ? 's' : ''} à libérer.
                        </p>
                    </div>
                )}

                <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-ink-100 w-fit overflow-x-auto max-w-full">
                    {ONGLETS.map((o) => (
                        <button
                            key={o.value}
                            onClick={() => setOnglet(o.value)}
                            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                                onglet === o.value ? 'bg-ramses-600 text-white' : 'text-ink-500 hover:text-ink-800'
                            }`}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-2xl border border-ink-100 overflow-hidden">
                    {loading ? (
                        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-ramses-600" size={26} /></div>
                    ) : filtrees.length === 0 ? (
                        <div className="p-16 text-center text-sm text-ink-400">Aucune commande dans cette catégorie</div>
                    ) : (
                        <div className="divide-y divide-ink-50">
                            {filtrees.map((o) => (
                                <div key={o._id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                            <span className="font-semibold text-ink-900">#{o._id.slice(-6).toUpperCase()}</span>
                                            <span className="text-sm text-ink-600">{(o.amount || 0).toLocaleString('fr-FR')} FCFA</span>
                                            <span className="text-xs text-ink-400">{o.nombreArticles} article{o.nombreArticles > 1 ? 's' : ''}</span>
                                            {o.liberation?.eligible ? (
                                                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-ok-50 text-ok-500">
                                                    <CheckCircle2 size={12} /> Libérable
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-warn-50 text-warn-500">
                                                    <AlertTriangle size={12} /> {o.status === 'Delivered' ? 'Délai de sécurité' : o.status === 'Out for Delivery' ? 'En livraison' : 'Pas encore livrée'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-ink-400">{new Date(o.createdAt).toLocaleString('fr-FR')}</p>
                                        {o.boutiquesConfirmees.length > 0 && (
                                            <p className="text-xs text-ink-500 mt-1 flex items-center gap-1">
                                                <Store size={12} className="text-ok-500" /> Confirmé : {o.boutiquesConfirmees.join(', ')}
                                            </p>
                                        )}
                                        {o.boutiquesManquantes.length > 0 && (
                                            <p className="text-xs text-warn-500 mt-1 flex items-center gap-1">
                                                <Store size={12} /> En attente : {o.boutiquesManquantes.join(', ')}
                                            </p>
                                        )}
                                    </div>

                                    <div className="shrink-0">
                                        {o.liberation?.eligible ? (
                                            <button
                                                onClick={() => valider(o._id, false)}
                                                disabled={actionEnCours === o._id}
                                                className="px-4 py-2.5 rounded-xl bg-ok-500 text-white text-sm font-medium hover:bg-ok-600 transition disabled:opacity-50"
                                            >
                                                {actionEnCours === o._id ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Valider — libérer les fonds'}
                                            </button>
                                        ) : (
                                            <div className="text-right max-w-xs">
                                                <p className="text-xs font-medium text-ink-500">
                                                    {o.status === 'Delivered' && o.releaseEligibleAt
                                                        ? `Libérable le ${new Date(o.releaseEligibleAt).toLocaleString('fr-FR')}`
                                                        : o.status === 'Out for Delivery'
                                                            ? 'Colis récupéré — livraison en cours'
                                                            : o.status === 'Shipped'
                                                                ? 'Expédiée — attente de récupération'
                                                                : 'Attente de livraison'}
                                                </p>
                                                {o.toutesConfirmees && <p className="text-[11px] text-ink-400 mt-1">Boutiques confirmées</p>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default AdminCommandes;