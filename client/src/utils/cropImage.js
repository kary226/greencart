const getRadianAngle = (degreeValue) => (degreeValue * Math.PI) / 180;

// Dimensions de la boîte englobante d'une image une fois tournée (sert à créer
// un canvas "scène" assez grand pour ne perdre aucun pixel pendant la rotation).
const rotatedSize = (width, height, rotation) => {
    const rotRad = getRadianAngle(rotation);
    return {
        width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
        height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
    };
};

const loadImage = (src) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

/**
 * Pré-traite l'image pour appliquer un miroir horizontal/vertical.
 * react-easy-crop ne gère pas le flip nativement : on "cuit" le flip dans une
 * nouvelle image (même dimensions naturelles) qu'on lui donne ensuite en entrée,
 * ce qui garde l'aperçu ET le rendu final parfaitement cohérents.
 * Retourne l'URL d'origine telle quelle si aucun flip n'est actif (évite un
 * traitement canvas inutile).
 */
export const getFlippedImage = async (imageSrc, flipH, flipV) => {
    if (!flipH && !flipV) return imageSrc;

    const image = await loadImage(imageSrc);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');

    ctx.translate(flipH ? canvas.width : 0, flipV ? canvas.height : 0);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(image, 0, 0);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), 'image/png');
    });
};

/**
 * Découpe l'image source selon la zone renvoyée par react-easy-crop
 * (onCropComplete), en appliquant rotation, filtres colorimétriques, une zone
 * floutée optionnelle et un texte superposé optionnel.
 *
 * @param {string} imageSrc - URL (ou object URL) de l'image, déjà flippée si besoin.
 * @param {{x:number,y:number,width:number,height:number}} pixelCrop - renvoyé par onCropComplete.
 * @param {number} rotation - en degrés.
 * @param {string} cssFilter - ex: "brightness(100%) contrast(100%) saturate(100%)".
 * @param {{size:number, fx:number, fy:number}|null} blurZone - fractions 0..1 relatives au crop final.
 * @param {{content:string, size:number, color:string, fx:number, fy:number}|null} textOverlay
 * @returns {Promise<Blob>}
 */
export const getCroppedImg = async (
    imageSrc,
    pixelCrop,
    rotation = 0,
    cssFilter = 'none',
    blurZone = null,
    textOverlay = null
) => {
    const image = await loadImage(imageSrc);

    // 1. Dessine l'image entière, tournée + filtrée, dans un canvas "scène"
    //    dimensionné pour contenir toute la rotation (bounding box). Les
    //    coordonnées renvoyées par react-easy-crop sont exprimées dans cet
    //    espace-là.
    const { width: sceneW, height: sceneH } = rotatedSize(image.naturalWidth, image.naturalHeight, rotation);
    const scene = document.createElement('canvas');
    scene.width = sceneW;
    scene.height = sceneH;
    const sctx = scene.getContext('2d');
    sctx.filter = cssFilter;
    sctx.translate(sceneW / 2, sceneH / 2);
    sctx.rotate(getRadianAngle(rotation));
    sctx.translate(-image.naturalWidth / 2, -image.naturalHeight / 2);
    sctx.drawImage(image, 0, 0);

    // 2. Découpe la zone sélectionnée.
    const outW = Math.max(1, Math.round(pixelCrop.width));
    const outH = Math.max(1, Math.round(pixelCrop.height));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(scene, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, outW, outH);

    // 3. Zone floutée — on floute une copie du rendu déjà recadré, puis on ne
    //    recopie que le patch concerné par-dessus l'image nette.
    if (blurZone) {
        const bw = Math.max(4, blurZone.size * Math.min(outW, outH));
        const bx = blurZone.fx * outW - bw / 2;
        const by = blurZone.fy * outH - bw / 2;
        const blurCanvas = document.createElement('canvas');
        blurCanvas.width = outW;
        blurCanvas.height = outH;
        const bctx = blurCanvas.getContext('2d');
        bctx.filter = `blur(${Math.max(2, bw * 0.12)}px)`;
        bctx.drawImage(canvas, 0, 0);
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx, by, bw, bw);
        ctx.clip();
        ctx.drawImage(blurCanvas, 0, 0);
        ctx.restore();
    }

    // 4. Texte — dessiné en dernier, par-dessus tout le reste.
    if (textOverlay && textOverlay.content && textOverlay.content.trim()) {
        const fontPx = (textOverlay.size / 100) * Math.min(outW, outH);
        ctx.font = `700 ${fontPx}px -apple-system, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(1, fontPx * 0.08);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.strokeText(textOverlay.content, textOverlay.fx * outW, textOverlay.fy * outH);
        ctx.fillStyle = textOverlay.color;
        ctx.fillText(textOverlay.content, textOverlay.fx * outW, textOverlay.fy * outH);
    }

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
    });
};