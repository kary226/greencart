import { useEffect, useState, useRef } from "react";
import { useAppContext } from "../context/AppContext";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import ProductReviews from "../components/ProductReviews";
import toast from "react-hot-toast";
import SEO from "../components/SEO";
import RecentlyViewed from "../components/RecentlyViewed";
import DOMPurify from "dompurify";
import { getPresetImageUrl } from "../utils/cloudinaryImage";
// Habillage RAMSES de la fiche produit (voir DESIGN.md a la racine).
import "../styles/product-details.css";

const ProductDetails = () => {
  const {
    products,
    navigate,
    currency,
    addToCart,
    cartItems,
    getCartKey,
    addToRecentlyViewed,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    axios,
  } = useAppContext();
  const { id } = useParams();

  // États
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [variantData, setVariantData] = useState(null);
  const [colorError, setColorError] = useState("");
  const [sizeError, setSizeError] = useState("");
  const [highlightColor, setHighlightColor] = useState(false);
  const [highlightSize, setHighlightSize] = useState(false);
  const [showRelatedPrev, setShowRelatedPrev] = useState(false);
  const [showRelatedNext, setShowRelatedNext] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  // Léger effet de swipe : décalage visuel de l'image pendant le glissement
  // du doigt, et animation de retour au centre au relâchement.
  const [dragOffset, setDragOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [averageRating, setAverageRating] = useState(4);
  const [totalReviews, setTotalReviews] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [showReturnPolicy, setShowReturnPolicy] = useState(false);
  const [returnPolicy, setReturnPolicy] = useState("");
  const [reviewsKey, setReviewsKey] = useState(0);

  // Refs
  const scrollContainerRef = useRef(null);
  const thumbnailRefs = useRef([]);
  const colorSectionRef = useRef(null);
  const sizeSectionRef = useRef(null);
  const relatedCarouselRef = useRef(null);

  const product = products.find((item) => item._id === id);
  const labelType = product?.labelType || "size";

  // Fonctions utilitaires
  const getAllMedia = () => {
    const media = [];
    if (product?.image && product.image.length > 0) {
      product.image.forEach((img) => {
        media.push({ type: "image", url: img });
      });
    }
    if (product?.video) {
      media.push({
        type: "video",
        url: product.video,
        poster: product.image?.[0] || null,
      });
    }
    return media;
  };

  const mediaItems = product ? getAllMedia() : [];
  const totalMedia = mediaItems.length;
  const currentMedia = mediaItems[currentMediaIndex] || null;
  const allImages = product?.image || [];
  const isCurrentVideo = currentMedia?.type === "video";
  const isYouTube = (url) => url?.includes("youtube.com") || url?.includes("youtu.be");
  const isVimeo = (url) => url?.includes("vimeo.com");

  // Aperçu de la boutique du produit (nom + logo), pour la pastille
  // « Vendu par ». Chargé à part : la liste du catalogue ne transporte que
  // l'identifiant, et peupler chaque produit alourdirait toutes les pages.
  const [boutiqueApercu, setBoutiqueApercu] = useState(null);

  useEffect(() => {
    const boutiqueId = product?.boutiqueId?._id || product?.boutiqueId;
    if (!boutiqueId) {
      setBoutiqueApercu(null);
      return;
    }

    let annule = false;
    (async () => {
      try {
        const { data } = await axios.get(`/api/boutiques/${boutiqueId}/apercu`);
        if (!annule && data.success) setBoutiqueApercu(data.boutique);
      } catch (error) {
        // Boutique suspendue ou supprimée : la fiche reste utilisable, on
        // n'affiche simplement pas la pastille.
        if (!annule) setBoutiqueApercu(null);
      }
    })();

    return () => { annule = true; };
  }, [product?.boutiqueId, axios]);

  // Effets
  useEffect(() => {
    const fetchReturnPolicy = async () => {
      try {
        const { data } = await axios.get("/api/setting/return-policy");
        if (data.success && data.data) {
          setReturnPolicy(data.data);
        }
      } catch (error) {
        console.error("Erreur chargement politique de retour:", error);
      }
    };
    fetchReturnPolicy();
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current && thumbnailRefs.current[currentMediaIndex]) {
      thumbnailRefs.current[currentMediaIndex].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentMediaIndex]);

  // Variante par défaut affichée à l'arrivée sur la fiche produit
  useEffect(() => {
    if (product && product.variants && product.variants.length > 0) {
      const defaultVariant = product.variants[0];
      setSelectedColor(defaultVariant.color);
      setVariantData(defaultVariant);
      setCurrentMediaIndex(defaultVariant.startImageIndex || 0);
    } else {
      setVariantData(null);
      setCurrentMediaIndex(0);
    }
  }, [product]);

  // Calcule la variante affichée (stock, prix, photo) à chaque changement
  useEffect(() => {
    if (!product || !product.variants || product.variants.length === 0) return;

    const exactVariant = product.variants.find((v) => {
      const colorMatch = selectedColor ? v.color === selectedColor : !v.color;
      const sizeMatch = selectedSize ? v.size === selectedSize : !v.size;
      return colorMatch && sizeMatch;
    });

    if (exactVariant) {
      setVariantData(exactVariant);
      setCurrentMediaIndex(exactVariant.startImageIndex || 0);
      if (selectedColor) {
        setColorError("");
        setHighlightColor(false);
      }
      return;
    }

    if (selectedColor) {
      const colorVariant = product.variants.find((v) => v.color === selectedColor);
      if (colorVariant) {
        setVariantData(colorVariant);
        setCurrentMediaIndex(colorVariant.startImageIndex || 0);
        setColorError("");
        setHighlightColor(false);
      }
    }
  }, [selectedColor, selectedSize, product]);

  useEffect(() => {
    if (selectedSize) {
      setSizeError("");
      setHighlightSize(false);
    }
  }, [selectedSize]);

  useEffect(() => {
    if (product) {
      addToRecentlyViewed(product);
      setReviewsKey((prev) => prev + 1);
    }
  }, [product]);

  // Préchargement des photos voisines (précédente/suivante) : pendant que
  // l'utilisateur regarde la photo courante, le navigateur va déjà chercher
  // les deux voisines en arrière-plan. Au moment du swipe, l'image est donc
  // déjà en cache et s'affiche sans latence perceptible.
  useEffect(() => {
    if (totalMedia < 2) return;

    const preload = (index) => {
      const item = mediaItems[index];
      if (item?.type === "image" && item.url) {
        const img = new Image();
        img.src = getPresetImageUrl(item.url, "detail");
      }
    };

    const nextIndex = currentMediaIndex === totalMedia - 1 ? 0 : currentMediaIndex + 1;
    const prevIndex = currentMediaIndex === 0 ? totalMedia - 1 : currentMediaIndex - 1;

    preload(nextIndex);
    preload(prevIndex);
  }, [currentMediaIndex, totalMedia, mediaItems]);

  // Navigation carrousel
  const checkRelatedScroll = () => {
    if (relatedCarouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = relatedCarouselRef.current;
      setShowRelatedPrev(scrollLeft > 20);
      setShowRelatedNext(scrollLeft + clientWidth < scrollWidth - 20);
    }
  };

  const scrollRelated = (direction) => {
    if (relatedCarouselRef.current) {
      const scrollAmount = direction === "left" ? -280 : 280;
      relatedCarouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
      setTimeout(checkRelatedScroll, 300);
    }
  };

  // Gestion du toucher pour le carrousel
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(e.targetTouches[0].clientX);
    setIsSwiping(true);
    setDragOffset(0);
  };

  const handleTouchMove = (e) => {
    const x = e.targetTouches[0].clientX;
    setTouchEnd(x);

    // L'image suit le doigt. Résistance (facteur réduit) sur la première
    // et dernière photo, quand on essaie de swiper au-delà — même principe
    // que le "rubber band" iOS, pour ne pas donner l'impression que ça bloque.
    let offset = x - touchStart;
    const atStart = currentMediaIndex === 0 && offset > 0;
    const atEnd = currentMediaIndex === totalMedia - 1 && offset < 0;
    if (atStart || atEnd) offset *= 0.35;

    setDragOffset(offset);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setTouchStart(0);
      setTouchEnd(0);
      setIsSwiping(false);
      setDragOffset(0);
      return;
    }
    const diff = touchStart - touchEnd;
    const threshold = 50;
    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentMediaIndex < totalMedia - 1) {
        setCurrentMediaIndex(currentMediaIndex + 1);
      } else if (diff < 0 && currentMediaIndex > 0) {
        setCurrentMediaIndex(currentMediaIndex - 1);
      }
    }
    setTouchStart(0);
    setTouchEnd(0);
    // isSwiping repasse à false -> la transition CSS prend le relais pour
    // ramener l'image (nouvelle ou inchangée) en douceur vers le centre.
    setIsSwiping(false);
    setDragOffset(0);
  };

  const goToPrevMedia = () => {
    setCurrentMediaIndex((prev) => (prev === 0 ? totalMedia - 1 : prev - 1));
  };

  const goToNextMedia = () => {
    setCurrentMediaIndex((prev) => (prev === totalMedia - 1 ? 0 : prev + 1));
  };

  // Fonctions produits
  const getProductCategory = () => {
    if (product?.categories && product.categories.length > 0) {
      return product.categories[0];
    }
    return product?.category;
  };

  const getProductDescription = () => {
    if (!product?.description) return "";
    if (Array.isArray(product.description)) {
      return product.description.join(" ");
    }
    return product.description.replace(/<[^>]*>/g, "");
  };

  // Données des variantes
  const uniqueColors =
    product && product.variants
      ? [...new Set(product.variants.map((v) => v.color).filter(Boolean))]
      : [];
  const uniqueSizes =
    product && product.variants
      ? [...new Set(product.variants.map((v) => v.size).filter(Boolean))]
      : [];

  const currentPrice = variantData?.price || product?.price;
  const currentOfferPrice = variantData?.offerPrice || product?.offerPrice;
  const currentStock = variantData?.stock ?? product?.stock ?? 0;

  const getVariantStock = () => {
    if (!product?.variants?.length) return product?.inStock ? product?.stock : 0;
    const variant = product.variants.find(
      (v) =>
        (selectedColor ? v.color === selectedColor : !v.color) &&
        (selectedSize ? v.size === selectedSize : !v.size)
    );
    return variant ? variant.stock : 0;
  };

  const isSizeAvailable = (size) => {
    if (!selectedColor) {
      return product.variants.some((v) => v.size === size && v.stock > 0);
    }
    const variant = product.variants.find(
      (v) => v.color === selectedColor && v.size === size
    );
    return variant ? variant.stock > 0 : false;
  };

  const getStockForSize = (size) => {
    if (selectedColor) {
      const variant = product.variants.find(
        (v) => v.color === selectedColor && v.size === size
      );
      return variant ? variant.stock : 0;
    }
    const variantsWithSize = product.variants.filter((v) => v.size === size);
    return variantsWithSize.reduce((sum, v) => sum + v.stock, 0);
  };

  const variantStock = getVariantStock();
  const cartKey = getCartKey(product?._id, selectedColor, selectedSize);
  const currentQty = cartItems[cartKey] || 0;

  // Labels et styles
  const getStockLabel = (stock) => {
    if (stock === null || stock === undefined) return null;
    if ((uniqueColors.length > 0 && !selectedColor) || (uniqueSizes.length > 0 && !selectedSize))
      return null;
    if (stock === 0) return "Rupture de stock";
    if (stock <= 5) return `Plus que ${stock} en stock`;
    return `En stock (${stock})`;
  };

  const getStockColor = (stock) => {
    if (stock === null || stock === undefined) return "";
    if (stock === 0) return "#e53935";
    if (stock <= 5) return "#ff9800";
    return "#4caf50";
  };

  const scrollToElement = (ref, setHighlight) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlight(true);
      setTimeout(() => setHighlight(false), 1500);
    }
  };

  // Validation et actions
  const validateAndProceed = (action) => {
    let hasError = false;
    if (uniqueColors.length > 0 && !selectedColor) {
      setColorError("Choisissez une couleur");
      scrollToElement(colorSectionRef, setHighlightColor);
      hasError = true;
    }
    if (!hasError && uniqueSizes.length > 0 && !selectedSize) {
      setSizeError("Choisissez une taille");
      scrollToElement(sizeSectionRef, setHighlightSize);
      hasError = true;
    }
    if (hasError) return false;
    if (variantStock !== null && variantStock === 0) {
      toast.error("Épuisé");
      return false;
    }
    if (variantStock !== null && currentQty >= variantStock) {
      toast.error(`Stock limité à ${variantStock}`);
      return false;
    }
    return true;
  };

  const handleAddToCart = () => {
    if (validateAndProceed("add")) {
      addToCart(product._id, selectedColor, selectedSize);
      toast.success("Ajouté au panier");
    }
  };

  const handleBuyNow = () => {
    if (validateAndProceed("buy")) {
      addToCart(product._id, selectedColor, selectedSize);
      navigate("/cart");
    }
  };

  // Rendu des étoiles
  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const decimal = rating % 1;
    const hasHalfStar = decimal >= 0.5;
    return (
      <div className="pd-stars">
        {[...Array(5)].map((_, i) => {
          if (i < fullStars) {
            return (
              <svg key={i} className="pd-star full" viewBox="0 0 24 24">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            );
          } else if (i === fullStars && hasHalfStar) {
            return (
              <svg key={i} className="pd-star half" viewBox="0 0 24 24">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" clipPath="url(#half)" />
              </svg>
            );
          } else {
            return (
              <svg key={i} className="pd-star empty" viewBox="0 0 24 24">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            );
          }
        })}
      </div>
    );
  };

  const handleReviewsData = (data) => {
    setAverageRating(data.averageRating);
    setTotalReviews(data.totalReviews);
  };

  const handleColorSelect = (color) => {
    setSelectedColor(selectedColor === color ? null : color);
    setSelectedSize(null);
  };

  // Effet pour les produits liés
  useEffect(() => {
    if (products.length > 0 && product) {
      let productsCopy = products.slice();
      const productCategory = getProductCategory();
      productsCopy = productsCopy.filter((item) => {
        if (item.category) {
          return item.category === productCategory && item._id !== product._id;
        }
        if (item.categories && item.categories.length > 0) {
          return item.categories.includes(productCategory) && item._id !== product._id;
        }
        return false;
      });
      setRelatedProducts(productsCopy.slice(0, 12));
      setTimeout(checkRelatedScroll, 100);
    }
    setSelectedColor(null);
    setSelectedSize(null);
    setCurrentMediaIndex(0);
    setAverageRating(4);
    setTotalReviews(0);
    setVariantData(null);
    setColorError("");
    setSizeError("");
    setHighlightColor(false);
    setHighlightSize(false);
    setShowDetails(false);
  }, [products, id]);

  if (!product) return null;

  const discount =
    currentOfferPrice && currentOfferPrice < currentPrice
      ? Math.round(((currentPrice - currentOfferPrice) / currentPrice) * 100)
      : null;

  const labelText = labelType === "variant" ? "Variante" : "Taille";

  return (
    <>
      <SEO
        title={product.name}
        description={getProductDescription().slice(0, 160)}
        keywords={`${product.name}, ${product.category}, vêtements, accessoires`}
        image={allImages[0]}
        url={`https://www.ramci.ci/products/all/${product._id}`}
      />

      <div className="pd-breadcrumb">
        <span className="pd-breadcrumb-static">
          <Link to="/">Accueil</Link> / <Link to="/products">Articles</Link> /
        </span>
        <span className="pd-breadcrumb-current">{product.name}</span>
      </div>

      <div className="pd-main">
        <div className="pd-gallery">
          <div
            className="pd-main-img"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="pd-media-track"
              style={{
                transform: `translateX(${dragOffset}px)`,
                transition: isSwiping ? "none" : "transform 0.25s ease-out",
              }}
            >
              {!isCurrentVideo ? (
                // Pas de loading="lazy" ici : c'est l'image principale visible
                // au premier affichage (LCP), on veut qu'elle charge tout de
                // suite — seule la largeur est optimisée via Cloudinary.
                <img src={getPresetImageUrl(currentMedia?.url, "detail")} alt={product.name} />
              ) : (
                <div className="pd-video-slide">
                  {isYouTube(currentMedia?.url) ? (
                    <iframe
                      src={
                        currentMedia.url.replace("watch?v=", "embed/").split("&")[0] +
                        "?autoplay=1"
                      }
                      className="pd-video-iframe"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={`Vidéo ${product.name}`}
                      loading="lazy"
                    />
                  ) : isVimeo(currentMedia?.url) ? (
                    <iframe
                      src={
                        currentMedia.url.replace("vimeo.com/", "player.vimeo.com/video/") +
                        "?autoplay=1"
                      }
                      className="pd-video-iframe"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      title={`Vidéo ${product.name}`}
                      loading="lazy"
                    />
                  ) : (
                    <video
                      src={currentMedia?.url}
                      className="pd-video-player"
                      controls
                      poster={currentMedia?.poster}
                      autoPlay
                      playsInline
                    />
                  )}
                </div>
              )}
            </div>

            {isCurrentVideo && <span className="pd-video-badge">▶ VIDÉO</span>}

            {totalMedia > 1 && (
              <span className="pd-counter">
                {currentMediaIndex + 1}/{totalMedia}
              </span>
            )}

            {totalMedia > 1 && !isMobile && (
              <>
                <button className="pd-nav pd-nav-prev" onClick={goToPrevMedia}>
                  ‹
                </button>
                <button className="pd-nav pd-nav-next" onClick={goToNextMedia}>
                  ›
                </button>
              </>
            )}
          </div>

          {totalMedia > 1 && (
            <div className="pd-dots">
              {mediaItems.map((_, i) => (
                <span
                  key={i}
                  className={`pd-dot ${currentMediaIndex === i ? "active" : ""}`}
                  onClick={() => setCurrentMediaIndex(i)}
                />
              ))}
            </div>
          )}

          {totalMedia > 1 && (
            <div className="pd-thumbs" ref={scrollContainerRef}>
              {mediaItems.map((media, i) => (
                <div
                  key={i}
                  ref={(el) => (thumbnailRefs.current[i] = el)}
                  className={`pd-thumb ${currentMediaIndex === i ? "active" : ""}`}
                  onClick={() => setCurrentMediaIndex(i)}
                >
                  {media.type === "image" ? (
                    <img src={getPresetImageUrl(media.url, "thumbnail")} alt="" loading="lazy" />
                  ) : (
                    <div className="pd-thumb-video">
                      <img
                        src={getPresetImageUrl(media.poster || allImages[0] || "/placeholder.jpg", "thumbnail")}
                        alt="Vidéo"
                        loading="lazy"
                      />
                      <div className="pd-thumb-play-icon">▶</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pd-info">
          <h1 className="pd-title">{product.name}</h1>

          {boutiqueApercu && (
            <Link
              to={`/boutique/${boutiqueApercu._id}`}
              className="pd-shop"
              aria-label={`Voir la boutique ${boutiqueApercu.nom}`}
            >
              <span className="pd-shop-avatar" aria-hidden="true">
                {boutiqueApercu.logo ? (
                  <img
                    src={getPresetImageUrl(boutiqueApercu.logo, "thumbnail")}
                    alt=""
                    width={28}
                    height={28}
                    loading="lazy"
                  />
                ) : (
                  boutiqueApercu.nom?.[0]?.toUpperCase() || "B"
                )}
              </span>
              <span className="pd-shop-text">
                <span className="pd-shop-label">Vendu par</span>
                <span className="pd-shop-name">{boutiqueApercu.nom}</span>
              </span>
              <svg
                className="pd-shop-chevron"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          )}

          <div className="pd-price">
            {discount && (
              <span className="pd-old">
                {currentPrice} {currency}
              </span>
            )}
            <span className="pd-current">
              {currentOfferPrice && currentOfferPrice < currentPrice
                ? currentOfferPrice
                : currentPrice}{" "}
              {currency}
            </span>
            {discount && <span className="pd-discount">-{discount}%</span>}

            <button
              type="button"
              className={`pd-wishlist-btn${isInWishlist?.(product._id) ? " active" : ""}`}
              onClick={() =>
                isInWishlist?.(product._id)
                  ? removeFromWishlist?.(product._id)
                  : addToWishlist?.(product._id)
              }
              aria-label={
                isInWishlist?.(product._id)
                  ? `Retirer ${product.name} des favoris`
                  : `Ajouter ${product.name} aux favoris`
              }
              aria-pressed={isInWishlist?.(product._id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          </div>

          <div className="pd-rating">
            {renderStars(averageRating)}
            <span className="pd-rating-text">
              {averageRating}/5 ({totalReviews} avis)
            </span>
          </div>

          {getStockLabel(currentStock) && (
            <p className="pd-stock" style={{ color: getStockColor(currentStock) }}>
              {getStockLabel(currentStock)}
            </p>
          )}

          {uniqueColors.length > 0 && (
            <div
              ref={colorSectionRef}
              className={`pd-option ${highlightColor ? "error" : ""}`}
            >
              <p className="pd-option-label">
                Couleur {selectedColor && <span>— {selectedColor}</span>}
              </p>
              <div className="pd-colors">
                {uniqueColors.map((color, i) => {
                  const variant = product.variants.find((v) => v.color === color);
                  const available = variant?.stock > 0;
                  return (
                    <button
                      key={i}
                      className={`pd-color ${selectedColor === color ? "active" : ""} ${
                        !available ? "disabled" : ""
                      }`}
                      onClick={() => handleColorSelect(color)}
                      disabled={!available}
                    >
                      <span
                        className="pd-swatch"
                        style={{ backgroundColor: variant?.colorCode || "#ccc" }}
                      />
                      <span className="pd-color-label">{color}</span>
                    </button>
                  );
                })}
              </div>
              {colorError && <p className="pd-error">{colorError}</p>}
            </div>
          )}

          {uniqueSizes.length > 0 && (
            <div
              ref={sizeSectionRef}
              className={`pd-option ${highlightSize ? "error" : ""}`}
            >
              <p className="pd-option-label">
                {labelText} {selectedSize && <span>— {selectedSize}</span>}
                {selectedSize && (
                  <span className="pd-size-stock-label">
                    {(() => {
                      const stock = getStockForSize(selectedSize);
                      return stock > 0
                        ? ` (${stock} disponible${stock > 1 ? "s" : ""})`
                        : " (Rupture)";
                    })()}
                  </span>
                )}
              </p>
              <div className="pd-sizes">
                {uniqueSizes.map((size, i) => {
                  const stock = getStockForSize(size);
                  const available = stock > 0;

                  return (
                    <button
                      key={i}
                      className={`pd-size ${selectedSize === size ? "active" : ""} ${
                        !available ? "disabled" : ""
                      }`}
                      onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                      disabled={!available}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
              {sizeError && <p className="pd-error">{sizeError}</p>}
            </div>
          )}

          {currentQty > 0 && (
            <p className="pd-cart-indicator">{currentQty} dans le panier</p>
          )}

          <div className="pd-details">
            <button
              type="button"
              className={`pd-details-btn ${showDetails ? "open" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                setShowDetails(!showDetails);
              }}
            >
              Détails <span>{showDetails ? "▲" : "▼"}</span>
            </button>
            {showDetails && (
              <div className="pd-details-content">
                <div
                  className="pd-description-html"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(product.description || ""),
                  }}
                />
              </div>
            )}
          </div>

          {returnPolicy && (
            <div className="pd-return-policy">
              <button
                type="button"
                className={`pd-return-policy-btn ${showReturnPolicy ? "open" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  setShowReturnPolicy(!showReturnPolicy);
                }}
              >
                Politique de retour <span>{showReturnPolicy ? "▲" : "▼"}</span>
              </button>
              {showReturnPolicy && (
                <div className="pd-return-policy-content">
                  <div
                    className="pd-return-policy-html"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(returnPolicy),
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <div className="pd-related">
          <div className="pd-section-header">
            <h2>Articles similaires</h2>
            <p>Vous pourriez aussi aimer</p>
          </div>
          <div className="pd-carousel-wrapper">
            {showRelatedPrev && (
              <button
                className="pd-carousel-nav pd-carousel-prev"
                onClick={() => scrollRelated("left")}
              >
                ‹
              </button>
            )}
            <div
              className="pd-carousel"
              ref={relatedCarouselRef}
              onScroll={checkRelatedScroll}
            >
              {relatedProducts
                .filter((p) => p.inStock)
                .map((p) => (
                  <div key={p._id} className="pd-carousel-item">
                    <ProductCard product={p} />
                  </div>
                ))}
            </div>
            {showRelatedNext && (
              <button
                className="pd-carousel-nav pd-carousel-next"
                onClick={() => scrollRelated("right")}
              >
                ›
              </button>
            )}
          </div>
        </div>
      )}

      <div className="pd-reviews">
        <div className="pd-section-header">
          <h2>Avis clients</h2>
          <p>
            {totalReviews > 0
              ? `${totalReviews} avis • ${averageRating}/5`
              : "Soyez le premier à donner votre avis"}
          </p>
        </div>
        <ProductReviews
          productId={product._id}
          onDataChange={handleReviewsData}
          key={reviewsKey}
        />
      </div>

      <RecentlyViewed key={reviewsKey} />

      <div className="pd-floating">
        <button className="pd-btn-cart" onClick={handleAddToCart}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          Ajouter
        </button>
        <button className="pd-btn-buy" onClick={handleBuyNow}>
          Acheter
        </button>
      </div>
    </>
  );
};

export default ProductDetails;