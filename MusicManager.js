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

        // Create single player (simplified)
        this.player = new Tone.Player().connect(this.analyser);
        
        // Set initial volume
        this.updateVolume();

        // Set up player event listeners
        this.setupPlayerEvents();

        this.isStarted = true;
        console.log("DJ MusicManager started with crossfader control.");
    }

    setupPlayerEvents() {
        this.player.onstop = () => {
            this.isPlaying = false;
            this.notifyPlayStateChange();
        };
    }

    // Crossfader Control (0 = full A, 1 = full B) - Visual only for now
    setCrossfaderPosition(position) {
        this.crossfaderPosition = Math.max(0, Math.min(1, position));
        
        if (this.onCrossfaderChange) {
            this.onCrossfaderChange(this.crossfaderPosition);
        }
    }

    getCrossfaderPosition() {
        return this.crossfaderPosition;
    }

    // Effect Controls
    toggleEffect(effectName) {
        if (!this.effects[effectName]) return false;
        
        this.effects[effectName].active = !this.effects[effectName].active;
        this.updateEffect(effectName);
        
        if (this.onEffectChange) {
            this.onEffectChange(effectName, this.effects[effectName]);
        }
        
        return this.effects[effectName].active;
    }

    setEffectIntensity(effectName, intensity) {
        if (!this.effects[effectName]) return false;
        
        this.effects[effectName].intensity = Math.max(0, Math.min(1, intensity));
        this.updateEffect(effectName);
        
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
        
        if (this.onPlaylistChange) {
            this.onPlaylistChange(this.playlist);
        }

        // Auto-load first track if empty
        if (this.playlist.length === 1 && this.currentTrackIndex === -1) {
            this.loadTrack(0);
        }

        return track;
    }

    removeTrack(trackId) {
        const index = this.playlist.findIndex(track => track.id === trackId);
        if (index === -1) return false;

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

    // Track Loading
    async loadTrack(trackIndex) {
        if (trackIndex < 0 || trackIndex >= this.playlist.length) return false;
        
        const track = this.playlist[trackIndex];
        if (!track || !track.url) return false;

        this.isLoading = true;
        this.stop();

        try {
            // Dispose old player
            if (this.player) {
                this.player.dispose();
            }

            // Create new player
            this.player = new Tone.Player({
                url: track.url,
                onload: () => {
                    this.isLoading = false;
                    console.log(`Track loaded: ${track.title}`);
                    
                    if (this.onTrackChange) {
                        this.onTrackChange(track);
                    }
                },
                onerror: (error) => {
                    this.isLoading = false;
                    console.error(`Error loading track: ${track.title}`, error);
                }
            }).connect(this.analyser);

            // Update volume
            this.updateVolume();
            
            // Set up event listeners
            this.setupPlayerEvents();

            this.currentTrackIndex = trackIndex;
            return true;
        } catch (error) {
            this.isLoading = false;
            console.error(`Error loading track:`, error);
            return false;
        }
    }

    // Playback Controls
    play() {
        if (!this.player || this.isLoading) return false;

        try {
            if (this.player.state === 'stopped') {
                this.player.start();
            }
            this.isPlaying = true;
            this.notifyPlayStateChange();
            return true;
        } catch (error) {
            console.error(`Error playing:`, error);
            return false;
        }
    }

    pause() {
        if (!this.player) return false;

        try {
            this.player.stop();
            this.isPlaying = false;
            this.notifyPlayStateChange();
            return true;
        } catch (error) {
            console.error(`Error pausing:`, error);
            return false;
        }
    }

    stop() {
        return this.pause();
    }

    togglePlayPause() {
        return this.isPlaying ? this.pause() : this.play();
    }

    playNext() {
        if (this.currentTrackIndex < this.playlist.length - 1) {
            return this.loadTrack(this.currentTrackIndex + 1);
        }
        return false;
    }

    playPrevious() {
        if (this.currentTrackIndex > 0) {
            return this.loadTrack(this.currentTrackIndex - 1);
        }
        return false;
    }

    // Volume Control
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.updateVolume();
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