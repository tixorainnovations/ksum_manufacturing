export const sanitizeFileName = (drawingNo, originalName) => {
  const cleanName = originalName
    .replace(/\.[^/.]+$/, "") // Remove extension
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-") // Replace non-alphanumeric with hyphen
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens

  const ext = originalName.split('.').pop().toLowerCase();
  let cleanExt = ext === 'jpeg' ? 'jpg' : ext;
  
  if (drawingNo) {
      const cleanDrawingNo = drawingNo.replace(/[^a-zA-Z0-9]/g, "");
      return `${cleanDrawingNo}_${cleanName}.${cleanExt}`;
  }
  return `${cleanName}.${cleanExt}`;
};

export const optimizeImage = (file, maxWidth = 1600, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      resolve(file); // Return original if not an image
      return;
    }

    // Convert to webp unless it's a small png with transparency need (but we'll just compress everything to WebP/JPEG)
    // WebP is highly efficient. Let's stick to jpeg or webp.
    const outputType = 'image/webp'; 

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Handle transparency for PNGs converted to JPEG/WebP
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas to Blob failed'));
              return;
            }
            // Create a new File from the Blob
            let finalExt = outputType.split('/')[1];
            if (finalExt === 'jpeg') finalExt = 'jpg';
            
            const originalNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            const newName = `${originalNameWithoutExt}.${finalExt}`;
            
            const optimizedFile = new File([blob], newName, {
              type: outputType,
              lastModified: Date.now(),
            });
            resolve(optimizedFile);
          },
          outputType,
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};
