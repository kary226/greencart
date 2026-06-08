import React, { useEffect, useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import toast from 'react-hot-toast';
import { Mail, Lock, LogIn, Store, AlertCircle } from 'lucide-react';

const SellerLogin = () => {
    const { isSeller, setIsSeller, navigate, axios } = useAppContext()
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const onSubmitHandler = async (event) => {
        event.preventDefault();
        setLoading(true);
        
        try {
            const { data } = await axios.post('/api/seller/login', { email, password })
            if (data.success) {
                localStorage.setItem('sellerToken', data.token);
                axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
                setIsSeller(true);
                toast.success("Connexion admin réussie");
                navigate('/seller');
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const sellerToken = localStorage.getItem('sellerToken');
        if (sellerToken) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${sellerToken}`;
            setIsSeller(true);
            navigate("/seller");
        }
    }, [isSeller, navigate, setIsSeller, axios]);

    if (isSeller) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Logo/Brand */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Store size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Espace Vendeur</h1>
                    <p className="text-sm text-gray-500 mt-1">Connectez-vous à votre tableau de bord</p>
                </div>

                {/* Formulaire */}
                <form onSubmit={onSubmitHandler} className="bg-white rounded-2xl shadow-xl p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="relative">
                            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input 
                                onChange={(e) => setEmail(e.target.value)} 
                                value={email}
                                type="email" 
                                placeholder="admin@exemple.com" 
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition text-sm" 
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
                                type={showPassword ? "text" : "password"} 
                                placeholder="Votre mot de passe" 
                                className="w-full pl-10 pr-12 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition text-sm" 
                                required 
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                            >
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                        <line x1="3" y1="3" x2="21" y2="21"/>
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <button 
                        disabled={loading} 
                        className="w-full mt-2 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
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

                    <div className="text-center pt-2">
                        <p className="text-xs text-gray-400">
                            Accès réservé aux administrateurs
                        </p>
                    </div>
                </form>

                {/* Message d'information */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                        <AlertCircle size={12} />
                        Contactez l'administrateur si vous n'avez pas d'accès
                    </p>
                </div>
            </div>
        </div>
    )
}

export default SellerLogin