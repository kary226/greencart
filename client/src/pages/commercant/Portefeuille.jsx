import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { Wallet, TrendingUp, TrendingDown, Clock, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

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

    const getTransactionIcon = (type) => {
        switch (type) {
            case 'vente': return <TrendingUp size={16} className="text-green-600" />;
            case 'retrait': return <TrendingDown size={16} className="text-red-600" />;
            case 'ajustement': return <Clock size={16} className="text-amber-600" />;
            default: return <Clock size={16} className="text-gray-400" />;
        }
    };

    const getTransactionLabel = (type) => {
        switch (type) {
            case 'vente': return 'Vente';
            case 'retrait': return 'Retrait';
            case 'ajustement': return 'Ajustement';
            default: return type;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-24">
                <Loader2 className="animate-spin text-burgundy-600" size={28} />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-2xl font-semibold text-gray-900">Portefeuille</h1>
                <Link to="/commercant/retraits" className="text-sm font-medium text-burgundy-700 hover:underline">
                    Demander un retrait
                </Link>
            </div>

            <div className="bg-gradient-to-br from-burgundy-600 to-burgundy-800 rounded-2xl p-6 mb-6">
                <p className="text-blush-200 text-sm">Solde disponible</p>
                <p className="text-3xl font-bold text-white mt-1">{wallet?.solde?.toLocaleString() || 0} FCFA</p>
            </div>

            <div className="bg-white rounded-2xl border border-blush-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-blush-100">
                    <h2 className="font-semibold text-gray-900">Historique des transactions ({totalItems})</h2>
                </div>
                {transactions.length === 0 ? (
                    <div className="p-10 text-center text-sm text-gray-400">Aucune transaction pour le moment</div>
                ) : (
                    <>
                        <div className="divide-y divide-blush-100">
                            {transactions.map((tx) => (
                                <div key={tx._id} className="px-6 py-3.5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-blush-100">{getTransactionIcon(tx.type)}</div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{getTransactionLabel(tx.type)}</p>
                                            <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleString('fr-FR')}</p>
                                            <p className="text-xs text-gray-400 truncate max-w-[200px]">{tx.description}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-bold ${tx.montant > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {tx.montant > 0 ? '+' : ''}{tx.montant.toLocaleString()} FCFA
                                        </p>
                                        <p className="text-xs text-gray-400">Solde : {tx.soldeApres?.toLocaleString()} FCFA</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-blush-100 flex items-center justify-between">
                                <p className="text-sm text-gray-400">Page {page} sur {totalPages}</p>
                                <div className="flex gap-1">
                                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-xl border border-blush-200 hover:bg-blush-100 disabled:opacity-50 transition"><ChevronLeft size={18} /></button>
                                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-xl border border-blush-200 hover:bg-blush-100 disabled:opacity-50 transition"><ChevronRight size={18} /></button>
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