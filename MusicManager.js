import * as Tone from 'https://esm.sh/tone';

// Enhanced MusicManager for DJ-style dual-deck crossfader control
export class MusicManager {
    constructor() {
        // Single player setup (simplified back to working state)
        this.player = null;
        
        // Effects chain
        this.reverb = null;
        this.stereoDelay = null;
        this.distortion = null;
        this.autoFilter = null;
        this.analyser = null;
        this.isStarted = false;
        
        // Crossfader and effects state
        this.crossfaderPosition = 0.5; // 0 = full A, 1 = full B, 0.5 = center
        this.effects = {
            reverb: { active: false, intensity: 0.2 },
            delay: { active: false, intensity: 0.3 },
            distortion: { active: false, intensity: 0.1 },
            filter: { active: false, intensity: 0.5 }
        };
        
        // Playlist management
        this.playlist = [];
        this.currentTrackIndex = -1;
        this.isPlaying = false;
        this.volume = 0.7;
        
        // Track loading state
        this.isLoading = false;
        
        // Event callbacks
        this.onTrackChange = null;
        this.onPlayStateChange = null;
        this.onPlaylistChange = null;
        this.onCrossfaderChange = null;
        this.onEffectChange = null;
    }

    // Must be called after a user interaction
    async start() {
        if (this.isStarted) return;

        console.log('🎵 Starting MusicManager...');
        await Tone.start();

        // Create effects chain
        this.reverb = new Tone.Reverb({
            decay: 3,
            preDelay: 0.01,
            wet: 0
        }).toDestination();

        this.stereoDelay = new Tone.FeedbackDelay("8n", 0.3);
        this.stereoDelay.wet.value = 0;
        this.stereoDelay.connect(this.reverb);

        this.distortion = new Tone.Distortion(0);
        this.distortion.wet.value = 0;
        this.distortion.connect(this.stereoDelay);

        this.autoFilter = new Tone.AutoFilter("4n");
        this.autoFilter.wet.value = 0;
        this.autoFilter.start();
        this.autoFilter.connect(this.distortion);

        // Create analyser for visualization
        this.analyser = new Tone.Analyser('waveform', 1024);
        this.analyser.connect(this.autoFilter);

        // Don't create player here - wait for track loading
        this.player = null;
        
        // Set initial volume
        this.updateVolume();

        this.isStarted = true;
        console.log("✅ DJ MusicManager started with crossfader control and effects chain.");
    }

    setupPlayerEvents() {
        if (!this.player) return;
        
        this.player.onstop = () => {
            this.isPlaying = false;
            this.notifyPlayStateChange();
            console.log('🎵 Track stopped');
        };
    }

    // Crossfader Control (0 = full A, 1 = full B) - Visual only for now
    setCrossfaderPosition(position) {
        this.crossfaderPosition = Math.max(0, Math.min(1, position));
        console.log(`🎛️ Crossfader position: ${(this.crossfaderPosition * 100).toFixed(0)}%`);
        
        if (this.onCrossfaderChange) {
            this.onCrossfaderChange(this.crossfaderPosition);
        }
    }

    getCrossfaderPosition() {
        return this.crossfaderPosition;
    }

    // Effect Controls
    toggleEffect(effectName) {
        if (!this.effects[effectName]) {
            console.warn(`❌ Unknown effect: ${effectName}`);
            return false;
        }
        
        this.effects[effectName].active = !this.effects[effectName].active;
        this.updateEffect(effectName);
        
        console.log(`🎛️ Effect ${effectName}: ${this.effects[effectName].active ? 'ON' : 'OFF'} (${(this.effects[effectName].intensity * 100).toFixed(0)}%)`);
        
        if (this.onEffectChange) {
            this.onEffectChange(effectName, this.effects[effectName]);
        }
        
        return this.effects[effectName].active;
    }

    setEffectIntensity(effectName, intensity) {
        if (!this.effects[effectName]) return false;
        
        this.effects[effectName].intensity = Math.max(0, Math.min(1, intensity));
        this.updateEffect(effectName);
        
        console.log(`🎛️ ${effectName} intensity: ${(this.effects[effectName].intensity * 100).toFixed(0)}%`);
        
        if (this.onEffectChange) {
            this.onEffectChange(effectName, this.effects[effectName]);
        }
        
        return true;
    }

    updateEffect(effectName) {
        const effect = this.effects[effectName];
        const wetValue = effect.active ? effect.intensity : 0;
        
        switch(effectName) {
            case 'reverb':
                if (this.reverb) this.reverb.wet.value = wetValue;
                break;
            case 'delay':
                if (this.stereoDelay) this.stereoDelay.wet.value = wetValue;
                break;
            case 'distortion':
                if (this.distortion) {
                    this.distortion.wet.value = wetValue;
                    this.distortion.distortion = wetValue * 0.8; // Scale distortion amount
                }
                break;
            case 'filter':
                if (this.autoFilter) {
                    this.autoFilter.wet.value = wetValue;
                    this.autoFilter.frequency.value = 200 + (wetValue * 2000); // 200Hz to 2200Hz
                }
                break;
        }
    }

    getEffect(effectName) {
        return this.effects[effectName] || null;
    }

    getAllEffects() {
        return { ...this.effects };
    }

    // Playlist Management
    addTrack(trackInfo) {
        const track = {
            id: Date.now() + Math.random(),
            title: trackInfo.title || 'Unknown Title',
            artist: trackInfo.artist || 'Unknown Artist',
            url: trackInfo.url,
            duration: trackInfo.duration || null,
            ...trackInfo
        };

        this.playlist.push(track);
        console.log(`🎵 Track added: ${track.title} by ${track.artist}`);
        
        if (this.onPlaylistChange) {
            this.onPlaylistChange(this.playlist);
        }

        // Auto-load first track if empty
        if (this.playlist.length === 1 && this.currentTrackIndex === -1) {
            setTimeout(() => this.loadTrack(0), 500);
        }

        return track;
    }

    removeTrack(trackId) {
        const index = this.playlist.findIndex(track => track.id === trackId);
        if (index === -1) return false;

        const track = this.playlist[index];
        console.log(`🗑️ Removing track: ${track.title}`);

        // Handle removal of current track
        if (index === this.currentTrackIndex) {
            this.stop();
            this.currentTrackIndex = -1;
        }

        // Adjust current index
        if (index < this.currentTrackIndex) this.currentTrackIndex--;

        this.playlist.splice(index, 1);

        if (this.onPlaylistChange) {
            this.onPlaylistChange(this.playlist);
        }

        return true;
    }

    // Reorder tracks in playlist
    reorderTrack(oldIndex, newIndex) {
        if (oldIndex < 0 || oldIndex >= this.playlist.length || 
            newIndex < 0 || newIndex >= this.playlist.length || 
            oldIndex === newIndex) {
            console.warn(`❌ Invalid reorder indices: ${oldIndex} -> ${newIndex}`);
            return false;
        }

        console.log(`🔄 Reordering track from position ${oldIndex} to ${newIndex}`);
        
        // Remove track from old position
        const [movedTrack] = this.playlist.splice(oldIndex, 1);
        
        // Insert track at new position
        this.playlist.splice(newIndex, 0, movedTrack);
        
        // Update current track index if necessary
        if (this.currentTrackIndex === oldIndex) {
            // Currently playing track was moved
            this.currentTrackIndex = newIndex;
            console.log(`🎵 Updated current track index to ${newIndex}`);
        } else if (this.currentTrackIndex > oldIndex && this.currentTrackIndex <= newIndex) {
            // Current track index shifts down
            this.currentTrackIndex--;
        } else if (this.currentTrackIndex < oldIndex && this.currentTrackIndex >= newIndex) {
            // Current track index shifts up
            this.currentTrackIndex++;
        }
        
        // Notify UI of playlist change
        if (this.onPlaylistChange) {
            this.onPlaylistChange(this.playlist);
        }
        
        // Notify of track change if current track moved
        if (this.onTrackChange && oldIndex === this.currentTrackIndex) {
            this.onTrackChange(this.getCurrentTrack());
        }
        
        console.log(`✅ Track reordered successfully. Current track index: ${this.currentTrackIndex}`);
        return true;
    }

    // Track Loading
    async loadTrack(trackIndex) {
        if (trackIndex < 0 || trackIndex >= this.playlist.length) {
            console.warn(`❌ Invalid track index: ${trackIndex}`);
            return false;
        }
        
        const track = this.playlist[trackIndex];
        if (!track || !track.url) {
            console.warn(`❌ Invalid track or URL: ${track?.title || 'Unknown'}`);
            return false;
        }

        console.log(`🎵 Loading track: ${track.title} by ${track.artist}`);
        this.isLoading = true;
        this.stop();

        try {
            // Dispose old player
            if (this.player) {
                this.player.dispose();
                this.player = null;
            }

            // Create new player with proper error handling
            this.player = new Tone.Player({
                url: track.url,
                onload: () => {
                    this.isLoading = false;
                    console.log(`✅ Track loaded successfully: ${track.title}`);
                    
                    if (this.onTrackChange) {
                        this.onTrackChange(track);
                    }
                },
                onerror: (error) => {
                    this.isLoading = false;
                    console.error(`❌ Error loading track: ${track.title}`, error);
                }
            });

            // Connect to effects chain
            if (this.analyser) {
                this.player.connect(this.analyser);
            }

            // Update volume
            this.updateVolume();
            
            // Set up event listeners
            this.setupPlayerEvents();

            this.currentTrackIndex = trackIndex;
            return true;
        } catch (error) {
            this.isLoading = false;
            console.error(`❌ Error creating player for track:`, error);
            return false;
        }
    }

    // Playback Controls
    play() {
        if (!this.player || this.isLoading) {
            console.warn('❌ Cannot play: No player or still loading');
            return false;
        }

        try {
            if (this.player.state === 'stopped') {
                this.player.start();
                console.log('▶️ Playing track');
            }
            this.isPlaying = true;
            this.notifyPlayStateChange();
            return true;
        } catch (error) {
            console.error(`❌ Error playing:`, error);
            return false;
        }
    }

    pause() {
        if (!this.player) {
            console.warn('❌ Cannot pause: No player');
            return false;
        }

        try {
            this.player.stop();
            this.isPlaying = false;
            this.notifyPlayStateChange();
            console.log('⏸️ Track paused');
            return true;
        } catch (error) {
            console.error(`❌ Error pausing:`, error);
            return false;
        }
    }

    stop() {
        return this.pause();
    }

    togglePlayPause() {
        const result = this.isPlaying ? this.pause() : this.play();
        console.log(`🎵 Toggle play/pause: ${this.isPlaying ? 'Playing' : 'Paused'}`);
        return result;
    }

    playNext() {
        if (this.currentTrackIndex < this.playlist.length - 1) {
            console.log('⏭️ Playing next track');
            return this.loadTrack(this.currentTrackIndex + 1);
        } else {
            console.log('⏭️ Already at last track');
            return false;
        }
    }

    playPrevious() {
        if (this.currentTrackIndex > 0) {
            console.log('⏮️ Playing previous track');
            return this.loadTrack(this.currentTrackIndex - 1);
        } else {
            console.log('⏮️ Already at first track');
            return false;
        }
    }

    // Volume Control
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.updateVolume();
        console.log(`🔊 Volume: ${(this.volume * 100).toFixed(0)}%`);
    }

    updateVolume() {
        if (this.player) {
            this.player.volume.value = Tone.gainToDb(this.volume);
        }
    }

    getVolume() {
        return this.volume;
    }

    // Legacy dual deck methods for compatibility
    loadTrackToDeck(deck, trackIndex) {
        return this.loadTrack(trackIndex);
    }

    playDeck(deck) {
        return this.play();
    }

    pauseDeck(deck) {
        return this.pause();
    }

    stopDeck(deck) {
        return this.stop();
    }

    togglePlayPauseDeck(deck) {
        return this.togglePlayPause();
    }

    // Getters
    getCurrentTrack(deck = null) {
        if (this.currentTrackIndex >= 0 && this.currentTrackIndex < this.playlist.length) {
            return this.playlist[this.currentTrackIndex];
        }
        return null;
    }

    getPlaylist() {
        return [...this.playlist];
    }

    getCurrentTrackIndex(deck = null) {
        return this.currentTrackIndex;
    }

    getIsPlaying(deck = null) {
        return this.isPlaying;
    }

    getIsLoading(deck = null) {
        return this.isLoading;
    }

    getAnalyser() {
        return this.analyser;
    }

    // Event notification helpers
    notifyPlayStateChange() {
        if (this.onPlayStateChange) {
            this.onPlayStateChange(this.isPlaying);
        }
    }

    // Event Handlers
    setOnTrackChange(callback) {
        this.onTrackChange = callback;
    }

    setOnPlayStateChange(callback) {
        this.onPlayStateChange = callback;
    }

    setOnPlaylistChange(callback) {
        this.onPlaylistChange = callback;
    }

    setOnCrossfaderChange(callback) {
        this.onCrossfaderChange = callback;
    }

    setOnEffectChange(callback) {
        this.onEffectChange = callback;
    }

    // Utility methods
    static createTrackFromFile(file) {
        const url = URL.createObjectURL(file);
        const name = file.name.replace(/\.[^/.]+$/, "");
        
        let title = name;
        let artist = 'Unknown Artist';
        
        if (name.includes(' - ')) {
            const parts = name.split(' - ');
            if (parts.length >= 2) {
                artist = parts[0].trim();
                title = parts.slice(1).join(' - ').trim();
            }
        }

        return {
            title,
            artist,
            url,
            filename: file.name,
            size: file.size,
            type: file.type
        };
    }

    static createTrackFromURL(url, title = null, artist = null) {
        const urlObj = new URL(url);
        const filename = urlObj.pathname.split('/').pop() || 'Unknown Track';
        const defaultTitle = filename.replace(/\.[^/.]+$/, "");

        return {
            title: title || defaultTitle,
            artist: artist || 'Unknown Artist',
            url,
            filename
        };
    }
}