import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
    const { axios } = useAppContext();
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
            <div className="mt-16 text-center py-20">
                <div className="text-green-600 text-6xl mb-4">📧</div>
                <h1 className="text-2xl font-bold mb-2">Email envoyé !</h1>
                <p className="text-gray-500">Vérifiez votre boîte mail pour réinitialiser votre mot de passe ou vos spams.</p>
                <Link to="/" className="mt-4 inline-block text-primary hover:underline">Retour à l'accueil</Link>
            </div>
        );
    }

    return (
        <div className="mt-16 pb-16">
            <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md">
                <h1 className="text-2xl font-bold text-center mb-4">Mot de passe oublié ?</h1>
                <p className="text-gray-500 text-center mb-6">Entrez votre email, nous vous enverrons un lien de réinitialisation.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="email"
                        placeholder="Votre email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                        required
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                    >
                        {loading ? 'Envoi en cours...' : 'Envoyer'}
                    </button>
                </form>
                <p className="text-center text-sm text-gray-400 mt-4">
                    <Link to="/" className="text-primary hover:underline">Retour à la connexion</Link>
                </p>
            </div>
        </div>
    );
};

export default ForgotPassword;