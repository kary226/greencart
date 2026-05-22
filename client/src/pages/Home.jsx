import React from 'react'
import BannerCarousel from '../components/BannerCarousel'
import Categories from '../components/Categories'
import BestSeller from '../components/BestSeller'
import NewsLetter from '../components/NewsLetter'
import { useAppContext } from '../context/AppContext'
import ProductCard from '../components/ProductCard'

const Home = () => {
  const { products } = useAppContext()
  
  // Tous les produits en stock
  const allProducts = products.filter(product => product.inStock === true)

  return (
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

          {/* Scroll horizontal */}
          <div className='overflow-x-auto scrollbar-hide pb-4'>
            <div className='flex gap-4 md:gap-6' style={{ minWidth: 'max-content' }}>
              {allProducts.map((product) => (
                <div key={product._id} className='w-[160px] sm:w-[200px] md:w-[220px] flex-shrink-0'>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <NewsLetter />
      <BannerCarousel position="bottom" className="mt-10" />
    </div>
  )
}

export default Home