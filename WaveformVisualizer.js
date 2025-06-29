import * as THREE from 'three';

// Enhanced WaveformVisualizer with DJ-specific visual effects
export class WaveformVisualizer {
    constructor(scene, analyser, canvasWidth, canvasHeight) {
        this.scene = scene;
        this.analyser = analyser;
        this.mesh = null;
        this.bufferLength = this.analyser.size;
        this.dataArray = new Float32Array(this.bufferLength);
        this.smoothedDataArray = new Float32Array(this.bufferLength);
        
        // Enhanced visual properties for DJ interface
        this.smoothingFactor = 0.4;
        this.width = canvasWidth * 0.8;
        this.height = 450;
        this.yPosition = 0;
        this.thickness = 30.0;
        
        // DJ-specific visual state
        this.crossfaderPosition = 0.5;
        this.activeEffect = null;
        this.effectIntensity = 0;
        this.beatPulse = 0;
        
        // Color system
        this.currentColor = new THREE.Color('#7B4394');
        this.targetColor = new THREE.Color('#7B4394');
        this.effectColor = new THREE.Color('#7B4394');
        
        // Enhanced uniforms for DJ effects
        this.uniforms = {
            solidColor: { value: this.currentColor },
            crossfaderPos: { value: 0.5 },
            effectIntensity: { value: 0.0 },
            beatPulse: { value: 0.0 },
            time: { value: 0.0 }
        };
        
        // Additional visual elements
        this.crossfaderIndicator = null;
        this.effectIndicators = [];
        
        this._createVisualizer();
        this._createDJIndicators();
    }

    _createVisualizer() {
        // Enhanced shader material with DJ effects
        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                uniform float crossfaderPos;
                uniform float effectIntensity;
                uniform float beatPulse;
                uniform float time;
                
                void main() {
                    vUv = uv;
                    vPosition = position;
                    
                    // Add subtle wave distortion based on crossfader and effects
                    vec3 pos = position;
                    float wave = sin(pos.x * 0.01 + time * 2.0) * effectIntensity * 20.0;
                    float pulse = sin(time * 10.0) * beatPulse * 5.0;
                    pos.y += wave + pulse;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 solidColor;
                uniform float crossfaderPos;
                uniform float effectIntensity;
                uniform float beatPulse;
                uniform float time;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    vec3 color = solidColor;
                    
                    // Crossfader color mixing
                    vec3 deckAColor = vec3(1.0, 0.2, 0.2); // Red for deck A
                    vec3 deckBColor = vec3(0.2, 1.0, 0.2); // Green for deck B
                    vec3 crossfaderColor = mix(deckAColor, deckBColor, crossfaderPos);
                    
                    // Blend with crossfader color
                    color = mix(color, crossfaderColor, 0.3);
                    
                    // Effect intensity glow
                    float glow = effectIntensity * (0.5 + 0.5 * sin(time * 5.0));
                    color += vec3(glow * 0.3, glow * 0.1, glow * 0.5);
                    
                    // Beat pulse effect
                    float pulse = beatPulse * (0.8 + 0.2 * sin(time * 15.0));
                    color += vec3(pulse * 0.2);
                    
                    // Add some sparkle based on position
                    float sparkle = sin(vPosition.x * 0.1 + time * 3.0) * sin(vPosition.y * 0.1 + time * 2.0);
                    color += vec3(sparkle * effectIntensity * 0.1);
                    
                    gl_FragColor = vec4(color, 0.9);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.bufferLength * 2 * 3);
        const uvs = new Float32Array(this.bufferLength * 2 * 2);
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

        const indices = [];
        for (let i = 0; i < this.bufferLength - 1; i++) {
            const p1 = i * 2;
            const p2 = p1 + 1;
            const p3 = (i + 1) * 2;
            const p4 = p3 + 1;
            
            indices.push(p1, p2, p3);
            indices.push(p2, p4, p3);
        }
        
        geometry.setIndex(indices);
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);
        
        this.updatePosition(window.innerWidth, window.innerHeight);
    }

    _createDJIndicators() {
        // Create crossfader position indicator
        const crossfaderGeometry = new THREE.PlaneGeometry(20, 100);
        const crossfaderMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        
        this.crossfaderIndicator = new THREE.Mesh(crossfaderGeometry, crossfaderMaterial);
        this.crossfaderIndicator.position.set(0, -200, 1);
        this.scene.add(this.crossfaderIndicator);

        // Create effect indicators (small cubes for each effect)
        const effectNames = ['reverb', 'delay', 'distortion', 'filter'];
        const effectColors = [0x4444ff, 0xff44ff, 0xff4444, 0xffff44];
        
        effectNames.forEach((name, index) => {
            const geometry = new THREE.BoxGeometry(30, 30, 30);
            const material = new THREE.MeshBasicMaterial({
                color: effectColors[index],
                transparent: true,
                opacity: 0.3
            });
            
            const indicator = new THREE.Mesh(geometry, material);
            indicator.position.set(-150 + (index * 100), 200, 1);
            indicator.userData = { effectName: name, baseOpacity: 0.3 };
            
            this.effectIndicators.push(indicator);
            this.scene.add(indicator);
        });
    }

    update() {
        if (!this.analyser || !this.mesh) return;

        // Update time uniform for animations
        this.uniforms.time.value += 0.016; // ~60fps

        // Smoothly interpolate colors
        this.currentColor.lerp(this.targetColor, 0.05);
        
        // Get audio data
        const newArray = this.analyser.getValue();
        if (newArray instanceof Float32Array) {
            this.dataArray.set(newArray);
        }

        // Calculate beat detection for pulse effect
        let sum = 0;
        for (let i = 0; i < this.bufferLength; i++) {
            sum += Math.abs(this.dataArray[i]);
        }
        const average = sum / this.bufferLength;
        this.beatPulse = Math.max(0, Math.min(1, average * 2));
        this.uniforms.beatPulse.value = this.beatPulse;

        // Update waveform geometry
        const positions = this.mesh.geometry.attributes.position.array;
        const uvs = this.mesh.geometry.attributes.uv.array;
        
        const startX = -this.width / 2;
        const xStep = this.width / (this.bufferLength - 1);
        const halfThickness = this.thickness / 2;

        for (let i = 0; i < this.bufferLength; i++) {
            // Enhanced smoothing with effect-based modulation
            this.smoothedDataArray[i] = this.smoothingFactor * this.dataArray[i] + 
                                      (1 - this.smoothingFactor) * this.smoothedDataArray[i];
            
            // Add effect-based amplitude modulation
            let amplitude = this.smoothedDataArray[i] * this.height;
            if (this.activeEffect) {
                amplitude *= (1 + this.effectIntensity * 0.5);
            }
            
            const x = startX + i * xStep;
            const y = this.yPosition + amplitude;
            
            // Enhanced thickness based on crossfader position
            const dynamicThickness = halfThickness * (1 + Math.abs(this.crossfaderPosition - 0.5) * 0.5);
            
            const vertexIndex = i * 2 * 3;
            positions[vertexIndex] = x;
            positions[vertexIndex + 1] = y + dynamicThickness;
            positions[vertexIndex + 2] = 2;
            
            positions[vertexIndex + 3] = x;
            positions[vertexIndex + 4] = y - dynamicThickness;
            positions[vertexIndex + 5] = 2;
            
            const uvIndex = i * 2 * 2;
            uvs[uvIndex] = i / (this.bufferLength - 1);
            uvs[uvIndex + 1] = 1.0;
            uvs[uvIndex + 2] = i / (this.bufferLength - 1);
            uvs[uvIndex + 3] = 0.0;
        }

        this.mesh.geometry.attributes.position.needsUpdate = true;
        this.mesh.geometry.attributes.uv.needsUpdate = true;
        this.mesh.geometry.computeBoundingSphere();

        // Update DJ indicators
        this._updateDJIndicators();
    }

    _updateDJIndicators() {
        // Update crossfader indicator position
        if (this.crossfaderIndicator) {
            const xPos = (this.crossfaderPosition - 0.5) * this.width * 0.8;
            this.crossfaderIndicator.position.x = xPos;
            
            // Color based on position
            const hue = this.crossfaderPosition * 120; // 0 = red, 120 = green
            this.crossfaderIndicator.material.color.setHSL(hue / 360, 0.8, 0.6);
        }

        // Update effect indicators
        this.effectIndicators.forEach((indicator) => {
            const effectName = indicator.userData.effectName;
            const isActive = this.activeEffect === effectName;
            
            // Animate opacity and scale
            const targetOpacity = isActive ? 0.9 : 0.3;
            const targetScale = isActive ? 1.2 + this.effectIntensity * 0.5 : 1.0;
            
            indicator.material.opacity += (targetOpacity - indicator.material.opacity) * 0.1;
            indicator.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
            
            // Rotate active effect
            if (isActive) {
                indicator.rotation.y += 0.05;
                indicator.rotation.x += 0.02;
            }
        });
    }

    // DJ-specific update methods
    updateCrossfaderPosition(position) {
        this.crossfaderPosition = Math.max(0, Math.min(1, position));
        this.uniforms.crossfaderPos.value = this.crossfaderPosition;
    }

    updateActiveEffect(effectName, effectState) {
        this.activeEffect = effectState && effectState.active ? effectName : null;
        this.effectIntensity = effectState ? effectState.intensity : 0;
        this.uniforms.effectIntensity.value = this.effectIntensity;
        
        // Update target color based on active effect
        if (this.activeEffect) {
            const effectColors = {
                reverb: '#4444ff',
                delay: '#ff44ff', 
                distortion: '#ff4444',
                filter: '#ffff44'
            };
            this.targetColor.set(effectColors[this.activeEffect] || '#7B4394');
        } else {
            // Return to crossfader-based color
            const hue = this.crossfaderPosition * 120;
            this.targetColor.setHSL(hue / 360, 0.7, 0.5);
        }
    }

    updateColor(newColor) {
        this.targetColor.set(newColor);
    }

    updatePosition(canvasWidth, canvasHeight) {
        this.width = canvasWidth * 0.8;
        this.yPosition = -canvasHeight / 2 + 250;
        
        // Update crossfader indicator position
        if (this.crossfaderIndicator) {
            this.crossfaderIndicator.position.y = -canvasHeight / 2 + 100;
        }
        
        // Update effect indicators position
        this.effectIndicators.forEach((indicator, index) => {
            indicator.position.y = canvasHeight / 2 - 100;
            indicator.position.x = -150 + (index * 100);
        });
    }

    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
        }
        
        if (this.crossfaderIndicator) {
            this.scene.remove(this.crossfaderIndicator);
            if (this.crossfaderIndicator.geometry) this.crossfaderIndicator.geometry.dispose();
            if (this.crossfaderIndicator.material) this.crossfaderIndicator.material.dispose();
        }
        
        this.effectIndicators.forEach(indicator => {
            this.scene.remove(indicator);
            if (indicator.geometry) indicator.geometry.dispose();
            if (indicator.material) indicator.material.dispose();
        });
        
        this.effectIndicators = [];
    }
}