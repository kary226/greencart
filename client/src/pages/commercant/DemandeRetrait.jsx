import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Send, Loader2, Clock, CheckCircle2, XCircle, Wallet,
    ShieldCheck, ExternalLink, Info,
} from 'lucide-react';

// Demande de retrait — commerçant.
//
// Le circuit est semi-automatique : Jèko (le prestataire de paiement du
// site) ne propose aucune API de versement, donc le virement final est
// exécuté à la main par l'admin. Ce qui EST automatique et immédiat :
//   - la réservation des fonds (débit du solde dès la demande) ;
//   - la protection contre le double retrait (clé d'idempotence ci-dessous).
//
// CLÉ D'IDEMPOTENCE : générée une seule fois par intention de retrait, et
// réutilisée telle quelle si la requête échoue et qu'on retente (perte
// réseau, timeout...). Le serveur reconnaît la clé et renvoie la demande
// déjà créée au lieu d'en ouvrir une seconde. Une nouvelle clé n'est
// générée qu'après un succès, ou si le commerçant modifie le formulaire.
const nouvelleCle = () => (
    window.crypto?.randomUUID ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

const STATUTS = {
    en_attente: { label: 'En attente', className: 'bg-warn-50 text-warn-500', icon: Clock, desc: 'Fonds réservés, en attente de traitement.' },
    en_cours: { label: 'Virement en cours', className: 'bg-blue-100 text-blue-700', icon: Send, desc: 'Le virement est en cours d\'exécution.' },
    payee: { label: 'Payée', className: 'bg-ok-50 text-ok-500', icon: CheckCircle2, desc: 'Argent envoyé.' },
    rejetee: { label: 'Rejetée', className: 'bg-ramses-100 text-ramses-700', icon: XCircle, desc: 'Fonds restitués à ton portefeuille.' },
};

const DemandeRetrait = () => {
    const { axios } = useAppContext();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [wallet, setWallet] = useState(null);
    const [demandes, setDemandes] = useState([]);
    const [operateurs, setOperateurs] = useState([]);

    const [formData, setFormData] = useState({ montant: '', operateur: '', numero: '', titulaire: '' });
    const cleIdempotenceRef = useRef(nouvelleCle());

    const demandeEnCours = useMemo(
        () => demandes.find((d) => ['en_attente', 'en_cours'].includes(d.statut)),
        [demandes]
    );

    const loadData = async () => {
        setLoading(true);
        try {
            const [walletRes, demandesRes, operateursRes] = await Promise.all([
                axios.get('/api/wallet/moi'),
                axios.get('/api/retraits/moi'),
                axios.get('/api/retraits/operateurs'),
            ]);
            if (walletRes.data.success) setWallet(walletRes.data.wallet);
            if (demandesRes.data.success) setDemandes(demandesRes.data.demandes);
            if (operateursRes.data.success) setOperateurs(operateursRes.data.operateurs);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // Toute modification volontaire du formulaire = nouvelle intention de
    // retrait = nouvelle clé. On ne garde la même clé que pour rejouer
    // EXACTEMENT la même requête après un échec réseau.
    const majChamp = (champ, valeur) => {
        setFormData((f) => ({ ...f, [champ]: valeur }));
        cleIdempotenceRef.current = nouvelleCle();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const montant = parseInt(formData.montant, 10);
        if (!montant || montant < 1000) { toast.error('Le montant minimum est de 1000 FCFA'); return; }
        if (wallet && montant > wallet.solde) { toast.error('Montant supérieur à ton solde disponible'); return; }
        if (!formData.operateur) { toast.error('Choisis un opérateur Mobile Money'); return; }
        const numeroPropre = formData.numero.replace(/\s/g, '');
        if (!/^\d{10}$/.test(numeroPropre)) { toast.error('Numéro invalide — 10 chiffres attendus'); return; }

        setSubmitting(true);
        try {
            const { data } = await axios.post('/api/retraits', {
                montant,
                operateur: formData.operateur,
                numero: numeroPropre,
                titulaire: formData.titulaire.trim(),
                cleIdempotence: cleIdempotenceRef.current,
            });
            if (data.success) {
                toast.success(data.rejeu ? 'Cette demande était déjà enregistrée' : 'Demande envoyée — fonds réservés');
                setFormData({ montant: '', operateur: '', numero: '', titulaire: '' });
                cleIdempotenceRef.current = nouvelleCle(); // succès -> prochaine demande, nouvelle clé
                loadData();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            // Échec réseau : on NE régénère PAS la clé, pour que le prochain
            // clic rejoue la même demande plutôt que d'en créer une seconde.
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-ramses-600" size={28} /></div>;
    }

    return (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
            <h1 className="font-display text-2xl font-semibold text-ink-900 mb-6">Demandes de retrait</h1>

            <div className="bg-gradient-to-br from-ramses-600 to-ramses-800 rounded-2xl p-5 mb-6 flex items-center justify-between">
                <div>
                    <p className="text-ink-200 text-sm">Solde disponible</p>
                    <p className="text-2xl font-bold text-white">{(wallet?.solde ?? 0).toLocaleString('fr-FR')} FCFA</p>
                    {wallet?.soldeEnAttente > 0 && (
                        <p className="text-ink-200/80 text-xs mt-1">
                            + {wallet.soldeEnAttente.toLocaleString('fr-FR')} FCFA en attente de validation
                        </p>
                    )}
                </div>
                <Wallet size={30} className="text-ink-200/60" />
            </div>

            {demandeEnCours ? (
                <div className="bg-white rounded-2xl border border-ink-200 p-6 mb-6 text-center">
                    {(() => {
                        const s = STATUTS[demandeEnCours.statut];
                        const Icon = s.icon;
                        return (
                            <>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${s.className}`}>
                                    <Icon size={22} />
                                </div>
                                <p className="font-semibold text-ink-900">{demandeEnCours.montant.toLocaleString('fr-FR')} FCFA — {s.label}</p>
                                <p className="text-sm text-ink-500 mt-1">{s.desc}</p>
                                <p className="text-xs text-ink-400 mt-3">Une seule demande à la fois — la suivante sera possible une fois celle-ci traitée.</p>
                            </>
                        );
                    })()}
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-ink-200 p-6 mb-6">
                    <h2 className="font-semibold text-ink-900 mb-1">Nouvelle demande</h2>
                    <p className="text-xs text-ink-400 mb-4 flex items-center gap-1.5">
                        <ShieldCheck size={13} className="text-ok-500" /> Montant net — la commission plateforme est déjà déduite de ton solde.
                    </p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-ink-700 mb-1">Montant (FCFA)</label>
                            <input
                                type="number" min="1000" step="100" value={formData.montant}
                                onChange={(e) => majChamp('montant', e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-ink-200 focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500 outline-none transition text-sm"
                                placeholder="1000" required
                            />
                            <p className="text-xs text-ink-400 mt-1">Minimum : 1000 FCFA · Maximum : {(wallet?.solde ?? 0).toLocaleString('fr-FR')} FCFA</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-ink-700 mb-1">Opérateur Mobile Money</label>
                            <select
                                value={formData.operateur}
                                onChange={(e) => majChamp('operateur', e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-ink-200 focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500 outline-none transition text-sm bg-white"
                                required
                            >
                                <option value="" disabled>Choisir un opérateur…</option>
                                {operateurs.map((o) => (
                                    <option key={o.code} value={o.code}>{o.libelle}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-ink-700 mb-1">Numéro Mobile Money</label>
                            <input
                                type="tel" inputMode="numeric" value={formData.numero}
                                onChange={(e) => majChamp('numero', e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-ink-200 focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500 outline-none transition text-sm"
                                placeholder="07 12 34 56 78" required
                            />
                            <p className="text-xs text-ink-400 mt-1">10 chiffres, sans indicatif.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-ink-700 mb-1">Nom du titulaire (optionnel)</label>
                            <input
                                type="text" value={formData.titulaire}
                                onChange={(e) => majChamp('titulaire', e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-ink-200 focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500 outline-none transition text-sm"
                                placeholder="Nom exact sur le compte Mobile Money"
                            />
                            <p className="text-xs text-ink-400 mt-1">Aide l'admin à vérifier le numéro avant l'envoi.</p>
                        </div>

                        <button
                            type="submit" disabled={submitting}
                            className="w-full flex items-center justify-center gap-2 bg-ramses-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-ramses-700 transition disabled:opacity-50"
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Soumettre la demande
                        </button>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-ink-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-ink-50"><h2 className="font-semibold text-ink-900">Historique ({demandes.length})</h2></div>
                {demandes.length === 0 ? (
                    <div className="p-10 text-center text-sm text-ink-400">Aucune demande pour le moment</div>
                ) : (
                    <div className="divide-y divide-ink-50">
                        {demandes.map((demande) => {
                            const s = STATUTS[demande.statut] || STATUTS.en_attente;
                            const Icon = s.icon;
                            return (
                                <div key={demande._id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-ink-800">{demande.montant.toLocaleString('fr-FR')} FCFA</p>
                                        <p className="text-xs text-ink-400">{new Date(demande.createdAt).toLocaleString('fr-FR')}</p>
                                        <p className="text-xs text-ink-400">{demande.numero}</p>
                                        {demande.noteAdmin && <p className="text-xs text-ramses-600 mt-1">Note : {demande.noteAdmin}</p>}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${s.className}`}>
                                            <Icon size={12} /> {s.label}
                                        </span>
                                        {demande.preuvePaiement && (
                                            <a href={demande.preuvePaiement} target="_blank" rel="noreferrer" className="flex items-center gap-1 justify-end mt-1 text-xs text-ramses-700 hover:underline">
                                                Voir la preuve <ExternalLink size={11} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="flex items-start gap-2 mt-4 text-xs text-ink-400">
                <Info size={14} className="shrink-0 mt-0.5" />
                <p>Le virement est exécuté manuellement par l'équipe RAMCI dès la demande — aucune API de versement automatique n'est disponible chez notre prestataire de paiement actuel.</p>
            </div>
        </div>
    );
};

export default DemandeRetrait;