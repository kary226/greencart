import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Search, Loader2, ChevronLeft, ChevronRight, RefreshCw,
    Coins, User, Mail, Phone
} from 'lucide-react';

const Rcoins = () => {
    const { axios } = useAppContext();
    const [balances, setBalances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalEnCirculation, setTotalEnCirculation] = useState(0);

    const fetchBalances = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: itemsPerPage,
            });
            if (searchTerm) params.append('search', searchTerm);

            const { data } = await axios.get(`/api/admin/rcoins?${params}`);
            if (data.success) {
                setBalances(data.balances || []);
                setTotalPages(data.pagination?.totalPages || 1);
                setTotal(data.pagination?.total || 0);
                setTotalEnCirculation(data.totalEnCirculation || 0);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBalances();
    }, [currentPage, searchTerm]);

    const StatCard = ({ icon: Icon, label, value, color = 'gray' }) => (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2">
                <Icon size={16} className={`text-${color}-500`} />
                <span className="text-xs text-gray-500">{label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
    );

    if (loading && balances.length === 0) {
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
                        <h1 className="text-2xl font-bold text-gray-900">RCOINS — Solde clients</h1>
                        <p className="text-sm text-gray-500 mt-1">{total} client(s) avec un solde</p>
                    </div>
                </div>

                {/* Statistiques */}
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3 mt-5">
                    <StatCard icon={User} label="Clients avec solde" value={total} color="blue" />
                    <StatCard icon={Coins} label="RCOINS en circulation" value={totalEnCirculation.toLocaleString('fr-FR')} color="yellow" />
                </div>

                {/* Filtres */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-5">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Rechercher par nom, email ou téléphone..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-gray-400 outline-none text-sm"
                            />
                        </div>
                        <button onClick={fetchBalances} className="px-3.5 py-2.5 bg-gray-100 rounded-xl text-sm hover:bg-gray-200 transition">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                {/* Liste */}
                {balances.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 mt-5">
                        <Coins size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">Aucun client avec un solde RCOINS</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-5">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Téléphone</th>
                                        <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Solde RCOINS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {balances.map((client) => (
                                        <tr key={client._id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{client.name || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Mail size={13} className="text-gray-400" /> {client.email || '—'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Phone size={13} className="text-gray-400" /> {client.phone || '—'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="inline-flex items-center gap-1.5 font-bold text-yellow-600">
                                                    <Coins size={14} /> {client.creditBalance.toLocaleString('fr-FR')}
                                                </span>
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

export default Rcoins;