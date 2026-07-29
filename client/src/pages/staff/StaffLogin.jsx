import React, { useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import toast from 'react-hot-toast';
import { Mail, Lock, LogIn, UserCog, ShieldCheck, CheckCircle2 } from 'lucide-react';

const ROLE_LABELS = {
    admin: 'Administrateur',
    commercant: 'Commerçant',
    livreur: 'Livreur',
    assistant_shein: 'Assistant Shein',
};

const StaffLogin = () => {
    const { axios } = useAppContext()
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [totpCode, setTotpCode] = useState("");
    const [loading, setLoading] = useState(false);
    // Pas encore d'espace dédié par rôle (Phases 2 à 5) : on affiche donc
    // ici la confirmation de connexion directement, avec les infos du
    // compte renvoyées par le serveur — c'est la preuve visuelle que tout
    // fonctionne de bout en bout.
    const [connectedAccount, setConnectedAccount] = useState(null);

    const onSubmitHandler = async (event) => {
        event.preventDefault();
        setLoading(true);

        try {
            const { data } = await axios.post('/api/staff/login', { email, password, totpCode })
            if (data.success) {
                toast.success("Connexion réussie");
                setConnectedAccount(data.staffUser);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    }

    if (connectedAccount) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={32} className="text-green-600" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-1">Connexion réussie</h1>
                    <p className="text-sm text-gray-500 mb-6">La session est bien active côté serveur (cookie staffToken posé).</p>

                    <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Nom</span><span className="font-medium text-gray-900">{connectedAccount.nom}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-medium text-gray-900">{connectedAccount.email}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Rôle</span><span className="font-medium text-gray-900">{ROLE_LABELS[connectedAccount.role] || connectedAccount.role}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Statut</span><span className="font-medium text-green-600">{connectedAccount.statut}</span></div>
                    </div>

                    <button
                        onClick={() => setConnectedAccount(null)}
                        className="w-full mt-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition text-sm"
                    >
                        Se déconnecter (revenir au formulaire)
                    </button>
                    <p className="text-xs text-gray-400 mt-4">
                        Il n'y a pas encore d'espace dédié à ce rôle (Phases 2 à 5 à venir) — cette page confirme juste que la connexion fonctionne.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <UserCog size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Espace équipe</h1>
                    <p className="text-sm text-gray-500 mt-1">Admin, commerçant, livreur ou assistant Shein</p>
                </div>

                <form onSubmit={onSubmitHandler} className="bg-white rounded-2xl shadow-xl p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="relative">
                            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                onChange={(e) => setEmail(e.target.value)}
                                value={email}
                                type="email"
                                placeholder="vous@exemple.com"
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
                                placeholder="Votre mot de passe"
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Code d'authentification (2FA)</label>
                        <div className="relative">
                            <ShieldCheck size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                onChange={(e) => setTotpCode(e.target.value)}
                                value={totpCode}
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="123456"
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition text-sm tracking-widest"
                                required
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Code à 6 chiffres généré par votre application d'authentification</p>
                    </div>

                    <button
                        disabled={loading}
                        className="w-full mt-2 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Connexion...</span>
                            </>
                        ) : (
                            <>
                                <LogIn size={18} />
                                <span>Se connecter</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default StaffLogin