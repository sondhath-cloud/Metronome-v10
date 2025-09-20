// Simple and Reliable Audio Manager for Metronome App
// Uses straightforward Web Audio API with fallback to simple timing

class AudioManager {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.isAudioReady = false;
        this.volume = 0.5;
        this.platform = this.detectPlatform();
        
        // Audio samples storage
        this.audioBuffers = new Map();
        this.samplesLoaded = false;
        this.sampleBaseUrl = 'https://www.soundjay.com/misc/sounds/'; // Free samples source
        
        // Simple initialization
        this.init();
    }

    // Detect platform for basic compatibility
    detectPlatform() {
        const userAgent = navigator.userAgent.toLowerCase();
        if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
        if (/android/.test(userAgent)) return 'android';
        if (/windows/.test(userAgent)) return 'windows';
        if (/macintosh|mac os x/.test(userAgent)) return 'macos';
        if (/linux/.test(userAgent)) return 'linux';
        return 'unknown';
    }

    // Initialize Audio System
    async init() {
        try {
            // Create AudioContext
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass();
            
            // Create master gain node
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.volume;
            
            this.isAudioReady = true;
            console.log('Audio system initialized successfully');
            
            // Load realistic samples in the background
            this.loadRealisticSamples().catch(error => {
                console.warn('Failed to load realistic samples, using synthesis:', error);
            });
        } catch (error) {
            console.warn('Audio initialization failed:', error);
            this.isAudioReady = false;
        }
    }

    // Resume audio context (required for user interaction)
    async resumeAudioOnUserInteraction() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                this.isAudioReady = true;
                console.log('Audio context resumed');
                return true;
            } catch (error) {
                console.warn('Failed to resume audio context:', error);
                return false;
            }
        }
        return true;
    }

    // Load audio sample from URL
    async loadAudioSample(name, url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.audioBuffers.set(name, audioBuffer);
            console.log(`Loaded audio sample: ${name}`);
            return true;
        } catch (error) {
            console.warn(`Failed to load audio sample ${name}:`, error);
            return false;
        }
    }

    // Play audio sample
    playAudioSample(sampleName, volume = 0.5, startTime = 0) {
        if (!this.isAudioReady || !this.audioContext) {
            console.log('Audio not ready, skipping sample playback');
            return;
        }

        const buffer = this.audioBuffers.get(sampleName);
        if (!buffer) {
            console.warn(`Audio sample not found: ${sampleName}, falling back to synthesis`);
            this.playBeatFallback(sampleName);
            return;
        }

        try {
            const now = this.audioContext.currentTime;
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = buffer;
            source.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            gainNode.gain.setValueAtTime(volume, now);
            
            source.start(now + startTime);
            console.log(`Playing audio sample: ${sampleName}`);
        } catch (error) {
            console.warn(`Error playing audio sample ${sampleName}:`, error);
            this.playBeatFallback(sampleName);
        }
    }

    // Fallback to synthesis if sample fails
    playBeatFallback(sampleName) {
        switch (sampleName) {
            case 'classic':
                this.playClick();
                break;
            case 'wood':
                this.playWoodBlock();
                break;
            case 'bass':
                this.playBassGuitarSynthesis();
                break;
            case 'piano':
                this.playPianoSynthesis();
                break;
            default:
                this.playClick();
        }
    }

    // Helper method to convert numbers to words for TTS
    numberToWord(num) {
        const words = [
            '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 
            'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'
        ];
        return words[num] || num.toString();
    }

    // Play count-in using Text-to-Speech with precise beat timing
    playCountInVoice(isAccented = false, tempo = 120, timeSignature = 4) {
        if (!this.isAudioReady || !this.audioContext) {
            console.log('Audio not ready, skipping count-in TTS');
            return;
        }

        try {
            // Check if speech synthesis is available
            if (!('speechSynthesis' in window)) {
                console.warn('Speech synthesis not available, using fallback');
                this.playCountInFallback(isAccented);
                return;
            }

            // Determine what to say based on time signature
            let words = [];
            
            // Generate count words based on the actual time signature numerator
            console.log(`TTS Count-in: Time signature = ${timeSignature}, Tempo = ${tempo}`);
            for (let i = 1; i <= timeSignature; i++) {
                words.push(this.numberToWord(i));
            }
            console.log(`TTS Count-in words:`, words);
            
            // Calculate beat duration in milliseconds
            const beatDurationMs = (60 / tempo) * 1000;
            
            // Calculate speech rate based on tempo
            // For fast tempos, we need to speed up the speech rate
            let speechRate = 1.0;
            if (tempo > 120) {
                // Scale speech rate for faster tempos
                speechRate = Math.min(3.0, 1.0 + (tempo - 120) / 120);
            } else if (tempo < 80) {
                // Slightly slower for very slow tempos
                speechRate = Math.max(0.5, 0.8 + (tempo - 60) / 100);
            }
            
            // Speak each word at exactly the beat timing
            words.forEach((word, index) => {
                setTimeout(() => {
                    const utterance = new SpeechSynthesisUtterance(word);
                    utterance.volume = this.volume;
                    utterance.rate = speechRate; // Adjusted speech rate
                    utterance.pitch = index === 0 ? 1.2 : 1.0; // Accent first beat
                    speechSynthesis.speak(utterance);
                }, index * beatDurationMs);
            });
            
        } catch (error) {
            console.warn('Error playing count-in TTS:', error);
            // Fallback to synthesized sound
            this.playCountInFallback(isAccented);
        }
    }
    
    // Fallback synthesized sound if audio files are not available
    playCountInFallback(isAccented = false) {
        if (!this.isAudioReady || !this.audioContext) {
            console.log('Audio not ready, skipping count-in fallback');
            return;
        }

        try {
            const now = this.audioContext.currentTime;
            const duration = 0.08;
            
            // Create multiple oscillators for count-in sound
            const osc1 = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            // Count-in frequencies - lower and more resonant
            const baseFreq = isAccented ? 400 : 300;
            const volume = isAccented ? 0.7 : 0.5;
            
            osc1.frequency.setValueAtTime(baseFreq, now);
            osc1.type = 'sawtooth';
            
            osc2.frequency.setValueAtTime(baseFreq * 1.5, now);
            osc2.type = 'triangle';
            
            // Low-pass filter for character
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
            filter.Q.setValueAtTime(2, now);
            
            // Envelope - quick attack, natural decay
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(volume * this.volume, now + 0.005);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
            
            // Connect audio graph
            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            // Play the sound
            osc1.start(now);
            osc1.stop(now + duration);
            osc2.start(now);
            osc2.stop(now + duration);
            
        } catch (error) {
            console.warn('Error playing count-in fallback:', error);
        }
    }

    // Play click sound - sharp metronome click
    playClick(frequency = 1200, volume = 0.6, attack = 0.001, decay = 0.02, sustain = 0, release = 0.01) {
        if (!this.isAudioReady || !this.audioContext) {
            console.log('Audio not ready, skipping click');
            return;
        }

        try {
            const now = this.audioContext.currentTime;
            const duration = 0.03; // Very short for crisp click
            
            // Create multiple oscillators for a more realistic click sound
            const osc1 = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            // High frequency for sharp click
            osc1.frequency.setValueAtTime(1200, now);
            osc1.type = 'square'; // Square wave for sharp attack
            
            // Add harmonic for more click character
            osc2.frequency.setValueAtTime(2400, now);
            osc2.type = 'triangle';
            
            // High-pass filter to emphasize the click
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(800, now);
            filter.Q.setValueAtTime(1, now);
            
            // Very sharp envelope - quick attack and immediate decay
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(volume * this.volume, now + 0.001); // Instant attack
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration); // Sharp decay
            
            // Connect audio graph
            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            // Play the click
            osc1.start(now);
            osc1.stop(now + duration);
            osc2.start(now);
            osc2.stop(now + duration);
            
        } catch (error) {
            console.warn('Error playing click:', error);
        }
    }

    // Play bass guitar sound using synthesis only
    playBassGuitar(frequency = 185, volume = 0.5) {
        if (!this.isAudioReady || !this.audioContext) {
            console.log('Audio not ready, skipping bass guitar');
            return;
        }

        this.playBassGuitarSynthesis(frequency, volume);
    }

    // Play bass guitar 2 sound for subdivisions using synthesis only
    playBassGuitar2(frequency = 185, volume = 0.5) {
        if (!this.isAudioReady || !this.audioContext) {
            console.log('Audio not ready, skipping bass guitar 2');
            return;
        }

        this.playBassGuitar2Synthesis(frequency, volume);
    }



    // Synthesized bass guitar sound (fallback)
    playBassGuitarSynthesis(frequency = 185, volume = 0.5) {
        try {
            const now = this.audioContext.currentTime;
            const duration = 0.1; // Very short for crisp metronome
            
            // Create a more realistic bass sound with multiple oscillators
            const osc1 = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const gain1 = this.audioContext.createGain();
            const gain2 = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            // Set up oscillators
            osc1.frequency.setValueAtTime(frequency, now);
            osc1.type = 'sawtooth';
            osc2.frequency.setValueAtTime(frequency * 0.5, now); // Sub-bass
            osc2.type = 'sine';
            
            // Set up filter
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, now);
            filter.Q.setValueAtTime(2, now);
            
            // Create envelope - very crisp attack and sharp decay
            const env = this.audioContext.createGain();
            env.gain.setValueAtTime(0, now);
            env.gain.linearRampToValueAtTime(volume * this.volume, now + 0.005); // Faster attack
            env.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.7); // Sharp decay
            
            // Connect
            osc1.connect(gain1);
            osc2.connect(gain2);
            gain1.connect(filter);
            gain2.connect(filter);
            filter.connect(env);
            env.connect(this.masterGain);
            
            // Set gains
            gain1.gain.setValueAtTime(0.7, now);
            gain2.gain.setValueAtTime(0.3, now);
            
            // Play
            osc1.start(now);
            osc1.stop(now + duration);
            osc2.start(now);
            osc2.stop(now + duration);
            
        } catch (error) {
            console.warn('Error playing bass guitar synthesis:', error);
        }
    }

    // Synthesized bass guitar 2 sound (fallback for subdivisions)
    playBassGuitar2Synthesis(frequency = 185, volume = 0.5) {
        try {
            const now = this.audioContext.currentTime;
            const duration = 0.08; // Very short for crisp subdivisions
            
            // Create a slightly different bass sound for subdivisions
            const osc1 = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const gain1 = this.audioContext.createGain();
            const gain2 = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            // Set up oscillators - slightly higher pitch for subdivisions
            osc1.frequency.setValueAtTime(frequency * 1.2, now); // 20% higher
            osc1.type = 'sawtooth';
            osc2.frequency.setValueAtTime(frequency * 0.6, now); // Sub-bass
            osc2.type = 'sine';
            
            // Set up filter - different character for subdivisions
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now); // Higher cutoff for subdivisions
            filter.Q.setValueAtTime(1.5, now);
            
            // Create envelope - very crisp for subdivisions
            const env = this.audioContext.createGain();
            env.gain.setValueAtTime(0, now);
            env.gain.linearRampToValueAtTime(volume * this.volume * 0.7, now + 0.005); // Faster attack
            env.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.6); // Very sharp decay
            
            // Connect
            osc1.connect(gain1);
            osc2.connect(gain2);
            gain1.connect(filter);
            gain2.connect(filter);
            filter.connect(env);
            env.connect(this.masterGain);
            
            // Set gains
            gain1.gain.setValueAtTime(0.6, now);
            gain2.gain.setValueAtTime(0.4, now);
            
            // Play
            osc1.start(now);
            osc1.stop(now + duration);
            osc2.start(now);
            osc2.stop(now + duration);
            
        } catch (error) {
            console.warn('Error playing bass guitar 2 synthesis:', error);
        }
    }

    // Enhanced synthesis for more realistic sounds
    async loadRealisticSamples() {
        if (this.samplesLoaded) return true;
        
        console.log('Initializing enhanced synthesis for realistic sounds...');
        
        // For now, we'll use enhanced synthesis instead of external samples
        // This is more reliable and doesn't require external dependencies
        this.samplesLoaded = true;
        console.log('Enhanced synthesis ready');
        return true;
    }

    // Main playBeat method - handles different sound types
    playBeat(soundType = 'classic', beatNumber = 1, isEmphasized = false) {
        if (!this.isAudioReady || !this.audioContext) {
            console.log('Audio not ready, skipping beat');
            return;
        }

        try {
            // Try to play realistic sample first, fallback to synthesis
            const volume = isEmphasized ? 0.8 : 0.6;
            this.playAudioSample(soundType, volume);
        } catch (error) {
            console.warn('Error playing beat:', error);
            // Fallback to original synthesis
            this.playBeatFallback(soundType, isEmphasized);
        }
    }

    // Enhanced fallback method with emphasis support
    playBeatFallback(soundType, isEmphasized = false) {
        switch (soundType) {
            case 'classic':
                const frequency = isEmphasized ? 1200 : 800;
                const volume = isEmphasized ? 0.8 : 0.6;
                this.playClick(frequency, volume);
                break;
            case 'wood':
                this.playEnhancedWoodBlock(isEmphasized);
                break;
            case 'bass':
                this.playEnhancedBassGuitar(isEmphasized);
                break;
            case 'piano':
                this.playEnhancedPiano(isEmphasized);
                break;
            default:
                this.playClick(isEmphasized ? 1200 : 800, isEmphasized ? 0.8 : 0.6);
        }
    }

    // Enhanced Ping Sound (Wood Block)
    playEnhancedWoodBlock(isEmphasized = false) {
        try {
            const now = this.audioContext.currentTime;
            const duration = 0.15;
            const volume = isEmphasized ? 0.8 : 0.6;
            
            // Create multiple oscillators for wood block sound
            const osc1 = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const osc3 = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            // Wood block frequencies (harmonic series)
            osc1.frequency.setValueAtTime(isEmphasized ? 800 : 600, now);
            osc2.frequency.setValueAtTime(isEmphasized ? 1600 : 1200, now);
            osc3.frequency.setValueAtTime(isEmphasized ? 2400 : 1800, now);
            
            osc1.type = 'sine';
            osc2.type = 'sine';
            osc3.type = 'sine';
            
            // Filter for wood-like timbre
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2000, now);
            filter.Q.setValueAtTime(2, now);
            
            // Envelope for wood block attack/decay
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(volume, now + 0.001);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
            
            // Connect nodes
            osc1.connect(filter);
            osc2.connect(filter);
            osc3.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            // Play
            osc1.start(now);
            osc1.stop(now + duration);
            osc2.start(now);
            osc2.stop(now + duration);
            osc3.start(now);
            osc3.stop(now + duration);
            
        } catch (error) {
            console.warn('Error playing enhanced wood block:', error);
        }
    }

    // Enhanced Thump Sound (Bass Guitar)
    playEnhancedBassGuitar(isEmphasized = false) {
        try {
            const now = this.audioContext.currentTime;
            const duration = 0.3;
            const volume = isEmphasized ? 0.8 : 0.6;
            const frequency = isEmphasized ? 200 : 185;
            
            // Create multiple oscillators for bass sound
            const osc1 = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            // Bass frequencies
            osc1.frequency.setValueAtTime(frequency, now);
            osc2.frequency.setValueAtTime(frequency * 2, now); // Octave
            
            osc1.type = 'sawtooth';
            osc2.type = 'sine';
            
            // Low-pass filter for bass
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
            filter.Q.setValueAtTime(1, now);
            
            // Envelope
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
            
            // Connect
            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            // Play
            osc1.start(now);
            osc1.stop(now + duration);
            osc2.start(now);
            osc2.stop(now + duration);
            
        } catch (error) {
            console.warn('Error playing enhanced bass guitar:', error);
        }
    }


    // Enhanced Hoot Sound (Piano)
    playEnhancedPiano(isEmphasized = false) {
        try {
            const now = this.audioContext.currentTime;
            const duration = 0.4;
            const volume = isEmphasized ? 0.8 : 0.6;
            const frequency = isEmphasized ? 880 : 440;
            
            // Create multiple oscillators for piano harmonics
            const osc1 = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const osc3 = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            // Piano harmonics
            osc1.frequency.setValueAtTime(frequency, now);
            osc2.frequency.setValueAtTime(frequency * 2, now);
            osc3.frequency.setValueAtTime(frequency * 3, now);
            
            osc1.type = 'sine';
            osc2.type = 'sine';
            osc3.type = 'sine';
            
            // Filter for piano timbre
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2000, now);
            filter.Q.setValueAtTime(1, now);
            
            // Piano envelope (quick attack, slow decay)
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
            
            // Connect
            osc1.connect(filter);
            osc2.connect(filter);
            osc3.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            // Play
            osc1.start(now);
            osc1.stop(now + duration);
            osc2.start(now);
            osc2.stop(now + duration);
            osc3.start(now);
            osc3.stop(now + duration);
            
        } catch (error) {
            console.warn('Error playing enhanced piano:', error);
        }
    }


    // Synthesized piano sound
    playPianoSynthesis(frequency = 440, volume = 0.6) {
        try {
            const now = this.audioContext.currentTime;
            const duration = 0.3;
            
            // Multiple oscillators for piano-like sound
            const osc1 = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const osc3 = this.audioContext.createOscillator();
            
            osc1.frequency.setValueAtTime(frequency, now);
            osc2.frequency.setValueAtTime(frequency * 2, now); // Octave
            osc3.frequency.setValueAtTime(frequency * 3, now); // Fifth
            
            osc1.type = 'triangle';
            osc2.type = 'sine';
            osc3.type = 'sine';
            
            const gain1 = this.audioContext.createGain();
            const gain2 = this.audioContext.createGain();
            const gain3 = this.audioContext.createGain();
            const masterEnv = this.audioContext.createGain();
            
            // Piano-like envelope
            masterEnv.gain.setValueAtTime(0, now);
            masterEnv.gain.linearRampToValueAtTime(volume * this.volume, now + 0.05);
            masterEnv.gain.exponentialRampToValueAtTime(volume * this.volume * 0.3, now + 0.1);
            masterEnv.gain.exponentialRampToValueAtTime(0.001, now + duration);
            
            // Mix levels
            gain1.gain.setValueAtTime(1.0, now);
            gain2.gain.setValueAtTime(0.3, now);
            gain3.gain.setValueAtTime(0.1, now);
            
            osc1.connect(gain1);
            osc2.connect(gain2);
            osc3.connect(gain3);
            gain1.connect(masterEnv);
            gain2.connect(masterEnv);
            gain3.connect(masterEnv);
            masterEnv.connect(this.masterGain);
            
            osc1.start(now);
            osc2.start(now);
            osc3.start(now);
            osc1.stop(now + duration);
            osc2.stop(now + duration);
            osc3.stop(now + duration);
            
        } catch (error) {
            console.warn('Error playing piano synthesis:', error);
        }
    }

    // Set volume
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.masterGain) {
            this.masterGain.gain.value = this.volume;
        }
    }

    // Get audio status
    getAudioStatus() {
        return {
            isReady: this.isAudioReady,
            isHardware: true, // We're using Web Audio API
            platform: this.platform,
            latency: 0,
            state: this.audioContext ? this.audioContext.state : 'unavailable',
            volume: this.volume
        };
    }

    // Stop metronome (for compatibility)
    stopMetronome() {
        // This is handled by the main metronome class
    }

    // Cleanup
    destroy() {
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioManager;
} else {
    window.AudioManager = AudioManager;
}
