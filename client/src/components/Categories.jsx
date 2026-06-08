import React, { useRef, useState, useEffect } from 'react'
import { useAppContext } from '../context/AppContext'
import { ChevronLeft, ChevronRight, Package, Grid } from 'lucide-react'

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
        scrollRef.current.scrollBy({ left: -280, behavior: 'smooth' })
        setTimeout(checkScrollPosition, 300)
    }

    const scrollRight = () => {
        scrollRef.current.scrollBy({ left: 280, behavior: 'smooth' })
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
            <div className="bg-white pt-20 pb-10 px-4">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Catégories</h2>
                    <div className="flex justify-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
                    </div>
                </div>
            </div>
        )
    }

    if (categories.length === 0) {
        return null
    }

    return (
        <div className="bg-white pt-8 pb-6 px-4">
            <div className="max-w-7xl mx-auto">
                {/* En-tête */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Catégories</h2>
                        <div className="w-12 h-0.5 bg-red-500 rounded-full mt-2"></div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => navigate('/categories')}
                            className="text-sm text-gray-500 hover:text-red-500 transition flex items-center gap-1"
                        >
                            <Grid size={14} />
                            Voir tout
                        </button>
                    </div>
                </div>

                {/* Carrousel */}
                <div className='relative'>
                    
                    {/* Flèche gauche */}
                    {showLeftArrow && (
                        <button 
                            onClick={scrollLeft}
                            className='absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-100 hover:text-red-500 transition border border-gray-200 -ml-3'
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}

                    {/* Liste des catégories */}
                    <div 
                        ref={scrollRef} 
                        onScroll={checkScrollPosition}
                        className='flex overflow-x-auto gap-4 pb-3 px-2 scroll-smooth'
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        <style>{`
                            div::-webkit-scrollbar {
                                display: none;
                            }
                        `}</style>
                        
                        {categories.map((category, index) => (
                            <div key={index}
                                className='group cursor-pointer flex-shrink-0 w-24 text-center transition-transform hover:-translate-y-1 duration-200'
                                onClick={() => {
                                    navigate(`/products?categories=${category.slug}`);
                                    scrollTo(0, 0);
                                }}
                            >
                                {/* Cercle image */}
                                <div className='relative mx-auto mb-3'>
                                    <div className='w-20 h-20 rounded-full overflow-hidden shadow-md transition-all duration-300 group-hover:shadow-lg group-hover:scale-105'
                                        style={{ backgroundColor: category.bgColor || '#f3f4f6' }}>
                                        {category.image ? (
                                            <img 
                                                src={category.image} 
                                                alt={category.name} 
                                                className='w-full h-full object-cover'
                                            />
                                        ) : (
                                            <div className='w-full h-full flex items-center justify-center'>
                                                <Package size={28} className="text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Nom */}
                                <p className='text-sm font-medium text-gray-700 group-hover:text-red-500 transition line-clamp-1'>
                                    {category.name}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Flèche droite */}
                    {showRightArrow && (
                        <button 
                            onClick={scrollRight}
                            className='absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-100 hover:text-red-500 transition border border-gray-200 -mr-3'
                        >
                            <ChevronRight size={20} />
                        </button>
                    )}

                </div>
            </div>
        </div>
    )
}

export default Categories