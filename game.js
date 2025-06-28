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
        
        // Gesture state
        this.gestureState = {
            leftHand: null,
            rightHand: null,
            isPlayPauseGesture: false,
            isNextGesture: false,
            isPrevGesture: false,
            volumeLevel: 0.7
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
        this.scene.background = new THREE.Color(0xffffff);

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

            // Create video element
            this.videoElement = document.createElement('video');
            this.videoElement.style.position = 'absolute';
            this.videoElement.style.top = '0';
            this.videoElement.style.left = '0';
            this.videoElement.style.width = '320px';
            this.videoElement.style.height = '240px';
            this.videoElement.style.zIndex = '1000';
            this.videoElement.style.opacity = '0.3'; // Make it semi-transparent for debugging
            this.videoElement.autoplay = true;
            this.videoElement.playsInline = true;
            
            // Add to DOM for debugging (you can remove this later)
            document.body.appendChild(this.videoElement);

            // Create canvas for MediaPipe
            this.canvasElement = document.createElement('canvas');
            this.canvasElement.style.position = 'absolute';
            this.canvasElement.style.top = '0';
            this.canvasElement.style.left = '320px';
            this.canvasElement.style.width = '320px';
            this.canvasElement.style.height = '240px';
            this.canvasElement.style.zIndex = '1001';
            this.canvasElement.width = 320;
            this.canvasElement.height = 240;
            this.canvasCtx = this.canvasElement.getContext('2d');
            
            // Add canvas to DOM for debugging
            document.body.appendChild(this.canvasElement);

            console.log('📹 Game: Requesting camera access...');
            
            // Request camera access
            const constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
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
            // Import MediaPipe Hands with updated CDN URLs
            const { Hands } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.9.0/hands.js');
            const { Camera } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675029046/camera_utils.js');
            
            console.log('✅ Game: MediaPipe modules loaded');

            // Initialize Hands
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.9.0/${file}`;
                }
            });

            // Configure Hands
            this.hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            // Set up results callback
            this.hands.onResults((results) => {
                this.onHandsResults(results);
            });

            console.log('✅ Game: MediaPipe Hands configured');

            // Initialize camera for MediaPipe
            const camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    if (this.hands && this.videoElement.readyState >= 2) {
                        await this.hands.send({ image: this.videoElement });
                    }
                },
                width: 640,
                height: 480
            });

            await camera.start();
            console.log('✅ Game: MediaPipe camera started');
            
        } catch (error) {
            console.error('❌ Game: MediaPipe setup failed:', error);
            throw new Error(`MediaPipe initialization failed: ${error.message}`);
        }
    }

    onHandsResults(results) {
        // Clear canvas
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        // Draw the video frame
        this.canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);

        if (results.multiHandLandmarks && results.multiHandedness) {
            console.log(`🤖 Game: Detected ${results.multiHandLandmarks.length} hand(s)`);
            
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const handedness = results.multiHandedness[i];
                
                // Draw hand landmarks
                this.drawHandLandmarks(landmarks);
                
                // Process gestures
                this.processHandGestures(landmarks, handedness.label);
            }
        }
        
        this.canvasCtx.restore();
    }

    drawHandLandmarks(landmarks) {
        // Draw connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8], // Index
            [0, 9], [9, 10], [10, 11], [11, 12], // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17] // Palm
        ];

        this.canvasCtx.strokeStyle = '#00FF00';
        this.canvasCtx.lineWidth = 2;
        
        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            
            this.canvasCtx.beginPath();
            this.canvasCtx.moveTo(startPoint.x * this.canvasElement.width, startPoint.y * this.canvasElement.height);
            this.canvasCtx.lineTo(endPoint.x * this.canvasElement.width, endPoint.y * this.canvasElement.height);
            this.canvasCtx.stroke();
        });

        // Draw landmarks
        this.canvasCtx.fillStyle = '#FF0000';
        landmarks.forEach((landmark) => {
            this.canvasCtx.beginPath();
            this.canvasCtx.arc(
                landmark.x * this.canvasElement.width,
                landmark.y * this.canvasElement.height,
                3,
                0,
                2 * Math.PI
            );
            this.canvasCtx.fill();
        });
    }

    processHandGestures(landmarks, handLabel) {
        // Simple gesture recognition
        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];

        // Calculate hand height (for volume control)
        const handHeight = 1 - wrist.y; // Invert Y coordinate
        
        if (handLabel === 'Left') {
            this.gestureState.leftHand = {
                height: handHeight,
                landmarks: landmarks
            };
            
            // Volume control based on left hand height
            const volume = Math.max(0, Math.min(1, handHeight));
            this.gestureState.volumeLevel = volume;
            this.musicManager.setVolume(volume);
            
        } else if (handLabel === 'Right') {
            this.gestureState.rightHand = {
                height: handHeight,
                landmarks: landmarks
            };
            
            // Simple gesture recognition for playback control
            const thumbIndexDistance = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) + 
                Math.pow(thumbTip.y - indexTip.y, 2)
            );
            
            // Play/pause gesture (thumb and index finger close together)
            if (thumbIndexDistance < 0.05) {
                if (!this.gestureState.isPlayPauseGesture) {
                    console.log('🎵 Game: Play/pause gesture detected');
                    this.musicManager.togglePlayPause();
                    this.gestureState.isPlayPauseGesture = true;
                }
            } else {
                this.gestureState.isPlayPauseGesture = false;
            }
            
            // Next track gesture (hand raised high)
            if (handHeight > 0.8) {
                if (!this.gestureState.isNextGesture) {
                    console.log('⏭️ Game: Next track gesture detected');
                    this.musicManager.playNext();
                    this.gestureState.isNextGesture = true;
                }
            } else {
                this.gestureState.isNextGesture = false;
            }
            
            // Previous track gesture (hand lowered)
            if (handHeight < 0.2) {
                if (!this.gestureState.isPrevGesture) {
                    console.log('⏮️ Game: Previous track gesture detected');
                    this.musicManager.playPrevious();
                    this.gestureState.isPrevGesture = true;
                }
            } else {
                this.gestureState.isPrevGesture = false;
            }
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
            switch(event.code) {
                case 'KeyC':
                    console.log('📹 Camera status:', {
                        isCameraActive: this.isCameraActive,
                        videoElement: !!this.videoElement,
                        stream: !!this.cameraStream,
                        hands: !!this.hands
                    });
                    break;
                case 'KeyG':
                    console.log('🤖 Gesture state:', this.gestureState);
                    break;
                case 'KeyV':
                    // Toggle video visibility for debugging
                    if (this.videoElement) {
                        this.videoElement.style.display = 
                            this.videoElement.style.display === 'none' ? 'block' : 'none';
                    }
                    if (this.canvasElement) {
                        this.canvasElement.style.display = 
                            this.canvasElement.style.display === 'none' ? 'block' : 'none';
                    }
                    break;
            }
        });
        
        console.log('✅ Game: Event listeners setup complete');
        console.log('🔧 Debug keys: C (camera status), G (gesture state), V (toggle video visibility)');
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
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