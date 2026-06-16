// main.js - App initialization and event wiring

const AppState = {
    files: new Map(), // Map<id, FileState>
    nextId: 1,
    settings: {
        quality: 1,
        format: 'original'
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Settings listeners
    UI.qualitySlider.addEventListener('input', (e) => {
        AppState.settings.quality = e.target.value;
        recompressAll();
    });

    UI.formatSelect.addEventListener('change', (e) => {
        AppState.settings.format = e.target.value;
        recompressAll();
    });

    // 2. File input listeners
    UI.fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        e.target.value = ''; // Reset
    });

    // 3. Drag and Drop listeners
    UI.dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt.files && dt.files.length) {
            handleFiles(dt.files);
        }
    });

    // 4. Download / Clear All listeners
    UI.downloadAllBtn.addEventListener('click', () => {
        ZipHandler.downloadBatch(AppState.files, AppState.settings.format);
    });

    UI.clearAllBtn.addEventListener('click', () => {
        AppState.files.clear();
        UI.clearAll();
    });

    // 5. WebP support detection (Phase 4)
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const webpSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp');
    if (!webpSupported) {
        const webpOpt = document.getElementById('webp-option');
        if (webpOpt) webpOpt.remove();
        console.info('WebP not supported in this browser — option hidden.');
    }
});

async function handleFiles(filesList) {
    if (filesList.length === 0) return;

    // Filter valid files first
    const validFiles = [];
    Array.from(filesList).forEach(file => {
        if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
            const errMsg = document.createElement('div');
            errMsg.textContent = `"${file.name}" is an HEIC/HEIF file. HEIC is not yet supported in v1 — please convert it to JPG first.`;
            errMsg.style.cssText = 'color:#ef4444;padding:8px;border:1px solid #ef4444;border-radius:6px;margin:4px 0;font-size:0.875rem;';
            document.getElementById('file-list').prepend(errMsg);
            document.getElementById('results-section').style.display = 'block';
            setTimeout(() => errMsg.remove(), 8000);
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            alert(`File "${file.name}" is not an image and will be ignored.`);
            return;
        }
        validFiles.push(file);
    });

    if (validFiles.length === 0) return;

    // Auth Gating Check
    if (!Auth.canCompress(validFiles.length)) return;
    
    // Auth logic increments the try count for guests
    Auth.incrementFreeTries(validFiles.length);

    // Warning for guest users with large batches
    if (!Auth.user && AppState.files.size + validFiles.length > 30) {
        alert("For best performance, we recommend compressing up to 30 images at a time. Sign up for unlimited robust batching.");
    }

    // Chunked Batch Processing Strategy for Logged-In Users with large quantities
    if (Auth.user && validFiles.length > 50) {
        await processInChunks(validFiles);
    } else {
        validFiles.forEach(file => {
            if (file.size > 25 * 1024 * 1024) {
                alert(`File "${file.name}" is larger than 25MB. Compression may take a while.`);
            }

            const id = AppState.nextId++;
            const fileState = {
                id,
                originalFile: file,
                compressedBlob: null,
                status: 'pending'
            };
            AppState.files.set(id, fileState);

            UI.createCard(id, file);
            
            // Add event listeners for the new card buttons
            document.getElementById(`btn-rm-${id}`).addEventListener('click', () => removeFile(id));
            document.getElementById(`btn-dl-${id}`).addEventListener('click', () => downloadSingleFile(id));

            // Start compression
            compressFile(id);
        });
    }
}

async function processInChunks(files) {
    const CHUNK_SIZE = 50;
    const totalChunks = Math.ceil(files.length / CHUNK_SIZE);
    
    const resultsSection = document.getElementById('results-section');
    const summaryText = document.getElementById('summary-text');
    const fileList = document.getElementById('file-list');
    
    resultsSection.style.display = 'block';
    
    for (let i = 0; i < totalChunks; i++) {
        summaryText.textContent = `Processing chunk ${i + 1} of ${totalChunks} (Images ${i * CHUNK_SIZE + 1} to ${Math.min((i + 1) * CHUNK_SIZE, files.length)})...`;
        fileList.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);"><div class="spinner" style="margin: 0 auto 1rem; width: 32px; height: 32px; border: 3px solid var(--border-color); border-top-color: var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite;"></div><p>Compressing chunk in the background to save memory...</p></div>';
        
        const chunk = files.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkState = new Map();
        
        const compressPromises = chunk.map(async (file, index) => {
            const id = `chunk-${i}-${index}`;
            try {
                const compressedBlob = await Compressor.processFile(file, AppState.settings);
                chunkState.set(id, {
                    originalFile: file,
                    compressedBlob: compressedBlob,
                    status: 'done'
                });
            } catch (err) {
                console.error("Failed to compress", file.name, err);
            }
        });
        
        await Promise.all(compressPromises);
        
        summaryText.textContent = `Downloading chunk ${i + 1} of ${totalChunks}...`;
        await ZipHandler.downloadBatch(chunkState, AppState.settings.format, `CompressIt-Batch-${i + 1}.zip`);
        
        // Let JS garbage collect
        await new Promise(resolve => setTimeout(resolve, 500));
        chunkState.clear();
    }
    
    summaryText.textContent = `Finished processing ${files.length} images!`;
    fileList.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Batch processing complete. Your ZIP files have been downloaded successfully.</div>';
}

async function compressFile(id) {
    const state = AppState.files.get(id);
    if (!state) return;

    state.status = 'compressing';
    UI.updateCardStatus(id, state);
    UI.updateSummary(AppState.files);

    try {
        const resultBlob = await Compressor.processFile(state.originalFile, AppState.settings);
        state.compressedBlob = resultBlob;
        state.status = 'done';
    } catch (error) {
        state.status = 'error';
    }

    UI.updateCardStatus(id, state);
    UI.updateSummary(AppState.files);
}

function recompressAll() {
    AppState.files.forEach((state, id) => {
        compressFile(id);
    });
}

function removeFile(id) {
    AppState.files.delete(id);
    UI.removeCard(id);
    UI.updateSummary(AppState.files);
}

function downloadSingleFile(id) {
    const state = AppState.files.get(id);
    if (state && state.status === 'done') {
        ZipHandler.downloadSingle(state.compressedBlob, state.originalFile.name, AppState.settings.format);
    }
}
