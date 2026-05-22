import React from 'react'
import { assets } from '../assets/assets'
import { Link } from 'react-router-dom'

const MainBanner = () => {
  return (
    <div className='relative rounded-2xl overflow-hidden mt-6'>
      <img src={assets.main_banner_bg} alt="banner" className='w-full hidden md:block object-cover max-h-80'/>
      <img src={assets.main_banner_bg_sm} alt="banner" className='w-full md:hidden object-cover max-h-56'/>

      <div className='absolute inset-0 flex flex-col items-center md:items-start justify-center pb-0 px-4 md:pl-12 lg:pl-16'>
        <h1 className='text-xl md:text-2xl lg:text-3xl font-bold text-center md:text-left max-w-60 md:max-w-72 lg:max-w-96 leading-snug'>
          Freshness You Can Trust, Savings You will Love!
        </h1>

        <div className='flex items-center mt-4 font-medium'>
          <Link to={"/products"} className='group flex items-center gap-2 px-5 md:px-7 py-2 bg-primary hover:bg-primary-dull transition rounded-full text-white cursor-pointer text-sm'>
            Shop now
            <img className='md:hidden transition group-focus:translate-x-1' src={assets.white_arrow_icon} alt="arrow" />
          </Link>

          <Link to={"/products"} className='group hidden md:flex items-center gap-2 px-7 py-2 cursor-pointer text-sm'>
            Explore deals
            <img className='transition group-hover:translate-x-1' src={assets.black_arrow_icon} alt="arrow" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default MainBanner