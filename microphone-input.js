// Microphone Input and Beat Detection for Metronome App
// Analyzes audio input to detect tempo and beats in real-time

class MicrophoneInput {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.isListening = false;
        this.isInitialized = false;
        
        // Beat detection properties
        this.beatHistory = [];
        this.lastBeatTime = 0;
        this.beatThreshold = 0.1; // Will be calculated from sensitivity slider
        this.sensitivity = 90; // User sensitivity setting (0-100)
        this.minBeatInterval = 100; // Minimum time between beats (ms) - allows up to 600 BPM
        this.maxBeatInterval = 2000; // Maximum time between beats (ms)
        
        // Tempo calculation
        this.detectedTempo = 120;
        this.tempoHistory = [];
        this.tempoConfidence = 0;
        
        // Audio analysis
        this.bufferLength = 0;
        this.smoothingFactor = 0.8; // How much to smooth the audio signal
        
        // Frequency analysis
        this.frequencyData = null;
        this.timeData = null;
        this.fftSize = 2048;
        
        // Instrument detection modes
        this.detectionMode = 'other'; // 'drums', 'guitar', 'other'
        this.frequencyRanges = {
            drums: { low: 20, high: 80 },    // 80-320 Hz - kick and snare range
            guitar: { low: 40, high: 120 },  // 160-480 Hz - mid-range frequencies
            other: { low: 0, high: 160 }     // Full range for other instruments
        };
        
        // Onset detection
        this.previousSpectrum = null;
        this.onsetThreshold = 0.05; // Much lower default threshold
        this.spectralCentroid = 0;
        this.zeroCrossingRate = 0;
        
        // Callbacks
        this.onBeatDetected = null;
        this.onTempoDetected = null;
        this.onVolumeUpdate = null;
        this.onError = null;
    }
    
    async init() {
        // Don't request microphone permission by default
        // This will be called when user actually wants to use microphone
        console.log('Microphone input ready (permission will be requested when needed)');
        return true;
    }
    
    async requestMicrophoneAccess() {
        if (this.isInitialized) {
            return true;
        }
        
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            // Create audio context
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass();
            
            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = this.smoothingFactor;
            
            // Create microphone source
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
            // Set up data arrays for analysis
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            this.frequencyData = new Uint8Array(this.bufferLength);
            this.timeData = new Uint8Array(this.analyser.fftSize);
            
            this.isInitialized = true;
            console.log('Microphone access granted and initialized successfully');
            
            return true;
        } catch (error) {
            console.error('Failed to get microphone access:', error);
            if (this.onError) {
                this.onError('Microphone access denied or not available');
            }
            return false;
        }
    }
    
    async startListening() {
        if (this.isListening) {
            console.warn('Already listening');
            return true;
        }
        
        // Request microphone access if not already initialized
        if (!this.isInitialized) {
            const success = await this.requestMicrophoneAccess();
            if (!success) {
                return false;
            }
        }
        
        this.isListening = true;
        this.analyzeAudio();
        console.log('Started listening for beats');
        return true;
    }
    
    stopListening() {
        console.log('stopListening() called - stack trace:', new Error().stack);
        this.isListening = false;
        console.log('Stopped listening for beats');
    }
    
    analyzeAudio() {
        if (!this.isListening) {
            console.log('Audio analysis stopped - isListening is false');
            return;
        }
        
        // Get frequency and time domain data
        this.analyser.getByteFrequencyData(this.frequencyData);
        this.analyser.getByteTimeDomainData(this.timeData);
        
        // Calculate various audio features
        const averageVolume = this.calculateAverageVolume();
        const frequencyVolume = this.calculateFrequencyVolume();
        const onsetStrength = this.calculateOnsetStrength();
        const spectralCentroid = this.calculateSpectralCentroid();
        
        // Update volume display
        if (this.onVolumeUpdate) {
            this.onVolumeUpdate(averageVolume);
        }
        
        // Debug logging (reduced frequency for cleaner output)
        if (Math.random() < 0.02) { // Log 2% of the time
            console.log(`Audio Analysis - Mode: ${this.detectionMode}, Vol: ${averageVolume.toFixed(3)}, FreqVol: ${frequencyVolume.toFixed(3)}, Onset: ${onsetStrength.toFixed(3)}, Centroid: ${spectralCentroid.toFixed(1)}`);
        }
        
        // Detect beat using enhanced method
        if (this.detectBeatEnhanced(averageVolume, frequencyVolume, onsetStrength)) {
            this.processBeat();
        }
        
        // Continue analysis
        requestAnimationFrame(() => this.analyzeAudio());
    }
    
    calculateAverageVolume() {
        // Safety check for frequency data
        if (!this.frequencyData || !this.bufferLength) {
            return 0;
        }
        
        let sum = 0;
        for (let i = 0; i < this.bufferLength; i++) {
            sum += this.frequencyData[i];
        }
        return sum / this.bufferLength / 255; // Normalize to 0-1
    }
    
    calculateFrequencyVolume() {
        // Safety check for frequency data
        if (!this.frequencyData || !this.bufferLength) {
            return 0;
        }
        
        const range = this.frequencyRanges[this.detectionMode] || this.frequencyRanges.mixed;
        
        // Safety check for range
        if (!range || typeof range.low === 'undefined' || typeof range.high === 'undefined') {
            console.warn(`Invalid frequency range for detection mode: ${this.detectionMode}`);
            return 0;
        }
        
        let sum = 0;
        let count = 0;
        let maxValue = 0;
        
        // Calculate weighted average with emphasis on peak values
        for (let i = range.low; i < Math.min(range.high, this.bufferLength); i++) {
            const value = this.frequencyData[i];
            sum += value;
            maxValue = Math.max(maxValue, value);
            count++;
        }
        
        if (count === 0) return 0;
        
        // Use both average and peak for better detection
        const average = sum / count / 255;
        const peak = maxValue / 255;
        
        // Weighted combination: 70% average, 30% peak
        return average * 0.7 + peak * 0.3;
    }
    
    calculateOnsetStrength() {
        if (!this.previousSpectrum) {
            this.previousSpectrum = new Array(this.bufferLength).fill(0);
            return 0;
        }
        
        let onsetSum = 0;
        for (let i = 0; i < this.bufferLength; i++) {
            const diff = this.frequencyData[i] - this.previousSpectrum[i];
            onsetSum += Math.max(0, diff); // Only positive changes
        }
        
        // Store current spectrum for next calculation
        this.previousSpectrum = Array.from(this.frequencyData);
        
        // Scale up the onset strength for better detection
        return (onsetSum / this.bufferLength / 255) * 50; // Scale up by 50x for much better detection
    }
    
    calculateSpectralCentroid() {
        let weightedSum = 0;
        let magnitudeSum = 0;
        
        for (let i = 0; i < this.bufferLength; i++) {
            const magnitude = this.frequencyData[i];
            weightedSum += i * magnitude;
            magnitudeSum += magnitude;
        }
        
        this.spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
        return this.spectralCentroid;
    }
    
    detectBeat(volume) {
        const now = Date.now();
        const timeSinceLastBeat = now - this.lastBeatTime;
        
        // Check if enough time has passed since last beat
        if (timeSinceLastBeat < this.minBeatInterval) {
            return false;
        }
        
        // Check if volume exceeds threshold
        if (volume < this.beatThreshold) {
            return false;
        }
        
        // For very low volumes, be more lenient with beat detection
        if (volume < 0.2) {
            // If volume is low but above threshold, allow beat detection
            return true;
        }
        
        // Check if this is a significant volume increase for higher volumes
        const recentVolumes = this.beatHistory.slice(-3); // Use fewer recent volumes for more sensitivity
        if (recentVolumes.length > 0) {
            const avgRecentVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
            // Reduced threshold for volume increase (10% instead of 20%)
            if (volume < avgRecentVolume * 1.1) {
                return false;
            }
        }
        
        return true;
    }
    
    detectBeatEnhanced(volume, frequencyVolume, onsetStrength) {
        const now = Date.now();
        const timeSinceLastBeat = now - this.lastBeatTime;
        
        // Check if enough time has passed since last beat
        if (timeSinceLastBeat < this.minBeatInterval) {
            return false;
        }
        
        // Calculate multiple energy measures for better detection
        let rmsEnergy = 0;
        let peakEnergy = 0;
        let spectralEnergy = 0;
        
        if (this.timeData && this.bufferLength) {
            // RMS Energy (overall loudness)
            for (let i = 0; i < this.bufferLength; i++) {
                const sample = (this.timeData[i] - 128) / 128; // Normalize to -1 to 1
                rmsEnergy += sample * sample;
                peakEnergy = Math.max(peakEnergy, Math.abs(sample));
            }
            rmsEnergy = Math.sqrt(rmsEnergy / this.bufferLength);
        }
        
        // Spectral energy (frequency content)
        if (this.frequencyData && this.bufferLength) {
            const range = this.frequencyRanges[this.detectionMode] || this.frequencyRanges.mixed;
            for (let i = range.low; i < Math.min(range.high, this.bufferLength); i++) {
                spectralEnergy += this.frequencyData[i];
            }
            spectralEnergy = spectralEnergy / (range.high - range.low) / 255;
        }
        
        // Calculate spectral centroid for additional context
        const spectralCentroid = this.calculateSpectralCentroid();
        
        // Combined energy measure (weighted combination)
        const energy = rmsEnergy * 0.6 + peakEnergy * 0.3 + spectralEnergy * 0.1;
        
        // Initialize energy history if needed
        this.energyHistory = this.energyHistory || [];
        this.energyHistory.push(energy);
        
        // Keep only last 30 energy readings (about 1 second at 30fps)
        if (this.energyHistory.length > 30) {
            this.energyHistory.shift();
        }
        
        // Need at least 5 readings for reliable threshold calculation
        if (this.energyHistory.length < 5) {
            return false;
        }
        
        // Calculate adaptive threshold based on instrument mode
        const threshold = this.calculateAdaptiveThreshold(energy, spectralCentroid);
        
        // Beat detection with confidence scoring
        const beatDetected = energy > threshold.energy;
        const confidence = this.calculateBeatConfidence(energy, threshold, spectralCentroid);
        
        // Additional rhythm pattern analysis for musical beats
        const rhythmConfidence = this.analyzeRhythmPattern(now);
        
        // Lower confidence threshold for musical content
        const minConfidence = this.detectionMode === 'other' ? 0.2 : 0.3;
        const finalConfidence = Math.max(confidence, rhythmConfidence);
        
        // Debug logging (every 20th frame to reduce noise)
        if (Math.random() < 0.05) {
            console.log(`Energy: ${energy.toFixed(4)}, Threshold: ${threshold.energy.toFixed(4)}, Confidence: ${finalConfidence.toFixed(2)}, Rhythm: ${rhythmConfidence.toFixed(2)}, Mode: ${this.detectionMode}`);
        }
        
        if (beatDetected && finalConfidence > minConfidence) {
            console.log(`Beat detected! Energy=${energy.toFixed(4)} > ${threshold.energy.toFixed(4)}, Confidence: ${finalConfidence.toFixed(2)}`);
            return true;
        }
        
        return false;
    }
    
    calculateAdaptiveThreshold(currentEnergy, spectralCentroid) {
        const history = this.energyHistory;
        const recentHistory = history.slice(-10); // Last 10 readings
        
        // Calculate statistics
        const mean = recentHistory.reduce((a, b) => a + b, 0) / recentHistory.length;
        const variance = recentHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentHistory.length;
        const stdDev = Math.sqrt(variance);
        
        // Base threshold multiplier based on instrument mode
        let baseMultiplier = 1.5;
        let spectralWeight = 0.1;
        
        switch (this.detectionMode) {
            case 'drums':
                baseMultiplier = 2.2; // Less sensitive for drums (they're loud)
                spectralWeight = 0.3; // More spectral influence for transients
                break;
            case 'guitar':
                baseMultiplier = 1.6; // Moderate sensitivity
                spectralWeight = 0.2; // Moderate spectral influence
                break;
            case 'other':
            default:
                baseMultiplier = 1.7; // Balanced sensitivity
                spectralWeight = 0.15; // Balanced spectral influence
                break;
        }
        
        // Apply sensitivity slider adjustment
        // Sensitivity 0-100 maps to 0.3-2.5 multiplier range (more range for musical content)
        // Higher sensitivity = lower threshold = more sensitive detection
        const sensitivityMultiplier = 0.3 + (this.sensitivity / 100) * 2.2;
        baseMultiplier = baseMultiplier / sensitivityMultiplier;
        
        // Additional adjustment for musical content
        if (this.detectionMode === 'other') {
            // More aggressive detection for other instruments
            baseMultiplier = baseMultiplier * 0.8; // 20% more sensitive
        }
        
        // Adaptive threshold that considers:
        // 1. Recent energy mean
        // 2. Energy variance (more variance = higher threshold)
        // 3. Spectral centroid (higher = more high-freq content = likely transients)
        // 4. User sensitivity setting
        const energyThreshold = mean * baseMultiplier + stdDev * 0.5;
        const spectralAdjustment = (spectralCentroid / this.bufferLength) * spectralWeight;
        const finalThreshold = energyThreshold + spectralAdjustment;
        
        return {
            energy: Math.max(finalThreshold, 0.01), // Minimum threshold
            mean: mean,
            stdDev: stdDev,
            spectralCentroid: spectralCentroid,
            sensitivityMultiplier: sensitivityMultiplier
        };
    }
    
    calculateBeatConfidence(energy, threshold, spectralCentroid) {
        // Confidence based on multiple factors
        let confidence = 0;
        
        // Energy confidence (0-0.5)
        const energyRatio = energy / threshold.energy;
        confidence += Math.min(0.5, (energyRatio - 1) * 0.5);
        
        // Spectral confidence (0-0.3)
        const spectralRatio = spectralCentroid / (this.bufferLength * 0.5);
        confidence += Math.min(0.3, spectralRatio * 0.3);
        
        // Consistency confidence (0-0.2)
        if (this.energyHistory.length >= 5) {
            const recentVariance = this.calculateRecentVariance();
            const consistencyScore = Math.max(0, 1 - recentVariance * 10);
            confidence += consistencyScore * 0.2;
        }
        
        return Math.min(1, confidence);
    }
    
    calculateRecentVariance() {
        if (this.energyHistory.length < 5) return 1;
        
        const recent = this.energyHistory.slice(-5);
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance = recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length;
        return Math.sqrt(variance);
    }
    
    analyzeRhythmPattern(currentTime) {
        // Initialize rhythm analysis if needed
        if (!this.rhythmHistory) {
            this.rhythmHistory = [];
            this.rhythmPatterns = [];
        }
        
        // Add current energy to rhythm history
        if (this.energyHistory.length > 0) {
            const currentEnergy = this.energyHistory[this.energyHistory.length - 1];
            this.rhythmHistory.push({
                time: currentTime,
                energy: currentEnergy
            });
        }
        
        // Keep only last 2 seconds of rhythm data
        const twoSecondsAgo = currentTime - 2000;
        this.rhythmHistory = this.rhythmHistory.filter(entry => entry.time > twoSecondsAgo);
        
        if (this.rhythmHistory.length < 10) {
            return 0; // Not enough data for rhythm analysis
        }
        
        // Look for rhythmic patterns in the energy data
        const recentEnergies = this.rhythmHistory.slice(-20).map(entry => entry.energy);
        const meanEnergy = recentEnergies.reduce((a, b) => a + b, 0) / recentEnergies.length;
        
        // Calculate energy variations (peaks and valleys)
        let peaks = 0;
        let valleys = 0;
        let totalVariation = 0;
        
        for (let i = 1; i < recentEnergies.length - 1; i++) {
            const prev = recentEnergies[i - 1];
            const curr = recentEnergies[i];
            const next = recentEnergies[i + 1];
            
            // Peak detection
            if (curr > prev && curr > next && curr > meanEnergy * 1.1) {
                peaks++;
            }
            
            // Valley detection
            if (curr < prev && curr < next && curr < meanEnergy * 0.9) {
                valleys++;
            }
            
            // Total variation
            totalVariation += Math.abs(curr - prev);
        }
        
        // Calculate rhythm confidence based on pattern regularity
        const expectedBeats = Math.max(1, Math.floor((currentTime - this.rhythmHistory[0].time) / 500)); // Expect beats every 500ms or faster
        const peakRatio = peaks / Math.max(1, expectedBeats);
        const variationRatio = totalVariation / recentEnergies.length / meanEnergy;
        
        // Rhythm confidence: higher when we have regular peaks and good variation
        let rhythmConfidence = 0;
        
        // Peak regularity (0-0.4)
        if (peakRatio > 0.5 && peakRatio < 2.0) {
            rhythmConfidence += 0.4;
        }
        
        // Energy variation (0-0.3)
        if (variationRatio > 0.1 && variationRatio < 1.0) {
            rhythmConfidence += 0.3;
        }
        
        // Beat timing consistency (0-0.3)
        if (this.beatHistory.length >= 3) {
            const recentBeats = this.beatHistory.slice(-5);
            const intervals = [];
            for (let i = 1; i < recentBeats.length; i++) {
                intervals.push(recentBeats[i] - recentBeats[i - 1]);
            }
            
            if (intervals.length > 0) {
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const intervalVariance = intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length;
                const consistency = Math.max(0, 1 - (Math.sqrt(intervalVariance) / avgInterval));
                rhythmConfidence += consistency * 0.3;
            }
        }
        
        return Math.min(1, rhythmConfidence);
    }
    
    getDetectionThresholds() {
        const baseThresholds = {
            volume: this.beatThreshold,
            frequency: this.beatThreshold * 0.7,
            onset: this.onsetThreshold,
            volumeIncrease: 1.1
        };
        
        // Adjust thresholds based on detection mode
        switch (this.detectionMode) {
            case 'bass':
                return {
                    ...baseThresholds,
                    volume: this.beatThreshold * 0.8,
                    frequency: this.beatThreshold * 0.5,
                    onset: this.onsetThreshold * 0.6,
                    volumeIncrease: 1.05
                };
            case 'drums':
                return {
                    ...baseThresholds,
                    volume: this.beatThreshold * 1.2,
                    frequency: this.beatThreshold * 0.9,
                    onset: this.onsetThreshold * 1.5,
                    volumeIncrease: 1.3
                };
            case 'guitar':
                return {
                    ...baseThresholds,
                    volume: this.beatThreshold * 0.15, // Super sensitive - 15% of sensitivity
                    frequency: this.beatThreshold * 0.2, // Very sensitive
                    onset: this.onsetThreshold * 0.05, // Extremely sensitive
                    volumeIncrease: 1.02 // Not used for guitar
                };
            default: // mixed
                return {
                    ...baseThresholds,
                    volume: this.beatThreshold * 0.2, // More sensitive
                    frequency: this.beatThreshold * 0.3, // More sensitive
                    onset: this.onsetThreshold * 0.1, // More sensitive
                    volumeIncrease: 1.1 // More sensitive
                };
        }
    }
    
    processBeat() {
        const now = Date.now();
        this.lastBeatTime = now;
        
        // Add to beat history
        this.beatHistory.push(now);
        
        // Keep only recent beats (last 10 seconds)
        const tenSecondsAgo = now - 10000;
        this.beatHistory = this.beatHistory.filter(time => time > tenSecondsAgo);
        
        console.log(`Beat detected! Total beats: ${this.beatHistory.length}`);
        
        // Calculate tempo if we have enough beats
        if (this.beatHistory.length >= 2) {
            console.log('Calculating tempo...');
            this.calculateTempo();
        } else {
            console.log(`Need ${2 - this.beatHistory.length} more beats for tempo calculation`);
        }
        
        // Notify callback
        if (this.onBeatDetected) {
            this.onBeatDetected(now);
        }
    }
    
    calculateTempo() {
        if (this.beatHistory.length < 2) return;
        
        console.log(`Calculating tempo from ${this.beatHistory.length} beats`);
        
        // Calculate intervals between beats
        const intervals = [];
        for (let i = 1; i < this.beatHistory.length; i++) {
            const interval = this.beatHistory[i] - this.beatHistory[i - 1];
            if (interval >= this.minBeatInterval && interval <= this.maxBeatInterval) {
                intervals.push(interval);
            }
        }
        
        console.log(`Valid intervals: ${intervals.length}`);
        
        if (intervals.length === 0) {
            console.log('No valid intervals found');
            return;
        }
        
        // Use median instead of average for more robust tempo calculation
        const sortedIntervals = intervals.sort((a, b) => a - b);
        const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
        
        // Convert to BPM
        let newTempo = Math.round(60000 / medianInterval);
        
        // Handle very fast tempos by looking for half-time patterns
        if (newTempo > 200) {
            // Check if this might be a half-time pattern (double the interval)
            const doubleInterval = medianInterval * 2;
            const halfTimeTempo = Math.round(60000 / doubleInterval);
            
            // If half-time tempo is more reasonable, use it
            if (halfTimeTempo >= 60 && halfTimeTempo <= 200) {
                newTempo = halfTimeTempo;
                console.log(`Detected half-time pattern: ${newTempo} BPM (was ${Math.round(60000 / medianInterval)} BPM)`);
            }
        }
        
        console.log(`Calculated tempo: ${newTempo} BPM (median interval: ${medianInterval.toFixed(1)}ms)`);
        
        // Validate tempo range
        if (newTempo >= 30 && newTempo <= 300) {
            // Add to tempo history
            this.tempoHistory.push(newTempo);
            
            // Keep only recent tempos (last 8 calculations for better stability)
            if (this.tempoHistory.length > 8) {
                this.tempoHistory.shift();
            }
            
            // Calculate weighted average tempo (more recent tempos have higher weight)
            let weightedSum = 0;
            let totalWeight = 0;
            this.tempoHistory.forEach((tempo, index) => {
                const weight = index + 1; // More recent = higher weight
                weightedSum += tempo * weight;
                totalWeight += weight;
            });
            
            this.detectedTempo = Math.round(weightedSum / totalWeight);
            
            console.log(`Final tempo: ${this.detectedTempo} BPM (weighted average from ${this.tempoHistory.length} calculations)`);
            
            // Calculate confidence based on consistency
            this.calculateConfidence();
            
            // Notify callback
            if (this.onTempoDetected) {
                this.onTempoDetected(this.detectedTempo, this.tempoConfidence);
            }
        } else {
            console.log(`Tempo ${newTempo} BPM is outside valid range (30-300)`);
        }
    }
    
    calculateConfidence() {
        if (this.tempoHistory.length < 2) {
            this.tempoConfidence = 0;
            return;
        }
        
        // Calculate standard deviation
        const mean = this.tempoHistory.reduce((sum, tempo) => sum + tempo, 0) / this.tempoHistory.length;
        const variance = this.tempoHistory.reduce((sum, tempo) => sum + Math.pow(tempo - mean, 2), 0) / this.tempoHistory.length;
        const standardDeviation = Math.sqrt(variance);
        
        // Convert to confidence (0-100)
        // Lower standard deviation = higher confidence
        this.tempoConfidence = Math.max(0, Math.min(100, 100 - (standardDeviation * 2)));
    }
    
    // Sensitivity control methods
    setSensitivity(sensitivity) {
        // Store sensitivity value (0-100) for use in adaptive threshold calculation
        this.sensitivity = Math.max(0, Math.min(100, sensitivity));
        console.log(`Sensitivity set to ${this.sensitivity}%`);
    }
    
    setMinBeatInterval(interval) {
        this.minBeatInterval = interval;
        console.log(`Minimum beat interval set to ${interval}ms`);
    }
    
    setMaxBeatInterval(interval) {
        this.maxBeatInterval = interval;
        console.log(`Maximum beat interval set to ${interval}ms`);
    }
    
    // Detection mode control
    setDetectionMode(mode) {
        if (['drums', 'guitar', 'other'].includes(mode)) {
            this.detectionMode = mode;
            console.log(`Detection mode set to: ${mode}`);
        } else {
            console.warn(`Invalid detection mode: ${mode}. Using 'other' instead.`);
            this.detectionMode = 'other';
        }
    }
    
    setOnsetThreshold(threshold) {
        this.onsetThreshold = Math.max(0, Math.min(1, threshold));
        console.log(`Onset threshold set to: ${this.onsetThreshold}`);
    }
    
    // Get current status
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isListening: this.isListening,
            detectedTempo: this.detectedTempo,
            tempoConfidence: this.tempoConfidence,
            beatThreshold: this.beatThreshold,
            recentBeats: this.beatHistory.length,
            tempoHistory: [...this.tempoHistory],
            detectionMode: this.detectionMode,
            onsetThreshold: this.onsetThreshold,
            spectralCentroid: this.spectralCentroid
        };
    }
    
    // Reset detection
    reset() {
        this.beatHistory = [];
        this.tempoHistory = [];
        this.detectedTempo = 120;
        this.tempoConfidence = 0;
        this.lastBeatTime = 0;
        console.log('Beat detection reset');
    }
    
    // Cleanup
    destroy() {
        this.stopListening();
        if (this.microphone && this.microphone.mediaStream) {
            this.microphone.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.isInitialized = false;
        console.log('Microphone input destroyed');
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MicrophoneInput;
} else {
    window.MicrophoneInput = MicrophoneInput;
}
