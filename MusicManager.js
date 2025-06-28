import * as Tone from 'https://esm.sh/tone';

// Enhanced MusicManager for DJ-style track playback and playlist management
export class MusicManager {
    constructor() {
        this.player = null;
        this.reverb = null;
        this.stereoDelay = null;
        this.analyser = null;
        this.isStarted = false;
        
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
    }

    // Must be called after a user interaction
    async start() {
        if (this.isStarted) return;

        await Tone.start();

        // Create effects chain
        this.reverb = new Tone.Reverb({
            decay: 3,
            preDelay: 0.01,
            wet: 0.2
        }).toDestination();

        this.stereoDelay = new Tone.FeedbackDelay("8n", 0.3).connect(this.reverb);
        this.stereoDelay.wet.value = 0.1;

        // Create analyser for visualization
        this.analyser = new Tone.Analyser('waveform', 1024);
        this.analyser.connect(this.stereoDelay);

        // Create player (will be recreated when tracks are loaded)
        this.player = new Tone.Player().connect(this.analyser);
        this.player.volume.value = Tone.gainToDb(this.volume);

        // Set up player event listeners
        this.player.onstop = () => {
            this.isPlaying = false;
            if (this.onPlayStateChange) {
                this.onPlayStateChange(false);
            }
        };

        this.isStarted = true;
        console.log("MusicManager started and ready for DJ control.");
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

        // If this is the first track, make it current
        if (this.playlist.length === 1 && this.currentTrackIndex === -1) {
            this.currentTrackIndex = 0;
            this.loadCurrentTrack();
        }

        return track;
    }

    removeTrack(trackId) {
        const index = this.playlist.findIndex(track => track.id === trackId);
        if (index === -1) return false;

        // If removing current track, stop playback
        if (index === this.currentTrackIndex) {
            this.stop();
            this.currentTrackIndex = -1;
        } else if (index < this.currentTrackIndex) {
            this.currentTrackIndex--;
        }

        this.playlist.splice(index, 1);

        if (this.onPlaylistChange) {
            this.onPlaylistChange(this.playlist);
        }

        // Load next available track if playlist isn't empty
        if (this.playlist.length > 0 && this.currentTrackIndex === -1) {
            this.currentTrackIndex = Math.min(index, this.playlist.length - 1);
            this.loadCurrentTrack();
        }

        return true;
    }

    reorderTrack(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.playlist.length || 
            toIndex < 0 || toIndex >= this.playlist.length) {
            return false;
        }

        const track = this.playlist.splice(fromIndex, 1)[0];
        this.playlist.splice(toIndex, 0, track);

        // Update current track index
        if (this.currentTrackIndex === fromIndex) {
            this.currentTrackIndex = toIndex;
        } else if (fromIndex < this.currentTrackIndex && toIndex >= this.currentTrackIndex) {
            this.currentTrackIndex--;
        } else if (fromIndex > this.currentTrackIndex && toIndex <= this.currentTrackIndex) {
            this.currentTrackIndex++;
        }

        if (this.onPlaylistChange) {
            this.onPlaylistChange(this.playlist);
        }

        return true;
    }

    // Track Loading and Playback
    async loadTrack(index) {
        if (index < 0 || index >= this.playlist.length) return false;

        this.stop();
        this.currentTrackIndex = index;
        return await this.loadCurrentTrack();
    }

    async loadCurrentTrack() {
        if (this.currentTrackIndex < 0 || this.currentTrackIndex >= this.playlist.length) {
            return false;
        }

        const track = this.playlist[this.currentTrackIndex];
        if (!track || !track.url) return false;

        this.isLoading = true;

        try {
            // Dispose old player
            if (this.player) {
                this.player.dispose();
            }

            // Create new player with the track
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

            this.player.volume.value = Tone.gainToDb(this.volume);

            // Set up player event listeners
            this.player.onstop = () => {
                this.isPlaying = false;
                if (this.onPlayStateChange) {
                    this.onPlayStateChange(false);
                }
                // Auto-play next track when current ends
                if (this.player.state === 'stopped' && this.currentTrackIndex < this.playlist.length - 1) {
                    this.playNext();
                }
            };

            return true;
        } catch (error) {
            this.isLoading = false;
            console.error('Error loading track:', error);
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
            
            if (this.onPlayStateChange) {
                this.onPlayStateChange(true);
            }
            return true;
        } catch (error) {
            console.error('Error playing track:', error);
            return false;
        }
    }

    pause() {
        if (!this.player) return false;

        try {
            this.player.stop();
            this.isPlaying = false;
            
            if (this.onPlayStateChange) {
                this.onPlayStateChange(false);
            }
            return true;
        } catch (error) {
            console.error('Error pausing track:', error);
            return false;
        }
    }

    stop() {
        if (!this.player) return false;

        try {
            this.player.stop();
            this.isPlaying = false;
            
            if (this.onPlayStateChange) {
                this.onPlayStateChange(false);
            }
            return true;
        } catch (error) {
            console.error('Error stopping track:', error);
            return false;
        }
    }

    togglePlayPause() {
        if (this.isPlaying) {
            return this.pause();
        } else {
            return this.play();
        }
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

    // Volume Control (for gesture control)
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.player) {
            this.player.volume.value = Tone.gainToDb(this.volume);
        }
    }

    getVolume() {
        return this.volume;
    }

    // Getters
    getCurrentTrack() {
        if (this.currentTrackIndex >= 0 && this.currentTrackIndex < this.playlist.length) {
            return this.playlist[this.currentTrackIndex];
        }
        return null;
    }

    getPlaylist() {
        return [...this.playlist];
    }

    getCurrentTrackIndex() {
        return this.currentTrackIndex;
    }

    getIsPlaying() {
        return this.isPlaying;
    }

    getIsLoading() {
        return this.isLoading;
    }

    getAnalyser() {
        return this.analyser;
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

    // Utility method to create track info from file
    static createTrackFromFile(file) {
        const url = URL.createObjectURL(file);
        const name = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        
        // Try to parse artist and title from filename
        let title = name;
        let artist = 'Unknown Artist';
        
        // Common patterns: "Artist - Title" or "Title - Artist"
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

    // Utility method to create track info from URL
    static createTrackFromURL(url, title = null, artist = null) {
        // Extract filename from URL for default title
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