import React, { useState, useRef, useEffect, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { getCroppedImg, getFlippedImage } from '../utils/cropImage';

/**
 * ImageCropper — recadrage tactile (pinch-to-zoom, drag à un doigt), basé sur
 * react-easy-crop pour l'interaction, avec les mêmes réglages qu'avant
 * (rotation, miroir, filtres, texte, zone floutée).
 *
 * Props :
 * - imageFile : File | Blob — l'image à recadrer
 * - onCropComplete(blob: Blob) — appelé avec l'image recadrée (PNG)
 * - onCancel() — fermeture sans appliquer
 * - aspectRatio (optionnel) — ratio initial (ex: 16/9). Laisser undefined pour "libre".
 * - cropShape ('rect' | 'round') — forme du masque de prévisualisation
 * - lockAspectRatio (optionnel) — masque les presets de format si true
 */

const PRESETS = [
    { label: 'Libre', value: null },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:4', value: 3 / 4 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
];

// react-easy-crop a besoin d'un ratio numérique non-nul même en mode "libre" ;
// on simule le "libre" avec un ratio très permissif proche du conteneur.
const FREE_ASPECT = 1;

const ImageCropper = ({ imageFile, onCropComplete, onCancel, aspectRatio = null, cropShape = 'rect', lockAspectRatio = false }) => {
    const [imgSrc, setImgSrc] = useState(null); // source brute (object URL du fichier)
    const [displaySrc, setDisplaySrc] = useState(null); // source affichée/recadrée = imgSrc avec flip "cuit"

    // Transformations
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [flipH, setFlipH] = useState(false);
    const [flipV, setFlipV] = useState(false);
    const [ratio, setRatio] = useState(aspectRatio || null);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    // Réglages colorimétriques (appliqués à l'aperçu ET au rendu final)
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [saturate, setSaturate] = useState(100);

    // Calques additionnels — un texte et une zone floutée, positionnés en
    // coordonnées fractionnaires (0 à 1) relatives à la zone de recadrage.
    const [textOverlay, setTextOverlay] = useState(null); // { content, size, color, fx, fy }
    const [blurZone, setBlurZone] = useState(null); // { size, fx, fy }

    const overlayStageRef = useRef(null);

    // Charger l'image source
    useEffect(() => {
        const url = URL.createObjectURL(imageFile);
        setImgSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [imageFile]);

    // "Cuire" le flip dans l'image affichée (react-easy-crop ne gère pas le
    // miroir nativement). Se refait seulement quand flipH/flipV changent.
    useEffect(() => {
        if (!imgSrc) return;
        let cancelled = false;
        let objectUrlToRevoke = null;
        (async () => {
            const result = await getFlippedImage(imgSrc, flipH, flipV);
            if (cancelled) return;
            if (result !== imgSrc) objectUrlToRevoke = result;
            setDisplaySrc(result);
        })();
        return () => {
            cancelled = true;
            if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
        };
    }, [imgSrc, flipH, flipV]);

    const onCropAreaComplete = useCallback((_croppedArea, pixels) => {
        setCroppedAreaPixels(pixels);
    }, []);

    // Raccourcis clavier
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onCancel();
            if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4, +(z + 0.1).toFixed(2)));
            if (e.key === '-') setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)));
            if (e.key.toLowerCase() === 'r' && !e.shiftKey) setRotation((r) => (r + 90) % 360);
            if (e.key.toLowerCase() === 'r' && e.shiftKey) setRotation((r) => (r - 90 + 360) % 360);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Déplacement du calque texte / de la zone floutée — position stockée en
    // fraction (0..1) de la zone de recadrage affichée à l'écran.
    const startOverlayDrag = (kind) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        const move = (ev) => {
            const rect = overlayStageRef.current.getBoundingClientRect();
            const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
            const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
            const fx = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
            const fy = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
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

    const cssFilter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;

    const handleApply = async () => {
        if (!croppedAreaPixels || !displaySrc) return;
        const blob = await getCroppedImg(displaySrc, croppedAreaPixels, 0, cssFilter, blurZone, textOverlay);
        if (blob) onCropComplete(blob);
    };

    const handleReset = () => {
        setZoom(1);
        setCrop({ x: 0, y: 0 });
        setRotation(0);
        setFlipH(false);
        setFlipV(false);
        setRatio(aspectRatio || null);
        setBrightness(100);
        setContrast(100);
        setSaturate(100);
        setTextOverlay(null);
        setBlurZone(null);
    };

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
                    <div className="ic-stage">
                        <div className="ic-image-wrap">
                            {displaySrc && (
                                <Cropper
                                    image={displaySrc}
                                    crop={crop}
                                    zoom={zoom}
                                    rotation={rotation}
                                    aspect={ratio || FREE_ASPECT}
                                    cropShape={cropShape}
                                    showGrid
                                    zoomSpeed={0.5}
                                    minZoom={1}
                                    maxZoom={4}
                                    restrictPosition
                                    mediaProps={{ style: { filter: cssFilter } }}
                                    onCropChange={setCrop}
                                    onZoomChange={setZoom}
                                    onRotationChange={setRotation}
                                    onCropComplete={onCropAreaComplete}
                                    setCropperRef={(ref) => { overlayStageRef.current = ref?.current || null; }}
                                />
                            )}

                            {/* Calques texte / flou, positionnés par-dessus la zone de crop
                                de react-easy-crop (toujours centrée et de taille connue). */}
                            {croppedAreaPixels && (blurZone || textOverlay) && (
                                <div className="ic-overlay-layer" style={getOverlayBoxStyle(ratio)}>
                                    {blurZone && (
                                        <div
                                            className="ic-blur-layer"
                                            onPointerDown={startOverlayDrag('blur')}
                                            style={{
                                                left: `${blurZone.fx * 100}%`,
                                                top: `${blurZone.fy * 100}%`,
                                                width: `${blurZone.size * 100}%`,
                                                aspectRatio: '1 / 1',
                                                transform: 'translate(-50%, -50%)',
                                            }}
                                        />
                                    )}
                                    {textOverlay && (
                                        <div
                                            className="ic-text-layer"
                                            onPointerDown={startOverlayDrag('text')}
                                            style={{
                                                left: `${textOverlay.fx * 100}%`,
                                                top: `${textOverlay.fy * 100}%`,
                                                fontSize: `${textOverlay.size}%`,
                                                color: textOverlay.color,
                                                transform: 'translate(-50%, -50%)',
                                            }}
                                        >
                                            {textOverlay.content || 'Texte'}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="ic-hint">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4M12 8h.01" />
                            </svg>
                            Pincez pour zoomer · glissez pour déplacer
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
                                <button className="ic-icon-btn" onClick={() => setZoom(z => Math.max(1, +(z - 0.1).toFixed(2)))} aria-label="Diminuer le zoom">−</button>
                                <input
                                    type="range" min={1} max={4} step={0.01}
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
                                <button className="ic-icon-btn" onClick={() => setRotation(r => (r - 90 + 360) % 360)} aria-label="Rotation -90°" title="Rotation -90° (Shift+R)">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
                                </button>
                                <input
                                    type="range" min={-180} max={180} step={1}
                                    value={((rotation % 360) + 540) % 360 - 180}
                                    onChange={(e) => setRotation((parseInt(e.target.value, 10) + 360) % 360)}
                                    className="ic-slider"
                                />
                                <button className="ic-icon-btn" onClick={() => setRotation(r => (r + 90) % 360)} aria-label="Rotation +90°" title="Rotation +90° (R)">
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
                        <button className="ic-reset" onClick={handleReset}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                            Réinitialiser
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="ic-footer">
                    <button onClick={onCancel} className="ic-btn ic-btn-ghost">Annuler</button>
                    <button onClick={handleApply} className="ic-btn ic-btn-primary" disabled={!croppedAreaPixels}>Appliquer le recadrage</button>
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
                }
                @media (max-width: 640px) {
                    .ic-stage { padding: 14px; flex: 1; }
                }

                .ic-image-wrap {
                    position: relative;
                    width: 100%;
                    height: 480px;
                    max-height: 60vh;
                    border-radius: 4px;
                    background: #0c0d11;
                    overflow: hidden;
                }
                @media (max-width: 640px) {
                    .ic-image-wrap { height: 100%; max-height: none; flex: 1; min-height: 320px; }
                }

                /* Calque texte/flou positionné par-dessus la zone de crop de
                   react-easy-crop, qui est toujours centrée dans le conteneur. */
                .ic-overlay-layer {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    pointer-events: none;
                }
                .ic-overlay-layer > * { pointer-events: auto; }

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
                .ic-btn-primary:hover:not(:disabled) { background: #6e72ff; }
                .ic-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>
        </div>
    );
};

// Boîte dans laquelle on positionne les calques texte/flou : correspond à la
// zone de crop de react-easy-crop (toujours carrée/rectangulaire selon le
// ratio choisi, centrée, occupant au mieux le conteneur disponible).
function getOverlayBoxStyle(ratio) {
    const effectiveRatio = ratio || FREE_ASPECT;
    return {
        width: effectiveRatio >= 1 ? '100%' : `${100 * effectiveRatio}%`,
        aspectRatio: `${effectiveRatio}`,
        maxHeight: '100%',
        maxWidth: '100%',
    };
}

<<<<<<< HEAD
export default ImageCropper;
=======
export default ImageCropper;
>>>>>>> f304c575a1d2258ae00d18bdf249a42709f91024
