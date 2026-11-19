const getRadianAngle = (degreeValue) => (degreeValue * Math.PI) / 180;

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

export const getCroppedImg = async (
    imageSrc,
    pixelCrop,
    rotation = 0,
    cssFilter = 'none',
    blurZone = null,
    textOverlay = null
) => {
    const image = await loadImage(imageSrc);

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

    const outW = Math.max(1, Math.round(pixelCrop.width));
    const outH = Math.max(1, Math.round(pixelCrop.height));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(scene, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, outW, outH);

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