import { assets, footerLinks } from "../assets/assets";
import { Mail, MapPin, Phone, Clock } from 'lucide-react';

const Footer = () => {

    const currentYear = new Date().getFullYear();

    const socialLinks = [
        {
            label: "Facebook",
            href: "https://facebook.com",
            svg: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
            ),
        },
        {
            label: "Twitter / X",
            href: "https://twitter.com",
            svg: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
            ),
        },
        {
            label: "Instagram",
            href: "https://instagram.com",
            svg: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <circle cx="12" cy="12" r="4"/>
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                </svg>
            ),
        },
        {
            label: "YouTube",
            href: "https://youtube.com",
            svg: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
                </svg>
            ),
        },
    ];

    return (
        <footer className="bg-white border-t border-gray-100 pt-12 pb-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Contenu principal */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-gray-100">

                    {/* Colonne 1 - Logo & Infos */}
                    <div className="md:col-span-4">
                        {/* ✅ LOGO AGRANDI : h-12 au lieu de h-8 */}
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
                                <span>contact@ramci.com</span>
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

                    {/* Colonne 3 - Newsletter & Social */}
                    <div className="md:col-span-3">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">
                            Restons connectés
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Suivez-nous sur les réseaux sociaux pour ne rien manquer
                        </p>

                        {/* Réseaux sociaux */}
                        <div className="flex gap-3 mb-6">
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

                        {/* Newsletter */}
                        <div className="mt-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Newsletter</p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="email"
                                    placeholder="Votre email"
                                    className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition"
                                />
                                <button className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition">
                                    S'abonner
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                                Recevez nos offres exclusives
                            </p>
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div className="pt-6 pb-4 text-center">
                    <p className="text-xs text-gray-400">
                        &copy; {currentYear} RAMCI. Tous droits réservés.
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;