// compressor.js - Compression + format conversion logic

const Compressor = {
    getOptions(qualityLevel, file) {
        // qualityLevel: 0 (Low), 1 (Medium), 2 (High)
        const hasWorker = typeof Worker !== 'undefined';
        const fileSizeMB = file.size / (1024 * 1024);

        // For images under 3MB, bypass the iterative sizing loop to prevent quality/size inversion.
        // By setting maxSizeMB to 50, the library does a single-pass compression using initialQuality.
        const useSinglePass = fileSizeMB < 3.0;

        const presets = {
            0: { maxSizeMB: useSinglePass ? 50 : 0.3, initialQuality: 0.4, maxWidthOrHeight: 1280, useWebWorker: hasWorker },
            1: { maxSizeMB: useSinglePass ? 50 : 1.0, initialQuality: 0.7, maxWidthOrHeight: 1920, useWebWorker: hasWorker },
            2: { maxSizeMB: useSinglePass ? 50 : 2.0, initialQuality: 0.9, maxWidthOrHeight: 2560, useWebWorker: hasWorker }
        };
        return presets[qualityLevel] || presets[1];
    },

    async processFile(file, settings) {
        try {
            // 1. Compression
            const options = this.getOptions(parseInt(settings.quality), file);
            
            // To prevent the library from forcing compressed files to be smaller than the original
            // (which causes quality/size inversion and same-size results on small files),
            // we wrap the file in a Blob and override its size property to a large value for small files.
            const fileSizeMB = file.size / (1024 * 1024);
            let fileToCompress = file;
            if (fileSizeMB < 3.0) {
                fileToCompress = new Blob([file], { type: file.type });
                Object.defineProperty(fileToCompress, 'size', { value: 50 * 1024 * 1024 });
                Object.defineProperty(fileToCompress, 'name', { value: file.name });
                Object.defineProperty(fileToCompress, 'lastModified', { value: file.lastModified });
            }

            let resultBlob = await imageCompression(fileToCompress, options);

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
