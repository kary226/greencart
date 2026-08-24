import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Search, Loader2, ChevronLeft, ChevronRight, RefreshCw,
    Coins, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';

const RcoinsTransactions = () => {
    const { axios } = useAppContext();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: itemsPerPage,
            });
            if (filter !== 'all') params.append('type', filter);

            const { data } = await axios.get(`/api/admin/rcoins/transactions?${params}`);
            if (data.success) {
                setTransactions(data.transactions || []);
                setTotalPages(data.pagination?.totalPages || 1);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [currentPage, filter]);

    if (loading && transactions.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-red-500 mx-auto" size={32} />
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-4 sm:p-6 max-w-7xl mx-auto">
                {/* En-tête */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">RCOINS — Transactions</h1>
                        <p className="text-sm text-gray-500 mt-1">{total} transaction(s)</p>
                    </div>
                </div>

                {/* Filtres */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-5">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <select
                            value={filter}
                            onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
                            className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none bg-white"
                        >
                            <option value="all">Tous les types</option>
                            <option value="credit">Crédits</option>
                            <option value="debit">Débits</option>
                        </select>
                        <button onClick={fetchTransactions} className="px-3.5 py-2.5 bg-gray-100 rounded-xl text-sm hover:bg-gray-200 transition">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                {/* Liste */}
                {transactions.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 mt-5">
                        <Coins size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">Aucune transaction</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-5">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Commande</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {transactions.map((tx) => (
                                        <tr key={tx._id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 text-sm">
                                                <div className="font-medium text-gray-900">{tx.userId?.name || '—'}</div>
                                                <div className="text-xs text-gray-500">{tx.userId?.email || ''}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {tx.type === 'credit' ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700">
                                                        <ArrowUpCircle size={13} /> Crédit
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-700">
                                                        <ArrowDownCircle size={13} /> Débit
                                                    </span>
                                                )}
                                            </td>
                                            <td className={`px-6 py-4 text-right text-sm font-bold ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                                {tx.type === 'credit' ? '+' : '-'}{tx.amount.toLocaleString('fr-FR')}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-sm text-gray-600">
                                                {tx.orderId?._id ? `#${tx.orderId._id.slice(-6).toUpperCase()}` : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 max-w-[220px] truncate">
                                                {tx.description || '—'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-5">
                        <p className="text-sm text-gray-500">Page {currentPage} / {totalPages}</p>
                        <div className="flex gap-1.5">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
                                <ChevronLeft size={16} />
                            </button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RcoinsTransactions;