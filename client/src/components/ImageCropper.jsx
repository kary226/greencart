import React, { useState } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/cropImage';

const ImageCropper = ({ imageFile, onCropComplete, onCancel, aspectRatio = 16 / 9, cropShape = 'rect' }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [rotation, setRotation] = useState(0);

    const onCropChange = (crop) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom) => {
        setZoom(zoom);
    };

    const onCropCompleteHandler = (croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleCrop = async () => {
        try {
            const croppedImage = await getCroppedImg(imageFile, croppedAreaPixels, rotation);
            onCropComplete(croppedImage);
        } catch (error) {
            console.error(error);
        }
    };

    const zoomIn = () => {
        setZoom(prev => Math.min(prev + 0.1, 3));
    };

    const zoomOut = () => {
        setZoom(prev => Math.max(prev - 0.1, 0.5));
    };

    const rotateLeft = () => {
        setRotation(prev => prev - 90);
    };

    const rotateRight = () => {
        setRotation(prev => prev + 90);
    };

    // Style différent selon la forme de crop
    const cropAreaStyle = cropShape === 'round' 
        ? {
            border: '2px solid #22c55e',
            borderRadius: '50%',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
        }
        : {
            border: '2px solid #22c55e',
            borderRadius: '8px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
        };

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold">
                        Recadrer l'image {cropShape === 'round' ? '(format cercle)' : '(format carré)'}
                    </h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                        ✕
                    </button>
                </div>

                <div className="relative h-[400px] w-full bg-gray-900">
                    <Cropper
                        image={URL.createObjectURL(imageFile)}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={aspectRatio}
                        onCropChange={onCropChange}
                        onZoomChange={onZoomChange}
                        onCropComplete={onCropCompleteHandler}
                        onRotationChange={setRotation}
                        cropShape={cropShape}
                        showGrid={true}
                        zoomWithScroll={true}
                        style={{
                            containerStyle: {
                                width: '100%',
                                height: '100%',
                                backgroundColor: '#1a1a1a'
                            },
                            cropAreaStyle: cropAreaStyle
                        }}
                    />
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-700">Zoom</label>
                            <div className="flex gap-2">
                                <button onClick={zoomOut} className="w-8 h-8 bg-gray-200 rounded-full hover:bg-gray-300 transition flex items-center justify-center">-</button>
                                <span className="text-sm text-gray-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
                                <button onClick={zoomIn} className="w-8 h-8 bg-gray-200 rounded-full hover:bg-gray-300 transition flex items-center justify-center">+</button>
                            </div>
                        </div>
                        <input type="range" min={0.5} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary" />
                    </div>

                    <div className="flex justify-center gap-4 mb-4">
                        <button onClick={rotateLeft} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition text-sm flex items-center gap-2">↺ Rotation gauche</button>
                        <button onClick={rotateRight} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition text-sm flex items-center gap-2">↻ Rotation droite</button>
                    </div>

                    <p className="text-xs text-gray-400 text-center mb-4">💡 Astuce : Utilise la molette de la souris pour zoomer, ou glisse l'image pour la repositionner</p>

                    <div className="flex justify-end gap-3">
                        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">Annuler</button>
                        <button onClick={handleCrop} className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition">Appliquer le recadrage</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageCropper;