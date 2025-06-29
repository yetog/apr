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
        
        // Enhanced gesture state for DJ controls
        this.gestureState = {
            leftHand: null,
            rightHand: null,
            
            // Basic controls
            isPlayPauseGesture: false,
            isNextGesture: false,
            isPrevGesture: false,
            volumeLevel: 0.7,
            
            // DJ-specific controls
            crossfaderPosition: 0.5,
            isCrossfaderActive: false,
            
            // Effect controls
            activeEffect: null, // 'reverb', 'delay', 'distortion', 'filter'
            effectIntensity: 0.5,
            isEffectToggleGesture: false,
            
            // Gesture recognition
            lastGestureTime: 0,
            handCount: 0,
            gestureHistory: [] // For more complex gesture recognition
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
            this.setupMusicManagerCallbacks();
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

        // Enhanced waveform visualizer
        if (this.musicManager.getAnalyser()) {
            this.waveformVisualizer = new WaveformVisualizer(
                this.scene,
                this.musicManager.getAnalyser(),
                window.innerWidth,
                window.innerHeight
            );
            console.log('✅ Game: Enhanced waveform visualizer created');
        } else {
            console.warn('⚠️ Game: No analyser available for waveform visualizer');
        }

        console.log('✅ Game: Three.js setup complete');
    }

    async setupCamera() {
        console.log('📹 Game: Setting up camera...');
        
        try {
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
            this.videoElement.style.opacity = '0.4';
            this.videoElement.style.objectFit = 'cover';
            this.videoElement.autoplay = true;
            this.videoElement.playsInline = true;
            this.videoElement.muted = true;
            
            document.body.appendChild(this.videoElement);

            // Create canvas for MediaPipe (full screen)
            this.canvasElement = document.createElement('canvas');
            this.canvasElement.style.position = 'fixed';
            this.canvasElement.style.top = '0';
            this.canvasElement.style.left = '0';
            this.canvasElement.style.width = '100vw';
            this.canvasElement.style.height = '100vh';
            this.canvasElement.style.zIndex = '999';
            this.canvasElement.style.pointerEvents = 'none';
            this.canvasElement.width = window.innerWidth;
            this.canvasElement.height = window.innerHeight;
            this.canvasCtx = this.canvasElement.getContext('2d');
            
            document.body.appendChild(this.canvasElement);

            console.log('📹 Game: Requesting camera access...');
            
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
            
            this.videoElement.srcObject = this.cameraStream;
            
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
                
                setTimeout(() => {
                    reject(new Error('Video loading timeout'));
                }, 10000);
            });

            await this.videoElement.play();
            this.isCameraActive = true;
            console.log('✅ Game: Camera setup complete');
            
        } catch (error) {
            console.error('❌ Game: Camera setup failed:', error);
            
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
            if (typeof Hands === 'undefined') {
                throw new Error('Hands constructor not found. MediaPipe script may not have loaded.');
            }

            console.log('✅ Game: MediaPipe Hands class found globally');

            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
                }
            });

            this.hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            });

            this.hands.onResults((results) => {
                this.onHandsResults(results);
            });

            console.log('✅ Game: MediaPipe Hands configured for dual-hand DJ control');

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
            
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const handedness = results.multiHandedness[i];
                
                // Enhanced hand colors for DJ interface
                const handColor = handedness.label === 'Left' ? '#00FF88' : '#FF6600';
                this.drawHandLandmarks(landmarks, handColor);
                
                // Process enhanced DJ gestures
                this.processEnhancedHandGestures(landmarks, handedness.label);
            }
        }
        
        this.canvasCtx.restore();
    }

    drawHandLandmarks(landmarks, color = '#00FF00') {
        // Enhanced drawing with thicker lines for better visibility
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8], // Index
            [0, 9], [9, 10], [10, 11], [11, 12], // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17] // Palm
        ];

        this.canvasCtx.strokeStyle = color;
        this.canvasCtx.lineWidth = 5; // Thicker for DJ interface
        this.canvasCtx.shadowColor = color;
        this.canvasCtx.shadowBlur = 10;
        
        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            
            this.canvasCtx.beginPath();
            this.canvasCtx.moveTo(startPoint.x * this.canvasElement.width, startPoint.y * this.canvasElement.height);
            this.canvasCtx.lineTo(endPoint.x * this.canvasElement.width, endPoint.y * this.canvasElement.height);
            this.canvasCtx.stroke();
        });

        // Enhanced landmark dots
        this.canvasCtx.fillStyle = color === '#00FF88' ? '#FF0044' : '#FFFF00';
        this.canvasCtx.shadowBlur = 5;
        landmarks.forEach((landmark) => {
            this.canvasCtx.beginPath();
            this.canvasCtx.arc(
                landmark.x * this.canvasElement.width,
                landmark.y * this.canvasElement.height,
                8, // Larger points
                0,
                2 * Math.PI
            );
            this.canvasCtx.fill();
        });
        
        this.canvasCtx.shadowBlur = 0; // Reset shadow
    }

    processEnhancedHandGestures(landmarks, handLabel) {
        const currentTime = Date.now();
        
        // Key landmarks for gesture recognition
        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        const indexMcp = landmarks[5]; // Index finger base
        const middleMcp = landmarks[9]; // Middle finger base

        // Normalize hand position (0-1)
        const handHeight = Math.max(0, Math.min(1, 1 - wrist.y));
        const handHorizontal = Math.max(0, Math.min(1, wrist.x));
        
        if (handLabel === 'Left') {
            this.gestureState.leftHand = {
                height: handHeight,
                horizontal: handHorizontal,
                landmarks: landmarks,
                lastUpdate: currentTime
            };
            
            // Volume control
            const volume = handHeight;
            this.gestureState.volumeLevel = volume;
            this.musicManager.setVolume(volume);
            
            // Effect intensity control when effect is active
            if (this.gestureState.activeEffect) {
                this.musicManager.setEffectIntensity(this.gestureState.activeEffect, handHeight);
                this.gestureState.effectIntensity = handHeight;
                console.log(`🎛️ ${this.gestureState.activeEffect} intensity: ${(handHeight * 100).toFixed(0)}%`);
            }
            
            console.log(`🔊 Left hand - volume: ${(volume * 100).toFixed(0)}%, height: ${(handHeight * 100).toFixed(0)}%`);
            
        } else if (handLabel === 'Right') {
            this.gestureState.rightHand = {
                height: handHeight,
                horizontal: handHorizontal,
                landmarks: landmarks,
                lastUpdate: currentTime
            };
            
            // Crossfader control (horizontal position)
            this.gestureState.crossfaderPosition = handHorizontal;
            this.musicManager.setCrossfaderPosition(handHorizontal);
            
            // Gesture recognition
            const thumbIndexDistance = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) + 
                Math.pow(thumbTip.y - indexTip.y, 2)
            );
            
            const thumbMiddleDistance = Math.sqrt(
                Math.pow(thumbTip.x - middleTip.x, 2) + 
                Math.pow(thumbTip.y - middleTip.y, 2)
            );
            
            // Check if fingers are extended (for effect selection)
            const indexExtended = indexTip.y < indexMcp.y - 0.02;
            const middleExtended = middleTip.y < middleMcp.y - 0.02;
            const ringExtended = ringTip.y < landmarks[13].y - 0.02;
            const pinkyExtended = pinkyTip.y < landmarks[17].y - 0.02;
            
            const gestureDelay = 1500;
            
            // Play/pause gesture (pinch - thumb and index)
            const pinchThreshold = 0.06;
            if (thumbIndexDistance < pinchThreshold) {
                if (!this.gestureState.isPlayPauseGesture && 
                    currentTime - this.gestureState.lastGestureTime > gestureDelay) {
                    console.log('🎵 DJ: Play/pause gesture detected');
                    this.musicManager.togglePlayPause();
                    this.gestureState.isPlayPauseGesture = true;
                    this.gestureState.lastGestureTime = currentTime;
                }
            } else {
                this.gestureState.isPlayPauseGesture = false;
            }
            
            // Effect toggle gestures (thumb + middle finger)
            if (thumbMiddleDistance < pinchThreshold) {
                if (!this.gestureState.isEffectToggleGesture && 
                    currentTime - this.gestureState.lastGestureTime > gestureDelay) {
                    
                    // Determine which effect to toggle based on extended fingers
                    let effectToToggle = null;
                    
                    if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
                        effectToToggle = 'reverb';
                    } else if (!indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
                        effectToToggle = 'delay';
                    } else if (!indexExtended && !middleExtended && ringExtended && !pinkyExtended) {
                        effectToToggle = 'distortion';
                    } else if (!indexExtended && !middleExtended && !ringExtended && pinkyExtended) {
                        effectToToggle = 'filter';
                    } else {
                        // Default to reverb if no specific finger pattern
                        effectToToggle = 'reverb';
                    }
                    
                    const wasActive = this.musicManager.toggleEffect(effectToToggle);
                    this.gestureState.activeEffect = wasActive ? effectToToggle : null;
                    
                    console.log(`🎛️ DJ: ${effectToToggle} ${wasActive ? 'ON' : 'OFF'}`);
                    this.gestureState.isEffectToggleGesture = true;
                    this.gestureState.lastGestureTime = currentTime;
                }
            } else {
                this.gestureState.isEffectToggleGesture = false;
            }
            
            // Track navigation (high/low gestures)
            const nextThreshold = 0.8;
            const prevThreshold = 0.2;
            
            if (handHeight > nextThreshold && !this.gestureState.isEffectToggleGesture && !this.gestureState.isPlayPauseGesture) {
                if (!this.gestureState.isNextGesture && 
                    currentTime - this.gestureState.lastGestureTime > gestureDelay) {
                    console.log('⏭️ DJ: Next track gesture detected');
                    this.musicManager.playNext();
                    this.gestureState.isNextGesture = true;
                    this.gestureState.lastGestureTime = currentTime;
                }
            } else {
                this.gestureState.isNextGesture = false;
            }
            
            if (handHeight < prevThreshold && !this.gestureState.isEffectToggleGesture && !this.gestureState.isPlayPauseGesture) {
                if (!this.gestureState.isPrevGesture && 
                    currentTime - this.gestureState.lastGestureTime > gestureDelay) {
                    console.log('⏮️ DJ: Previous track gesture detected');
                    this.musicManager.playPrevious();
                    this.gestureState.isPrevGesture = true;
                    this.gestureState.lastGestureTime = currentTime;
                }
            } else {
                this.gestureState.isPrevGesture = false;
            }
            
            console.log(`🎛️ Right hand - crossfader: ${(handHorizontal * 100).toFixed(0)}%, height: ${(handHeight * 100).toFixed(0)}%, active effect: ${this.gestureState.activeEffect || 'none'}`);
        }
    }

    setupMusicManagerCallbacks() {
        // Enhanced callbacks for DJ features
        this.musicManager.setOnCrossfaderChange((position) => {
            // Update visual feedback based on crossfader position
            if (this.waveformVisualizer) {
                const hue = position * 120; // 0 = red, 120 = green
                this.waveformVisualizer.updateCrossfaderPosition(position);
                this.waveformVisualizer.updateColor(`hsl(${hue}, 70%, 50%)`);
            }
        });

        this.musicManager.setOnEffectChange((effectName, effectState) => {
            // Update visual feedback based on active effects
            if (this.waveformVisualizer) {
                this.waveformVisualizer.updateActiveEffect(effectName, effectState);
            }
        });
    }

    setupEventListeners() {
        console.log('🎮 Game: Setting up event listeners...');
        
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
        
        document.addEventListener('keydown', (event) => {
            if (['KeyG', 'KeyV', 'KeyC', 'KeyH', 'KeyE', 'KeyX'].includes(event.code)) {
                event.preventDefault();
            }
            
            switch(event.code) {
                case 'KeyG':
                    console.log('🎛️ Current DJ gesture state:', {
                        handCount: this.gestureState.handCount,
                        crossfaderPosition: this.gestureState.crossfaderPosition,
                        activeEffect: this.gestureState.activeEffect,
                        effectIntensity: this.gestureState.effectIntensity,
                        volumeLevel: this.gestureState.volumeLevel,
                        leftHand: this.gestureState.leftHand ? {
                            height: this.gestureState.leftHand.height,
                            horizontal: this.gestureState.leftHand.horizontal
                        } : null,
                        rightHand: this.gestureState.rightHand ? {
                            height: this.gestureState.rightHand.height,
                            horizontal: this.gestureState.rightHand.horizontal
                        } : null
                    });
                    break;
                case 'KeyH':
                    console.log(`
🎛️ ENHANCED DJ CONTROLLER HELP:

📹 Camera Controls:
- V: Toggle video/canvas visibility
- C: Toggle canvas landmarks only

🎛️ Enhanced Hand Gestures:

LEFT HAND (Volume & Effect Intensity):
- Raise/lower hand: Volume control
- When effect is active: Controls effect intensity

RIGHT HAND (DJ Controls):
- Horizontal position: Crossfader (left=deck A, right=deck B)
- Pinch (thumb + index): Play/Pause
- Thumb + middle + finger patterns: Toggle effects
  • Index finger up: Reverb
  • Middle finger up: Delay  
  • Ring finger up: Distortion
  • Pinky up: Auto Filter
- Raise hand high (80%+): Next track
- Lower hand (20%-): Previous track

🎵 DJ Features:
- Crossfader blends between deck A and B
- Multiple audio effects with gesture control
- Real-time visual feedback
- Enhanced waveform visualization

⌨️ Keyboard Shortcuts:
- Space: Play/Pause
- Arrow Left/Right: Previous/Next track
- M: Toggle music sidebar
- G: Show gesture state (debug)
- E: Toggle random effect (debug)
- X: Reset crossfader to center (debug)
- H: Show this help

🎵 DJ Tips:
- Use both hands simultaneously for full control
- Left hand controls volume and effect intensity
- Right hand horizontal position is your crossfader
- Combine gestures for complex DJ techniques
- Green lines = Left hand, Orange lines = Right hand
                    `);
                    break;
                case 'KeyV':
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
                    if (this.canvasElement) {
                        const isHidden = this.canvasElement.style.display === 'none';
                        this.canvasElement.style.display = isHidden ? 'block' : 'none';
                        console.log(`🎨 Canvas landmarks ${isHidden ? 'shown' : 'hidden'}`);
                    }
                    break;
                case 'KeyE':
                    // Debug: Toggle random effect
                    const effects = ['reverb', 'delay', 'distortion', 'filter'];
                    const randomEffect = effects[Math.floor(Math.random() * effects.length)];
                    this.musicManager.toggleEffect(randomEffect);
                    console.log(`🎛️ Debug: Toggled ${randomEffect}`);
                    break;
                case 'KeyX':
                    // Debug: Reset crossfader to center
                    this.musicManager.setCrossfaderPosition(0.5);
                    console.log('🎛️ Debug: Crossfader reset to center');
                    break;
            }
        });
        
        console.log('✅ Game: Enhanced DJ event listeners setup complete');
        console.log('🔧 Debug keys: G (gesture state), V (toggle video/canvas), C (toggle canvas), E (random effect), X (reset crossfader), H (help)');
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        if (this.canvasElement) {
            this.canvasElement.width = window.innerWidth;
            this.canvasElement.height = window.innerHeight;
        }
        
        if (this.waveformVisualizer) {
            this.waveformVisualizer.updatePosition(window.innerWidth, window.innerHeight);
        }
    }

    startAnimation() {
        console.log('🎮 Game: Starting enhanced DJ animation loop...');
        
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            // Update enhanced waveform visualizer
            if (this.waveformVisualizer) {
                this.waveformVisualizer.update();
                
                // Dynamic color based on crossfader position and active effects
                if (this.gestureState.rightHand) {
                    const crossfaderHue = this.gestureState.crossfaderPosition * 120; // 0-120 degrees
                    let baseColor = `hsl(${crossfaderHue}, 70%, 50%)`;
                    
                    // Modify color based on active effect
                    if (this.gestureState.activeEffect) {
                        const effectColors = {
                            reverb: 'hsl(240, 80%, 60%)', // Blue
                            delay: 'hsl(300, 80%, 60%)', // Purple
                            distortion: 'hsl(0, 80%, 60%)', // Red
                            filter: 'hsl(60, 80%, 60%)' // Yellow
                        };
                        baseColor = effectColors[this.gestureState.activeEffect] || baseColor;
                    }
                    
                    this.waveformVisualizer.updateColor(baseColor);
                }
                
                // Update crossfader position in visualizer
                this.waveformVisualizer.updateCrossfaderPosition(this.gestureState.crossfaderPosition);
                
                // Update effect state in visualizer
                if (this.gestureState.activeEffect) {
                    const effectState = this.musicManager.getEffect(this.gestureState.activeEffect);
                    this.waveformVisualizer.updateActiveEffect(this.gestureState.activeEffect, effectState);
                }
            }
            
            this.renderer.render(this.scene, this.camera);
        };
        
        animate();
        console.log('✅ Game: Enhanced DJ animation loop started');
    }

    showError(message) {
        console.error('❌ Game Error:', message);
        
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
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.hands) {
            this.hands.close();
        }
        
        if (this.waveformVisualizer) {
            this.waveformVisualizer.dispose();
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.videoElement) {
            this.videoElement.remove();
        }
        
        if (this.canvasElement) {
            this.canvasElement.remove();
        }
        
        console.log('✅ Game: Disposal complete');
    }
}