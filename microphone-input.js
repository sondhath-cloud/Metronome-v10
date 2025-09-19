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
        this.minBeatInterval = 200; // Minimum time between beats (ms)
        this.maxBeatInterval = 2000; // Maximum time between beats (ms)
        
        // Tempo calculation
        this.detectedTempo = 120;
        this.tempoHistory = [];
        this.tempoConfidence = 0;
        
        // Audio analysis
        this.bufferLength = 0;
        this.smoothingFactor = 0.8; // How much to smooth the audio signal
        
        // Callbacks
        this.onBeatDetected = null;
        this.onTempoDetected = null;
        this.onVolumeUpdate = null;
        this.onError = null;
    }
    
    async init() {
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
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = this.smoothingFactor;
            
            // Create microphone source
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
            // Set up data array for analysis
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            
            this.isInitialized = true;
            console.log('Microphone input initialized successfully');
            
            return true;
        } catch (error) {
            console.error('Failed to initialize microphone input:', error);
            if (this.onError) {
                this.onError('Microphone access denied or not available');
            }
            return false;
        }
    }
    
    startListening() {
        if (!this.isInitialized) {
            console.warn('Microphone not initialized');
            return false;
        }
        
        if (this.isListening) {
            console.warn('Already listening');
            return true;
        }
        
        this.isListening = true;
        this.analyzeAudio();
        console.log('Started listening for beats');
        return true;
    }
    
    stopListening() {
        this.isListening = false;
        console.log('Stopped listening for beats');
    }
    
    analyzeAudio() {
        if (!this.isListening) return;
        
        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Calculate average volume
        const averageVolume = this.calculateAverageVolume();
        
        // Update volume display
        if (this.onVolumeUpdate) {
            this.onVolumeUpdate(averageVolume);
        }
        
        // Debug logging (remove after testing)
        if (Math.random() < 0.01) { // Log 1% of the time to avoid spam
            console.log('Audio volume:', averageVolume.toFixed(3), 'Threshold:', this.beatThreshold.toFixed(3));
        }
        
        // Detect beat
        if (this.detectBeat(averageVolume)) {
            console.log('Beat detected! Volume:', averageVolume.toFixed(3));
            this.processBeat();
        }
        
        // Continue analysis
        requestAnimationFrame(() => this.analyzeAudio());
    }
    
    calculateAverageVolume() {
        let sum = 0;
        for (let i = 0; i < this.bufferLength; i++) {
            sum += this.dataArray[i];
        }
        return sum / this.bufferLength / 255; // Normalize to 0-1
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
    
    processBeat() {
        const now = Date.now();
        this.lastBeatTime = now;
        
        // Add to beat history
        this.beatHistory.push(now);
        
        // Keep only recent beats (last 10 seconds)
        const tenSecondsAgo = now - 10000;
        this.beatHistory = this.beatHistory.filter(time => time > tenSecondsAgo);
        
        // Calculate tempo if we have enough beats
        if (this.beatHistory.length >= 2) {
            this.calculateTempo();
        }
        
        // Notify callback
        if (this.onBeatDetected) {
            this.onBeatDetected(now);
        }
    }
    
    calculateTempo() {
        if (this.beatHistory.length < 2) return;
        
        // Calculate intervals between beats
        const intervals = [];
        for (let i = 1; i < this.beatHistory.length; i++) {
            const interval = this.beatHistory[i] - this.beatHistory[i - 1];
            if (interval >= this.minBeatInterval && interval <= this.maxBeatInterval) {
                intervals.push(interval);
            }
        }
        
        if (intervals.length === 0) return;
        
        // Calculate average interval
        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        
        // Convert to BPM
        const newTempo = Math.round(60000 / avgInterval);
        
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
            
            // Calculate confidence based on consistency
            this.calculateConfidence();
            
            // Notify callback
            if (this.onTempoDetected) {
                this.onTempoDetected(this.detectedTempo, this.tempoConfidence);
            }
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
    
    // Get current status
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isListening: this.isListening,
            detectedTempo: this.detectedTempo,
            tempoConfidence: this.tempoConfidence,
            beatThreshold: this.beatThreshold,
            recentBeats: this.beatHistory.length,
            tempoHistory: [...this.tempoHistory]
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
