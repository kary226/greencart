import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
import SEO from '../components/SEO';
import { getPresetImageUrl } from '../utils/cloudinaryImage';
import { Store, MapPin, PackageSearch, ChevronLeft } from 'lucide-react';

// Vitrine publique d'une boutique : son identité, puis tous ses articles.
//
// Parti pris : la page appartient au CATALOGUE, pas à la marque de la
// boutique. L'en-tête reste donc sobre (pas de bannière ni de couleur
// d'accent propre au commerçant) et la grille est exactement celle des
// autres listes du site — un client qui arrive ici depuis une fiche produit
// ne doit pas avoir l'impression d'avoir changé de site.

const Squelette = () => (
    <div className="max-w-7xl mx-auto pt-6 pb-12">
        <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-ink-100 animate-pulse" />
            <div className="flex-1 space-y-2">
                <div className="h-6 w-1/2 rounded-lg bg-ink-100 animate-pulse" />
                <div className="h-3.5 w-1/3 rounded-lg bg-ink-100 animate-pulse" />
            </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-2xl bg-ink-100 animate-pulse" />
            ))}
        </div>
    </div>
);

const BoutiqueVitrine = () => {
    const { id } = useParams();
    const { axios } = useAppContext();

    const [boutique, setBoutique] = useState(null);
    const [produits, setProduits] = useState([]);
    const [chargement, setChargement] = useState(true);
    const [introuvable, setIntrouvable] = useState(false);
    const [descriptionDepliee, setDescriptionDepliee] = useState(false);

    useEffect(() => {
        let annule = false;

        (async () => {
            setChargement(true);
            setIntrouvable(false);
            try {
                const { data } = await axios.get(`/api/boutiques/${id}`);
                if (annule) return;
                if (data.success) {
                    setBoutique(data.boutique);
                    setProduits(data.produits || []);
                } else {
                    setIntrouvable(true);
                }
            } catch {
                if (!annule) setIntrouvable(true);
            } finally {
                if (!annule) setChargement(false);
            }
        })();

        return () => { annule = true; };
    }, [axios, id]);

    // Remonter en haut quand on arrive depuis une fiche produit.
    useEffect(() => { window.scrollTo(0, 0); }, [id]);

    if (chargement) return <Squelette />;

    if (introuvable || !boutique) {
        return (
            <div className="max-w-7xl mx-auto pt-6 pb-12">
                <div className="text-center py-16 px-6">
                    <div className="w-16 h-16 rounded-full bg-ink-50 flex items-center justify-center mx-auto mb-4">
                        <Store size={26} className="text-ink-400" />
                    </div>
                    <p className="rs-h2 mb-1.5">Boutique indisponible</p>
                    <p className="text-[13px] text-ink-400 mb-6 max-w-[320px] mx-auto">
                        Cette boutique n'existe plus ou n'est pas accessible pour le moment.
                    </p>
                    <Link to="/products" className="rs-btn rs-btn--primary">Voir tous les articles</Link>
                </div>
            </div>
        );
    }

    // Les zones sont peuplées côté serveur (nom de ville / commune) : c'est
    // l'information la plus utile à un acheteur qui hésite — « est-ce qu'ils
    // livrent chez moi ? ».
    const zones = (boutique.zonesLivraison || [])
        .map((z) => z.communeId?.name || z.cityId?.name)
        .filter(Boolean);
    const zonesAffichees = zones.slice(0, 3);
    const zonesRestantes = zones.length - zonesAffichees.length;

    const description = boutique.description?.trim();
    const descriptionLongue = (description?.length || 0) > 160;

    return (
        <>
            <SEO
                title={boutique.nom}
                description={description || `Découvrez les articles de ${boutique.nom} sur Ramci.`}
                keywords={`${boutique.nom}, boutique, Ramci, Abidjan`}
                url={`https://www.ramci.ci/boutique/${boutique._id}`}
            />

            <div className="max-w-7xl mx-auto pt-4 pb-12">

                {/* Retour : sur mobile, le geste système ne suffit pas quand on
                    arrive par un lien partagé — il faut une porte de sortie. */}
                <Link
                    to="/products"
                    className="inline-flex items-center gap-1 text-[13px] text-ink-400 hover:text-ink-800 transition mb-3 -ml-1 min-h-[44px]"
                >
                    <ChevronLeft size={16} /> Tous les articles
                </Link>

                <header className="border border-ink-200 rounded-2xl p-4 sm:p-5 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-ink-50 border border-ink-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {boutique.logo ? (
                                <img
                                    src={getPresetImageUrl(boutique.logo, 'thumbnail')}
                                    alt={`Logo de ${boutique.nom}`}
                                    className="w-full h-full object-cover"
                                    width={80}
                                    height={80}
                                />
                            ) : (
                                <span className="rs-display text-ink-300" aria-hidden="true">
                                    {boutique.nom?.[0]?.toUpperCase() || 'B'}
                                </span>
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="rs-label text-ink-400 mb-1">Boutique</p>
                            <h1 className="rs-display leading-tight break-words">{boutique.nom}</h1>
                            <p className="text-[13px] text-ink-400 mt-1.5">
                                {produits.length} article{produits.length > 1 ? 's' : ''} en vente
                            </p>
                        </div>
                    </div>

                    {description && (
                        <div className="mt-4">
                            <p
                                className={`text-[13px] leading-relaxed text-ink-600 ${
                                    descriptionLongue && !descriptionDepliee ? 'line-clamp-3' : ''
                                }`}
                            >
                                {description}
                            </p>
                            {descriptionLongue && (
                                <button
                                    type="button"
                                    onClick={() => setDescriptionDepliee((v) => !v)}
                                    className="text-[13px] font-semibold text-ramses-600 mt-1 min-h-[44px]"
                                >
                                    {descriptionDepliee ? 'Réduire' : 'Lire la suite'}
                                </button>
                            )}
                        </div>
                    )}

                    {zonesAffichees.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-ink-100 flex items-start gap-2">
                            <MapPin size={15} className="text-ink-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[13px] text-ink-400">Livre à</span>
                                {zonesAffichees.map((zone) => (
                                    <span
                                        key={zone}
                                        className="text-[12px] font-medium text-ink-700 bg-ink-50 border border-ink-200 rounded-full px-2.5 py-1"
                                    >
                                        {zone}
                                    </span>
                                ))}
                                {zonesRestantes > 0 && (
                                    <span className="text-[12px] text-ink-400">+{zonesRestantes}</span>
                                )}
                            </div>
                        </div>
                    )}
                </header>

                {produits.length === 0 ? (
                    <div className="text-center py-16 px-6">
                        <div className="w-16 h-16 rounded-full bg-ink-50 flex items-center justify-center mx-auto mb-4">
                            <PackageSearch size={26} className="text-ink-400" />
                        </div>
                        <p className="rs-h2 mb-1.5">Aucun article pour l'instant</p>
                        <p className="text-[13px] text-ink-400 mb-6 max-w-[320px] mx-auto">
                            Cette boutique n'a rien en vente actuellement. Revenez plus tard.
                        </p>
                        <Link to="/products" className="rs-btn rs-btn--secondary">Voir tous les articles</Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
                        {produits.map((product) => (
                            <ProductCard key={product._id} product={product} />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

export default BoutiqueVitrine;