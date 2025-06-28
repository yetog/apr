---
license: mit
title: Gesture DJ Controller
sdk: static
emoji: 🎵
colorFrom: purple
colorTo: pink
short_description: Hand-controlled DJ interface with gesture controls and playlist management
---

# Gesture DJ Controller

A hand-controlled DJ interface with gesture controls, playlist management, and audio-reactive visualizations. Control your music with natural hand movements!

An interactive web application built with Three.js, MediaPipe computer vision, and Tone.js for real-time audio processing.

## Features

- **Hand Gesture Control**: Use natural hand movements to control playback
  - **Left Hand**: Volume control (raise hand to increase volume)
  - **Right Hand**: Playback control
    - Pinch (thumb + index finger): Play/Pause
    - Raise hand high: Next track
    - Lower hand: Previous track
- **Playlist Management**: Import and organize your music collection
  - Import local audio files
  - Add tracks via URL
  - Drag and drop to reorder playlist
  - Remove unwanted tracks
- **Audio-Reactive Visualizer**: Real-time waveform visualization that responds to your music
- **Full-Screen Camera Overlay**: See your hands while controlling the music

[Live Demo](https://collidingscopes.github.io/arpeggiator/) | [More Code & Tutorials](https://funwithcomputervision.com/)

## Requirements

- Modern web browser with WebGL support
- Camera access enabled for hand tracking
- Audio files (MP3, WAV, etc.) or audio URLs for playback

## Technologies

- **MediaPipe** (@mediapipe/hands@0.4.1646424915) for hand tracking and gesture recognition
- **MediaPipe Camera Utils** (@mediapipe/camera_utils@0.3.1627447220) for camera integration
- **Three.js** for audio-reactive visual rendering and 3D graphics
- **Tone.js** for audio processing, effects, and analysis
- **HTML5 Canvas** for hand landmark visualization
- **JavaScript ES6 Modules** for modern, modular code architecture

## Setup for Development

```bash
# Clone this repository
git clone https://github.com/collidingScopes/arpeggiator
cd arpeggiator

# Install dependencies (optional - project uses CDN imports)
npm install

# Start development server
npm run dev
# or
python -m http.server 8000
```

Then navigate to `http://localhost:8000` in your browser.

**Important**: The application requires camera access. Make sure to allow camera permissions when prompted.

## How to Use

1. **Allow Camera Access**: Grant camera permissions when prompted
2. **Import Music**: 
   - Click the 🎵 button to open the sidebar
   - Use "Import Local Files" to add audio files from your computer
   - Or paste audio URLs to add online tracks
3. **Control with Gestures**:
   - Show your hands to the camera
   - Use left hand height to control volume
   - Use right hand gestures for playback control
4. **Manage Playlist**:
   - Click tracks to select them
   - Drag and drop to reorder
   - Use playback controls or gestures

## Gesture Controls

### Left Hand (Volume Control)
- **Raise hand**: Increase volume
- **Lower hand**: Decrease volume
- **Hand position**: Directly controls audio volume level

### Right Hand (Playback Control)
- **Pinch gesture** (thumb + index finger close): Play/Pause toggle
- **Raise hand high** (above 80% of screen): Skip to next track
- **Lower hand** (below 20% of screen): Go to previous track

## Keyboard Shortcuts

- **Space**: Play/Pause
- **Arrow Right**: Next track
- **Arrow Left**: Previous track
- **M**: Toggle music sidebar
- **G**: Debug - Show gesture state in console
- **V**: Debug - Toggle video/canvas visibility

## Project Structure

```
├── main.js              # Application entry point
├── game.js              # Main game logic and MediaPipe integration
├── MusicManager.js      # Audio playback and playlist management
├── UIManager.js         # User interface and sidebar controls
├── WaveformVisualizer.js # Audio-reactive visualization
├── styles.css           # Application styling
├── index.html           # Main HTML file
└── assets/              # Static assets
    └── siteOGImage.webp # Social media preview image
```

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari (with WebRTC support)
- Edge

**Note**: MediaPipe works best in Chrome/Chromium browsers. Some features may be limited in other browsers.

## Troubleshooting

### Camera Issues
- Ensure camera permissions are granted
- Check if another application is using the camera
- Try refreshing the page and allowing permissions again

### Gesture Recognition Issues
- Ensure good lighting conditions
- Keep hands visible and within camera frame
- Check browser console (F12) for debug information
- Use keyboard shortcut 'G' to view gesture state

### Audio Issues
- Ensure audio files are in supported formats (MP3, WAV, OGG)
- Check browser audio permissions
- Verify audio URLs are accessible and CORS-enabled

## License

MIT License

## Credits

- **Three.js** - https://threejs.org/
- **MediaPipe** - https://mediapipe.dev/
- **Tone.js** - https://tonejs.github.io/
- **ESM CDN** - https://esm.sh/

## Related Projects

I've released several computer vision projects (with code + tutorials) here:
[Fun With Computer Vision](https://www.funwithcomputervision.com/)

You can purchase lifetime access and receive the full project files and tutorials. I'm adding more content regularly 🪬

You might also like some of my other open source projects:

- [3D Model Playground](https://collidingScopes.github.io/3d-model-playground) - Control 3D models with voice and hand gestures
- [Threejs Hand Tracking Tutorial](https://collidingScopes.github.io/threejs-handtracking-101) - Basic hand tracking setup with Three.js and MediaPipe
- [Particular Drift](https://collidingScopes.github.io/particular-drift) - Turn photos into flowing particle animations
- [Video-to-ASCII](https://collidingScopes.github.io/ascii) - Convert videos into ASCII pixel art

## Contact

- **Instagram**: [@stereo.drift](https://www.instagram.com/stereo.drift/)
- **Twitter/X**: [@measure_plan](https://x.com/measure_plan)
- **Email**: [stereodriftvisuals@gmail.com](mailto:stereodriftvisuals@gmail.com)
- **GitHub**: [collidingScopes](https://github.com/collidingScopes)

## Support

If you found this project useful, feel free to buy me a coffee. 

My name is Alan, and I enjoy building open source software for computer vision, games, and more. This would be much appreciated during late-night coding sessions!

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/yellow_img.png)](https://www.buymeacoffee.com/stereoDrift)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Changelog

### v1.0.0
- Initial release with gesture-controlled DJ interface
- Hand tracking with MediaPipe
- Audio-reactive visualizations
- Playlist management with drag-and-drop
- Full-screen camera overlay
- Local file and URL import support