import { Game } from './game.js';
import { MusicManager } from './MusicManager.js';
import { UIManager } from './UIManager.js';

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
    
    // Initialize the game with the render target and music manager
    const game = new Game(renderDiv, musicManager);
    
    // Start the music manager after user interaction
    let hasStarted = false;
    const startAudio = async () => {
        if (!hasStarted) {
            try {
                await musicManager.start();
                hasStarted = true;
                console.log('Audio system started successfully');
                
                // Add some demo tracks for testing
                addDemoTracks(musicManager);
            } catch (error) {
                console.error('Failed to start audio system:', error);
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

// Add some demo tracks for testing
function addDemoTracks(musicManager) {
    // Add some royalty-free demo tracks (these are example URLs - replace with actual working URLs)
    const demoTracks = [
        {
            title: "Chill Vibes",
            artist: "Demo Artist",
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav" // Replace with actual music URL
        },
        {
            title: "Electronic Beat",
            artist: "Sample Creator", 
            url: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav" // Replace with actual music URL
        }
    ];

    // Note: The above URLs are just examples. In a real implementation, you would:
    // 1. Use actual royalty-free music URLs
    // 2. Host your own demo tracks
    // 3. Use a music streaming API
    // 4. Or remove this demo function entirely

    // Uncomment the following lines when you have actual demo track URLs:
    // demoTracks.forEach(track => {
    //     musicManager.addTrack(track);
    // });
}