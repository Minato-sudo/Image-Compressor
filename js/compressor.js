// compressor.js - Compression + format conversion logic

const Compressor = {
    getOptions(qualityLevel, file) {
        // qualityLevel: 0 (Low), 1 (Medium), 2 (High)
        const hasWorker = typeof Worker !== 'undefined';
        const fileSizeMB = file.size / (1024 * 1024);

        // Dynamically scale target size to guarantee compression triggers,
        // while respecting the upper bounds from the build plan.
        let lowTarget = Math.max(0.05, Math.min(0.3, fileSizeMB * 0.4));
        let medTarget = Math.max(0.1, Math.min(1.0, fileSizeMB * 0.7));
        let highTarget = Math.max(0.2, Math.min(2.0, fileSizeMB * 0.9));

        // Ensure targets are strictly less than the original size
        if (lowTarget >= fileSizeMB) {
            lowTarget = fileSizeMB * 0.5;
        }
        if (medTarget >= fileSizeMB) {
            medTarget = fileSizeMB * 0.75;
        }
        if (highTarget >= fileSizeMB) {
            highTarget = fileSizeMB * 0.9;
        }

        const presets = {
            0: { maxSizeMB: lowTarget, initialQuality: 0.4, maxWidthOrHeight: 1280, useWebWorker: hasWorker },
            1: { maxSizeMB: medTarget, initialQuality: 0.7, maxWidthOrHeight: 1920, useWebWorker: hasWorker },
            2: { maxSizeMB: highTarget, initialQuality: 0.9, maxWidthOrHeight: 2560, useWebWorker: hasWorker }
        };
        return presets[qualityLevel] || presets[1];
    },

    async processFile(file, settings) {
        try {
            // 1. Compression
            const options = this.getOptions(parseInt(settings.quality), file);
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
