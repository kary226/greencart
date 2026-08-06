import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
// `Link` était UTILISÉ dans l'état « lien invalide » mais jamais importé :
// la page plantait avec « Link is not defined » dès qu'un lien de
// réinitialisation était expiré — c'est-à-dire précisément quand
// l'utilisateur avait besoin de retrouver son chemin.
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, Eye, EyeOff, Check } from 'lucide-react';

const LONGUEUR_MIN = 6;

const ResetPassword = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);

    const assezLong = password.length >= LONGUEUR_MIN;
    const correspondent = confirmPassword.length > 0 && password === confirmPassword;
    const peutValider = assezLong && correspondent && !loading;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Les mots de passe ne correspondent pas');
            return;
        }

        if (password.length < LONGUEUR_MIN) {
            toast.error(`Le mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères`);
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
            <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4 py-16">
                <div className="max-w-[420px] w-full text-center">
                    {/* L'émoji ❌ servait d'icône — proscrit par la checklist
                        d'accessibilité, et le rouge est réservé à la marque. */}
                    <div className="w-16 h-16 rounded-full bg-warn-50 flex items-center justify-center mx-auto mb-5">
                        <AlertTriangle size={28} className="text-warn-500" />
                    </div>
                    <h1 className="rs-h1 mb-2">Lien invalide ou expiré</h1>
                    <p className="text-[14px] text-ink-500 leading-relaxed mb-7">
                        Les liens de réinitialisation ont une durée de vie limitée. Demandez-en un nouveau,
                        il arrivera dans la minute.
                    </p>
                    <Link to="/forgot-password" className="rs-btn rs-btn--primary rs-btn--block">
                        Demander un nouveau lien
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4 py-16">
            <div className="max-w-[420px] w-full">
                <div className="rs-card">
                    <h1 className="rs-h1 mb-2">Nouveau mot de passe</h1>
                    <p className="text-[14px] text-ink-500 mb-5">
                        Choisissez un mot de passe d'au moins {LONGUEUR_MIN} caractères.
                    </p>

                    <form onSubmit={handleSubmit} className="grid gap-4">
                        <div>
                            <label htmlFor="password" className="block text-[12px] font-semibold text-ink-500 mb-1.5">
                                Nouveau mot de passe
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    /* Bascule de visibilité : sans elle, on saisit à
                                       l'aveugle deux fois de suite sur un clavier
                                       mobile — première cause d'échec sur ce type
                                       de formulaire. */
                                    type={visible ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="rs-input pr-12"
                                    required
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setVisible(v => !v)}
                                    aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 rs-icon-btn !w-10 !h-10"
                                >
                                    {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                            </div>
                            {password.length > 0 && (
                                <p className={`text-[12px] mt-1.5 flex items-center gap-1.5 ${assezLong ? 'text-ok-500' : 'text-ink-400'}`}>
                                    {assezLong && <Check size={13} />}
                                    Au moins {LONGUEUR_MIN} caractères
                                </p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-[12px] font-semibold text-ink-500 mb-1.5">
                                Confirmer le mot de passe
                            </label>
                            <input
                                id="confirmPassword"
                                type={visible ? 'text' : 'password'}
                                autoComplete="new-password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="rs-input"
                                required
                            />
                            {/* Retour immédiat plutôt qu'un toast après soumission :
                                on corrige en tapant, pas après avoir tout renvoyé. */}
                            {confirmPassword.length > 0 && (
                                <p className={`text-[12px] mt-1.5 flex items-center gap-1.5 ${correspondent ? 'text-ok-500' : 'text-warn-500'}`}>
                                    {correspondent ? <><Check size={13} /> Les mots de passe correspondent</> : 'Les mots de passe ne correspondent pas'}
                                </p>
                            )}
                        </div>

                        <button type="submit" disabled={!peutValider} className="rs-btn rs-btn--primary rs-btn--block">
                            {loading ? 'Modification…' : 'Modifier mon mot de passe'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
