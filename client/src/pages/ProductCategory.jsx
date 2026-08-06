import React from 'react'
import { useAppContext } from '../context/AppContext'
import { useParams, Link } from 'react-router-dom'
import { categories } from '../assets/assets'
import ProductCard from '../components/ProductCard'
import { PackageOpen } from 'lucide-react'

const ProductCategory = () => {

    const { products } =  useAppContext()
    const { category } = useParams()

    const searchCategory = categories.find((item)=> item.path.toLowerCase() === category)

    // Filtrer les produits qui ont cette catégorie (support multiple)
    const filteredProducts = products.filter((product) => {
        // Si le produit a l'ancien format (category)
        if (product.category) {
            return product.category.toLowerCase() === category
        }
        // Si le produit a le nouveau format (categories tableau)
        if (product.categories && product.categories.length > 0) {
            return product.categories.some(cat => cat.toLowerCase() === category)
        }
        return false
    })

    // `categories` vient d'une liste figée dans assets, alors que le catalogue
    // réel est dynamique : une catégorie créée en back-office n'y figure pas et
    // la page s'affichait alors sans titre. À défaut, on rend lisible le slug
    // de l'URL plutôt que de ne rien montrer.
    const titre = searchCategory
        ? searchCategory.text
        : String(category || '').replace(/-/g, ' ')

    return (
        <div className="max-w-7xl mx-auto pt-6 pb-12">

            <header className="mb-5">
                <h1 className="rs-display capitalize">{titre}</h1>
                <p className="text-[13px] text-ink-400 mt-1.5">
                    {filteredProducts.length} article{filteredProducts.length > 1 ? 's' : ''}
                </p>
            </header>

            {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
                    {filteredProducts.map((product)=>(
                        <ProductCard key={product._id} product={product}/>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 px-6">
                    <div className="w-16 h-16 rounded-full bg-ink-50 flex items-center justify-center mx-auto mb-4">
                        <PackageOpen size={26} className="text-ink-400" />
                    </div>
                    <p className="rs-h2 mb-1.5">Rien dans cette catégorie</p>
                    <p className="text-[13px] text-ink-400 mb-6 max-w-[300px] mx-auto">
                        Elle sera réapprovisionnée. En attendant, il y a de quoi faire ailleurs.
                    </p>
                    {/* L'état vide d'origine était une phrase sans issue : le client
                        n'avait aucun moyen de rebondir sans le bouton retour. */}
                    <div className="flex flex-wrap gap-2.5 justify-center">
                        <Link to="/products" className="rs-btn rs-btn--primary">
                            Voir tous les articles
                        </Link>
                        <Link to="/categories" className="rs-btn rs-btn--secondary">
                            Autres catégories
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ProductCategory
