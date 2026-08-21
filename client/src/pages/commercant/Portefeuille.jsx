import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Wallet, TrendingUp, TrendingDown, Clock, Loader2, ChevronLeft, ChevronRight,
    RotateCcw, XCircle, ArrowRightLeft, Info,
} from 'lucide-react';

// Configuration d'affichage par type de transaction.
//
// 'retour' est délibérément traité à part : c'est le seul type qui peut
// mettre le solde en négatif (un colis revient après que le commerçant a
// déjà retiré l'argent), donc c'est le seul qui a vraiment besoin d'attirer
// l'œil — d'où le rouge et l'icône dédiée, plutôt que le rouge générique
// utilisé pour tout montant négatif (un retrait normal est aussi négatif,
// mais n'a rien d'anormal).
const TYPE_CONFIG = {
    vente: { label: 'Vente', icon: TrendingUp, className: 'text-ok-500 bg-ok-50' },
    liberation: { label: 'Fonds libérés', icon: ArrowRightLeft, className: 'text-blue-600 bg-blue-50' },
    retrait: { label: 'Retrait', icon: TrendingDown, className: 'text-ink-600 bg-ink-100' },
    ajustement: { label: 'Ajustement', icon: Clock, className: 'text-warn-500 bg-warn-50' },
    annulation: { label: 'Commande annulée', icon: XCircle, className: 'text-ink-500 bg-ink-100' },
    retour: { label: 'Colis retour', icon: RotateCcw, className: 'text-ramses-700 bg-ramses-50' },
};

const Portefeuille = () => {
    const { axios } = useAppContext();

    const [loading, setLoading] = useState(true);
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const loadWallet = async () => {
        setLoading(true);
        try {
            const [walletRes, transactionsRes] = await Promise.all([
                axios.get('/api/wallet/moi'),
                axios.get(`/api/wallet/moi/transactions?page=${page}&limit=20`),
            ]);
            if (walletRes.data.success) setWallet(walletRes.data.wallet);
            if (transactionsRes.data.success) {
                setTransactions(transactionsRes.data.transactions);
                setTotalItems(transactionsRes.data.pagination?.total || 0);
                setTotalPages(transactionsRes.data.pagination?.totalPages || 1);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadWallet(); }, [page]);

    if (loading) {
        return (
            <div className="flex justify-center py-24">
                <Loader2 className="animate-spin text-ramses-600" size={28} />
            </div>
        );
    }

    const soldeNegatif = (wallet?.solde ?? 0) < 0;

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-2xl font-semibold text-ink-900">Portefeuille</h1>
                <Link to="/commercant/retraits" className="text-sm font-medium text-ramses-700 hover:underline">
                    Demander un retrait
                </Link>
            </div>

            {/* Deux soldes, côte à côte : ce qui est retirable maintenant, et
                ce qui arrive mais attend encore la validation admin. Les
                confondre en un seul chiffre laisserait croire au commerçant
                qu'il peut retirer plus qu'il ne peut réellement. */}
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className={`rounded-2xl p-6 ${soldeNegatif ? 'bg-gradient-to-br from-ramses-700 to-ramses-900' : 'bg-gradient-to-br from-ramses-600 to-ramses-800'}`}>
                    <p className="text-ink-200 text-sm">Solde disponible</p>
                    <p className="text-3xl font-bold text-white mt-1">{(wallet?.solde ?? 0).toLocaleString('fr-FR')} FCFA</p>
                    {soldeNegatif && (
                        <p className="text-ink-200/90 text-xs mt-2 flex items-start gap-1.5">
                            <Info size={13} className="shrink-0 mt-0.5" />
                            Solde négatif suite à un retour après retrait — il se résorbe avec tes prochaines ventes.
                        </p>
                    )}
                </div>
                <div className="rounded-2xl p-6 bg-white border border-ink-200">
                    <p className="text-ink-400 text-sm">En attente de validation</p>
                    <p className="text-3xl font-bold text-ink-900 mt-1">{(wallet?.soldeEnAttente ?? 0).toLocaleString('fr-FR')} FCFA</p>
                    <p className="text-ink-400 text-xs mt-2">Crédité à la commande, pas encore retirable.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-ink-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-ink-50">
                    <h2 className="font-semibold text-ink-900">Historique des transactions ({totalItems})</h2>
                </div>
                {transactions.length === 0 ? (
                    <div className="p-10 text-center text-sm text-ink-400">Aucune transaction pour le moment</div>
                ) : (
                    <>
                        <div className="divide-y divide-ink-50">
                            {transactions.map((tx) => {
                                const cfg = TYPE_CONFIG[tx.type] || TYPE_CONFIG.ajustement;
                                const Icon = cfg.icon;
                                const estRetour = tx.type === 'retour';
                                return (
                                    <div key={tx._id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`p-2 rounded-xl shrink-0 ${cfg.className}`}><Icon size={16} /></div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-ink-800">{cfg.label}</p>
                                                <p className="text-xs text-ink-400">{new Date(tx.createdAt).toLocaleString('fr-FR')}</p>
                                                <p className="text-xs text-ink-400 truncate max-w-[220px]">{tx.description}</p>
                                                {/* Rappel de la commission sur les ventes : évite que le
                                                    commerçant pense qu'on lui a "pris" de l'argent — le
                                                    montant crédité a toujours été net dès le départ. */}
                                                {tx.type === 'vente' && tx.montantBrut ? (
                                                    <p className="text-[11px] text-ink-400 mt-0.5">
                                                        Prix affiché {tx.montantBrut.toLocaleString('fr-FR')} FCFA · commission {tx.commission?.toLocaleString('fr-FR')} FCFA
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={`text-sm font-bold ${estRetour ? 'text-ramses-600' : tx.montant > 0 ? 'text-ok-500' : 'text-ink-600'}`}>
                                                {tx.montant > 0 ? '+' : ''}{tx.montant.toLocaleString('fr-FR')} FCFA
                                            </p>
                                            <p className="text-xs text-ink-400">Solde : {tx.soldeApres?.toLocaleString('fr-FR')} FCFA</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-ink-50 flex items-center justify-between">
                                <p className="text-sm text-ink-400">Page {page} sur {totalPages}</p>
                                <div className="flex gap-1">
                                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-xl border border-ink-200 hover:bg-ink-50 disabled:opacity-50 transition"><ChevronLeft size={18} /></button>
                                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-xl border border-ink-200 hover:bg-ink-50 disabled:opacity-50 transition"><ChevronRight size={18} /></button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Portefeuille;