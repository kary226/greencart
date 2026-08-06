import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { MailCheck, ArrowLeft } from 'lucide-react';

const ForgotPassword = () => {
    const { axios, setShowUserLogin } = useAppContext();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await axios.post('/api/user/forgot-password', { email });
            if (data.success) {
                setSent(true);
                toast.success(data.message);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4 py-16">
                <div className="max-w-[420px] w-full text-center">
                    {/* L'émoji 📧 servait d'icône : proscrit par la checklist
                        d'accessibilité — il se lit « e-mail » au lecteur d'écran
                        et change d'aspect selon la plateforme. */}
                    <div className="w-16 h-16 rounded-full bg-ok-50 flex items-center justify-center mx-auto mb-5">
                        <MailCheck size={28} className="text-ok-500" />
                    </div>
                    <h1 className="rs-h1 mb-2">Vérifiez votre boîte mail</h1>
                    <p className="text-[14px] text-ink-500 leading-relaxed mb-2">
                        Si un compte existe pour <strong className="text-ink-900">{email}</strong>,
                        vous recevrez un lien de réinitialisation d'ici quelques minutes.
                    </p>
                    <p className="text-[13px] text-ink-400 mb-7">
                        Pensez à regarder dans les indésirables.
                    </p>
                    <Link to="/" className="rs-btn rs-btn--secondary rs-btn--block">
                        Retour à l'accueil
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4 py-16">
            <div className="max-w-[420px] w-full">
                <div className="rs-card">
                    <h1 className="rs-h1 mb-2">Mot de passe oublié ?</h1>
                    <p className="text-[14px] text-ink-500 leading-relaxed mb-5">
                        Indiquez votre adresse e-mail, nous vous enverrons un lien pour en choisir un nouveau.
                    </p>

                    <form onSubmit={handleSubmit} className="grid gap-4">
                        <div>
                            <label htmlFor="email" className="block text-[12px] font-semibold text-ink-500 mb-1.5">
                                Adresse e-mail
                            </label>
                            <input
                                id="email"
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                placeholder="vous@exemple.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="rs-input"
                                required
                                autoFocus
                            />
                        </div>

                        <button type="submit" disabled={loading || !email} className="rs-btn rs-btn--primary rs-btn--block">
                            {loading ? 'Envoi en cours…' : 'Envoyer le lien'}
                        </button>
                    </form>
                </div>

                {/* Le lien « Retour à la connexion » pointait vers « / », qui
                    n'est pas la page de connexion — la connexion est une modale.
                    Il l'ouvre maintenant réellement. */}
                <button
                    onClick={() => setShowUserLogin(true)}
                    className="rs-btn rs-btn--ghost rs-btn--block mt-3"
                >
                    <ArrowLeft size={16} />
                    Retour à la connexion
                </button>
            </div>
        </div>
    );
};

export default ForgotPassword;
