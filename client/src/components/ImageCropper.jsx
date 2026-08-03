import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * ImageCropper — recadrage libre, moderne, desktop-first.
 *
 * Props :
 * - imageFile : File | Blob — l'image à recadrer
 * - onCropComplete(blob: Blob) — appelé avec l'image recadrée (PNG)
 * - onCancel() — fermeture sans appliquer
 * - aspectRatio (optionnel) — ratio initial (ex: 16/9). Laisser undefined pour "libre".
 * - cropShape ('rect' | 'round') — forme du masque de prévisualisation
 */

const PRESETS = [
    { label: 'Libre', value: null },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:4', value: 3 / 4 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
];

const MIN_CROP = 40;

const ImageCropper = ({ imageFile, onCropComplete, onCancel, aspectRatio = null, cropShape = 'rect', lockAspectRatio = false }) => {
    const containerRef = useRef(null);
    const cropLayerRef = useRef(null);
    const imgRef = useRef(null);
    const [imgSrc, setImgSrc] = useState(null);
    const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
    const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });

    // Transformations de l'image (zoom / rotation / flip)
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [flipH, setFlipH] = useState(false);
    const [flipV, setFlipV] = useState(false);

    // Réglages colorimétriques (appliqués à l'aperçu ET au rendu final)
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [saturate, setSaturate] = useState(100);

    // Calques additionnels — un texte et une zone floutée, positionnés en coordonnées
    // fractionnaires (0 à 1) RELATIVES à la zone de recadrage, pour rester cohérents
    // quelle que soit la taille finale exportée.
    const [textOverlay, setTextOverlay] = useState(null); // { content, size, color, fx, fy }
    const [blurZone, setBlurZone] = useState(null); // { size, fx, fy }

    // Zone de recadrage en coordonnées d'affichage (px, relatives au conteneur d'image)
    const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
    const [ratio, setRatio] = useState(aspectRatio);

    const dragState = useRef(null);

    // Charger l'image
    useEffect(() => {
        const url = URL.createObjectURL(imageFile);
        setImgSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [imageFile]);

    const computeLayout = useCallback(() => {
        const img = imgRef.current;
        const container = containerRef.current;
        if (!img || !container || !naturalSize.w) return;

        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const scale = Math.min(cw / naturalSize.w, ch / naturalSize.h);
        const dw = naturalSize.w * scale;
        const dh = naturalSize.h * scale;
        setDisplaySize({ w: dw, h: dh });

        // Crop initial centré, le plus grand possible selon le ratio
        let cropW, cropH;
        if (ratio) {
            if (dw / dh > ratio) {
                cropH = dh * 0.9;
                cropW = cropH * ratio;
            } else {
                cropW = dw * 0.9;
                cropH = cropW / ratio;
            }
        } else {
            cropW = dw * 0.8;
            cropH = dh * 0.8;
        }
        setCrop({
            x: (dw - cropW) / 2,
            y: (dh - cropH) / 2,
            w: cropW,
            h: cropH,
        });
    }, [naturalSize, ratio]);

    const handleImgLoad = (e) => {
        setNaturalSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
    };

    useEffect(() => {
        computeLayout();
        const onResize = () => computeLayout();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [naturalSize]);

    // Recalcule la zone de crop quand le ratio change (sans recharger l'image)
    useEffect(() => {
        if (!displaySize.w) return;
        setCrop((prev) => {
            const cx = prev.x + prev.w / 2;
            const cy = prev.y + prev.h / 2;
            let w = prev.w;
            let h = prev.h;
            if (ratio) {
                // Conserve l'aire approx., ajuste au ratio
                const area = w * h;
                h = Math.sqrt(area / ratio);
                w = h * ratio;
                w = Math.min(w, displaySize.w);
                h = Math.min(h, displaySize.h);
                if (w / h > ratio) w = h * ratio; else h = w / ratio;
            }
            let x = cx - w / 2;
            let y = cy - h / 2;
            x = Math.max(0, Math.min(x, displaySize.w - w));
            y = Math.max(0, Math.min(y, displaySize.h - h));
            return { x, y, w, h };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ratio]);

    // --- Interaction : déplacement / redimensionnement ---
    const clampCrop = (c) => {
        let { x, y, w, h } = c;
        w = Math.max(MIN_CROP, Math.min(w, displaySize.w));
        h = Math.max(MIN_CROP, Math.min(h, displaySize.h));
        x = Math.max(0, Math.min(x, displaySize.w - w));
        y = Math.max(0, Math.min(y, displaySize.h - h));
        return { x, y, w, h };
    };

    const onPointerDownMove = (e) => {
        e.preventDefault();
        dragState.current = {
            type: 'move',
            startX: e.clientX,
            startY: e.clientY,
            crop: { ...crop },
        };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

    const onPointerDownResize = (handle) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragState.current = {
            type: 'resize',
            handle,
            startX: e.clientX,
            startY: e.clientY,
            crop: { ...crop },
        };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e) => {
        const ds = dragState.current;
        if (!ds) return;
        const dx = e.clientX - ds.startX;
        const dy = e.clientY - ds.startY;

        if (ds.type === 'move') {
            setCrop(clampCrop({ ...ds.crop, x: ds.crop.x + dx, y: ds.crop.y + dy }));
            return;
        }

        // Resize
        let { x, y, w, h } = ds.crop;
        const handle = ds.handle;

        if (handle.includes('e')) w = ds.crop.w + dx;
        if (handle.includes('s')) h = ds.crop.h + dy;
        if (handle.includes('w')) { w = ds.crop.w - dx; x = ds.crop.x + dx; }
        if (handle.includes('n')) { h = ds.crop.h - dy; y = ds.crop.y + dy; }

        if (ratio) {
            // Recalcule h (ou w) selon le ratio en fonction du côté dominant
            if (handle.includes('e') || handle.includes('w')) {
                h = w / ratio;
                if (handle.includes('n')) y = ds.crop.y + ds.crop.h - h;
            } else {
                w = h * ratio;
                if (handle.includes('w')) x = ds.crop.x + ds.crop.w - w;
            }
        }

        w = Math.max(MIN_CROP, w);
        h = Math.max(MIN_CROP, h);

        setCrop(clampCrop({ x, y, w, h }));
    };

    const onPointerUp = () => {
        dragState.current = null;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
    };

    // Déplacement du calque texte / de la zone floutée — position stockée en
    // fraction (0..1) de la boîte de recadrage courante.
    const startOverlayDrag = (kind) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        const move = (ev) => {
            const rect = cropLayerRef.current.getBoundingClientRect();
            const fx = Math.min(1, Math.max(0, (ev.clientX - rect.left - crop.x) / crop.w));
            const fy = Math.min(1, Math.max(0, (ev.clientY - rect.top - crop.y) / crop.h));
            if (kind === 'text') setTextOverlay((prev) => (prev ? { ...prev, fx, fy } : prev));
            if (kind === 'blur') setBlurZone((prev) => (prev ? { ...prev, fx, fy } : prev));
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    // Molette = zoom
    const onWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        setZoom((z) => Math.min(4, Math.max(0.2, +(z + delta).toFixed(2))));
    };

    // Raccourcis clavier
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onCancel();
            if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4, +(z + 0.1).toFixed(2)));
            if (e.key === '-') setZoom((z) => Math.max(0.2, +(z - 0.1).toFixed(2)));
            if (e.key.toLowerCase() === 'r' && !e.shiftKey) setRotation((r) => r + 90);
            if (e.key.toLowerCase() === 'r' && e.shiftKey) setRotation((r) => r - 90);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Rendu final ---
    const handleApply = async () => {
        const img = imgRef.current;
        if (!img || !displaySize.w) return;

        const scaleX = naturalSize.w / displaySize.w;
        const scaleY = naturalSize.h / displaySize.h;
        const outW = Math.max(1, Math.round(crop.w * scaleX));
        const outH = Math.max(1, Math.round(crop.h * scaleY));

        // Canvas intermédiaire : reproduit exactement ce qui est visible dans .ic-image-wrap,
        // mais à l'échelle naturelle (1 unité displaySize = scaleX/scaleY unités naturelles).
        const sceneW = displaySize.w * scaleX;
        const sceneH = displaySize.h * scaleY;

        const scene = document.createElement('canvas');
        scene.width = sceneW;
        scene.height = sceneH;
        const sctx = scene.getContext('2d');

        sctx.save();
        sctx.translate(sceneW / 2, sceneH / 2);
        sctx.rotate((rotation * Math.PI) / 180);
        sctx.scale((flipH ? -1 : 1) * zoom, (flipV ? -1 : 1) * zoom);
        sctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
        sctx.drawImage(img, -naturalSize.w / 2, -naturalSize.h / 2, naturalSize.w, naturalSize.h);
        sctx.restore();

        // Découpe la zone de crop (convertie de coordonnées d'affichage vers coordonnées "scene")
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(
            scene,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.w * scaleX,
            crop.h * scaleY,
            0, 0, outW, outH
        );

        // Zone floutée — on floute une copie du rendu déjà recadré, puis on ne
        // recopie que le patch concerné par-dessus l'image nette.
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

        // Texte — dessiné en dernier, par-dessus tout le reste, avec un léger
        // contour sombre pour rester lisible sur n'importe quel fond.
        if (textOverlay && textOverlay.content.trim()) {
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

        canvas.toBlob((blob) => {
            if (blob) onCropComplete(blob);
        }, 'image/png', 0.95);
    };

    const imgTransform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${zoom * (flipH ? -1 : 1)}, ${zoom * (flipV ? -1 : 1)})`;
    const cssFilter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;

    return (
        <div className="ic-overlay" role="dialog" aria-modal="true">
            <div className="ic-modal">
                {/* Header */}
                <div className="ic-header">
                    <div className="ic-title">
                        <span className="ic-title-main">Recadrer l'image</span>
                        <span className="ic-title-sub">{ratio ? PRESETS.find(p => p.value === ratio)?.label || 'Personnalisé' : 'Format libre'}</span>
                    </div>
                    <button onClick={onCancel} className="ic-close" aria-label="Fermer">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="ic-body">
                    {/* Zone de travail */}
                    <div className="ic-stage" ref={containerRef} onWheel={onWheel}>
                        <div className="ic-image-wrap">
                            <img
                                ref={imgRef}
                                src={imgSrc}
                                onLoad={handleImgLoad}
                                alt="à recadrer"
                                className="ic-image"
                                style={{
                                    width: displaySize.w,
                                    height: displaySize.h,
                                    transform: imgTransform,
                                    filter: cssFilter,
                                }}
                                draggable={false}
                            />

                            {displaySize.w > 0 && (
                                <div ref={cropLayerRef} className="ic-crop-layer" style={{ width: displaySize.w, height: displaySize.h }}>
                                    {/* Voile sombre avec trou = zone de crop */}
                                    <svg className="ic-mask" width={displaySize.w} height={displaySize.h}>
                                        <defs>
                                            <mask id="ic-hole">
                                                <rect width="100%" height="100%" fill="white" />
                                                {cropShape === 'round' ? (
                                                    <ellipse
                                                        cx={crop.x + crop.w / 2}
                                                        cy={crop.y + crop.h / 2}
                                                        rx={crop.w / 2}
                                                        ry={crop.h / 2}
                                                        fill="black"
                                                    />
                                                ) : (
                                                    <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="black" />
                                                )}
                                            </mask>
                                        </defs>
                                        <rect width="100%" height="100%" fill="rgba(10,10,14,0.6)" mask="url(#ic-hole)" />
                                    </svg>

                                    {/* Cadre + poignées */}
                                    <div
                                        className={`ic-crop-frame ${cropShape === 'round' ? 'is-round' : ''}`}
                                        style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
                                        onPointerDown={onPointerDownMove}
                                    >
                                        {/* Grille des tiers */}
                                        <div className="ic-grid">
                                            <span /><span /><span /><span />
                                        </div>

                                        {/* Poignées (cachées si rond, sauf coins pour resize global) */}
                                        {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => (
                                            <div
                                                key={h}
                                                className={`ic-handle ic-handle-${h}`}
                                                onPointerDown={onPointerDownResize(h)}
                                            />
                                        ))}

                                        {/* Calque zone floutée */}
                                        {blurZone && (
                                            <div
                                                className="ic-blur-layer"
                                                onPointerDown={startOverlayDrag('blur')}
                                                style={{
                                                    left: crop.w * blurZone.fx,
                                                    top: crop.h * blurZone.fy,
                                                    width: Math.min(crop.w, crop.h) * blurZone.size,
                                                    height: Math.min(crop.w, crop.h) * blurZone.size,
                                                    transform: 'translate(-50%, -50%)',
                                                }}
                                            />
                                        )}

                                        {/* Calque texte */}
                                        {textOverlay && (
                                            <div
                                                className="ic-text-layer"
                                                onPointerDown={startOverlayDrag('text')}
                                                style={{
                                                    left: crop.w * textOverlay.fx,
                                                    top: crop.h * textOverlay.fy,
                                                    fontSize: (textOverlay.size / 100) * Math.min(crop.w, crop.h),
                                                    color: textOverlay.color,
                                                    transform: 'translate(-50%, -50%)',
                                                }}
                                            >
                                                {textOverlay.content || 'Texte'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="ic-hint">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4M12 8h.01" />
                            </svg>
                            Molette pour zoomer · glisser pour déplacer · poignées pour redimensionner
                        </div>
                    </div>

                    {/* Panneau latéral de contrôles */}
                    <div className="ic-controls">
                        {/* Formats */}
                        {!lockAspectRatio && (
                            <div className="ic-section">
                                <span className="ic-section-label">Format</span>
                                <div className="ic-presets">
                                    {PRESETS.map((p) => (
                                        <button
                                            key={p.label}
                                            className={`ic-preset ${ratio === p.value ? 'active' : ''}`}
                                            onClick={() => setRatio(p.value)}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Zoom */}
                        <div className="ic-section">
                            <div className="ic-section-head">
                                <span className="ic-section-label">Zoom</span>
                                <span className="ic-value">{Math.round(zoom * 100)}%</span>
                            </div>
                            <div className="ic-slider-row">
                                <button className="ic-icon-btn" onClick={() => setZoom(z => Math.max(0.2, +(z - 0.1).toFixed(2)))} aria-label="Diminuer le zoom">−</button>
                                <input
                                    type="range" min={0.2} max={4} step={0.01}
                                    value={zoom}
                                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                                    className="ic-slider"
                                />
                                <button className="ic-icon-btn" onClick={() => setZoom(z => Math.min(4, +(z + 0.1).toFixed(2)))} aria-label="Augmenter le zoom">+</button>
                            </div>
                        </div>

                        {/* Rotation */}
                        <div className="ic-section">
                            <div className="ic-section-head">
                                <span className="ic-section-label">Rotation</span>
                                <span className="ic-value">{rotation % 360}°</span>
                            </div>
                            <div className="ic-slider-row">
                                <button className="ic-icon-btn" onClick={() => setRotation(r => r - 90)} aria-label="Rotation -90°" title="Rotation -90° (Shift+R)">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
                                </button>
                                <input
                                    type="range" min={-180} max={180} step={1}
                                    value={((rotation % 360) + 540) % 360 - 180}
                                    onChange={(e) => setRotation(parseInt(e.target.value, 10))}
                                    className="ic-slider"
                                />
                                <button className="ic-icon-btn" onClick={() => setRotation(r => r + 90)} aria-label="Rotation +90°" title="Rotation +90° (R)">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
                                </button>
                            </div>
                        </div>

                        {/* Miroir */}
                        <div className="ic-section">
                            <span className="ic-section-label">Miroir</span>
                            <div className="ic-flip-row">
                                <button className={`ic-toggle ${flipH ? 'active' : ''}`} onClick={() => setFlipH(f => !f)}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18M16 7l4 5-4 5M8 7l-4 5 4 5" /></svg>
                                    Horizontal
                                </button>
                                <button className={`ic-toggle ${flipV ? 'active' : ''}`} onClick={() => setFlipV(f => !f)}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M7 8l5-4 5 4M7 16l5 4 5-4" /></svg>
                                    Vertical
                                </button>
                            </div>
                        </div>

                        {/* Réglages colorimétriques */}
                        <div className="ic-section">
                            <span className="ic-section-label">Réglages</span>
                            <div className="ic-slider-row">
                                <span className="ic-mini-label">Luminosité</span>
                                <input type="range" min={50} max={150} value={brightness} onChange={(e) => setBrightness(+e.target.value)} className="ic-slider" />
                            </div>
                            <div className="ic-slider-row">
                                <span className="ic-mini-label">Contraste</span>
                                <input type="range" min={50} max={150} value={contrast} onChange={(e) => setContrast(+e.target.value)} className="ic-slider" />
                            </div>
                            <div className="ic-slider-row">
                                <span className="ic-mini-label">Saturation</span>
                                <input type="range" min={0} max={200} value={saturate} onChange={(e) => setSaturate(+e.target.value)} className="ic-slider" />
                            </div>
                        </div>

                        {/* Texte sur l'image */}
                        <div className="ic-section">
                            <span className="ic-section-label">Texte</span>
                            {!textOverlay ? (
                                <button
                                    className="ic-toggle"
                                    onClick={() => setTextOverlay({ content: 'Texte', size: 8, color: '#ffffff', fx: 0.5, fy: 0.5 })}
                                >
                                    + Ajouter du texte
                                </button>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        value={textOverlay.content}
                                        onChange={(e) => setTextOverlay((p) => ({ ...p, content: e.target.value }))}
                                        className="ic-text-input"
                                        placeholder="Votre texte…"
                                    />
                                    <div className="ic-slider-row">
                                        <span className="ic-mini-label">Taille</span>
                                        <input type="range" min={3} max={20} value={textOverlay.size} onChange={(e) => setTextOverlay((p) => ({ ...p, size: +e.target.value }))} className="ic-slider" />
                                    </div>
                                    <div className="ic-flip-row">
                                        <input type="color" value={textOverlay.color} onChange={(e) => setTextOverlay((p) => ({ ...p, color: e.target.value }))} className="ic-color-input" />
                                        <button className="ic-toggle" onClick={() => setTextOverlay(null)}>Supprimer</button>
                                    </div>
                                    <p className="ic-mini-hint">Glissez le texte directement sur l'image pour le repositionner.</p>
                                </>
                            )}
                        </div>

                        {/* Zone floutée */}
                        <div className="ic-section">
                            <span className="ic-section-label">Zone floutée</span>
                            {!blurZone ? (
                                <button className="ic-toggle" onClick={() => setBlurZone({ size: 0.3, fx: 0.5, fy: 0.5 })}>
                                    + Ajouter une zone floutée
                                </button>
                            ) : (
                                <>
                                    <div className="ic-slider-row">
                                        <span className="ic-mini-label">Taille</span>
                                        <input type="range" min={0.1} max={0.7} step={0.02} value={blurZone.size} onChange={(e) => setBlurZone((p) => ({ ...p, size: +e.target.value }))} className="ic-slider" />
                                    </div>
                                    <button className="ic-toggle" onClick={() => setBlurZone(null)}>Supprimer</button>
                                    <p className="ic-mini-hint">Glissez le cadre pour masquer un visage, un logo…</p>
                                </>
                            )}
                        </div>

                        {/* Réinitialiser */}
                        <button className="ic-reset" onClick={() => { setZoom(1); setRotation(0); setFlipH(false); setFlipV(false); setRatio(aspectRatio); setBrightness(100); setContrast(100); setSaturate(100); setTextOverlay(null); setBlurZone(null); computeLayout(); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                            Réinitialiser
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="ic-footer">
                    <button onClick={onCancel} className="ic-btn ic-btn-ghost">Annuler</button>
                    <button onClick={handleApply} className="ic-btn ic-btn-primary">Appliquer le recadrage</button>
                </div>
            </div>

            <style>{`
                .ic-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 200;
                    background: rgba(8, 8, 12, 0.78);
                    backdrop-filter: blur(6px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                @media (max-width: 640px) {
                    .ic-overlay { padding: 0; }
                }

                .ic-modal {
                    width: 100%;
                    max-width: 1040px;
                    max-height: 92vh;
                    background: #15161b;
                    border: 1px solid #26272f;
                    border-radius: 16px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 30px 80px rgba(0,0,0,0.5);
                    color: #e7e7ea;
                }
                @media (max-width: 640px) {
                    .ic-modal {
                        max-height: 100dvh;
                        height: 100dvh;
                        border-radius: 0;
                        border: none;
                    }
                }

                .ic-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-bottom: 1px solid #25262d;
                }

                .ic-title { display: flex; flex-direction: column; gap: 2px; }
                .ic-title-main { font-size: 15px; font-weight: 600; color: #f4f4f6; }
                .ic-title-sub { font-size: 12px; color: #7c7d88; }

                .ic-close {
                    background: #1f2027;
                    border: 1px solid #2c2d35;
                    border-radius: 10px;
                    width: 34px; height: 34px;
                    display: flex; align-items: center; justify-content: center;
                    color: #9a9ba6;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .ic-close:hover { color: #fff; background: #2a2b33; }

                .ic-body {
                    display: flex;
                    flex: 1;
                    min-height: 0;
                }

                @media (max-width: 860px) {
                    .ic-body { flex-direction: column; overflow-y: auto; }
                }

                /* --- Zone de travail --- */
                .ic-stage {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 28px;
                    background:
                        repeating-linear-gradient(45deg, #1a1b21 0 12px, #181920 12px 24px);
                    position: relative;
                    gap: 14px;
                    touch-action: none;
                }
                @media (max-width: 640px) {
                    .ic-stage { padding: 14px; flex: none; }
                }

                .ic-image-wrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    width: 100%;
                    height: 480px;
                    max-height: 60vh;
                    border-radius: 4px;
                    background: #0c0d11;
                }
                @media (max-width: 640px) {
                    .ic-image-wrap { height: 62vw; max-height: 46vh; }
                }

                .ic-image {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    object-fit: contain;
                    transition: transform 0.05s linear;
                    will-change: transform;
                    user-select: none;
                    -webkit-user-drag: none;
                }

                .ic-crop-layer {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    pointer-events: none;
                }

                .ic-mask {
                    position: absolute;
                    top: 0;
                    left: 0;
                    pointer-events: none;
                }

                .ic-crop-frame {
                    position: absolute;
                    box-shadow: 0 0 0 1px rgba(255,255,255,0.85);
                    cursor: move;
                    pointer-events: auto;
                    touch-action: none;
                }

                .ic-crop-frame.is-round { border-radius: 50%; }

                .ic-grid {
                    position: absolute;
                    inset: 0;
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    grid-template-rows: 1fr 1fr 1fr;
                    pointer-events: none;
                    opacity: 0.55;
                }
                .ic-grid span {
                    border-right: 1px solid rgba(255,255,255,0.35);
                    border-bottom: 1px solid rgba(255,255,255,0.35);
                }
                .ic-grid span:nth-child(3n) { border-right: none; }
                .ic-grid span:nth-child(n+7) { border-bottom: none; }

                .ic-handle {
                    position: absolute;
                    width: 14px;
                    height: 14px;
                    background: #fff;
                    border: 1.5px solid #15161b;
                    border-radius: 4px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
                    touch-action: none;
                }
                /* Zone de préhension tactile agrandie sans changer la taille visuelle,
                   pour rester facile à saisir du bout du doigt sans imprécision. */
                .ic-handle::before {
                    content: '';
                    position: absolute;
                    inset: -12px;
                }

                .ic-handle-nw { top: -7px; left: -7px; cursor: nwse-resize; }
                .ic-handle-ne { top: -7px; right: -7px; cursor: nesw-resize; }
                .ic-handle-sw { bottom: -7px; left: -7px; cursor: nesw-resize; }
                .ic-handle-se { bottom: -7px; right: -7px; cursor: nwse-resize; }
                .ic-handle-n { top: -7px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
                .ic-handle-s { bottom: -7px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
                .ic-handle-e { right: -7px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
                .ic-handle-w { left: -7px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }

                .is-round .ic-handle { border-radius: 50%; }

                .ic-blur-layer {
                    position: absolute;
                    border-radius: 10px;
                    border: 2px dashed rgba(255,255,255,0.9);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    cursor: grab;
                    touch-action: none;
                }
                .ic-blur-layer:active { cursor: grabbing; }

                .ic-text-layer {
                    position: absolute;
                    font-weight: 700;
                    white-space: nowrap;
                    text-shadow: 0 1px 3px rgba(0,0,0,0.6), 0 0 1px rgba(0,0,0,0.6);
                    cursor: grab;
                    user-select: none;
                    touch-action: none;
                    padding: 8px;
                }
                .ic-text-layer:active { cursor: grabbing; }

                .ic-mini-label {
                    font-size: 11px;
                    color: #9a9ba6;
                    width: 66px;
                    flex-shrink: 0;
                }

                .ic-mini-hint {
                    font-size: 11px;
                    color: #6f7079;
                    line-height: 1.4;
                    margin: 0;
                }

                .ic-text-input {
                    padding: 8px 10px;
                    border-radius: 8px;
                    border: 1px solid #2c2d35;
                    background: #1d1e25;
                    color: #e7e7ea;
                    font-size: 13px;
                    outline: none;
                }
                .ic-text-input:focus { border-color: #5b5ff7; }

                .ic-color-input {
                    width: 36px;
                    height: 34px;
                    border-radius: 8px;
                    border: 1px solid #2c2d35;
                    background: #1d1e25;
                    cursor: pointer;
                    padding: 2px;
                }

                .ic-hint {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11.5px;
                    color: #6f7079;
                    letter-spacing: 0.01em;
                }

                /* --- Panneau de contrôles --- */
                .ic-controls {
                    width: 280px;
                    flex-shrink: 0;
                    padding: 22px 20px;
                    border-left: 1px solid #25262d;
                    display: flex;
                    flex-direction: column;
                    gap: 22px;
                    overflow-y: auto;
                    background: #17181e;
                }

                @media (max-width: 860px) {
                    .ic-controls {
                        width: 100%;
                        border-left: none;
                        border-top: 1px solid #25262d;
                        flex-direction: row;
                        flex-wrap: wrap;
                        gap: 16px;
                    }
                    .ic-section { flex: 1 1 130px; }
                }

                @media (max-width: 640px) {
                    .ic-controls {
                        flex-direction: column;
                        flex-wrap: nowrap;
                        padding: 16px;
                        gap: 18px;
                    }
                    .ic-section { flex: none; }
                    .ic-presets { grid-template-columns: repeat(3, 1fr); }
                    .ic-preset, .ic-toggle, .ic-icon-btn { min-height: 38px; }
                }

                .ic-section { display: flex; flex-direction: column; gap: 10px; }

                .ic-section-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .ic-section-label {
                    font-size: 11.5px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: #82838e;
                }

                .ic-value {
                    font-size: 12px;
                    font-weight: 600;
                    color: #e7e7ea;
                    font-variant-numeric: tabular-nums;
                }

                .ic-presets {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 6px;
                }

                .ic-preset {
                    padding: 8px 6px;
                    border-radius: 8px;
                    border: 1px solid #2c2d35;
                    background: #1d1e25;
                    color: #c6c7cf;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .ic-preset:hover { border-color: #3d3e48; color: #fff; }
                .ic-preset.active {
                    background: #5b5ff7;
                    border-color: #5b5ff7;
                    color: #fff;
                }

                .ic-slider-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .ic-slider {
                    flex: 1;
                    -webkit-appearance: none;
                    appearance: none;
                    height: 4px;
                    border-radius: 4px;
                    background: #2c2d35;
                    cursor: pointer;
                }
                .ic-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 16px; height: 16px;
                    border-radius: 50%;
                    background: #fff;
                    box-shadow: 0 0 0 1px #5b5ff7, 0 0 0 4px rgba(91,95,247,0.18);
                    cursor: pointer;
                }
                .ic-slider::-moz-range-thumb {
                    width: 16px; height: 16px;
                    border: none;
                    border-radius: 50%;
                    background: #fff;
                    box-shadow: 0 0 0 1px #5b5ff7, 0 0 0 4px rgba(91,95,247,0.18);
                    cursor: pointer;
                }

                .ic-icon-btn {
                    width: 28px; height: 28px;
                    flex-shrink: 0;
                    border-radius: 8px;
                    border: 1px solid #2c2d35;
                    background: #1d1e25;
                    color: #c6c7cf;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .ic-icon-btn:hover { border-color: #3d3e48; color: #fff; }

                .ic-flip-row {
                    display: flex;
                    gap: 8px;
                }

                .ic-toggle {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 9px 8px;
                    border-radius: 8px;
                    border: 1px solid #2c2d35;
                    background: #1d1e25;
                    color: #c6c7cf;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .ic-toggle:hover { border-color: #3d3e48; color: #fff; }
                .ic-toggle.active {
                    background: #5b5ff7;
                    border-color: #5b5ff7;
                    color: #fff;
                }

                .ic-reset {
                    margin-top: auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 10px;
                    border-radius: 8px;
                    border: 1px solid #2c2d35;
                    background: transparent;
                    color: #8c8d97;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .ic-reset:hover { color: #fff; border-color: #3d3e48; }

                /* --- Footer --- */
                .ic-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    padding: 16px 20px;
                    border-top: 1px solid #25262d;
                    background: #15161b;
                }

                .ic-btn {
                    padding: 10px 20px;
                    border-radius: 9px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    border: 1px solid transparent;
                    transition: all 0.15s;
                }

                .ic-btn-ghost {
                    background: transparent;
                    border-color: #2c2d35;
                    color: #c6c7cf;
                }
                .ic-btn-ghost:hover { border-color: #3d3e48; color: #fff; }

                .ic-btn-primary {
                    background: #5b5ff7;
                    color: #fff;
                    box-shadow: 0 4px 14px rgba(91,95,247,0.35);
                }
                .ic-btn-primary:hover { background: #6e72ff; }
            `}</style>
        </div>
    );
};

export default ImageCropper;