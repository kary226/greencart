import React from 'react'
import { Link } from 'react-router-dom'
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { X, Mail, Lock, User, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const Login = () => {

    const { setShowUserLogin, loginUser, registerUser, axios, setUser, setToken } = useAppContext()

    const [state, setState] = React.useState("login");
    const [firstName, setFirstName] = React.useState("");
    const [lastName, setLastName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [showPassword, setShowPassword] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

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
                setToken(data.token);
                localStorage.setItem('token', data.token);
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
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all"
            >
                <form
                    onSubmit={onSubmitHandler}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up"
                >
                    <button
                        type="button"
                        onClick={() => setShowUserLogin(false)}
                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition z-10"
                    >
                        <X size={18} />
                    </button>

                    <div className="text-center pt-8 pb-4">
                        {/* Logo RAMCI au lieu de l'emoji */}
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <span className="text-2xl font-bold text-red-500">RAMCI</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            {state === "login" ? "Connexion" : "Créer un compte"}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {state === "login"
                                ? "Connectez-vous à votre compte"
                                : "Inscrivez-vous pour commencer"}
                        </p>
                    </div>

                    <div className="px-6 pb-6 space-y-4">

                        {/* Bouton Google */}
                        <div onClick={(e) => e.stopPropagation()} className="flex justify-center">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={handleGoogleError}
                                text={state === "login" ? "signin_with" : "signup_with"}
                                shape="rectangular"
                                logo_alignment="left"
                                width="368"
                                locale="fr"
                            />
                        </div>

                        {/* Séparateur */}
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-gray-200"></div>
                            <span className="text-xs text-gray-400 font-medium">ou</span>
                            <div className="flex-1 h-px bg-gray-200"></div>
                        </div>

                        {state === "register" && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                                    <div className="relative">
                                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            onChange={(e) => setFirstName(e.target.value)}
                                            value={firstName}
                                            placeholder="Votre prénom"
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition text-sm"
                                            type="text"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                                    <div className="relative">
                                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            onChange={(e) => setLastName(e.target.value)}
                                            value={lastName}
                                            placeholder="Votre nom"
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition text-sm"
                                            type="text"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    onChange={(e) => setEmail(e.target.value)}
                                    value={email}
                                    placeholder="exemple@email.com"
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition text-sm"
                                    type="email"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    onChange={(e) => setPassword(e.target.value)}
                                    value={password}
                                    placeholder="Votre mot de passe"
                                    className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition text-sm"
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

                        {state === "register" ? (
                            <p className="text-center text-sm text-gray-500">
                                J'ai déjà un compte{" "}
                                <button
                                    type="button"
                                    onClick={() => setState("login")}
                                    className="text-red-500 font-medium hover:text-red-600 transition"
                                >
                                    Se connecter
                                </button>
                            </p>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-center text-sm text-gray-500">
                                    Vous n'avez pas de compte ?{" "}
                                    <button
                                        type="button"
                                        onClick={() => setState("register")}
                                        className="text-red-500 font-medium hover:text-red-600 transition"
                                    >
                                        Créer un compte
                                    </button>
                                </p>
                                <Link
                                    to="/forgot-password"
                                    onClick={() => setShowUserLogin(false)}
                                    className="block text-center text-sm text-red-500 hover:text-red-600 transition"
                                >
                                    Mot de passe oublié ?
                                </Link>
                            </div>
                        )}

                        <button
                            disabled={loading}
                            className="w-full mt-2 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Chargement...</span>
                                </div>
                            ) : (
                                state === "register" ? "S'inscrire" : "Se connecter"
                            )}
                        </button>
                    </div>
                </form>

                <style>{`
                    @keyframes fade-in-up {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-in-up {
                        animation: fade-in-up 0.3s ease-out;
                    }
                `}</style>
            </div>
        </GoogleOAuthProvider>
    )
}

export default Login;