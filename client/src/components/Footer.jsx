import { assets, footerLinks } from "../assets/assets";
import { Mail, MapPin, Phone } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Footer = () => {
    const currentYear = new Date().getFullYear();
    const navigate = useNavigate();
    const location = useLocation();

    // ✅ Fonction pour ouvrir Tawk.to
    const openTawkTo = (e) => {
        e.preventDefault();
        if (window.Tawk_API) {
            window.Tawk_API.showWidget();
            window.Tawk_API.maximize();
        } else {
            const script = document.createElement('script');
            script.async = true;
            script.src = 'https://embed.tawk.to/6a26a25d683c831c304cb5ea/1jqjekfae';
            script.charset = 'UTF-8';
            script.setAttribute('crossorigin', '*');
            document.body.appendChild(script);
            setTimeout(() => {
                if (window.Tawk_API) {
                    window.Tawk_API.showWidget();
                    window.Tawk_API.maximize();
                }
            }, 1000);
        }
    };

    // ✅ Gestionnaire de clic sur les liens
    const handleLinkClick = (e, url) => {
        // Si c'est "Contactez-nous" → ouvrir Tawk.to
        if (url === '#contact' || url === 'contact') {
            openTawkTo(e);
            return;
        }

        // Si c'est un lien externe
        if (url.startsWith('http')) {
            window.open(url, '_blank');
            return;
        }

        // Si c'est un lien interne
        e.preventDefault();
        
        // Si on est déjà sur la même page → scroll en haut
        if (location.pathname === url) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // Navigation vers une autre page + scroll en haut
        window.scrollTo({ top: 0 });
        navigate(url);
    };

    const socialLinks = [
        {
            label: "Facebook",
            href: "https://www.facebook.com/share/18V41aoDkM/",
            svg: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
            ),
        },
        {
            label: "Instagram",
            href: "https://www.instagram.com/ramci.ci",
            svg: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <circle cx="12" cy="12" r="4"/>
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                </svg>
            ),
        },
        {
            label: "TikTok",
            href: "https://www.tiktok.com/@ramci.ci",
            svg: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 15.58a6.34 6.34 0 0 0 6.33 6.33c3.5 0 6.33-2.84 6.33-6.33V9.56a6.85 6.85 0 0 0 4.77 1.84V8.1a4.8 4.8 0 0 1-2.84-1.41z"/>
                </svg>
            ),
        },
    ];

    return (
        <footer className="bg-ink-0 border-t border-ink-100 pt-12 pb-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-ink-100">

                    {/* Colonne 1 - Logo & Infos */}
                    <div className="md:col-span-4">
                        <img className="h-12 w-auto mb-4" src={assets.logo} alt="logo" />
                        <p className="text-[14px] text-ink-500 mb-5 max-w-md leading-relaxed">
                            Votre satisfaction est notre priorité. Découvrez une expérience de shopping unique avec des produits de qualité.
                        </p>
                        {/* Le téléphone et l'e-mail étaient de simples <span> :
                            sur mobile, un numéro affiché sans `tel:` oblige le
                            client à le recopier à la main pour appeler. */}
                        <div className="grid gap-1">
                            <span className="flex items-center gap-2.5 text-[14px] text-ink-500 min-h-[36px]">
                                <MapPin size={16} className="text-ramses-600 shrink-0" />
                                Abidjan, Côte d'Ivoire
                            </span>
                            <a
                                href="tel:+2250596733150"
                                className="flex items-center gap-2.5 text-[14px] text-ink-500 hover:text-ramses-600 transition-colors min-h-[36px]"
                            >
                                <Phone size={16} className="text-ramses-600 shrink-0" />
                                +225 05 96 73 31 50
                            </a>
                            <a
                                href="mailto:contactramci@gmail.com"
                                className="flex items-center gap-2.5 text-[14px] text-ink-500 hover:text-ramses-600 transition-colors min-h-[36px] break-all"
                            >
                                <Mail size={16} className="text-ramses-600 shrink-0" />
                                contactramci@gmail.com
                            </a>
                        </div>
                    </div>

                    {/* Colonne 2 - Liens rapides */}
                    <div className="md:col-span-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                            {footerLinks.map((section, index) => (
                                <div key={index}>
                                    <h3 className="rs-label text-ink-900 mb-3">
                                        {section.title}
                                    </h3>
                                    <ul className="space-y-2">
                                        {section.links.map((link, i) => (
                                            <li key={i}>
                                                <a
                                                    href={link.url}
                                                    onClick={(e) => handleLinkClick(e, link.url)}
                                                    className="text-[14px] text-ink-500 hover:text-ramses-600 transition-colors cursor-pointer inline-flex items-center min-h-[36px]"
                                                    target={link.url.startsWith('http') ? '_blank' : '_self'}
                                                    rel={link.url.startsWith('http') ? 'noopener noreferrer' : ''}
                                                >
                                                    {link.text}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Colonne 3 - Réseaux sociaux */}
                    <div className="md:col-span-3">
                        <h3 className="rs-label text-ink-900 mb-3">
                            Restons connectés
                        </h3>
                        <p className="text-[14px] text-ink-500 mb-4">
                            Suivez-nous sur les réseaux sociaux pour ne rien manquer
                        </p>

                        <div className="flex gap-3">
                            {socialLinks.map((social, idx) => (
                                <a
                                    key={idx}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-11 h-11 rounded-full bg-ink-50 flex items-center justify-center text-ink-600 hover:bg-ramses-600 hover:text-white transition-colors focus-visible:outline-none focus-visible:shadow-[var(--rs-focus)]"
                                    aria-label={social.label}
                                >
                                    {social.svg}
                                </a>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div className="pt-6 text-center">
                    <p className="text-[12px] text-ink-400">
                        &copy; {currentYear} RAMCI. Tous droits réservés.
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;