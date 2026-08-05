import React from 'react'

// Fallback affiché pendant le chargement d'un chunk lazy (React.lazy).
// Volontairement minimal et sans logique (contrairement à pages/Loading.jsx
// qui gère une redirection) pour éviter tout effet de bord dans un Suspense.
const PageLoader = () => {
  return (
    <div className='flex items-center justify-center h-[60vh] w-full'>
      <div className='w-8 h-8 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin' />
    </div>
  )
}

export default PageLoader