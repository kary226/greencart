import React, { useEffect, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'

const AllProducts = () => {

    const { products } = useAppContext()
    const [searchParams] = useSearchParams()
    const [filteredProducts, setFilteredProducts] = useState([])

    useEffect(() => {
        let result = [...products]

        // 1. Filtre par recherche
        const searchQuery = searchParams.get('search')
        if (searchQuery) {
            result = result.filter(product => 
                product.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
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

        // 4. Filtre par catégories
        const categoriesParam = searchParams.get('categories')
        if (categoriesParam) {
            const categories = categoriesParam.split(',')
            result = result.filter(p => categories.includes(p.category))
        }

        // 5. Filtre stock (uniquement en stock)
        result = result.filter(product => product.inStock)

        setFilteredProducts(result)
    }, [products, searchParams])

    return (
        <div className='mt-16 flex flex-col'>
            <div className='flex flex-col items-end w-max'>
                <p className='text-2xl font-medium uppercase'>All products</p>
                <div className='w-16 h-0.5 bg-primary rounded-full'></div>
            </div>

            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-6 lg:grid-cols-5 mt-6'>
                {filteredProducts.length === 0 ? (
                    <div className='col-span-full text-center py-10 text-gray-500'>
                        Aucun produit trouvé
                    </div>
                ) : (
                    filteredProducts.map((product, index) => (
                        <ProductCard key={index} product={product} />
                    ))
                )}
            </div>
        </div>
    )
}

export default AllProducts