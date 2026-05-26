import React from 'react'
import { Helmet } from 'react-helmet-async'

const SEO = ({ title, description, keywords, image, url }) => {
  const siteTitle = 'GreenCart - Votre marché en ligne'
  const fullTitle = title ? `${title} | GreenCart` : siteTitle
  const siteDescription = description || 'GreenCart - Achetez des produits de qualité en Côte d\'Ivoire. Livraison rapide et paiement sécurisé.'
  const siteUrl = url || 'https://greencart-ci.vercel.app'
  const siteImage = image || 'https://greencart-ci.vercel.app/logo.png'

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={siteDescription} />
      <meta name="keywords" content={keywords || 'e-commerce, GreenCart, produits, Côte d\'Ivoire, livraison'} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      
      {/* Open Graph (Facebook/WhatsApp) */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={siteDescription} />
      <meta property="og:image" content={siteImage} />
      <meta property="og:url" content={siteUrl} />
      <meta property="og:type" content="website" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={siteDescription} />
      <meta name="twitter:image" content={siteImage} />
      
      <link rel="canonical" href={siteUrl} />
    </Helmet>
  )
}

export default SEO