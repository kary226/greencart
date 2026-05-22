import React from 'react'
import BannerCarousel from '../components/BannerCarousel'
import Categories from '../components/Categories'
import BestSeller from '../components/BestSeller'
import NewsLetter from '../components/NewsLetter'

const Home = () => {
  return (
    <div className='mt-10 space-y-10'>
      <BannerCarousel position="top" />
      <Categories />
      <BestSeller />
      <NewsLetter />
      <BannerCarousel position="bottom" className="mt-10" />
    </div>
  )
}

export default Home