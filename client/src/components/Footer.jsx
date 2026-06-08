import { assets, footerLinks } from "../assets/assets";
import { Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone, Clock } from 'lucide-react';

const Footer = () => {

    const currentYear = new Date().getFullYear();

    const socialLinks = [
        { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
        { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
        { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
        { icon: Youtube, href: "https://youtube.com", label: "YouTube" },
    ];

    return (
        <footer className="bg-white border-t border-gray-100 pt-12 pb-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Contenu principal */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-gray-100">
                    
                    {/* Colonne 1 - Logo & Infos */}
                    <div className="md:col-span-4">
                        <img className="h-8 w-auto mb-4" src={assets.logo} alt="logo" />
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
                                <span>+225 01 01 04 49 42</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Mail size={16} className="text-red-500 flex-shrink-0" />
                                <span>contact@ramci.com</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Clock size={16} className="text-red-500 flex-shrink-0" />
                                <span>Lun - Sam: 8h - 20h</span>
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
                                    <social.icon size={18} />
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
                        Conçu avec ❤️ en Côte d'Ivoire
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;