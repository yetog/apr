import { Game } from './game.js';
import { MusicManager } from './MusicManager.js';
import { UIManager } from './UIManager.js';
import { mountDJCopilotPanel } from './DJCopilotClient.js';

// Get the render target div
const renderDiv = document.getElementById('renderDiv');

// Check if renderDiv exists
if (!renderDiv) {
    console.error('Fatal Error: renderDiv element not found.');
} else {
    // Initialize the music manager
    const musicManager = new MusicManager();
    
    // Initialize the UI manager with the music manager
    const uiManager = new UIManager(musicManager);

    // Optional local DJ Copilot panel; never blocks APR audio or gestures.
    mountDJCopilotPanel().catch(error => console.warn('DJ Copilot unavailable:', error));
    
    // Initialize the game with the render target and music manager
    const game = new Game(renderDiv, musicManager);
    
    // Start the music manager after user interaction
    let hasStarted = false;
    const startAudio = async () => {
        if (!hasStarted) {
            try {
                await musicManager.start();
                hasStarted = true;
                console.log('✅ Audio system started successfully');
                
                // Add demo tracks for testing
                addDemoTracks(musicManager);
            } catch (error) {
                console.error('❌ Failed to start audio system:', error);
            }
        }
    };

    // Start audio on first user interaction
    const startOnInteraction = () => {
        startAudio();
        document.removeEventListener('click', startOnInteraction);
        document.removeEventListener('keydown', startOnInteraction);
        document.removeEventListener('touchstart', startOnInteraction);
    };

    document.addEventListener('click', startOnInteraction);
    document.addEventListener('keydown', startOnInteraction);
    document.addEventListener('touchstart', startOnInteraction);
}

// Add working demo tracks for testing
function addDemoTracks(musicManager) {
    console.log('🎵 Adding demo tracks...');
    
    // Use actual working audio URLs for demo tracks
    const demoTracks = [
        {
            title: "Demo Track 1 - Electronic",
            artist: "Sample Artist",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav"
        },
        {
            title: "Demo Track 2 - Ambient",
            artist: "Demo Creator",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav"
        },
        {
            title: "Demo Track 3 - Beat",
            artist: "Test Producer",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav"
        }
    ];

    // Add each demo track to the playlist
    demoTracks.forEach((track, index) => {
        try {
            const addedTrack = musicManager.addTrack(track);
            console.log(`✅ Demo track ${index + 1} added:`, addedTrack.title);
        } catch (error) {
            console.error(`❌ Failed to add demo track ${index + 1}:`, error);
        }
    });

    console.log(`🎵 ${demoTracks.length} demo tracks added to playlist`);
    console.log('🎛️ DJ controls are now ready! Use gestures to control playback and effects.');
    
    // Auto-load the first track
    setTimeout(() => {
        if (musicManager.getPlaylist().length > 0) {
            musicManager.loadTrack(0);
            console.log('🎵 First demo track loaded and ready to play');
        }
    }, 1000);
}