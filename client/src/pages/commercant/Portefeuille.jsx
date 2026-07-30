import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { Wallet, TrendingUp, TrendingDown, Clock, Loader2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

const Portefeuille = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

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
            <div className="min-h-screen bg-ivory-200 flex items-center justify-center">
                <Loader2 className="animate-spin text-burgundy-600" size={40} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ivory-200">
            <div className="bg-burgundy-600 text-ivory-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Wallet size={24} />
                            <div><h1 className="text-lg font-bold">Portefeuille</h1><p className="text-sm text-blush-300">Gérez vos finances</p></div>
                        </div>
                        <button onClick={() => navigate('/commercant/retraits')} className="flex items-center gap-2 bg-blush-200 text-burgundy-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blush-300 transition">
                            Demander un retrait
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6">
                <div className="bg-gradient-to-r from-burgundy-600 to-burgundy-800 rounded-xl shadow-lg p-6 mb-6">
                    <p className="text-blush-300 text-sm">Solde disponible</p>
                    <p className="text-3xl font-bold text-ivory-200 mt-1">{wallet?.solde?.toLocaleString() || 0} FCFA</p>
                    <p className="text-blush-300 text-xs mt-2">Dernière mise à jour : {new Date().toLocaleString('fr-FR')}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button onClick={() => navigate('/commercant/retraits')} className="bg-white border border-blush-300 rounded-xl p-4 text-center hover:shadow-md transition hover:border-burgundy-400">
                        <TrendingDown className="mx-auto text-amber-600 mb-1" size={24} />
                        <p className="text-sm font-medium text-gray-700">Retirer</p>
                    </button>
                    <button onClick={() => navigate('/commercant/commandes')} className="bg-white border border-blush-300 rounded-xl p-4 text-center hover:shadow-md transition hover:border-burgundy-400">
                        <Eye className="mx-auto text-blue-600 mb-1" size={24} />
                        <p className="text-sm font-medium text-gray-700">Voir mes commandes</p>
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-blush-300 overflow-hidden">
                    <div className="px-6 py-4 border-b border-blush-200"><h2 className="font-semibold text-gray-800">📋 Historique des transactions ({totalItems})</h2></div>
                    {transactions.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">Aucune transaction pour le moment</div>
                    ) : (
                        <>
                            <div className="divide-y divide-blush-200">
                                {transactions.map((tx) => (
                                    <div key={tx._id} className="px-6 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-blush-200">{getTransactionIcon(tx.type)}</div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{getTransactionLabel(tx.type)}</p>
                                                <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleString('fr-FR')}</p>
                                                <p className="text-xs text-gray-400 truncate max-w-[150px]">{tx.description}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-bold ${tx.montant > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {tx.montant > 0 ? '+' : ''}{tx.montant.toLocaleString()} FCFA
                                            </p>
                                            <p className="text-xs text-gray-400">Solde: {tx.soldeApres?.toLocaleString()} FCFA</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {totalPages > 1 && (
                                <div className="px-6 py-4 border-t border-blush-200 flex items-center justify-between">
                                    <p className="text-sm text-gray-500">Page {page} sur {totalPages}</p>
                                    <div className="flex gap-1">
                                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-blush-300 hover:bg-blush-200 disabled:opacity-50 transition"><ChevronLeft size={18} /></button>
                                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-blush-300 hover:bg-blush-200 disabled:opacity-50 transition"><ChevronRight size={18} /></button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Portefeuille;