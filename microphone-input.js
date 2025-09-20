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
        this.detectionMode = 'mixed'; // 'bass', 'drums', 'guitar', 'mixed'
        this.frequencyRanges = {
            bass: { low: 0, high: 20 },      // 20-80 Hz
            kick: { low: 20, high: 40 },     // 80-160 Hz  
            snare: { low: 40, high: 80 },    // 160-320 Hz
            guitar: { low: 80, high: 160 },  // 320-640 Hz
            cymbals: { low: 160, high: 320 }, // 640-1280 Hz
            mixed: { low: 0, high: 160 }     // Full range for mixed mode
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
        
        // Debug logging (remove after testing)
        if (Math.random() < 0.1) { // Log 10% of the time to see more activity
            const thresholds = this.getDetectionThresholds();
            console.log(`Audio: Vol=${averageVolume.toFixed(3)}/${thresholds.volume.toFixed(3)}, FreqVol=${frequencyVolume.toFixed(3)}/${thresholds.frequency.toFixed(3)}, Onset=${onsetStrength.toFixed(3)}/${thresholds.onset.toFixed(3)}, Centroid=${spectralCentroid.toFixed(1)}`);
        }
        
        // Detect beat using enhanced method
        if (this.detectBeatEnhanced(averageVolume, frequencyVolume, onsetStrength)) {
            console.log(`Beat detected! Vol=${averageVolume.toFixed(3)}, FreqVol=${frequencyVolume.toFixed(3)}, Onset=${onsetStrength.toFixed(3)}`);
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
        
        for (let i = range.low; i < Math.min(range.high, this.bufferLength); i++) {
            sum += this.frequencyData[i];
            count++;
        }
        
        return count > 0 ? (sum / count) / 255 : 0; // Normalize to 0-1
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
        
        // Get detection thresholds based on mode
        const thresholds = this.getDetectionThresholds();
        
        // Much more sensitive detection - use multiple approaches
        let beatDetected = false;
        let detectionMethod = '';
        
        // Method 1: Simple volume threshold (most reliable)
        if (volume > thresholds.volume) {
            beatDetected = true;
            detectionMethod = 'volume';
        }
        
        // Method 2: Volume increase detection (catches sudden changes)
        const recentVolumes = this.beatHistory.slice(-5);
        if (recentVolumes.length >= 2) {
            const avgRecentVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
            const volumeIncrease = volume / (avgRecentVolume + 0.001);
            
            if (volumeIncrease > 1.5) { // 50% increase
                beatDetected = true;
                detectionMethod = 'volume-increase';
            }
        }
        
        // Method 3: Frequency-based detection (for specific instruments)
        if (frequencyVolume > thresholds.frequency) {
            beatDetected = true;
            detectionMethod = 'frequency';
        }
        
        // Method 4: Onset detection (for percussive sounds)
        if (onsetStrength > thresholds.onset) {
            beatDetected = true;
            detectionMethod = 'onset';
        }
        
        // Method 5: Combined approach (any two methods)
        let methodCount = 0;
        if (volume > thresholds.volume) methodCount++;
        if (frequencyVolume > thresholds.frequency) methodCount++;
        if (onsetStrength > thresholds.onset) methodCount++;
        if (recentVolumes.length >= 2) {
            const avgRecentVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
            const volumeIncrease = volume / (avgRecentVolume + 0.001);
            if (volumeIncrease > 1.3) methodCount++;
        }
        
        if (methodCount >= 2) {
            beatDetected = true;
            detectionMethod = 'combined';
        }
        
        if (beatDetected) {
            console.log(`Beat detected! Method: ${detectionMethod}, Vol=${volume.toFixed(3)}/${thresholds.volume.toFixed(3)}, Freq=${frequencyVolume.toFixed(3)}/${thresholds.frequency.toFixed(3)}, Onset=${onsetStrength.toFixed(3)}/${thresholds.onset.toFixed(3)}`);
        }
        
        return beatDetected;
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
            console.log(`Interval ${i}: ${interval}ms (min: ${this.minBeatInterval}, max: ${this.maxBeatInterval})`);
            if (interval >= this.minBeatInterval && interval <= this.maxBeatInterval) {
                intervals.push(interval);
            }
        }
        
        console.log(`Valid intervals: ${intervals.length}`);
        
        if (intervals.length === 0) {
            console.log('No valid intervals found');
            return;
        }
        
        // Calculate average interval
        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        
        // Convert to BPM
        const newTempo = Math.round(60000 / avgInterval);
        
        console.log(`Calculated tempo: ${newTempo} BPM (avg interval: ${avgInterval.toFixed(1)}ms)`);
        
        // Validate tempo range
        if (newTempo >= 30 && newTempo <= 300) {
            // Add to tempo history
            this.tempoHistory.push(newTempo);
            
            // Keep only recent tempos (last 5 calculations)
            if (this.tempoHistory.length > 5) {
                this.tempoHistory.shift();
            }
            
            // Calculate average tempo
            const avgTempo = this.tempoHistory.reduce((sum, tempo) => sum + tempo, 0) / this.tempoHistory.length;
            this.detectedTempo = Math.round(avgTempo);
            
            console.log(`Final tempo: ${this.detectedTempo} BPM (from ${this.tempoHistory.length} calculations)`);
            
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
        // Convert sensitivity (0-100) to threshold (0.1-0.9)
        // Higher sensitivity = lower threshold (more sensitive)
        this.beatThreshold = 0.9 - (sensitivity / 100) * 0.8;
        console.log(`Sensitivity set to ${sensitivity}% (threshold: ${this.beatThreshold.toFixed(2)})`);
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
        if (['bass', 'drums', 'guitar', 'mixed'].includes(mode)) {
            this.detectionMode = mode;
            console.log(`Detection mode set to: ${mode}`);
        } else {
            console.warn(`Invalid detection mode: ${mode}. Using 'mixed' instead.`);
            this.detectionMode = 'mixed';
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
