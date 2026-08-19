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
            case 'vente': return <TrendingUp size={16} className="text-ok-500" />;
            case 'retrait': return <TrendingDown size={16} className="text-ramses-600" />;
            case 'ajustement': return <Clock size={16} className="text-warn-500" />;
            default: return <Clock size={16} className="text-ink-400" />;
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
                <Loader2 className="animate-spin text-ramses-600" size={28} />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-2xl font-semibold text-ink-900">Portefeuille</h1>
                <Link to="/commercant/retraits" className="text-sm font-medium text-ramses-700 hover:underline">
                    Demander un retrait
                </Link>
            </div>

            <div className="bg-gradient-to-br from-ramses-600 to-ramses-800 rounded-2xl p-6 mb-6">
                <p className="text-ink-200 text-sm">Solde disponible</p>
                <p className="text-3xl font-bold text-white mt-1">{wallet?.solde?.toLocaleString() || 0} FCFA</p>
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
                            {transactions.map((tx) => (
                                <div key={tx._id} className="px-6 py-3.5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-ink-50">{getTransactionIcon(tx.type)}</div>
                                        <div>
                                            <p className="text-sm font-medium text-ink-800">{getTransactionLabel(tx.type)}</p>
                                            <p className="text-xs text-ink-400">{new Date(tx.createdAt).toLocaleString('fr-FR')}</p>
                                            <p className="text-xs text-ink-400 truncate max-w-[200px]">{tx.description}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-bold ${tx.montant > 0 ? 'text-ok-500' : 'text-ramses-600'}`}>
                                            {tx.montant > 0 ? '+' : ''}{tx.montant.toLocaleString()} FCFA
                                        </p>
                                        <p className="text-xs text-ink-400">Solde : {tx.soldeApres?.toLocaleString()} FCFA</p>
                                    </div>
                                </div>
                            ))}
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