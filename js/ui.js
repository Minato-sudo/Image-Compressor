// ui.js - DOM rendering, drag-drop, previews

const UI = {
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    fileList: document.getElementById('file-list'),
    resultsSection: document.getElementById('results-section'),
    summaryText: document.getElementById('summary-text'),
    downloadAllBtn: document.getElementById('download-all-btn'),
    clearAllBtn: document.getElementById('clear-all-btn'),
    qualitySlider: document.getElementById('quality-slider'),
    formatSelect: document.getElementById('format-select'),

    init() {
        this.setupDragAndDrop();
    },

    setupDragAndDrop() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, () => this.dropZone.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, () => this.dropZone.classList.remove('drag-over'), false);
        });
    },

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    },

    formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    },

    createCard(id, file) {
        const card = document.createElement('div');
        card.className = 'file-card';
        card.id = `card-${id}`;

        const previewUrl = URL.createObjectURL(file);

        card.innerHTML = `
            <div class="file-card-preview">
                <img src="${previewUrl}" alt="Preview" onload="URL.revokeObjectURL(this.src)">
                <div class="spinner" id="spinner-${id}" style="display: none; position: absolute;"></div>
            </div>
            <div class="file-card-info">
                <div class="file-name" title=""></div>
                <div class="file-sizes">
                    <span id="orig-size-${id}">${this.formatBytes(file.size)}</span>
                    <span id="comp-size-${id}">Waiting...</span>
                    <span class="savings-badge" id="badge-${id}" style="display: none;"></span>
                </div>
                <div class="file-actions">
                    <button class="btn btn-primary" id="btn-dl-${id}" disabled>Download</button>
                    <button class="btn btn-ghost" id="btn-rm-${id}">Remove</button>
                </div>
            </div>
        `;

        // Security: Set filename via textContent
        card.querySelector('.file-name').textContent = file.name;
        card.querySelector('.file-name').title = file.name;

        this.fileList.appendChild(card);
    },

    updateCardStatus(id, state) {
        const spinner = document.getElementById(`spinner-${id}`);
        const compSize = document.getElementById(`comp-size-${id}`);
        const badge = document.getElementById(`badge-${id}`);
        const dlBtn = document.getElementById(`btn-dl-${id}`);

        if (state.status === 'compressing') {
            spinner.style.display = 'block';
            compSize.textContent = 'Compressing...';
            badge.style.display = 'none';
            dlBtn.disabled = true;
        } else if (state.status === 'done') {
            spinner.style.display = 'none';
            compSize.textContent = this.formatBytes(state.compressedBlob.size);
            
            const savings = ((state.originalFile.size - state.compressedBlob.size) / state.originalFile.size) * 100;
            if (savings > 0) {
                badge.textContent = `-${Math.round(savings)}%`;
                badge.style.display = 'inline-block';
            } else {
                badge.textContent = `+${Math.abs(Math.round(savings))}%`;
                badge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                badge.style.color = 'var(--danger-color)';
                badge.style.display = 'inline-block';
            }
            
            dlBtn.disabled = false;
        } else if (state.status === 'error') {
            spinner.style.display = 'none';
            compSize.textContent = 'Error';
            compSize.style.color = 'var(--danger-color)';
        }
    },

    updateSummary(filesMap) {
        const files = Array.from(filesMap.values());
        
        if (files.length === 0) {
            this.resultsSection.style.display = 'none';
            return;
        }
        
        this.resultsSection.style.display = 'block';

        let origTotal = 0;
        let compTotal = 0;
        let allDone = true;

        files.forEach(f => {
            origTotal += f.originalFile.size;
            if (f.status === 'done') {
                compTotal += f.compressedBlob.size;
            } else {
                compTotal += f.originalFile.size; // fallback until done
                if (f.status === 'compressing' || f.status === 'pending') {
                    allDone = false;
                }
            }
        });

        if (allDone) {
            const savings = ((origTotal - compTotal) / origTotal) * 100;
            const savingsStr = savings > 0 ? `(-${Math.round(savings)}%)` : '';
            this.summaryText.textContent = `Total: ${this.formatBytes(origTotal)} → ${this.formatBytes(compTotal)} ${savingsStr}`;
            this.downloadAllBtn.disabled = files.length === 0;
        } else {
            this.summaryText.textContent = `Processing ${files.length} images...`;
            this.downloadAllBtn.disabled = true;
        }
    },

    removeCard(id) {
        const card = document.getElementById(`card-${id}`);
        if (card) {
            card.remove();
        }
    },

    clearAll() {
        this.fileList.innerHTML = '';
        this.resultsSection.style.display = 'none';
    }
};

UI.init();
