import * as THREE from 'three';
import { WaveformVisualizer } from './WaveformVisualizer.js';

export class Game {
    constructor(renderDiv, musicManager) {
        console.log('🎮 Game: Initializing...');
        
        this.renderDiv = renderDiv;
        this.musicManager = musicManager;
        
        // Three.js setup
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.waveformVisualizer = null;
        
        // MediaPipe and camera setup
        this.hands = null;
        this.videoElement = null;
        this.canvasElement = null;
        this.canvasCtx = null;
        this.cameraStream = null;
        this.isCameraActive = false;
        this.mediaPipeCamera = null;
        
        // Gesture state
        this.gestureState = {
            leftHand: null,
            rightHand: null,
            isPlayPauseGesture: false,
            isNextGesture: false,
            isPrevGesture: false,
            volumeLevel: 0.7,
            lastGestureTime: 0,
            handCount: 0
        };
        
        // Animation
        this.animationId = null;
        
        this.init();
    }

    async init() {
        console.log('🎮 Game: Starting initialization...');
        
        try {
            await this.setupThreeJS();
            await this.setupCamera();
            await this.setupMediaPipe();
            this.setupEventListeners();
            this.startAnimation();
            
            console.log('✅ Game: Initialization complete!');
        } catch (error) {
            console.error('❌ Game: Initialization failed:', error);
            this.showError('Failed to initialize camera or hand tracking. Please check camera permissions.');
        }
    }

    setupThreeJS() {
        console.log('🎮 Game: Setting up Three.js...');
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 5;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderDiv.appendChild(this.renderer.domElement);

        // Waveform visualizer
        if (this.musicManager.getAnalyser()) {
            this.waveformVisualizer = new WaveformVisualizer(
                this.scene,
                this.musicManager.getAnalyser(),
                window.innerWidth,
                window.innerHeight
            );
            console.log('✅ Game: Waveform visualizer created');
        } else {
            console.warn('⚠️ Game: No analyser available for waveform visualizer');
        }

        console.log('✅ Game: Three.js setup complete');
    }

    async setupCamera() {
        console.log('📹 Game: Setting up camera...');
        
        try {
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia is not supported in this browser');
            }

            // Create video element (full screen)
            this.videoElement = document.createElement('video');
            this.videoElement.style.position = 'fixed';
            this.videoElement.style.top = '0';
            this.videoElement.style.left = '0';
            this.videoElement.style.width = '100vw';
            this.videoElement.style.height = '100vh';
            this.videoElement.style.zIndex = '998';
            this.videoElement.style.opacity = '0.4'; // Semi-transparent for overlay effect
            this.videoElement.style.objectFit = 'cover'; // Maintain aspect ratio
            this.videoElement.autoplay = true;
            this.videoElement.playsInline = true;
            this.videoElement.muted = true; // Prevent audio feedback
            
            // Add to DOM
            document.body.appendChild(this.videoElement);

            // Create canvas for MediaPipe (full screen)
            this.canvasElement = document.createElement('canvas');
            this.canvasElement.style.position = 'fixed';
            this.canvasElement.style.top = '0';
            this.canvasElement.style.left = '0';
            this.canvasElement.style.width = '100vw';
            this.canvasElement.style.height = '100vh';
            this.canvasElement.style.zIndex = '999';
            this.canvasElement.style.pointerEvents = 'none'; // Allow clicks to pass through
            this.canvasElement.width = window.innerWidth;
            this.canvasElement.height = window.innerHeight;
            this.canvasCtx = this.canvasElement.getContext('2d');
            
            // Add canvas to DOM
            document.body.appendChild(this.canvasElement);

            console.log('📹 Game: Requesting camera access...');
            
            // Request camera access with higher resolution for better hand detection
            const constraints = {
                video: {
                    width: { ideal: 1920, min: 1280 },
                    height: { ideal: 1080, min: 720 },
                    facingMode: 'user',
                    frameRate: { ideal: 30, min: 15 }
                }
            };

            this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ Game: Camera access granted');
            
            // Assign stream to video element
            this.videoElement.srcObject = this.cameraStream;
            
            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                this.videoElement.onloadedmetadata = () => {
                    console.log('✅ Game: Video metadata loaded');
                    console.log(`📹 Video resolution: ${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`);
                    resolve();
                };
                this.videoElement.onerror = (error) => {
                    console.error('❌ Game: Video error:', error);
                    reject(error);
                };
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    reject(new Error('Video loading timeout'));
                }, 10000);
            });

            await this.videoElement.play();
            this.isCameraActive = true;
            console.log('✅ Game: Camera setup complete');
            
        } catch (error) {
            console.error('❌ Game: Camera setup failed:', error);
            
            // Provide specific error messages
            if (error.name === 'NotAllowedError') {
                throw new Error('Camera access denied. Please allow camera access and refresh the page.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No camera found. Please connect a camera and refresh the page.');
            } else if (error.name === 'NotReadableError') {
                throw new Error('Camera is already in use by another application.');
            } else {
                throw new Error(`Camera error: ${error.message}`);
            }
        }
    }

    async setupMediaPipe() {
        console.log('🤖 Game: Setting up MediaPipe...');
        
        try {
            // Check if Hands is available globally (loaded via script tag)
            if (typeof Hands === 'undefined') {
                throw new Error('Hands constructor not found. MediaPipe script may not have loaded.');
            }

            console.log('✅ Game: MediaPipe Hands class found globally');

            // Initialize Hands using the global constructor
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
                }
            });

            // Configure Hands for better two-hand detection
            this.hands.setOptions({
                maxNumHands: 2,              // Allow detection of both hands
                modelComplexity: 1,          // Balance between accuracy and performance
                minDetectionConfidence: 0.7, // Higher confidence for more stable detection
                minTrackingConfidence: 0.5   // Lower tracking confidence for smoother tracking
            });

            // Set up results callback
            this.hands.onResults((results) => {
                this.onHandsResults(results);
            });

            console.log('✅ Game: MediaPipe Hands configured for two-hand detection');

            // Start processing video frames manually (without camera_utils)
            this.startVideoProcessing();
            
        } catch (error) {
            console.error('❌ Game: MediaPipe setup failed:', error);
            throw new Error(`MediaPipe initialization failed: ${error.message}`);
        }
    }

    startVideoProcessing() {
        console.log('🎥 Game: Starting video processing...');
        
        const processFrame = async () => {
            if (this.hands && this.videoElement && this.videoElement.readyState >= 2) {
                try {
                    await this.hands.send({ image: this.videoElement });
                } catch (error) {
                    console.error('Error processing frame:', error);
                }
            }
            
            // Continue processing at ~30fps
            setTimeout(processFrame, 33);
        };
        
        processFrame();
        console.log('✅ Game: Video processing started');
    }

    onHandsResults(results) {
        // Clear canvas
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

        // Reset hand count
        this.gestureState.handCount = 0;

        if (results.multiHandLandmarks && results.multiHandedness) {
            this.gestureState.handCount = results.multiHandLandmarks.length;
            
            // Log hand detection for debugging
            if (this.gestureState.handCount > 0) {
                const handLabels = results.multiHandedness.map(h => h.label).join(', ');
                console.log(`🤖 Game: Detected ${this.gestureState.handCount} hand(s): ${handLabels}`);
            }
            
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const handedness = results.multiHandedness[i];
                
                // Draw hand landmarks with different colors for each hand
                const handColor = handedness.label === 'Left' ? '#00FF00' : '#FF6600'; // Green for left, orange for right
                this.drawHandLandmarks(landmarks, handColor);
                
                // Process gestures
                this.processHandGestures(landmarks, handedness.label);
            }
        }
        
        this.canvasCtx.restore();
    }

    drawHandLandmarks(landmarks, color = '#00FF00') {
        // Draw connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8], // Index
            [0, 9], [9, 10], [10, 11], [11, 12], // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17] // Palm
        ];

        this.canvasCtx.strokeStyle = color;
        this.canvasCtx.lineWidth = 4; // Thicker lines for visibility
        
        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            
            this.canvasCtx.beginPath();
            this.canvasCtx.moveTo(startPoint.x * this.canvasElement.width, startPoint.y * this.canvasElement.height);
            this.canvasCtx.lineTo(endPoint.x * this.canvasElement.width, endPoint.y * this.canvasElement.height);
            this.canvasCtx.stroke();
        });

        // Draw landmarks
        this.canvasCtx.fillStyle = color === '#00FF00' ? '#FF0000' : '#FFFF00'; // Red dots for left hand, yellow for right
        landmarks.forEach((landmark) => {
            this.canvasCtx.beginPath();
            this.canvasCtx.arc(
                landmark.x * this.canvasElement.width,
                landmark.y * this.canvasElement.height,
                6, // Larger points for visibility
                0,
                2 * Math.PI
            );
            this.canvasCtx.fill();
        });
    }

    processHandGestures(landmarks, handLabel) {
        const currentTime = Date.now();
        
        // Simple gesture recognition
        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];

        // Calculate hand height (for volume control) - normalized 0-1
        const handHeight = Math.max(0, Math.min(1, 1 - wrist.y)); // Invert Y coordinate and clamp
        
        if (handLabel === 'Left') {
            this.gestureState.leftHand = {
                height: handHeight,
                landmarks: landmarks,
                lastUpdate: currentTime
            };
            
            // Volume control based on left hand height
            const volume = handHeight;
            this.gestureState.volumeLevel = volume;
            this.musicManager.setVolume(volume);
            
            console.log(`🔊 Left hand volume: ${(volume * 100).toFixed(0)}%`);
            
        } else if (handLabel === 'Right') {
            this.gestureState.rightHand = {
                height: handHeight,
                landmarks: landmarks,
                lastUpdate: currentTime
            };
            
            // Simple gesture recognition for playback control
            const thumbIndexDistance = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) + 
                Math.pow(thumbTip.y - indexTip.y, 2)
            );
            
            // Prevent rapid gesture triggering
            const gestureDelay = 1500; // 1.5 seconds between gestures
            
            // Play/pause gesture (thumb and index finger close together)
            const pinchThreshold = 0.06; // Slightly more sensitive
            if (thumbIndexDistance < pinchThreshold) {
                if (!this.gestureState.isPlayPauseGesture && 
                    currentTime - this.gestureState.lastGestureTime > gestureDelay) {
                    console.log('🎵 Game: Play/pause gesture detected (pinch)');
                    this.musicManager.togglePlayPause();
                    this.gestureState.isPlayPauseGesture = true;
                    this.gestureState.lastGestureTime = currentTime;
                }
            } else {
                this.gestureState.isPlayPauseGesture = false;
            }
            
            // Next track gesture (hand raised high)
            const nextThreshold = 0.75; // Slightly lower threshold
            if (handHeight > nextThreshold) {
                if (!this.gestureState.isNextGesture && 
                    currentTime - this.gestureState.lastGestureTime > gestureDelay) {
                    console.log('⏭️ Game: Next track gesture detected (hand high)');
                    this.musicManager.playNext();
                    this.gestureState.isNextGesture = true;
                    this.gestureState.lastGestureTime = currentTime;
                }
            } else {
                this.gestureState.isNextGesture = false;
            }
            
            // Previous track gesture (hand lowered)
            const prevThreshold = 0.25; // Slightly higher threshold
            if (handHeight < prevThreshold) {
                if (!this.gestureState.isPrevGesture && 
                    currentTime - this.gestureState.lastGestureTime > gestureDelay) {
                    console.log('⏮️ Game: Previous track gesture detected (hand low)');
                    this.musicManager.playPrevious();
                    this.gestureState.isPrevGesture = true;
                    this.gestureState.lastGestureTime = currentTime;
                }
            } else {
                this.gestureState.isPrevGesture = false;
            }
            
            console.log(`👋 Right hand - height: ${(handHeight * 100).toFixed(0)}%, pinch: ${thumbIndexDistance.toFixed(3)}`);
        }
    }

    setupEventListeners() {
        console.log('🎮 Game: Setting up event listeners...');
        
        // Window resize
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
        
        // Keyboard shortcuts for debugging
        document.addEventListener('keydown', (event) => {
            // Prevent default for our handled keys
            if (['KeyG', 'KeyV', 'KeyC', 'KeyH'].includes(event.code)) {
                event.preventDefault();
            }
            
            switch(event.code) {
                case 'KeyG':
                    console.log('🤖 Current gesture state:', {
                        handCount: this.gestureState.handCount,
                        leftHand: this.gestureState.leftHand ? {
                            height: this.gestureState.leftHand.height,
                            lastUpdate: new Date(this.gestureState.leftHand.lastUpdate).toLocaleTimeString()
                        } : null,
                        rightHand: this.gestureState.rightHand ? {
                            height: this.gestureState.rightHand.height,
                            lastUpdate: new Date(this.gestureState.rightHand.lastUpdate).toLocaleTimeString()
                        } : null,
                        volumeLevel: this.gestureState.volumeLevel,
                        activeGestures: {
                            playPause: this.gestureState.isPlayPauseGesture,
                            next: this.gestureState.isNextGesture,
                            prev: this.gestureState.isPrevGesture
                        }
                    });
                    break;
                case 'KeyH':
                    // Show help
                    console.log(`
🎮 GESTURE DJ CONTROLLER HELP:

📹 Camera Controls:
- V: Toggle video/canvas visibility
- C: Toggle canvas landmarks only

🤖 Hand Gestures:
LEFT HAND (Volume Control):
- Raise hand up: Increase volume
- Lower hand down: Decrease volume

RIGHT HAND (Playback Control):
- Pinch (thumb + index): Play/Pause
- Raise hand high (75%+): Next track
- Lower hand low (25%-): Previous track

⌨️ Keyboard Shortcuts:
- Space: Play/Pause
- Arrow Left/Right: Previous/Next track
- M: Toggle music sidebar
- G: Show gesture state (debug)
- H: Show this help

🎵 Tips:
- Use good lighting for better hand detection
- Keep hands visible in camera frame
- Wait 1.5 seconds between gestures
- Green lines = Left hand, Orange lines = Right hand
                    `);
                    break;
                case 'KeyV':
                    // Toggle video visibility for debugging
                    if (this.videoElement) {
                        const isHidden = this.videoElement.style.display === 'none';
                        this.videoElement.style.display = isHidden ? 'block' : 'none';
                        console.log(`📹 Video ${isHidden ? 'shown' : 'hidden'}`);
                    }
                    if (this.canvasElement) {
                        const isHidden = this.canvasElement.style.display === 'none';
                        this.canvasElement.style.display = isHidden ? 'block' : 'none';
                        console.log(`🎨 Canvas ${isHidden ? 'shown' : 'hidden'}`);
                    }
                    break;
                case 'KeyC':
                    // Toggle canvas visibility only
                    if (this.canvasElement) {
                        const isHidden = this.canvasElement.style.display === 'none';
                        this.canvasElement.style.display = isHidden ? 'block' : 'none';
                        console.log(`🎨 Canvas landmarks ${isHidden ? 'shown' : 'hidden'}`);
                    }
                    break;
            }
        });
        
        console.log('✅ Game: Event listeners setup complete');
        console.log('🔧 Debug keys: G (gesture state), V (toggle video/canvas), C (toggle canvas only), H (help)');
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Update canvas size
        if (this.canvasElement) {
            this.canvasElement.width = window.innerWidth;
            this.canvasElement.height = window.innerHeight;
        }
        
        if (this.waveformVisualizer) {
            this.waveformVisualizer.updatePosition(window.innerWidth, window.innerHeight);
        }
    }

    startAnimation() {
        console.log('🎮 Game: Starting animation loop...');
        
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            // Update waveform visualizer
            if (this.waveformVisualizer) {
                this.waveformVisualizer.update();
                
                // Update color based on gesture state
                if (this.gestureState.leftHand) {
                    const hue = this.gestureState.leftHand.height * 360;
                    this.waveformVisualizer.updateColor(`hsl(${hue}, 70%, 50%)`);
                }
            }
            
            // Render scene
            this.renderer.render(this.scene, this.camera);
        };
        
        animate();
        console.log('✅ Game: Animation loop started');
    }

    showError(message) {
        console.error('❌ Game Error:', message);
        
        // Create error display
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '50%';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translate(-50%, -50%)';
        errorDiv.style.background = 'rgba(255, 0, 0, 0.9)';
        errorDiv.style.color = 'white';
        errorDiv.style.padding = '20px';
        errorDiv.style.borderRadius = '10px';
        errorDiv.style.zIndex = '10000';
        errorDiv.style.maxWidth = '400px';
        errorDiv.style.textAlign = 'center';
        errorDiv.innerHTML = `
            <h3>Camera Error</h3>
            <p>${message}</p>
            <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 5px 15px;">Close</button>
        `;
        
        document.body.appendChild(errorDiv);
    }

    dispose() {
        console.log('🎮 Game: Disposing...');
        
        // Stop animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Stop camera
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
        }
        
        // Clean up MediaPipe
        if (this.hands) {
            this.hands.close();
        }
        
        // Clean up Three.js
        if (this.waveformVisualizer) {
            this.waveformVisualizer.dispose();
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        // Remove DOM elements
        if (this.videoElement) {
            this.videoElement.remove();
        }
        
        if (this.canvasElement) {
            this.canvasElement.remove();
        }
        
        console.log('✅ Game: Disposal complete');
    }
}