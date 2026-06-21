import React, { useEffect } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLocation } from 'react-router-dom'

const Loading = () => {

    const { navigate } = useAppContext()
    let { search } = useLocation()
    const query = new URLSearchParams(search)
    const nextUrl = query.get('next');

    useEffect(()=>{
        if(nextUrl){
            setTimeout(()=>{
                navigate(`/${nextUrl}`)
            },5000)
        }
    },[nextUrl])

  return (
    <div className='flex flex-col justify-center items-center h-screen gap-6 px-4'>
      {/* Logo ou nom de la marque */}
      <div className='text-center'>
        <h1 className='text-2xl font-bold text-gray-800' style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Ramci
        </h1>
        <p className='text-sm text-gray-400 mt-1' style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {nextUrl ? 'Redirection en cours...' : 'Chargement...'}
        </p>
      </div>

      {/* Barre de progression moderne */}
      <div className='w-full max-w-xs h-1 bg-gray-100 rounded-full overflow-hidden'>
        <div 
          className='h-full bg-primary rounded-full animate-pulse'
          style={{ 
            width: '60%',
            animation: 'ramci-loading-bar 2s ease-in-out infinite'
          }} 
        />
      </div>

      <style>{`
        @keyframes ramci-loading-bar {
          0%, 100% { width: 20%; }
          50% { width: 80%; }
        }
      `}</style>
    </div>
  )
}

export default Loading