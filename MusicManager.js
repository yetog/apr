import * as Tone from 'https://esm.sh/tone';

// Enhanced MusicManager for DJ-style dual-deck crossfader control
export class MusicManager {
    constructor() {
        // Dual deck setup for crossfader
        this.playerA = null;
        this.playerB = null;
        this.currentDeck = 'A'; // Which deck is currently active for loading
        
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
        this.currentTrackIndexA = -1;
        this.currentTrackIndexB = -1;
        this.isPlayingA = false;
        this.isPlayingB = false;
        this.volume = 0.7;
        
        // Track loading state
        this.isLoadingA = false;
        this.isLoadingB = false;
        
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

        // Create dual players for crossfader
        this.playerA = new Tone.Player().connect(this.analyser);
        this.playerB = new Tone.Player().connect(this.analyser);
        
        // Set initial volumes based on crossfader position
        this.updateCrossfaderVolumes();

        // Set up player event listeners
        this.setupPlayerEvents();

        this.isStarted = true;
        console.log("DJ MusicManager started with dual deck crossfader control.");
    }

    setupPlayerEvents() {
        this.playerA.onstop = () => {
            this.isPlayingA = false;
            this.notifyPlayStateChange();
        };

        this.playerB.onstop = () => {
            this.isPlayingB = false;
            this.notifyPlayStateChange();
        };
    }

    // Crossfader Control (0 = full A, 1 = full B)
    setCrossfaderPosition(position) {
        this.crossfaderPosition = Math.max(0, Math.min(1, position));
        this.updateCrossfaderVolumes();
        
        if (this.onCrossfaderChange) {
            this.onCrossfaderChange(this.crossfaderPosition);
        }
    }

    updateCrossfaderVolumes() {
        if (this.playerA && this.playerB) {
            // Crossfader curve - equal power crossfading
            const angleA = this.crossfaderPosition * Math.PI / 2;
            const angleB = (1 - this.crossfaderPosition) * Math.PI / 2;
            
            const volumeA = Math.cos(angleA) * this.volume;
            const volumeB = Math.cos(angleB) * this.volume;
            
            this.playerA.volume.value = Tone.gainToDb(volumeA);
            this.playerB.volume.value = Tone.gainToDb(volumeB);
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

    // Playlist Management (Enhanced for dual deck)
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

        // Auto-load first track to deck A if empty
        if (this.playlist.length === 1 && this.currentTrackIndexA === -1) {
            this.loadTrackToDeck('A', 0);
        }

        return track;
    }

    removeTrack(trackId) {
        const index = this.playlist.findIndex(track => track.id === trackId);
        if (index === -1) return false;

        // Handle removal from active decks
        if (index === this.currentTrackIndexA) {
            this.stopDeck('A');
            this.currentTrackIndexA = -1;
        }
        if (index === this.currentTrackIndexB) {
            this.stopDeck('B');
            this.currentTrackIndexB = -1;
        }

        // Adjust indices
        if (index < this.currentTrackIndexA) this.currentTrackIndexA--;
        if (index < this.currentTrackIndexB) this.currentTrackIndexB--;

        this.playlist.splice(index, 1);

        if (this.onPlaylistChange) {
            this.onPlaylistChange(this.playlist);
        }

        return true;
    }

    // Dual Deck Track Loading
    async loadTrackToDeck(deck, trackIndex) {
        if (trackIndex < 0 || trackIndex >= this.playlist.length) return false;
        
        const track = this.playlist[trackIndex];
        if (!track || !track.url) return false;

        const isLoadingKey = deck === 'A' ? 'isLoadingA' : 'isLoadingB';
        const playerKey = deck === 'A' ? 'playerA' : 'playerB';
        const currentIndexKey = deck === 'A' ? 'currentTrackIndexA' : 'currentTrackIndexB';

        this[isLoadingKey] = true;
        this.stopDeck(deck);

        try {
            // Dispose old player
            if (this[playerKey]) {
                this[playerKey].dispose();
            }

            // Create new player
            this[playerKey] = new Tone.Player({
                url: track.url,
                onload: () => {
                    this[isLoadingKey] = false;
                    console.log(`Track loaded to deck ${deck}: ${track.title}`);
                    
                    if (this.onTrackChange) {
                        this.onTrackChange(track, deck);
                    }
                },
                onerror: (error) => {
                    this[isLoadingKey] = false;
                    console.error(`Error loading track to deck ${deck}: ${track.title}`, error);
                }
            }).connect(this.analyser);

            // Update crossfader volumes
            this.updateCrossfaderVolumes();
            
            // Set up event listeners
            this.setupPlayerEvents();

            this[currentIndexKey] = trackIndex;
            return true;
        } catch (error) {
            this[isLoadingKey] = false;
            console.error(`Error loading track to deck ${deck}:`, error);
            return false;
        }
    }

    // Playback Controls for Dual Deck
    playDeck(deck) {
        const player = deck === 'A' ? this.playerA : this.playerB;
        const isPlayingKey = deck === 'A' ? 'isPlayingA' : 'isPlayingB';
        const isLoadingKey = deck === 'A' ? 'isLoadingA' : 'isLoadingB';

        if (!player || this[isLoadingKey]) return false;

        try {
            if (player.state === 'stopped') {
                player.start();
            }
            this[isPlayingKey] = true;
            this.notifyPlayStateChange();
            return true;
        } catch (error) {
            console.error(`Error playing deck ${deck}:`, error);
            return false;
        }
    }

    pauseDeck(deck) {
        const player = deck === 'A' ? this.playerA : this.playerB;
        const isPlayingKey = deck === 'A' ? 'isPlayingA' : 'isPlayingB';

        if (!player) return false;

        try {
            player.stop();
            this[isPlayingKey] = false;
            this.notifyPlayStateChange();
            return true;
        } catch (error) {
            console.error(`Error pausing deck ${deck}:`, error);
            return false;
        }
    }

    stopDeck(deck) {
        return this.pauseDeck(deck);
    }

    togglePlayPauseDeck(deck) {
        const isPlaying = deck === 'A' ? this.isPlayingA : this.isPlayingB;
        return isPlaying ? this.pauseDeck(deck) : this.playDeck(deck);
    }

    // Legacy methods for backward compatibility
    togglePlayPause() {
        // Toggle the currently active deck based on crossfader position
        const activeDeck = this.crossfaderPosition < 0.5 ? 'A' : 'B';
        return this.togglePlayPauseDeck(activeDeck);
    }

    play() {
        const activeDeck = this.crossfaderPosition < 0.5 ? 'A' : 'B';
        return this.playDeck(activeDeck);
    }

    pause() {
        const activeDeck = this.crossfaderPosition < 0.5 ? 'A' : 'B';
        return this.pauseDeck(activeDeck);
    }

    stop() {
        this.stopDeck('A');
        this.stopDeck('B');
        return true;
    }

    playNext() {
        const activeDeck = this.crossfaderPosition < 0.5 ? 'A' : 'B';
        const currentIndex = activeDeck === 'A' ? this.currentTrackIndexA : this.currentTrackIndexB;
        
        if (currentIndex < this.playlist.length - 1) {
            return this.loadTrackToDeck(activeDeck, currentIndex + 1);
        }
        return false;
    }

    playPrevious() {
        const activeDeck = this.crossfaderPosition < 0.5 ? 'A' : 'B';
        const currentIndex = activeDeck === 'A' ? this.currentTrackIndexA : this.currentTrackIndexB;
        
        if (currentIndex > 0) {
            return this.loadTrackToDeck(activeDeck, currentIndex - 1);
        }
        return false;
    }

    // Volume Control
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.updateCrossfaderVolumes();
    }

    getVolume() {
        return this.volume;
    }

    // Getters
    getCurrentTrack(deck = null) {
        if (deck === 'A' && this.currentTrackIndexA >= 0) {
            return this.playlist[this.currentTrackIndexA];
        }
        if (deck === 'B' && this.currentTrackIndexB >= 0) {
            return this.playlist[this.currentTrackIndexB];
        }
        
        // Legacy: return active deck track
        const activeDeck = this.crossfaderPosition < 0.5 ? 'A' : 'B';
        const currentIndex = activeDeck === 'A' ? this.currentTrackIndexA : this.currentTrackIndexB;
        
        if (currentIndex >= 0 && currentIndex < this.playlist.length) {
            return this.playlist[currentIndex];
        }
        return null;
    }

    getPlaylist() {
        return [...this.playlist];
    }

    getCurrentTrackIndex(deck = null) {
        if (deck === 'A') return this.currentTrackIndexA;
        if (deck === 'B') return this.currentTrackIndexB;
        
        // Legacy: return active deck index
        const activeDeck = this.crossfaderPosition < 0.5 ? 'A' : 'B';
        return activeDeck === 'A' ? this.currentTrackIndexA : this.currentTrackIndexB;
    }

    getIsPlaying(deck = null) {
        if (deck === 'A') return this.isPlayingA;
        if (deck === 'B') return this.isPlayingB;
        
        // Legacy: return if any deck is playing
        return this.isPlayingA || this.isPlayingB;
    }

    getIsLoading(deck = null) {
        if (deck === 'A') return this.isLoadingA;
        if (deck === 'B') return this.isLoadingB;
        
        return this.isLoadingA || this.isLoadingB;
    }

    getAnalyser() {
        return this.analyser;
    }

    // Event notification helpers
    notifyPlayStateChange() {
        if (this.onPlayStateChange) {
            this.onPlayStateChange(this.isPlayingA || this.isPlayingB);
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

    // Utility methods (unchanged)
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