import React, { useEffect, useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useSearchParams, Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import SEO from '../components/SEO'
import { buildSearchIndex, searchProducts } from '../utils/searchEngine'
import { SearchX } from 'lucide-react'

const AllProducts = () => {

    const { products } = useAppContext()
    const [searchParams] = useSearchParams()
    const [filteredProducts, setFilteredProducts] = useState([])
    const [isFuzzyMatch, setIsFuzzyMatch] = useState(false)

    // Construit l'index de recherche une seule fois par changement de
    // catalogue, plutôt qu'à chaque frappe/filtre.
    const searchIndex = useMemo(() => buildSearchIndex(products), [products])

    useEffect(() => {
        let result = [...products]
        let fuzzy = false

        // 1. Filtre par recherche — tolérant aux fautes de frappe, accents,
        // ordre des mots, et se rabat sur les résultats les plus proches
        // plutôt que de renvoyer une liste vide.
        const searchQuery = searchParams.get('search')
        if (searchQuery) {
            const { results, fuzzy: isFuzzy } = searchProducts(searchIndex, searchQuery)
            result = results
            fuzzy = isFuzzy
        }

        // 2. Filtre par prix min
        const minPrice = searchParams.get('minPrice')
        if (minPrice) {
            result = result.filter(p => p.offerPrice >= parseInt(minPrice))
        }

        // 3. Filtre par prix max
        const maxPrice = searchParams.get('maxPrice')
        if (maxPrice) {
            result = result.filter(p => p.offerPrice <= parseInt(maxPrice))
        }

        // 4. Filtre par catégories (support multiple)
        const categoriesParam = searchParams.get('categories')
        if (categoriesParam) {
            const categoriesToFilter = categoriesParam.split(',')
            result = result.filter(product => {
                const productCategories = product.categories || [product.category]
                return productCategories.some(cat => categoriesToFilter.includes(cat))
            })
        }

        // 5. Filtre stock (uniquement en stock)
        result = result.filter(product => product.inStock)

        setFilteredProducts(result)
        setIsFuzzyMatch(fuzzy)
    }, [products, searchParams, searchIndex])

    const searchQuery = searchParams.get('search')
    const aDesFiltres = Boolean(searchQuery || searchParams.get('minPrice') || searchParams.get('maxPrice') || searchParams.get('categories'))

    const getPageTitle = () => {
        if (searchQuery) return `Résultats pour "${searchQuery}"`
        return 'Tous nos articles'
    }

    const getPageDescription = () => {
        if (searchQuery) {
            return `Découvrez les articles correspondant à "${searchQuery}" sur Ramci. Vêtements, accessoires et plus.`
        }
        return 'Découvrez tous nos articles sur Ramci. Vêtements, accessoires et plus. Livraison rapide à Abidjan.'
    }

    return (
        <>
            <SEO
                title={getPageTitle()}
                description={getPageDescription()}
                keywords="vêtements, accessoires, boutique en ligne, Ramci, Côte d'Ivoire, Abidjan"
                url="https://www.ramci.ci/products"
            />

            <div className="max-w-7xl mx-auto pt-6 pb-12">

                <header className="mb-5">
                    <h1 className="rs-display">
                        {searchQuery ? 'Résultats' : 'Tous nos articles'}
                    </h1>
                    {/* Le compte était absent : sur une recherche, savoir qu'il y a
                        3 résultats ou 120 change ce qu'on fait ensuite. */}
                    <p className="text-[13px] text-ink-400 mt-1.5">
                        {searchQuery && <>« {searchQuery} » · </>}
                        {filteredProducts.length} article{filteredProducts.length > 1 ? 's' : ''}
                    </p>
                </header>

                {isFuzzyMatch && filteredProducts.length > 0 && searchQuery && (
                    <p className="text-[13px] text-ink-600 bg-warn-50 border border-warn-500/20 rounded-xl px-4 py-3 mb-5">
                        Aucun résultat exact pour « {searchQuery} » — voici les articles les plus proches.
                    </p>
                )}

                {filteredProducts.length === 0 ? (
                    <div className="text-center py-16 px-6">
                        <div className="w-16 h-16 rounded-full bg-ink-50 flex items-center justify-center mx-auto mb-4">
                            <SearchX size={26} className="text-ink-400" />
                        </div>
                        <p className="rs-h2 mb-1.5">Aucun article trouvé</p>
                        <p className="text-[13px] text-ink-400 mb-6 max-w-[320px] mx-auto">
                            {searchQuery
                                ? <>Rien ne correspond à « {searchQuery} ». Essayez un mot plus court, ou parcourez les catégories.</>
                                : 'Aucun article ne correspond à ces filtres.'}
                        </p>
                        <div className="flex flex-wrap gap-2.5 justify-center">
                            {aDesFiltres && (
                                <Link to="/products" className="rs-btn rs-btn--primary">
                                    Voir tous les articles
                                </Link>
                            )}
                            <Link to="/categories" className="rs-btn rs-btn--secondary">
                                Parcourir les catégories
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
                        {/* Clé sur l'identifiant et non sur l'index : avec un index,
                            React réutilise le mauvais composant quand la liste est
                            filtrée, et l'image d'un produit se retrouve sur un autre. */}
                        {filteredProducts.map((product) => (
                            <ProductCard key={product._id} product={product} />
                        ))}
                    </div>
                )}
            </div>
        </>
    )
}

export default AllProducts
