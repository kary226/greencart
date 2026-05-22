export const getCroppedImg = (imageFile, croppedAreaPixels, rotation = 0) => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const reader = new FileReader();
        
        reader.onload = (e) => {
            image.src = e.target.result;
        };
        
        reader.onerror = (error) => {
            reject(error);
        };
        
        reader.readAsDataURL(imageFile);
        
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Appliquer la rotation
            const rad = (rotation * Math.PI) / 180;
            const sin = Math.abs(Math.sin(rad));
            const cos = Math.abs(Math.cos(rad));
            
            // Calculer les nouvelles dimensions après rotation
            const rotatedWidth = image.width * cos + image.height * sin;
            const rotatedHeight = image.width * sin + image.height * cos;
            
            canvas.width = croppedAreaPixels.width;
            canvas.height = croppedAreaPixels.height;
            
            // Centrer l'image
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(rad);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);
            
            // Dessiner l'image recadrée
            ctx.drawImage(
                image,
                croppedAreaPixels.x,
                croppedAreaPixels.y,
                croppedAreaPixels.width,
                croppedAreaPixels.height,
                0,
                0,
                croppedAreaPixels.width,
                croppedAreaPixels.height
            );
            
            canvas.toBlob((blob) => {
                const file = new File([blob], imageFile.name, { type: imageFile.type });
                resolve(file);
            }, imageFile.type);
        };
        
        image.onerror = (error) => {
            reject(error);
        };
    });
};