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

        // Initial render
        this.renderCurrentTrack();
        this.renderPlaylist();
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
            </div>
        `).join('');

        this.playlistContainer.innerHTML = playlistHTML;

        // Add event listeners to playlist items
        this.playlistContainer.querySelectorAll('.playlist-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('playlist-item-btn')) {
                    const index = parseInt(item.dataset.index);
                    this.musicManager.loadTrack(index);
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
        // Could show a toast notification or update UI
        console.log(`Track imported: ${trackName}`);
    }

    showError(message) {
        // Could show error toast or modal
        console.error(message);
        alert(message); // Simple fallback
    }

    // Get current UI state
    getIsOpen() {
        return this.isOpen;
    }
}