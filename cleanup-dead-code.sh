#!/usr/bin/env bash
# Nettoyage GreenCart — suppression des fichiers/composants morts
# À lancer depuis la racine du repo (là où se trouve le dossier .git)
set -e

echo "== Fichiers parasites à la racine (résidus d'une commande shell mal redirigée) =="
git rm -f "git" "main" "et --hard HEAD~1" 2>/dev/null || true

echo "== Patches obsolètes (diffs déjà intégrés dans l'historique, blobs ne correspondent plus au code actuel) =="
git rm -f "greencart_nouveau_workflow.patch" "patch-phase3.diff" 2>/dev/null || true

echo "== Composants client jamais importés nulle part =="
git rm -f \
  client/src/components/BestSeller.jsx \
  client/src/components/BottomBanner.jsx \
  client/src/components/HeroCarousel.jsx \
  client/src/components/MainBanner.jsx \
  client/src/components/ScrollToTop.jsx \
  client/src/components/VariantSelector.jsx \
  client/src/components/Categories.jsx

echo "== Anciennes pages 'seller' remplacées par leurs équivalents 'admin' (plus jamais lazy-importées) =="
git rm -f \
  client/src/pages/seller/BannerManager.jsx \
  client/src/pages/seller/CategoryManager.jsx \
  client/src/pages/seller/ClientsManager.jsx \
  client/src/pages/seller/CouponManager.jsx \
  client/src/pages/seller/DeliveryManager.jsx \
  client/src/pages/seller/LocationManager.jsx \
  client/src/pages/seller/ProductList.jsx \
  client/src/pages/seller/SettingsManager.jsx \
  client/src/pages/staff/StaffActivation.jsx

echo "== Terminé. Vérifie avec 'git status' puis commit. =="
