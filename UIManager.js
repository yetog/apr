export class UIManager {
    constructor(musicManager) {
        this.musicManager = musicManager;
        this.sidebar = null;
        this.sidebarToggle = null;
        this.isOpen = false;
        
        // UI Elements
        this.currentTrackInfo = null;
        this.playlistContainer = null;
        this.playPauseBtn = null;
        this.fileInput = null;
        this.urlInput = null;
        
        // DJ-specific UI elements
        this.crossfaderIndicator = null;
        this.effectItems = null;
        
        // Drag and drop state
        this.draggedItem = null;
        this.draggedIndex = null;
        this.dropIndicator = null;
        
        this.init();
        this.setupEventListeners();
        this.setupMusicManagerCallbacks();
    }

    init() {
        // Get DOM elements
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        this.currentTrackInfo = document.getElementById('current-track-info');
        this.playlistContainer = document.getElementById('playlist-container');
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.fileInput = document.getElementById('file-input');
        this.urlInput = document.getElementById('url-input');
        
        // DJ-specific elements
        this.crossfaderIndicator = document.getElementById('crossfader-indicator');
        this.effectItems = document.querySelectorAll('.effect-item');

        // Create drop indicator
        this.createDropIndicator();

        // Initial render
        this.renderCurrentTrack();
        this.renderPlaylist();
        this.updateDJControls();
    }

    createDropIndicator() {
        this.dropIndicator = document.createElement('div');
        this.dropIndicator.className = 'drop-indicator';
        this.dropIndicator.style.display = 'none';
        this.dropIndicator.innerHTML = '<div class="drop-line"></div>';
    }

    setupEventListeners() {
        // Sidebar toggle
        this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('sidebar-close').addEventListener('click', () => this.closeSidebar());

        // File import
        document.getElementById('import-files-btn').addEventListener('click', () => {
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', (e) => {
            this.handleFileImport(e.target.files);
        });

        // URL import
        document.getElementById('import-url-btn').addEventListener('click', () => {
            this.handleURLImport();
        });

        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleURLImport();
            }
        });

        // Playback controls
        this.playPauseBtn.addEventListener('click', () => {
            this.musicManager.togglePlayPause();
        });

        document.getElementById('prev-btn').addEventListener('click', () => {
            this.musicManager.playPrevious();
        });

        document.getElementById('next-btn').addEventListener('click', () => {
            this.musicManager.playNext();
        });

        // DJ Controls - Effect items click handlers
        this.effectItems.forEach(item => {
            item.addEventListener('click', () => {
                const effectName = item.dataset.effect;
                this.musicManager.toggleEffect(effectName);
            });
        });

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.sidebar.contains(e.target) && !this.sidebarToggle.contains(e.target)) {
                this.closeSidebar();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return; // Don't interfere with input fields
            
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.musicManager.togglePlayPause();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.musicManager.playNext();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.musicManager.playPrevious();
                    break;
                case 'KeyM':
                    e.preventDefault();
                    this.toggleSidebar();
                    break;
                // DJ-specific shortcuts
                case 'Digit1':
                    e.preventDefault();
                    this.musicManager.toggleEffect('reverb');
                    break;
                case 'Digit2':
                    e.preventDefault();
                    this.musicManager.toggleEffect('delay');
                    break;
                case 'Digit3':
                    e.preventDefault();
                    this.musicManager.toggleEffect('distortion');
                    break;
                case 'Digit4':
                    e.preventDefault();
                    this.musicManager.toggleEffect('filter');
                    break;
            }
        });
    }

    setupMusicManagerCallbacks() {
        this.musicManager.setOnTrackChange((track) => {
            this.renderCurrentTrack();
            this.renderPlaylist();
        });

        this.musicManager.setOnPlayStateChange((isPlaying) => {
            this.updatePlayPauseButton(isPlaying);
        });

        this.musicManager.setOnPlaylistChange(() => {
            this.renderPlaylist();
        });

        // DJ-specific callbacks
        this.musicManager.setOnCrossfaderChange((position) => {
            this.updateCrossfaderDisplay(position);
        });

        this.musicManager.setOnEffectChange((effectName, effectState) => {
            this.updateEffectDisplay(effectName, effectState);
        });
    }

    // DJ Controls Updates
    updateDJControls() {
        // Update crossfader
        this.updateCrossfaderDisplay(this.musicManager.getCrossfaderPosition());
        
        // Update effects
        const effects = this.musicManager.getAllEffects();
        Object.keys(effects).forEach(effectName => {
            this.updateEffectDisplay(effectName, effects[effectName]);
        });
    }

    updateCrossfaderDisplay(position) {
        if (this.crossfaderIndicator) {
            // Convert position (0-1) to percentage for CSS
            const percentage = position * 100;
            this.crossfaderIndicator.style.left = `${percentage}%`;
            
            // Update color based on position
            const hue = position * 120; // 0 = red, 120 = green
            this.crossfaderIndicator.style.backgroundColor = `hsl(${hue}, 70%, 50%)`;
        }
    }

    updateEffectDisplay(effectName, effectState) {
        const effectItem = document.querySelector(`[data-effect="${effectName}"]`);
        if (effectItem) {
            const statusElement = effectItem.querySelector('.effect-status');
            
            if (effectState.active) {
                effectItem.classList.add('active');
                statusElement.textContent = `ON (${Math.round(effectState.intensity * 100)}%)`;
            } else {
                effectItem.classList.remove('active');
                statusElement.textContent = 'OFF';
            }
        }
    }

    // Sidebar Management
    toggleSidebar() {
        if (this.isOpen) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    openSidebar() {
        this.sidebar.classList.add('open');
        this.isOpen = true;
    }

    closeSidebar() {
        this.sidebar.classList.remove('open');
        this.isOpen = false;
    }

    // File Import Handling
    async handleFileImport(files) {
        if (!files || files.length === 0) return;

        for (const file of files) {
            if (file.type.startsWith('audio/')) {
                const trackInfo = this.musicManager.constructor.createTrackFromFile(file);
                this.musicManager.addTrack(trackInfo);
            }
        }

        // Clear the file input
        this.fileInput.value = '';
    }

    handleURLImport() {
        const url = this.urlInput.value.trim();
        if (!url) return;

        try {
            // Basic URL validation
            new URL(url);
            
            const trackInfo = this.musicManager.constructor.createTrackFromURL(url);
            this.musicManager.addTrack(trackInfo);
            
            // Clear the input
            this.urlInput.value = '';
        } catch (error) {
            alert('Please enter a valid URL');
        }
    }

    // Drag and Drop Implementation
    setupDragAndDrop(playlistItem, index) {
        playlistItem.draggable = true;
        playlistItem.dataset.index = index;

        // Drag start
        playlistItem.addEventListener('dragstart', (e) => {
            this.draggedItem = playlistItem;
            this.draggedIndex = index;
            playlistItem.classList.add('dragging');
            
            // Set drag data
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', playlistItem.outerHTML);
            
            // Add drag styling to other items
            this.playlistContainer.classList.add('drag-active');
        });

        // Drag end
        playlistItem.addEventListener('dragend', (e) => {
            playlistItem.classList.remove('dragging');
            this.playlistContainer.classList.remove('drag-active');
            this.hideDropIndicator();
            this.draggedItem = null;
            this.draggedIndex = null;
        });

        // Drag over
        playlistItem.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (this.draggedItem && this.draggedItem !== playlistItem) {
                const rect = playlistItem.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                const dropPosition = e.clientY < midpoint ? 'before' : 'after';
                
                this.showDropIndicator(playlistItem, dropPosition);
            }
        });

        // Drag enter
        playlistItem.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (this.draggedItem && this.draggedItem !== playlistItem) {
                playlistItem.classList.add('drag-over');
            }
        });

        // Drag leave
        playlistItem.addEventListener('dragleave', (e) => {
            playlistItem.classList.remove('drag-over');
        });

        // Drop
        playlistItem.addEventListener('drop', (e) => {
            e.preventDefault();
            playlistItem.classList.remove('drag-over');
            
            if (this.draggedItem && this.draggedItem !== playlistItem) {
                const targetIndex = parseInt(playlistItem.dataset.index);
                const rect = playlistItem.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                const dropPosition = e.clientY < midpoint ? 'before' : 'after';
                
                let newIndex = targetIndex;
                if (dropPosition === 'after') {
                    newIndex = targetIndex + 1;
                }
                
                // Adjust for the item being moved
                if (this.draggedIndex < newIndex) {
                    newIndex--;
                }
                
                // Perform the reorder (would need to implement in MusicManager)
                console.log(`Reorder from ${this.draggedIndex} to ${newIndex}`);
            }
            
            this.hideDropIndicator();
        });
    }

    showDropIndicator(targetItem, position) {
        this.hideDropIndicator();
        
        const rect = targetItem.getBoundingClientRect();
        const containerRect = this.playlistContainer.getBoundingClientRect();
        
        this.dropIndicator.style.display = 'block';
        this.dropIndicator.style.position = 'absolute';
        this.dropIndicator.style.left = '0';
        this.dropIndicator.style.right = '0';
        this.dropIndicator.style.height = '2px';
        this.dropIndicator.style.zIndex = '1000';
        
        if (position === 'before') {
            this.dropIndicator.style.top = (rect.top - containerRect.top - 1) + 'px';
        } else {
            this.dropIndicator.style.top = (rect.bottom - containerRect.top - 1) + 'px';
        }
        
        this.playlistContainer.appendChild(this.dropIndicator);
    }

    hideDropIndicator() {
        if (this.dropIndicator && this.dropIndicator.parentNode) {
            this.dropIndicator.parentNode.removeChild(this.dropIndicator);
        }
        this.dropIndicator.style.display = 'none';
    }

    // UI Rendering
    renderCurrentTrack() {
        const currentTrack = this.musicManager.getCurrentTrack();
        const titleElement = this.currentTrackInfo.querySelector('.track-title');
        const artistElement = this.currentTrackInfo.querySelector('.track-artist');

        if (currentTrack) {
            titleElement.textContent = currentTrack.title;
            artistElement.textContent = currentTrack.artist;
        } else {
            titleElement.textContent = 'No track loaded';
            artistElement.textContent = 'Select a track to begin';
        }
    }

    renderPlaylist() {
        const playlist = this.musicManager.getPlaylist();
        const currentIndex = this.musicManager.getCurrentTrackIndex();

        if (playlist.length === 0) {
            this.playlistContainer.innerHTML = '<div class="empty-playlist">No tracks in playlist</div>';
            return;
        }

        const playlistHTML = playlist.map((track, index) => `
            <div class="playlist-item ${index === currentIndex ? 'active' : ''}" data-track-id="${track.id}" data-index="${index}">
                <div class="playlist-item-info">
                    <div class="playlist-item-title">${this.escapeHtml(track.title)}</div>
                    <div class="playlist-item-artist">${this.escapeHtml(track.artist)}</div>
                </div>
                <div class="playlist-item-controls">
                    <button class="playlist-item-btn play-btn" data-index="${index}">▶️</button>
                    <button class="playlist-item-btn delete-btn" data-track-id="${track.id}">🗑️</button>
                </div>
                <div class="drag-handle">⋮⋮</div>
            </div>
        `).join('');

        this.playlistContainer.innerHTML = playlistHTML;

        // Add event listeners to playlist items
        this.playlistContainer.querySelectorAll('.playlist-item').forEach((item, index) => {
            // Setup drag and drop
            this.setupDragAndDrop(item, index);
            
            // Click to select track
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('playlist-item-btn') && 
                    !e.target.classList.contains('drag-handle')) {
                    const trackIndex = parseInt(item.dataset.index);
                    this.musicManager.loadTrack(trackIndex);
                }
            });
        });

        // Add event listeners to control buttons
        this.playlistContainer.querySelectorAll('.play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.musicManager.loadTrack(index);
                this.musicManager.play();
            });
        });

        this.playlistContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const trackId = parseInt(btn.dataset.trackId);
                if (confirm('Remove this track from playlist?')) {
                    this.musicManager.removeTrack(trackId);
                }
            });
        });
    }

    updatePlayPauseButton(isPlaying) {
        if (isPlaying) {
            this.playPauseBtn.textContent = '⏸️';
            this.playPauseBtn.classList.add('playing');
        } else {
            this.playPauseBtn.textContent = '▶️';
            this.playPauseBtn.classList.remove('playing');
        }
    }

    // Utility Methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public methods for external control
    showTrackImportSuccess(trackName) {
        console.log(`Track imported: ${trackName}`);
    }

    showError(message) {
        console.error(message);
        alert(message); // Simple fallback
    }

    // Get current UI state
    getIsOpen() {
        return this.isOpen;
    }
}