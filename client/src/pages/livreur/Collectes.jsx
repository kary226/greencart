import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { PackageSearch, Loader2, CheckCircle2, Hand, Truck } from 'lucide-react';

export default function Collectes() {
  const { axios } = useAppContext();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    try { const {data}=await axios.get('/api/order/livreur/collectes'); if(data.success) setOrders(data.orders||[]); }
    catch(e){ toast.error(e.response?.data?.message||e.message); } finally { setLoading(false); }
  };
  useEffect(()=>{ load(); },[]);
  const reserve = async (id) => {
    try { const {data}=await axios.post(`/api/order/livreur/collectes/${id}/reserver`); if(data.success){setActive(data.order); toast.success('Collecte réservée. Elle disparaît des autres livreurs.'); await load();} }
    catch(e){ toast.error(e.response?.data?.message||e.message); }
  };
  const collect = async (itemId) => {
    if(!active) return;
    try { const {data}=await axios.post(`/api/order/livreur/collectes/${active._id}/items/${itemId}/collecter`); if(data.success){setActive(data.order); toast.success('Article collecté');} }
    catch(e){ toast.error(e.response?.data?.message||e.message); }
  };
  const finish = async () => {
    if(!active) return;
    try { const {data}=await axios.post(`/api/order/livreur/collectes/${active._id}/terminer`); if(data.success){toast.success('Collecte terminée, remise au Seller.'); setActive(null); await load();} }
    catch(e){ toast.error(e.response?.data?.message||e.message); }
  };
  const activeItems=(active?.items||[]).filter(i=>i.availabilityStatus!=='unavailable');
  const done=activeItems.length>0 && activeItems.every(i=>i.availabilityStatus==='collected');
  return <div className="min-h-screen bg-ivory-200 p-4 sm:p-6"><div className="max-w-4xl mx-auto">
    <div className="flex items-center justify-between mb-6"><div><h1 className="text-xl font-bold text-gray-800 flex items-center gap-2"><PackageSearch/> Collectes</h1><p className="text-sm text-gray-500">Réservez une commande puis collectez chaque article.</p></div><button onClick={()=>navigate('/livreur/mes-livraisons')} className="px-3 py-2 rounded-xl bg-white border text-sm flex items-center gap-2"><Truck size={15}/> Livraisons</button></div>
    {active && <div className="bg-white rounded-2xl border p-5 mb-6"><div className="flex justify-between items-center mb-4"><div><p className="font-bold">Collecte #{active._id.slice(-8).toUpperCase()}</p><p className="text-xs text-gray-500">Chaque article doit être collecté.</p></div><span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">Collecte en cours</span></div>{activeItems.map(i=><div key={i._id} className="flex items-center justify-between py-3 border-t"><div><p className="text-sm font-medium">{i.name||'Produit'} × {i.quantity}</p><p className="text-xs text-gray-500">{i.sku||''}</p></div>{i.availabilityStatus==='collected'?<span className="text-green-600 text-sm flex items-center gap-1"><CheckCircle2 size={16}/> Collecté</span>:<button onClick={()=>collect(i._id)} className="px-3 py-2 rounded-xl bg-burgundy-600 text-white text-sm flex items-center gap-1"><Hand size={15}/> Collecter</button>}</div>)}<button disabled={!done} onClick={finish} className="mt-5 w-full py-3 rounded-xl bg-green-600 text-white font-medium disabled:opacity-40">{done?'Terminer la collecte':'Collectez tous les articles'}</button></div>}
    {loading?<div className="py-16 text-center"><Loader2 className="animate-spin mx-auto"/></div>:orders.length===0?<div className="bg-white rounded-2xl border p-12 text-center text-gray-500">Aucune collecte disponible.</div>:<div className="grid gap-4">{orders.map(o=><div key={o._id} className="bg-white rounded-2xl border p-5"><div className="flex justify-between"><div><p className="font-semibold">Commande #{o._id.slice(-8).toUpperCase()}</p><p className="text-xs text-gray-500 mt-1">{o.items?.filter(i=>i.availabilityStatus!=='unavailable').length||0} article(s) à collecter</p></div><button onClick={()=>reserve(o._id)} className="px-4 py-2 rounded-xl bg-burgundy-600 text-white text-sm">Récupérer</button></div></div>)}</div>}
  </div></div>;
}
