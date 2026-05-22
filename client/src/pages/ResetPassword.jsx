import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

const ResetPassword = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            toast.error('Les mots de passe ne correspondent pas');
            return;
        }
        
        if (password.length < 6) {
            toast.error('Le mot de passe doit contenir au moins 6 caractères');
            return;
        }
        
        setLoading(true);
        try {
            const { data } = await axios.post('/api/user/reset-password', { token, newPassword: password });
            if (data.success) {
                toast.success(data.message);
                setTimeout(() => navigate('/'), 2000);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="mt-16 text-center py-20">
                <div className="text-red-500 text-6xl mb-4">❌</div>
                <h1 className="text-2xl font-bold mb-2">Lien invalide</h1>
                <p className="text-gray-500">Le lien de réinitialisation est invalide ou a expiré.</p>
                <Link to="/forgot-password" className="mt-4 inline-block text-primary hover:underline">Retour</Link>
            </div>
        );
    }

    return (
        <div className="mt-16 pb-16">
            <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md">
                <h1 className="text-2xl font-bold text-center mb-4">Nouveau mot de passe</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        placeholder="Nouveau mot de passe"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Confirmer le mot de passe"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                        required
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                    >
                        {loading ? 'Modification...' : 'Modifier le mot de passe'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;