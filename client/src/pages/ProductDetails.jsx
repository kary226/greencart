import SEO from "../components/SEO";

// Extraire la description textuelle du produit
const getProductDescription = () => {
    if (product?.description && Array.isArray(product.description)) {
        return product.description.join(' ').slice(0, 160)
    }
    return product?.description || ''
}

<SEO 
    title={product.name}
    description={getProductDescription()}
    keywords={`${product.name}, ${product.category}, achat, GreenCart, Côte d'Ivoire`}
    image={product.image[0]}
    url={`https://greencart-ci.vercel.app/products/${getProductCategory()?.toLowerCase()}/${product._id}`}
/>