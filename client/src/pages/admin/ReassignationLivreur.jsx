import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { Search, Truck, Loader2, RefreshCw } from 'lucide-react';

/**
 * RÉASSIGNER UN LIVREUR (Admin Opérations / Logistique)
 * ================================================================
 * Par défaut, le livreur qui a collecté une commande est aussi celui qui
 * la livre (voir receptionnerColis). Cet écran couvre le cas où il faut
 * changer ça — le livreur d'origine n'est plus disponible pour la suite.
 *
 * Le point important, affiché explicitement : réassigner remet à zéro la
 * confirmation de remise (« Confirmer la remise » redevient nécessaire),
 * puisque le nouveau livreur n'a pas encore le colis en main.
 */

const STATUTS_INTERDITS = ['Delivered', 'Returned', 'Cancelled', 'pending_payment', 'Order Placed'];

const LABELS_STATUT = {
    'Checking Availability': 'Vérification',
    'Confirmed': 'Confirmée',
    'Collecting': 'Collecte en cours',
    'Ready for Shipment': 'Collecte terminée',
    'Shipped': 'Expédiée',
    'Out for Delivery': 'En livraison',
    'Disputed': 'Litige',
};

const ReassignationLivreur = () => {
    const { axios } = useAppContext();
    const [terme, setTerme] = useState('');
    const [resultats, setResultats] = useState([]);
    const [recherche, setRecherche] = useState(false);
    const [livreurs, setLivreurs] = useState([]);
    const [choixParCommande, setChoixParCommande] = useState({});
    const [enCours, setEnCours] = useState(null);

    useEffect(() => {
        axios.get('/api/order/admin/livreurs-actifs')
            .then(({ data }) => { if (data.success) setLivreurs(data.livreurs || []); })
            .catch((error) => toast.error(error.response?.data?.message || error.message));
    }, [axios]);

    const chercher = async (e) => {
        e.preventDefault();
        if (terme.trim().length < 3) {
            toast.error('Indique au moins 3 caractères (fin du numéro de commande)');
            return;
        }
        setRecherche(true);
        try {
            const { data } = await axios.get('/api/order/admin/recherche', { params: { q: terme.trim() } });
            if (data.success) setResultats(data.orders || []);
            else toast.error(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setRecherche(false);
        }
    };

    const assigner = async (orderId) => {
        const livreurId = choixParCommande[orderId];
        if (!livreurId) {
            toast.error('Choisis d\'abord un livreur');
            return;
        }
        setEnCours(orderId);
        try {
            const { data } = await axios.post('/api/order/admin/assigner-livreur', { orderId, livreurId });
            if (data.success) {
                toast.success(data.message || 'Livreur assigné');
                // On relance la même recherche pour rafraîchir l'affichage
                // (livreur actuel, remise réinitialisée).
                chercher({ preventDefault: () => {} });
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setEnCours(null);
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-4 sm:p-6 max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900">Réassigner un livreur</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Cherche une commande par la fin de son numéro pour changer le livreur qui doit la livrer.
                    Réassigner redemande une confirmation de remise — le nouveau livreur n'a pas encore le colis en main.
                </p>

                <form onSubmit={chercher} className="flex gap-2 mt-5">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={terme}
                            onChange={(e) => setTerme(e.target.value)}
                            placeholder="Ex : F7E6CD91"
                            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={recherche}
                        className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition disabled:opacity-50 flex items-center gap-2"
                    >
                        {recherche ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                        Chercher
                    </button>
                </form>

                <div className="space-y-3 mt-5">
                    {resultats.map((order) => {
                        const bloquee = STATUTS_INTERDITS.includes(order.status);
                        // [FIX] Depuis la décision du 06/09 (plus d'auto-
                        // assignation à la réception), collecteLivreurId ne
                        // veut plus dire "c'est lui qui livre" — juste "c'est
                        // lui qui a collecté". Les deux sont maintenant
                        // distingués pour ne pas induire en erreur.
                        const livreurLivraison = order.livreurId?.nom || null;
                        const nonPrisEnCharge = !order.livreurId && order.status === 'Shipped';

                        return (
                            <div key={order._id} className="bg-white rounded-2xl border border-gray-200 p-5">
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div>
                                        <p className="font-semibold text-gray-900">#{order._id.slice(-8).toUpperCase()}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {LABELS_STATUT[order.status] || order.status}
                                            {livreurLivraison && ` · Livreur actuel : ${livreurLivraison}`}
                                            {nonPrisEnCharge && ` · Disponible, pas encore pris en charge`}
                                            {order.livreurId && (
                                                order.remiseLivreurConfirmee
                                                    ? ' · Colis déjà remis'
                                                    : ' · Remise pas encore confirmée'
                                            )}
                                        </p>
                                    </div>

                                    {bloquee ? (
                                        <span className="text-xs text-gray-400 italic">
                                            Impossible à ce statut
                                        </span>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={choixParCommande[order._id] || ''}
                                                onChange={(e) => setChoixParCommande((prev) => ({ ...prev, [order._id]: e.target.value }))}
                                                className="px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none"
                                            >
                                                <option value="">Choisir un livreur…</option>
                                                {livreurs.map((l) => (
                                                    <option key={l._id} value={l._id}>{l.nom}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => assigner(order._id)}
                                                disabled={enCours === order._id}
                                                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition disabled:opacity-50 flex items-center gap-2 shrink-0"
                                            >
                                                {enCours === order._id ? <Loader2 size={15} className="animate-spin" /> : <Truck size={15} />}
                                                Assigner
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {!recherche && resultats.length === 0 && terme && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
                            Aucune commande trouvée pour "{terme}".
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReassignationLivreur;