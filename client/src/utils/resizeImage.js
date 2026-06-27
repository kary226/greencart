import Resizer from 'react-image-file-resizer';

export const resizeAndConvertToWebP = (file) => {
  return new Promise((resolve, reject) => {
    Resizer.imageFileResizer(
      file,                    // Le fichier sélectionné
      1920,                    // Largeur max
      1920,                    // Hauteur max
      'WEBP',                  // Format de sortie
      85,                      // Qualité (0-100)
      0,                       // Rotation
      (uri) => {
        if (uri instanceof Blob || uri instanceof File) {
          resolve(uri);
        } else {
          reject(new Error('La conversion a échoué'));
        }
      },
      'blob'                   // Format de sortie
    );
  });
};