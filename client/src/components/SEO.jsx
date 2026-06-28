import React from 'react'
import { Helmet } from 'react-helmet-async'

const SEO = ({ title, description, keywords, image, url }) => {
  const siteTitle = 'Ramci | Votre boutique en ligne en Côte d\'Ivoire'
  const fullTitle = title ? `${title} | ${siteTitle}` : siteTitle
  const siteDescription = description || 'Ramci - Vêtements, accessoires et plus. Livraison rapide à Abidjan.'
  const siteUrl = url || 'https://www.ramci.ci'
  const siteImage = image || 'https://www.ramci.ci/logo.png'

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={siteDescription} />
      <meta name="keywords" content={keywords || 'boutique en ligne, Ramci, vêtements, accessoires, Côte d\'Ivoire, Abidjan'} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={siteDescription} />
      <meta property="og:image" content={siteImage} />
      <meta property="og:url" content={siteUrl} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={siteDescription} />
      <meta name="twitter:image" content={siteImage} />
      <link rel="canonical" href={siteUrl} />
    </Helmet>
  )
}

export default SEO