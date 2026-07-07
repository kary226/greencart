import { assets, footerLinks } from "../assets/assets";
import { Mail, MapPin, Phone } from 'lucide-react';

const Footer = () => {
    const currentYear = new Date().getFullYear();

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
        <footer className="bg-white border-t border-gray-100 pt-12 pb-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-gray-100">

                    {/* Colonne 1 - Logo & Infos */}
                    <div className="md:col-span-4">
                        <img className="h-12 w-auto mb-4" src={assets.logo} alt="logo" />
                        <p className="text-sm text-gray-500 mb-4 max-w-md">
                            Votre satisfaction est notre priorité. Découvrez une expérience de shopping unique avec des produits de qualité.
                        </p>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <MapPin size={16} className="text-red-500 flex-shrink-0" />
                                <span>Abidjan, Côte d'Ivoire</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Phone size={16} className="text-red-500 flex-shrink-0" />
                                <span>+225 05 96 73 31 50</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Mail size={16} className="text-red-500 flex-shrink-0" />
                                <span>contactramci@gmail.com</span>
                            </div>
                        </div>
                    </div>

                    {/* Colonne 2 - Liens rapides */}
                    <div className="md:col-span-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                            {footerLinks.map((section, index) => (
                                <div key={index}>
                                    <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">
                                        {section.title}
                                    </h3>
                                    <ul className="space-y-2">
                                        {section.links.map((link, i) => (
                                            <li key={i}>
                                                <a
                                                    href={link.url}
                                                    className="text-sm text-gray-500 hover:text-red-500 transition-colors duration-200"
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
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">
                            Restons connectés
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Suivez-nous sur les réseaux sociaux pour ne rien manquer
                        </p>

                        <div className="flex gap-3">
                            {socialLinks.map((social, idx) => (
                                <a
                                    key={idx}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-red-500 hover:text-white transition-all duration-200"
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
                    <p className="text-xs text-gray-400">
                        &copy; {currentYear} RAMCI. Tous droits réservés.
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;