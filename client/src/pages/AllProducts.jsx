import React, { useEffect, useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import SEO from '../components/SEO'
import { buildSearchIndex, searchProducts } from '../utils/searchEngine'

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

    const getPageTitle = () => {
        const searchQuery = searchParams.get('search')
        if (searchQuery) return `Résultats pour "${searchQuery}"`
        return 'Tous nos articles'
    }

    const getPageDescription = () => {
        const searchQuery = searchParams.get('search')
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
            
            <div className='mt-16 flex flex-col'>
                <div className='flex flex-col items-end w-max'>
                    <p className='text-2xl font-medium uppercase'>Tous nos articles</p>
                    <div className='w-16 h-0.5 bg-primary rounded-full'></div>
                </div>

                {isFuzzyMatch && filteredProducts.length > 0 && searchParams.get('search') && (
                    <p className='text-sm text-gray-500 mt-4'>
                        Aucun résultat exact pour « {searchParams.get('search')} » — voici les articles les plus proches :
                    </p>
                )}

                <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-6 lg:grid-cols-5 mt-6'>
                    {filteredProducts.length === 0 ? (
                        <div className='col-span-full text-center py-10 text-gray-500'>
                            Aucun article trouvé
                        </div>
                    ) : (
                        filteredProducts.map((product, index) => (
                            <ProductCard key={index} product={product} />
                        ))
                    )}
                </div>
            </div>
        </>
    )
}

export default AllProducts