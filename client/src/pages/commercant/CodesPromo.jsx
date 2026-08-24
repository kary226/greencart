import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { Tag, Plus, Edit, Trash2, Loader2, X, Save, Power, Percent, Coins, Package } from 'lucide-react';

const emptyForm = {
    code: '',
    discountType: 'percentage',
    discountValue: '',
    minPurchase: '',
    maxDiscount: '',
    startDate: '',
    endDate: '',
    usageLimit: '',
    usagePerUser: '1',
    eligibleProducts: [], // vide = valable sur tous les produits de la boutique
};

const getStatus = (coupon) => {
    const now = new Date();
    if (!coupon.isActive) return { label: 'Désactivé', style: 'bg-ink-100 text-ink-600' };
    if (now < new Date(coupon.startDate)) return { label: 'À venir', style: 'bg-warn-50 text-warn-500' };
    if (now > new Date(coupon.endDate)) return { label: 'Expiré', style: 'bg-ramses-100 text-ramses-700' };
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return { label: 'Épuisé', style: 'bg-orange-100 text-orange-700' };
    return { label: 'Actif', style: 'bg-ok-50 text-ok-500' };
};

const CodesPromo = () => {
    const { axios } = useAppContext();
    const { boutique } = useOutletContext();

    const [loading, setLoading] = useState(true);
    const [coupons, setCoupons] = useState([]);
    const [produits, setProduits] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);

    const loadCoupons = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/api/coupon/mes-coupons');
            if (data.success) setCoupons(data.coupons);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadCoupons(); }, []);

    useEffect(() => {
        if (!boutique) return;
        const loadProduits = async () => {
            try {
                const { data } = await axios.get(`/api/product/list?boutiqueId=${boutique._id}&limit=200`);
                if (data.success) setProduits(data.products || []);
            } catch (error) { console.error('Erreur chargement produits:', error); }
        };
        loadProduits();
    }, [boutique, axios]);

    const openAddForm = () => {
        setEditingId(null);
        setForm(emptyForm);
        setShowForm(true);
    };

    const openEditForm = (coupon) => {
        setEditingId(coupon._id);
        setForm({
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            minPurchase: coupon.minPurchase || '',
            maxDiscount: coupon.maxDiscount || '',
            startDate: coupon.startDate ? coupon.startDate.slice(0, 10) : '',
            endDate: coupon.endDate ? coupon.endDate.slice(0, 10) : '',
            usageLimit: coupon.usageLimit || '',
            usagePerUser: coupon.usagePerUser ?? '1',
            eligibleProducts: coupon.eligibleProducts || [],
        });
        setShowForm(true);
    };

    const toggleProduct = (id) => {
        setForm((prev) => ({
            ...prev,
            eligibleProducts: prev.eligibleProducts.includes(id)
                ? prev.eligibleProducts.filter((p) => p !== id)
                : [...prev.eligibleProducts, id],
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.code.trim() || !form.discountValue || !form.startDate || !form.endDate) {
            toast.error('Merci de remplir les champs obligatoires');
            return;
        }
        setSubmitting(true);
        try {
            const payload = { ...form, id: editingId };
            const url = editingId ? '/api/coupon/mes-coupons/update' : '/api/coupon/mes-coupons/add';
            const { data } = await axios.post(url, payload);
            if (data.success) {
                toast.success(editingId ? 'Code promo modifié' : 'Code promo créé');
                setShowForm(false);
                loadCoupons();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id, code) => {
        if (!window.confirm(`Supprimer le code "${code}" ?`)) return;
        try {
            const { data } = await axios.post('/api/coupon/mes-coupons/delete', { id });
            if (data.success) { toast.success('Code promo supprimé'); loadCoupons(); }
            else toast.error(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const handleToggle = async (coupon) => {
        try {
            const { data } = await axios.post('/api/coupon/mes-coupons/toggle', { id: coupon._id, isActive: !coupon.isActive });
            if (data.success) { loadCoupons(); }
            else toast.error(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-display text-2xl font-semibold text-ink-900">Codes promo</h1>
                    <p className="text-sm text-ink-400">Réductions valables sur votre boutique</p>
                </div>
                <button onClick={openAddForm} className="flex items-center gap-2 bg-ramses-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-ramses-700 transition">
                    <Plus size={16} /> Créer un code
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-ramses-600" size={32} /></div>
            ) : coupons.length === 0 ? (
                <div className="bg-white rounded-2xl border border-ink-200 p-14 text-center">
                    <Tag className="mx-auto text-ink-300 mb-3" size={40} />
                    <h3 className="text-base font-medium text-ink-800">Aucun code promo</h3>
                    <p className="text-sm text-ink-400 mt-1">Créez une réduction pour booster vos ventes</p>
                    <button onClick={openAddForm} className="mt-4 inline-flex items-center gap-2 bg-ramses-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-ramses-700 transition">
                        <Plus size={16} /> Créer un code
                    </button>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                    {coupons.map((coupon) => {
                        const status = getStatus(coupon);
                        return (
                            <div key={coupon._id} className="bg-white rounded-2xl border border-ink-200 p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-9 h-9 rounded-xl bg-ink-50 flex items-center justify-center text-ramses-600 shrink-0">
                                            {coupon.discountType === 'percentage' ? <Percent size={16} /> : <Coins size={16} />}
                                        </div>
                                        <div>
                                            <p className="font-mono font-bold text-ink-900 tracking-wide">{coupon.code}</p>
                                            <p className="text-xs text-ink-400">
                                                {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `${coupon.discountValue.toLocaleString()} FCFA`}
                                                {coupon.eligibleProducts?.length > 0 ? ` · ${coupon.eligibleProducts.length} produit(s)` : ' · toute la boutique'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${status.style}`}>{status.label}</span>
                                </div>

                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-50 text-xs text-ink-400">
                                    <span>
                                        {new Date(coupon.startDate).toLocaleDateString('fr-FR')} → {new Date(coupon.endDate).toLocaleDateString('fr-FR')}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleToggle(coupon)} title={coupon.isActive ? 'Désactiver' : 'Activer'} className="p-1.5 rounded-lg hover:bg-ink-100 transition">
                                            <Power size={14} className={coupon.isActive ? 'text-ok-500' : 'text-ink-400'} />
                                        </button>
                                        <button onClick={() => openEditForm(coupon)} className="p-1.5 rounded-lg hover:bg-ink-100 transition"><Edit size={14} className="text-ink-600" /></button>
                                        <button onClick={() => handleDelete(coupon._id, coupon.code)} className="p-1.5 rounded-lg hover:bg-ramses-50 transition"><Trash2 size={14} className="text-ramses-600" /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-30" onClick={() => setShowForm(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-ink-50 sticky top-0 bg-white">
                            <h2 className="font-display text-lg font-semibold text-ink-900">{editingId ? 'Modifier le code' : 'Nouveau code promo'}</h2>
                            <button onClick={() => setShowForm(false)} className="p-1 text-ink-400 hover:text-ink-700"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-ink-700 mb-1">Code</label>
                                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required placeholder="EX: PROMO10"
                                    className="w-full px-3.5 py-2.5 border border-ink-200 rounded-xl text-sm uppercase font-mono outline-none focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Type</label>
                                    <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                                        className="w-full px-3.5 py-2.5 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500">
                                        <option value="percentage">Pourcentage (%)</option>
                                        <option value="fixed">Montant fixe (FCFA)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Valeur</label>
                                    <input type="number" min="0" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} required
                                        className="w-full px-3.5 py-2.5 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Achat minimum (FCFA)</label>
                                    <input type="number" min="0" value={form.minPurchase} onChange={(e) => setForm({ ...form, minPurchase: e.target.value })}
                                        className="w-full px-3.5 py-2.5 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500" />
                                </div>
                                {form.discountType === 'percentage' && (
                                    <div>
                                        <label className="block text-sm font-medium text-ink-700 mb-1">Remise max (FCFA)</label>
                                        <input type="number" min="0" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                                            className="w-full px-3.5 py-2.5 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500" />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Date de début</label>
                                    <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required
                                        className="w-full px-3.5 py-2.5 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Date de fin</label>
                                    <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required
                                        className="w-full px-3.5 py-2.5 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Limite d'utilisation totale</label>
                                    <input type="number" min="1" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} placeholder="Illimité"
                                        className="w-full px-3.5 py-2.5 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink-700 mb-1">Utilisations / client</label>
                                    <input type="number" min="1" value={form.usagePerUser} onChange={(e) => setForm({ ...form, usagePerUser: e.target.value })}
                                        className="w-full px-3.5 py-2.5 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500" />
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-1.5 text-sm font-medium text-ink-700 mb-2">
                                    <Package size={15} /> Produits concernés
                                </label>
                                <p className="text-xs text-ink-400 mb-2">Aucune sélection = valable sur toute la boutique</p>
                                <div className="max-h-40 overflow-y-auto border border-ink-200 rounded-xl p-2 flex flex-wrap gap-2">
                                    {produits.length === 0 ? (
                                        <p className="text-xs text-ink-400 px-1 py-1">Aucun produit</p>
                                    ) : produits.map((p) => (
                                        <button type="button" key={p._id} onClick={() => toggleProduct(p._id)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                                                form.eligibleProducts.includes(p._id)
                                                    ? 'bg-ramses-600 border-ramses-600 text-white'
                                                    : 'bg-white border-ink-200 text-ink-600 hover:border-ramses-400'
                                            }`}
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-2 border-t border-ink-50">
                                <button disabled={submitting} className="flex items-center gap-2 bg-ramses-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-ramses-700 transition disabled:opacity-50">
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {editingId ? 'Enregistrer' : 'Créer'}
                                </button>
                                <button type="button" onClick={() => setShowForm(false)} className="flex items-center gap-2 bg-ink-100 text-ink-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-ink-200 transition">
                                    <X size={16} /> Annuler
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CodesPromo;