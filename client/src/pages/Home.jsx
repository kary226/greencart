import React, { useState } from 'react'
import BannerCarousel from '../components/BannerCarousel'
import Categories from '../components/Categories'
import BestSeller from '../components/BestSeller'
import NewsLetter from '../components/NewsLetter'
import { useAppContext } from '../context/AppContext'
import ProductCard from '../components/ProductCard'
import SEO from '../components/SEO'

const Home = () => {
  const { products } = useAppContext()
  
  // Tous les produits en stock
  const allProducts = products.filter(product => product.inStock === true)
  
  // État pour le nombre de produits affichés
  const [visibleCount, setVisibleCount] = useState(20)
  const loadMoreCount = 20
  
  // Produits actuellement affichés
  const displayedProducts = allProducts.slice(0, visibleCount)
  const hasMore = visibleCount < allProducts.length

  const loadMore = () => {
    setVisibleCount(prev => Math.min(prev + loadMoreCount, allProducts.length))
  }

  return (
    <>
      <SEO 
        title="Accueil"
        description="Mira - Vêtements, accessoires et plus. Livraison rapide à Abidjan."
        keywords="boutique en ligne, Mira, vêtements, accessoires, Côte d'Ivoire, Abidjan"
      />
      
      <div className='mt-10 space-y-10'>
        <BannerCarousel position="top" />
        <Categories />
        <BestSeller />
        
        {/* Section Tous les produits */}
        {allProducts.length > 0 && (
          <div className='px-4'>
            <div className='flex justify-between items-center mb-6'>
              <div>
                <h2 className='text-2xl font-medium'>Tous les produits</h2>
                <div className='w-16 h-0.5 bg-primary rounded-full mt-1'></div>
              </div>
              <button 
                onClick={() => window.location.href = '/products'} 
                className='text-primary hover:underline text-sm'
              >
                Voir tout →
              </button>
            </div>

            {/* Grille verticale */}
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6'>
              {displayedProducts.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>

            {/* Bouton Voir plus (s'il reste des produits) */}
            {hasMore && (
              <div className='flex justify-center mt-8'>
                <button
                  onClick={loadMore}
                  className='px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dull transition text-sm font-medium'
                >
                  Voir plus (+{Math.min(loadMoreCount, allProducts.length - visibleCount)})
                </button>
              </div>
            )}

            {/* Bouton Voir tout (quand tous les produits sont chargés) */}
            {!hasMore && allProducts.length > 0 && (
              <div className='flex justify-center mt-8'>
                <button
                  onClick={() => window.location.href = '/products'}
                  className='px-6 py-2 border border-primary text-primary rounded-lg hover:bg-primary/10 transition text-sm font-medium'
                >
                  Voir tous nos produits →
                </button>
              </div>
            )}
          </div>
        )}

        <NewsLetter />
        <BannerCarousel position="bottom" className="mt-10" />
      </div>
    </>
  )
}

export default Home