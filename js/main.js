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

function handleFiles(filesList) {
    if (filesList.length === 0) return;

    if (AppState.files.size + filesList.length > 30) {
        alert("For best performance, we recommend compressing up to 30 images at a time.");
    }

    Array.from(filesList).forEach(file => {
        // Phase 9: HEIC detection — not natively supported
        if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
            const errMsg = document.createElement('div');
            errMsg.textContent = `"${file.name}" is an HEIC/HEIF file. HEIC is not yet supported in v1 — please convert it to JPG first.`;
            errMsg.style.cssText = 'color:#ef4444;padding:8px;border:1px solid #ef4444;border-radius:6px;margin:4px 0;font-size:0.875rem;';
            document.getElementById('file-list').prepend(errMsg);
            document.getElementById('results-section').style.display = 'block';
            setTimeout(() => errMsg.remove(), 8000);
            return;
        }
        
        // Phase 7: Error handling
        if (!file.type.startsWith('image/')) {
            alert(`File "${file.name}" is not an image and will be ignored.`);
            return;
        }

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
