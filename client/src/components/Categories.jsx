import React, { useRef, useState, useEffect } from 'react'
import { useAppContext } from '../context/AppContext'

const Categories = () => {

    const { navigate, axios } = useAppContext()
    const scrollRef = useRef(null)
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [showLeftArrow, setShowLeftArrow] = useState(false)
    const [showRightArrow, setShowRightArrow] = useState(true)

    const checkScrollPosition = () => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
            setShowLeftArrow(scrollLeft > 0)
            setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10)
        }
    }

    const scrollLeft = () => {
        scrollRef.current.scrollBy({ left: -250, behavior: 'smooth' })
        setTimeout(checkScrollPosition, 300)
    }

    const scrollRight = () => {
        scrollRef.current.scrollBy({ left: 250, behavior: 'smooth' })
        setTimeout(checkScrollPosition, 300)
    }

    const fetchCategories = async () => {
        try {
            const { data } = await axios.get('/api/category/list')
            if (data.success) {
                setCategories(data.categories)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCategories()
    }, [])

    useEffect(() => {
        if (scrollRef.current) {
            checkScrollPosition()
            window.addEventListener('resize', checkScrollPosition)
            return () => window.removeEventListener('resize', checkScrollPosition)
        }
    }, [categories])

    if (loading) {
        return (
            <div className='mt-16'>
                <p className='text-2xl md:text-3xl font-medium'>Catégories</p>
                <div className='flex justify-center py-10'>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        )
    }

    if (categories.length === 0) {
        return null
    }

    return (
        <div className='mt-16'>
            <p className='text-2xl md:text-3xl font-medium'>Catégories</p>

            <div className='relative mt-6'>
                
                {/* Flèche gauche */}
                {showLeftArrow && (
                    <button 
                        onClick={scrollLeft}
                        className='absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-md rounded-full w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition border border-gray-200'
                    >
                        ‹
                    </button>
                )}

                {/* Liste des catégories (défilement horizontal TOUJOURS actif) */}
                <div 
                    ref={scrollRef} 
                    onScroll={checkScrollPosition}
                    className='flex overflow-x-auto gap-3 pb-2 px-8 md:px-8 [&::-webkit-scrollbar]:hidden scroll-smooth'
                    style={{ scrollbarWidth: 'none' }}
                >
                    {categories.map((category, index) => (
                        <div key={index}
                            className='group cursor-pointer py-3 px-2 gap-2 rounded-lg flex flex-col justify-center items-center flex-shrink-0 w-24'
                            onClick={() => {
                                navigate(`/products/${category.slug}`);
                                scrollTo(0, 0);
                            }}
                        >
                            <div className='rounded-full w-16 h-16 flex items-center justify-center overflow-hidden'
                                style={{ backgroundColor: category.bgColor || '#f0f0f0' }}>
                                {category.image ? (
                                    <img 
                                        src={category.image} 
                                        alt={category.name} 
                                        className='group-hover:scale-108 transition w-full h-full object-cover'
                                    />
                                ) : (
                                    <span className="text-2xl">📁</span>
                                )}
                            </div>
                            <p className='text-xs font-medium text-center'>{category.name}</p>
                        </div>
                    ))}
                </div>

                {/* Flèche droite */}
                {showRightArrow && (
                    <button 
                        onClick={scrollRight}
                        className='absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-md rounded-full w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition border border-gray-200'
                    >
                        ›
                    </button>
                )}

            </div>
        </div>
    )
}

export default Categories