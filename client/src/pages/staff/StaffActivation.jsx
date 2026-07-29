import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import toast from 'react-hot-toast';
import { User, Lock, CheckCircle2, ShieldCheck, Copy, XCircle } from 'lucide-react';

const ROLE_LABELS = {
    admin: 'Administrateur',
    commercant: 'Commerçant',
    livreur: 'Livreur',
    assistant_shein: 'Assistant Shein',
};

const StaffActivation = () => {
    const { token } = useParams();
    const { axios } = useAppContext();

    const [nom, setNom] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null); // { staffUser, totpSetup }

    const copySecret = () => {
        if (!result?.totpSetup?.secret) return;
        navigator.clipboard.writeText(result.totpSetup.secret);
        toast.success('Secret copié');
    };

    const onSubmitHandler = async (event) => {
        event.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Les mots de passe ne correspondent pas');
            return;
        }
        if (password.length < 8) {
            toast.error('Le mot de passe doit contenir au moins 8 caractères');
            return;
        }

        setLoading(true);
        try {
            const { data } = await axios.post(`/api/staff/activation/${token}`, { nom, password });
            if (data.success) {
                toast.success('Compte activé');
                setResult(data);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
                <div className="text-center">
                    <XCircle size={48} className="text-red-500 mx-auto mb-3" />
                    <h1 className="text-xl font-bold text-gray-900">Lien invalide</h1>
                    <p className="text-sm text-gray-500 mt-1">Aucun jeton d'activation trouvé dans l'URL.</p>
                </div>
            </div>
        );
    }

    if (result) {
        const { staffUser, totpSetup } = result;
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 py-10">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
                    <div className="text-center mb-5">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 size={32} className="text-green-600" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900">Compte activé</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {staffUser?.nom} — {ROLE_LABELS[staffUser?.role] || staffUser?.role}
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck size={18} className="text-amber-600" />
                            <p className="text-sm font-semibold text-amber-800">Mise en place de la double authentification</p>
                        </div>
                        <p className="text-xs text-amber-700 mb-3">
                            Ce secret ne sera plus jamais affiché. Ajoutez-le maintenant dans Google Authenticator, Authy, ou une app équivalente (entrée manuelle si vous ne pouvez pas scanner de QR code).
                        </p>
                        <div className="bg-white border border-amber-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
                            <code className="text-xs break-all text-gray-800">{totpSetup?.secret}</code>
                            <button onClick={copySecret} type="button" className="shrink-0 p-1.5 text-amber-700 hover:bg-amber-100 rounded-md transition">
                                <Copy size={16} />
                            </button>
                        </div>
                    </div>

                    <p className="text-xs text-gray-400 mt-5 text-center">
                        Vous êtes déjà connecté (cookie de session posé). La prochaine fois, utilisez la page de connexion avec le code à 6 chiffres généré par votre application.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">Activer votre compte</h1>
                    <p className="text-sm text-gray-500 mt-1">Choisissez votre nom et votre mot de passe</p>
                </div>

                <form onSubmit={onSubmitHandler} className="bg-white rounded-2xl shadow-xl p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                        <div className="relative">
                            <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                onChange={(e) => setNom(e.target.value)}
                                value={nom}
                                type="text"
                                placeholder="Votre nom"
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                onChange={(e) => setPassword(e.target.value)}
                                value={password}
                                type="password"
                                placeholder="8 caractères minimum"
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                value={confirmPassword}
                                type="password"
                                placeholder="Retapez le mot de passe"
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition text-sm"
                                required
                            />
                        </div>
                    </div>

                    <button
                        disabled={loading}
                        className="w-full mt-2 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Activation...</span>
                            </>
                        ) : (
                            <span>Activer mon compte</span>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default StaffActivation;