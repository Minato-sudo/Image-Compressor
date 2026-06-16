// zipHandler.js - Batch zip + download

const ZipHandler = {
    downloadSingle(blob, originalName, targetFormat) {
        const ext = this.getExtension(originalName, targetFormat, blob.type);
        const baseName = this.getBaseName(originalName);
        const filename = `${baseName}-compressed.${ext}`;
        
        this.triggerDownload(blob, filename);
    },

    async downloadBatch(filesMap, targetFormat, zipFilename = 'compressed-images.zip') {
        const zip = new JSZip();
        let addedCount = 0;

        filesMap.forEach((fileState, id) => {
            if (fileState.status === 'done' && fileState.compressedBlob) {
                const ext = this.getExtension(fileState.originalFile.name, targetFormat, fileState.compressedBlob.type);
                const baseName = this.getBaseName(fileState.originalFile.name);
                const filename = `${baseName}-compressed.${ext}`;
                
                zip.file(filename, fileState.compressedBlob);
                addedCount++;
            }
        });

        if (addedCount === 0) return;

        if (addedCount === 1) {
            // Just download the single file if only 1 is done
            for (const fileState of filesMap.values()) {
                if (fileState.status === 'done') {
                    this.downloadSingle(fileState.compressedBlob, fileState.originalFile.name, targetFormat);
                    return;
                }
            }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        this.triggerDownload(zipBlob, zipFilename);
    },

    triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    getBaseName(filename) {
        const lastDot = filename.lastIndexOf('.');
        return lastDot !== -1 ? filename.substring(0, lastDot) : filename;
    },

    getExtension(originalName, targetFormat, mimeType) {
        if (targetFormat !== 'original') {
            const parts = mimeType.split('/');
            return parts[parts.length - 1] === 'jpeg' ? 'jpg' : parts[parts.length - 1];
        }
        const lastDot = originalName.lastIndexOf('.');
        return lastDot !== -1 ? originalName.substring(lastDot + 1) : 'jpg';
    }
};
