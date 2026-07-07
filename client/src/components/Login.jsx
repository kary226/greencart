import React from 'react'
import { Link } from 'react-router-dom'
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { X, Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const Login = () => {

    const { setShowUserLogin, loginUser, registerUser, axios, setUser } = useAppContext()

    const [state, setState] = React.useState("login");
    const [firstName, setFirstName] = React.useState("");
    const [lastName, setLastName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [showPassword, setShowPassword] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [rememberMe, setRememberMe] = React.useState(false);

    const onSubmitHandler = async (event) => {
        event.preventDefault();
        setLoading(true);

        if (state === "login") {
            await loginUser(email, password);
        } else {
            if (!firstName && !lastName) {
                toast.error("Veuillez entrer votre prénom et nom");
                setLoading(false);
                return;
            }
            await registerUser(firstName, lastName, email, password);
        }

        setLoading(false);
        setShowUserLogin(false);
    }

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const { data } = await axios.post('/api/user/google', {
                credential: credentialResponse.credential
            });

            if (data.success) {
                setUser(data.user);
                toast.success(`Bienvenue ${data.user.firstName || data.user.name} !`);
                setShowUserLogin(false);
            } else {
                toast.error(data.message || 'Erreur de connexion Google');
            }
        } catch (error) {
            toast.error('Erreur de connexion Google');
        }
    };

    const handleGoogleError = () => {
        toast.error('La connexion Google a échoué, veuillez réessayer');
    };

    return (
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
            <div
                onClick={() => setShowUserLogin(false)}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md transition-all p-4"
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up"
                >
                    <button
                        type="button"
                        onClick={() => setShowUserLogin(false)}
                        className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex flex-col md:flex-row">
                        {/* Left side - Branding avec Logo */}
                        <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-red-500 to-red-700 p-8 flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full opacity-10">
                                <div className="absolute -top-20 -right-20 w-64 h-64 bg-white rounded-full"></div>
                                <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-white rounded-full"></div>
                            </div>
                            
                            <div className="relative z-10">
                                <div className="flex items-center justify-center mb-8">
                                    <div className="w-24 h-24 flex items-center justify-center">
                                        <img 
                                            src="/logo.png" 
                                            alt="RAMCI" 
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                </div>
                                
                                <div className="space-y-4 text-center">
                                    <h3 className="text-2xl font-bold text-white">
                                        {state === "login" ? "Bon retour !" : "Rejoignez l'aventure"}
                                    </h3>
                                    <p className="text-white/80 text-sm leading-relaxed">
                                        {state === "login" 
                                            ? "Connectez-vous pour découvrir nos dernières collections et profiter de vos avantages exclusifs."
                                            : "Créez votre compte et bénéficiez de -10% sur votre première commande, livraison offerte dès 50 000 FCFA."}
                                    </p>
                                </div>
                            </div>

                            <div className="relative z-10 text-center">
                                <div className="flex flex-wrap items-center justify-center gap-3 text-white/60 text-xs">
                                    <span>Livraison rapide</span>
                                    <span>•</span>
                                    <span>Paiement sécurisé</span>
                                    <span>•</span>
                                    <span>Retours faciles</span>
                                </div>
                            </div>
                        </div>

                        {/* Right side - Form */}
                        <div className="w-full md:w-1/2 p-6 md:p-8">
                            {/* Logo visible sur mobile */}
                            <div className="md:hidden flex justify-center mb-6">
                                <div className="w-20 h-20 flex items-center justify-center">
                                    <img 
                                        src="/logo.png" 
                                        alt="RAMCI" 
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            </div>

                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    {state === "login" ? "Connexion" : "Inscription"}
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    {state === "login"
                                        ? "Entrez vos identifiants pour continuer"
                                        : "Remplissez le formulaire pour créer votre compte"}
                                </p>
                            </div>

                            <form onSubmit={onSubmitHandler} className="space-y-4">
                                {/* Google Button - Bien centré */}
                                <div className="flex justify-center w-full">
                                    <GoogleLogin
                                        onSuccess={handleGoogleSuccess}
                                        onError={handleGoogleError}
                                        text={state === "login" ? "signin_with" : "signup_with"}
                                        shape="pill"
                                        logo_alignment="center"
                                        width="100%"
                                        locale="fr"
                                        theme="outline"
                                    />
                                </div>

                                {/* Divider */}
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-200"></div>
                                    </div>
                                    <div className="relative flex justify-center text-xs">
                                        <span className="px-3 bg-white text-gray-400">ou continuez avec</span>
                                    </div>
                                </div>

                                {state === "register" && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Prénom</label>
                                            <div className="relative">
                                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    onChange={(e) => setFirstName(e.target.value)}
                                                    value={firstName}
                                                    placeholder="Votre prénom"
                                                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition text-sm"
                                                    type="text"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
                                            <div className="relative">
                                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    onChange={(e) => setLastName(e.target.value)}
                                                    value={lastName}
                                                    placeholder="Votre nom"
                                                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition text-sm"
                                                    type="text"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            onChange={(e) => setEmail(e.target.value)}
                                            value={email}
                                            placeholder="exemple@email.com"
                                            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition text-sm"
                                            type="email"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe</label>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            onChange={(e) => setPassword(e.target.value)}
                                            value={password}
                                            placeholder="Votre mot de passe"
                                            className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition text-sm"
                                            type={showPassword ? "text" : "password"}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {state === "login" && (
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-400"
                                            />
                                            <span className="text-xs text-gray-600">Se souvenir de moi</span>
                                        </label>
                                        <Link
                                            to="/forgot-password"
                                            onClick={() => setShowUserLogin(false)}
                                            className="text-xs text-red-500 hover:text-red-600 font-medium transition"
                                        >
                                            Mot de passe oublié ?
                                        </Link>
                                    </div>
                                )}

                                <button
                                    disabled={loading}
                                    className="w-full py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2 group"
                                >
                                    {loading ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Chargement...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <span>{state === "register" ? "Créer mon compte" : "Se connecter"}</span>
                                            <ArrowRight size={16} className="group-hover:translate-x-1 transition" />
                                        </>
                                    )}
                                </button>

                                <p className="text-center text-xs text-gray-500">
                                    {state === "login" ? (
                                        <>
                                            Nouveau client ?{" "}
                                            <button
                                                type="button"
                                                onClick={() => setState("register")}
                                                className="text-red-500 font-medium hover:text-red-600 transition"
                                            >
                                                Créer un compte
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            Déjà inscrit ?{" "}
                                            <button
                                                type="button"
                                                onClick={() => setState("login")}
                                                className="text-red-500 font-medium hover:text-red-600 transition"
                                            >
                                                Se connecter
                                            </button>
                                        </>
                                    )}
                                </p>
                            </form>
                        </div>
                    </div>
                </div>

                <style>{`
                    @keyframes fade-in-up {
                        from { opacity: 0; transform: translateY(30px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-in-up {
                        animation: fade-in-up 0.4s ease-out;
                    }
                `}</style>
            </div>
        </GoogleOAuthProvider>
    )
}

export default Login;