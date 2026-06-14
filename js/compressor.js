// compressor.js - Compression + format conversion logic

const Compressor = {
    getOptions(qualityLevel) {
        // qualityLevel: 0 (Low), 1 (Medium), 2 (High)
        const presets = {
            0: { maxSizeMB: 0.3, initialQuality: 0.4, maxWidthOrHeight: 1280, useWebWorker: true },
            1: { maxSizeMB: 1.0, initialQuality: 0.7, maxWidthOrHeight: 1920, useWebWorker: true },
            2: { maxSizeMB: 2.0, initialQuality: 0.9, maxWidthOrHeight: 2560, useWebWorker: true }
        };
        return presets[qualityLevel] || presets[1];
    },

    async processFile(file, settings) {
        try {
            // 1. Compression
            const options = this.getOptions(parseInt(settings.quality));
            let resultBlob = await imageCompression(file, options);

            // 2. Format Conversion
            if (settings.format !== 'original' && resultBlob.type !== settings.format) {
                resultBlob = await this.convertFormat(resultBlob, settings.format, options.initialQuality);
            }

            return resultBlob;
        } catch (error) {
            console.error('Compression error:', error);
            throw error;
        }
    },

    convertFormat(blob, targetMimeType, quality) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                // Handle transparency for JPEG output
                if (targetMimeType === 'image/jpeg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                ctx.drawImage(img, 0, 0);

                canvas.toBlob(
                    (newBlob) => {
                        URL.revokeObjectURL(url);
                        if (newBlob) {
                            resolve(newBlob);
                        } else {
                            reject(new Error('Canvas toBlob failed'));
                        }
                    },
                    targetMimeType,
                    quality
                );
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image for conversion'));
            };

            img.src = url;
        });
    }
};
