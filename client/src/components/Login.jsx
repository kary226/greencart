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

    const isRegister = state === "register";

    // Une modale se ferme à Échap — sans ça, l'utilisateur au clavier est
    // piégé, la seule sortie étant un clic sur le voile. Le défilement de la
    // page dessous est gelé pendant l'ouverture (sinon iOS fait défiler le
    // fond quand on scrolle le formulaire).
    React.useEffect(() => {
        const onKeyDown = (e) => { if (e.key === 'Escape') setShowUserLogin(false); };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [setShowUserLogin]);

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
        } catch {
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
                className="rs-overlay z-50"
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="login-title"
                    className="rs-float rs-modal-in relative w-full max-w-[840px] max-h-[92vh] overflow-y-auto rounded-[24px]"
                >
                    <button
                        type="button"
                        onClick={() => setShowUserLogin(false)}
                        aria-label="Fermer"
                        className="rs-icon-btn absolute top-2 right-2 z-20"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex flex-col md:flex-row">
                        {/* Panneau de marque. Il était en dégradé rouge plein :
                            DESIGN.md §7 proscrit les dégradés et interdit au
                            rouge de couvrir une grande surface — il ne reste
                            lisible comme « action » que s'il est rare. Le noir
                            de marque porte donc la moitié gauche, et le rouge
                            n'apparaît plus que dans le logo. */}
                        <div className="hidden md:flex md:w-[45%] bg-ink-900 p-8 flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-center mb-8">
                                    <img
                                        src="/logo.png"
                                        alt="RAMCI"
                                        className="w-24 h-24 object-contain"
                                    />
                                </div>

                                <h3 className="text-[20px] font-extrabold leading-[1.15] tracking-[-0.024em] text-white text-center mb-3">
                                    {isRegister ? "Rejoignez l'aventure" : "Bon retour !"}
                                </h3>
                                <p className="text-[14px] leading-relaxed text-ink-300 text-center">
                                    {isRegister
                                        ? "Créez votre compte et bénéficiez de -10% sur votre première commande, livraison offerte dès 50 000 FCFA."
                                        : "Connectez-vous pour découvrir nos dernières collections et profiter de vos avantages exclusifs."}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-semibold text-ink-400">
                                <span>Livraison rapide</span>
                                <span aria-hidden="true" className="text-ink-600">•</span>
                                <span>Paiement sécurisé</span>
                                <span aria-hidden="true" className="text-ink-600">•</span>
                                <span>Retours faciles</span>
                            </div>
                        </div>

                        {/* Formulaire */}
                        <div className="w-full md:w-[55%] p-6 md:p-8">
                            <div className="md:hidden flex justify-center mb-6">
                                <img
                                    src="/logo.png"
                                    alt="RAMCI"
                                    className="w-20 h-20 object-contain"
                                />
                            </div>

                            <div className="text-center mb-6">
                                <h2 id="login-title" className="rs-h1">
                                    {isRegister ? "Inscription" : "Connexion"}
                                </h2>
                                <p className="text-[14px] text-ink-500 mt-1">
                                    {isRegister
                                        ? "Remplissez le formulaire pour créer votre compte"
                                        : "Entrez vos identifiants pour continuer"}
                                </p>
                            </div>

                            <form onSubmit={onSubmitHandler} className="grid gap-4">
                                <div className="flex justify-center w-full">
                                    <GoogleLogin
                                        onSuccess={handleGoogleSuccess}
                                        onError={handleGoogleError}
                                        text={isRegister ? "signup_with" : "signin_with"}
                                        shape="pill"
                                        logo_alignment="center"
                                        width="100%"
                                        locale="fr"
                                        theme="outline"
                                    />
                                </div>

                                <div className="relative">
                                    <div aria-hidden="true" className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-ink-100"></div>
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="px-3 bg-ink-0 text-[12px] font-medium text-ink-400">ou continuez avec</span>
                                    </div>
                                </div>

                                {isRegister && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label htmlFor="login-firstname" className="block text-[12px] font-semibold text-ink-500 mb-1.5">
                                                Prénom
                                            </label>
                                            <div className="relative">
                                                <User aria-hidden="true" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                                                <input
                                                    id="login-firstname"
                                                    onChange={(e) => setFirstName(e.target.value)}
                                                    value={firstName}
                                                    placeholder="Votre prénom"
                                                    className="rs-input rs-input--icon-l"
                                                    type="text"
                                                    autoComplete="given-name"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="login-lastname" className="block text-[12px] font-semibold text-ink-500 mb-1.5">
                                                Nom
                                            </label>
                                            <div className="relative">
                                                <User aria-hidden="true" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                                                <input
                                                    id="login-lastname"
                                                    onChange={(e) => setLastName(e.target.value)}
                                                    value={lastName}
                                                    placeholder="Votre nom"
                                                    className="rs-input rs-input--icon-l"
                                                    type="text"
                                                    autoComplete="family-name"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="login-email" className="block text-[12px] font-semibold text-ink-500 mb-1.5">
                                        Adresse e-mail
                                    </label>
                                    <div className="relative">
                                        <Mail aria-hidden="true" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                                        <input
                                            id="login-email"
                                            onChange={(e) => setEmail(e.target.value)}
                                            value={email}
                                            placeholder="exemple@email.com"
                                            className="rs-input rs-input--icon-l"
                                            type="email"
                                            inputMode="email"
                                            autoComplete="email"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="login-password" className="block text-[12px] font-semibold text-ink-500 mb-1.5">
                                        Mot de passe
                                    </label>
                                    <div className="relative">
                                        <Lock aria-hidden="true" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                                        <input
                                            id="login-password"
                                            onChange={(e) => setPassword(e.target.value)}
                                            value={password}
                                            placeholder="Votre mot de passe"
                                            className="rs-input rs-input--icon-l rs-input--icon-r"
                                            type={showPassword ? "text" : "password"}
                                            autoComplete={isRegister ? "new-password" : "current-password"}
                                            required
                                        />
                                        {/* 44×44 : c'était une icône nue de 16px, sous la
                                            cible tactile minimale (DESIGN.md §8). */}
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                                            className="rs-icon-btn absolute right-0 top-1/2 -translate-y-1/2"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {!isRegister && (
                                    <div className="flex items-center justify-between gap-3">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="w-4 h-4 rounded border-ink-200 accent-ramses-600"
                                            />
                                            <span className="text-[12px] text-ink-500">Se souvenir de moi</span>
                                        </label>
                                        <Link
                                            to="/forgot-password"
                                            onClick={() => setShowUserLogin(false)}
                                            className="text-[12px] font-semibold text-ramses-700 hover:text-ramses-800"
                                        >
                                            Mot de passe oublié ?
                                        </Link>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="rs-btn rs-btn--primary rs-btn--block group"
                                >
                                    {loading ? (
                                        <>
                                            <span aria-hidden="true" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            <span>Chargement…</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>{isRegister ? "Créer mon compte" : "Se connecter"}</span>
                                            <ArrowRight aria-hidden="true" size={16} className="transition-transform group-hover:translate-x-1" />
                                        </>
                                    )}
                                </button>

                                <p className="text-center text-[12px] text-ink-500">
                                    {isRegister ? "Déjà inscrit ?" : "Nouveau client ?"}{" "}
                                    <button
                                        type="button"
                                        onClick={() => setState(isRegister ? "login" : "register")}
                                        className="font-semibold text-ramses-700 hover:text-ramses-800"
                                    >
                                        {isRegister ? "Se connecter" : "Créer un compte"}
                                    </button>
                                </p>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </GoogleOAuthProvider>
    )
}

export default Login;
