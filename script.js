// Hathaway Metronome v10 - Hybrid Simple/Advanced Interface
// Combines the simplicity of basic metronome with advanced features

class MetronomeCore {
    constructor() {
    // Core timing properties
    this.isPlaying = false;
    this.tempo = 120;
    this.beatsPerBar = 4;
    this.currentBeat = 1;
    this.intervalId = null;
    
    // Web Audio API timing properties for precise scheduling
    this.nextScheduledTime = 0;
    this.scheduledEvents = [];
    this.timingPrecision = 0.025; // 25ms lookahead for scheduling
        
        // Audio system
        this.audioManager = null;
        
        // UI callbacks
        this.onBeatChange = null;
        this.onTempoDetected = null;
        this.onVolumeUpdate = null;
        this.onMicrophoneError = null;
        
        // Advanced features
        this.timeSignature = { numerator: 4, denominator: 4 };
        this.subdivision = 'quarter';
        this.currentSubdivision = 0;
        this.emphasizedBeats = [1];
        this.playSubdivisionSounds = false;
        this.beatSound = 'classic';
        
        // Pattern and counting
        this.barCount = 0;
        this.beatCount = 0;
        this.patternMode = 'none';
        this.activeBars = 2;
        this.silentBarsPattern = 2;
        this.patternPhase = 'active';
        this.patternBarsRemaining = 0;
        this.isSilent = false;
        
        // Simple mode mute pattern
        this.mutePatternEnabled = false;
        this.currentBar = 1;
        this.isCurrentBarMuted = false;
        
        // Tap tempo
        this.tapTimes = [];
        
        // Voice features
        this.voiceRecognition = null;
        this.isVoiceEnabled = false;
        this.voiceSynthesis = null;
        
        // Microphone input
        this.microphoneInput = null;
        this.isMicrophoneEnabled = false;
        this.detectedTempo = 120;
        this.tempoConfidence = 0;
        this.currentVolume = 0;
        
        // Count-in functionality
        this.isCountInActive = false;
        this.countInBeats = 0;
        this.countInCurrentBeat = 0;
        this.countInIntervalId = null;
        
        // Display
        this.displayMode = 'circle';
        
        // Audio focus and visibility handling
        this.isPageVisible = true;
        this.wasPlayingBeforeHidden = false;
        this.audioFocusHandlers = {
            visibilityChange: null,
            pageShow: null,
            pageHide: null,
            beforeUnload: null
        };
        
        // Performance monitoring
        this.performanceMonitor = {
            isEnabled: true,
            checkInterval: 5000, // Check every 5 seconds
            monitorId: null,
            lastCheckTime: 0,
            performanceHistory: [],
            maxHistoryLength: 20,
            cpuThreshold: 80, // CPU usage threshold (%)
            memoryThreshold: 100 * 1024 * 1024, // Memory threshold (100MB)
            audioDropoutCount: 0,
            lastAudioTime: 0
        };
    }
    
    async init() {
        // Load saved settings first
        this.loadSettings();
        
        await this.setupAudioManager();
        await this.setupMicrophoneInput();
        this.setupAudioFocusHandling();
        this.startPerformanceMonitoring();
        console.log('MetronomeCore initialized');
    }
    
    async setupAudioManager() {
        this.audioManager = new AudioManager();
        await this.audioManager.init();
        console.log('Audio system ready:', this.audioManager.getAudioStatus());
    }
    
    async setupMicrophoneInput() {
        // Initialize microphone input but don't request permission by default
        this.microphoneInput = new MicrophoneInput();
        this.isMicrophoneEnabled = false;
        
        // Set up callbacks for microphone input
        this.microphoneInput.onTempoDetected = (tempo, confidence) => {
            this.detectedTempo = tempo;
            this.tempoConfidence = confidence;
            console.log(`Tempo detected: ${tempo} BPM (confidence: ${confidence}%)`);
            
            // Notify UI if callback is set
            if (this.onTempoDetected) {
                this.onTempoDetected(tempo, confidence);
            }
        };
        
        this.microphoneInput.onVolumeUpdate = (volume) => {
            this.currentVolume = volume;
            
            // Notify UI if callback is set
            if (this.onVolumeUpdate) {
                this.onVolumeUpdate(volume);
            }
        };
        
        this.microphoneInput.onError = (error) => {
            console.error('Microphone error:', error);
            
            // Notify UI if callback is set
            if (this.onMicrophoneError) {
                this.onMicrophoneError(error);
            }
        };
        
        console.log('Microphone input ready (permission not requested by default)');
    }
    
    setupAudioFocusHandling() {
        // Handle page visibility changes
        this.audioFocusHandlers.visibilityChange = () => {
            if (document.hidden) {
                this.handlePageHidden();
            } else {
                this.handlePageVisible();
            }
        };
        
        // Handle page show/hide events (for mobile)
        this.audioFocusHandlers.pageShow = () => {
            this.handlePageVisible();
        };
        
        this.audioFocusHandlers.pageHide = () => {
            this.handlePageHidden();
        };
        
        // Handle before unload
        this.audioFocusHandlers.beforeUnload = () => {
            this.handlePageUnload();
        };
        
        // Add event listeners
        document.addEventListener('visibilitychange', this.audioFocusHandlers.visibilityChange);
        window.addEventListener('pageshow', this.audioFocusHandlers.pageShow);
        window.addEventListener('pagehide', this.audioFocusHandlers.pageHide);
        window.addEventListener('beforeunload', this.audioFocusHandlers.beforeUnload);
        
        // Handle focus/blur for additional mobile support
        window.addEventListener('focus', () => this.handlePageVisible());
        window.addEventListener('blur', () => this.handlePageHidden());
        
        console.log('Audio focus handling initialized');
    }
    
    handlePageHidden() {
        console.log('Page hidden - pausing metronome');
        this.isPageVisible = false;
        
        if (this.isPlaying) {
            this.wasPlayingBeforeHidden = true;
            this.stop();
        }
        
        // Pause audio context to save resources
        if (this.audioManager && this.audioManager.audioContext) {
            this.audioManager.audioContext.suspend();
        }
    }
    
    handlePageVisible() {
        console.log('Page visible - resuming metronome if needed');
        this.isPageVisible = true;
        
        // Resume audio context
        if (this.audioManager && this.audioManager.audioContext) {
            this.audioManager.audioContext.resume();
        }
        
        // Resume metronome if it was playing before
        if (this.wasPlayingBeforeHidden) {
            this.wasPlayingBeforeHidden = false;
            // Small delay to ensure audio context is ready
            setTimeout(() => {
                this.start();
            }, 100);
        }
    }
    
    handlePageUnload() {
        console.log('Page unloading - cleaning up');
        this.stop();
        
        // Clean up audio focus handlers
        this.cleanupAudioFocusHandling();
        
        // Stop performance monitoring
        this.stopPerformanceMonitoring();
    }
    
    cleanupAudioFocusHandling() {
        document.removeEventListener('visibilitychange', this.audioFocusHandlers.visibilityChange);
        window.removeEventListener('pageshow', this.audioFocusHandlers.pageShow);
        window.removeEventListener('pagehide', this.audioFocusHandlers.pageHide);
        window.removeEventListener('beforeunload', this.audioFocusHandlers.beforeUnload);
        window.removeEventListener('focus', () => this.handlePageVisible());
        window.removeEventListener('blur', () => this.handlePageHidden());
    }
    
    startPerformanceMonitoring() {
        if (!this.performanceMonitor.isEnabled) return;
        
        this.performanceMonitor.monitorId = setInterval(() => {
            this.checkPerformance();
        }, this.performanceMonitor.checkInterval);
        
        console.log('Performance monitoring started');
    }
    
    stopPerformanceMonitoring() {
        if (this.performanceMonitor.monitorId) {
            clearInterval(this.performanceMonitor.monitorId);
            this.performanceMonitor.monitorId = null;
        }
    }
    
    checkPerformance() {
        const now = performance.now();
        const performanceData = {
            timestamp: now,
            memory: this.getMemoryUsage(),
            timing: this.getTimingData(),
            audioContext: this.getAudioContextStatus()
        };
        
        // Add to history
        this.performanceMonitor.performanceHistory.push(performanceData);
        if (this.performanceMonitor.performanceHistory.length > this.performanceMonitor.maxHistoryLength) {
            this.performanceMonitor.performanceHistory.shift();
        }
        
        // Check for performance issues
        this.analyzePerformance(performanceData);
        
        this.performanceMonitor.lastCheckTime = now;
    }
    
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }
    
    getTimingData() {
        const now = performance.now();
        const timing = {
            currentTime: now,
            timeSinceLastCheck: now - this.performanceMonitor.lastCheckTime,
            audioDropoutCount: this.performanceMonitor.audioDropoutCount
        };
        
        // Reset dropout count
        this.performanceMonitor.audioDropoutCount = 0;
        
        return timing;
    }
    
    getAudioContextStatus() {
        if (this.audioManager && this.audioManager.audioContext) {
            return {
                state: this.audioManager.audioContext.state,
                sampleRate: this.audioManager.audioContext.sampleRate,
                currentTime: this.audioManager.audioContext.currentTime
            };
        }
        return null;
    }
    
    analyzePerformance(performanceData) {
        const issues = [];
        
        // Check memory usage
        if (performanceData.memory) {
            const memoryUsage = performanceData.memory.used / (1024 * 1024); // Convert to MB
            if (memoryUsage > this.performanceMonitor.memoryThreshold / (1024 * 1024)) {
                issues.push(`High memory usage: ${memoryUsage.toFixed(1)}MB`);
            }
        }
        
        // Check timing issues
        if (performanceData.timing.timeSinceLastCheck > this.performanceMonitor.checkInterval * 1.5) {
            issues.push('Timing delay detected - possible CPU throttling');
        }
        
        // Check audio context issues
        if (performanceData.audioContext && performanceData.audioContext.state !== 'running') {
            issues.push(`Audio context not running: ${performanceData.audioContext.state}`);
        }
        
        // Check for audio dropouts
        if (performanceData.timing.audioDropoutCount > 0) {
            issues.push(`${performanceData.timing.audioDropoutCount} audio dropouts detected`);
        }
        
        // Log issues if any
        if (issues.length > 0) {
            console.warn('Performance issues detected:', issues);
            this.handlePerformanceIssues(issues);
        }
    }
    
    handlePerformanceIssues(issues) {
        // Reduce audio quality or complexity if performance is poor
        if (issues.some(issue => issue.includes('memory') || issue.includes('CPU'))) {
            console.log('Reducing audio quality due to performance issues');
            // Could reduce sample rate, buffer size, or disable some features
        }
        
        // Try to recover audio context if it's not running
        if (issues.some(issue => issue.includes('Audio context'))) {
            if (this.audioManager) {
                this.audioManager.ensureAudioContextReady();
            }
        }
    }
    
    recordAudioEvent() {
        this.performanceMonitor.lastAudioTime = performance.now();
    }
    
    recordAudioDropout() {
        this.performanceMonitor.audioDropoutCount++;
        console.warn('Audio dropout detected');
    }
    
    // Settings persistence
    saveSettings() {
        const settings = {
            tempo: this.tempo,
            timeSignature: this.timeSignature,
            beatSound: this.beatSound,
            emphasizedBeats: this.emphasizedBeats,
            subdivision: this.subdivision,
            playSubdivisionSounds: this.playSubdivisionSounds,
            patternMode: this.patternMode,
            activeBars: this.activeBars,
            silentBarsPattern: this.silentBarsPattern,
            mutePatternEnabled: this.mutePatternEnabled,
            isVoiceEnabled: this.isVoiceEnabled,
            isMicrophoneEnabled: this.isMicrophoneEnabled,
            displayMode: this.displayMode
        };
        
        // Save to both localStorage (persistent) and sessionStorage (current session)
        try {
            localStorage.setItem('metronomeSettings', JSON.stringify(settings));
            sessionStorage.setItem('metronomeSettings', JSON.stringify(settings));
            console.log('Settings saved to both localStorage and sessionStorage');
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }
    
    loadSettings() {
        // Try sessionStorage first (current session), then localStorage (persistent)
        let saved = null;
        let source = '';
        
        try {
            saved = sessionStorage.getItem('metronomeSettings');
            if (saved) {
                source = 'sessionStorage';
            } else {
                saved = localStorage.getItem('metronomeSettings');
                if (saved) {
                    source = 'localStorage';
                }
            }
        } catch (error) {
            console.warn('Failed to access storage:', error);
            return false;
        }
        
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                this.tempo = settings.tempo || 120;
                this.timeSignature = settings.timeSignature || { numerator: 4, denominator: 4 };
                this.beatSound = settings.beatSound || 'classic';
                this.emphasizedBeats = settings.emphasizedBeats || [1];
                this.subdivision = settings.subdivision || 'quarter';
                this.playSubdivisionSounds = settings.playSubdivisionSounds || false;
                this.patternMode = settings.patternMode || 'none';
                this.activeBars = settings.activeBars || 2;
                this.silentBarsPattern = settings.silentBarsPattern || 2;
                this.mutePatternEnabled = settings.mutePatternEnabled || false;
                this.isVoiceEnabled = settings.isVoiceEnabled || false;
                this.isMicrophoneEnabled = settings.isMicrophoneEnabled || false;
                this.displayMode = settings.displayMode || 'circle';
                
                console.log(`Settings loaded from ${source}`);
                return true;
            } catch (error) {
                console.warn('Failed to parse settings:', error);
            }
        }
        return false;
    }

    // Core timing methods
    start() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.currentBeat = 1;
        this.currentSubdivision = 0;
        this.resetPattern();
        
        // Ensure audio context is running
        if (this.audioManager && this.audioManager.audioContext) {
            if (this.audioManager.audioContext.state === 'suspended') {
                this.audioManager.audioContext.resume();
            }
        }
        
        // Calculate timing intervals
        const baseInterval = (60 / this.tempo) * 1000;
        
        // Determine subdivision interval based on current subdivision setting
        let subdivisionInterval;
        switch (this.subdivision) {
            case 'eighth':
                subdivisionInterval = baseInterval / 2;
                break;
            case 'sixteenth':
                subdivisionInterval = baseInterval / 4;
                break;
            default: // quarter
                subdivisionInterval = baseInterval;
                break;
        }
        
        // Convert to seconds for Web Audio API
        this.subdivisionIntervalSeconds = subdivisionInterval / 1000;
        
        // Play first beat immediately
        this.playBeat();
        
        // Update UI for first beat
        if (this.onBeatChange) {
            this.onBeatChange();
        }
        
        // Start Web Audio API scheduling instead of setInterval
        this.startAudioScheduling();
        
        console.log('Metronome started at', this.tempo, 'BPM with', this.subdivision, 'subdivisions');
    }
    
    stop() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        this.currentBeat = 1;
        this.currentSubdivision = 0;
        
        // Stop both interval and audio scheduling
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // Clear scheduled audio events
        this.scheduledEvents = [];
        
        // Update UI when stopped
        if (this.onBeatChange) {
            this.onBeatChange();
        }
        
        console.log('Metronome stopped');
    }
    
    // Web Audio API scheduling for precise timing
    startAudioScheduling() {
        if (!this.audioManager || !this.audioManager.audioContext) {
            console.warn('Audio context not available, falling back to setInterval');
            this.startFallbackTiming();
            return;
        }
        
        const audioContext = this.audioManager.audioContext;
        const currentTime = audioContext.currentTime;
        
        // Schedule events for the next 2 seconds
        this.scheduleNextEvents(currentTime);
        
        // Set up the scheduling loop
        this.schedulingInterval = setInterval(() => {
            if (!this.isPlaying) {
                clearInterval(this.schedulingInterval);
                return;
            }
            
            const now = audioContext.currentTime;
            this.scheduleNextEvents(now);
        }, this.timingPrecision * 1000); // Check every 25ms
    }
    
    scheduleNextEvents(currentTime) {
        if (!this.audioManager || !this.audioManager.audioContext) return;
        
        const audioContext = this.audioManager.audioContext;
        const lookahead = 2.0; // Schedule 2 seconds ahead
        const endTime = currentTime + lookahead;
        
        // Find the next subdivision time
        let nextTime = this.nextScheduledTime;
        if (nextTime === 0) {
            nextTime = currentTime + this.subdivisionIntervalSeconds;
        }
        
        // Schedule events up to the lookahead time
        while (nextTime < endTime) {
            // Schedule the beat event
            this.scheduleBeatEvent(nextTime);
            
            // Move to next subdivision
            nextTime += this.subdivisionIntervalSeconds;
        }
        
        this.nextScheduledTime = nextTime;
    }
    
    scheduleBeatEvent(scheduledTime) {
        if (!this.audioManager || !this.audioManager.audioContext) return;
        
        const audioContext = this.audioManager.audioContext;
        
        // Schedule the audio
        if (this.audioManager.audioContext) {
            const now = audioContext.currentTime;
            const delay = Math.max(0, scheduledTime - now);
            
            // Schedule the beat sound
            setTimeout(() => {
                if (this.isPlaying) {
                    this.nextSubdivision();
                }
            }, delay * 1000);
        }
    }
    
    // Fallback timing for when Web Audio API is not available
    startFallbackTiming() {
        const baseInterval = (60 / this.tempo) * 1000;
        
        let subdivisionInterval;
        switch (this.subdivision) {
            case 'eighth':
                subdivisionInterval = baseInterval / 2;
                break;
            case 'sixteenth':
                subdivisionInterval = baseInterval / 4;
                break;
            default:
                subdivisionInterval = baseInterval;
                break;
        }
        
        this.intervalId = setInterval(() => {
            if (this.isPlaying) {
                this.nextSubdivision();
            }
        }, subdivisionInterval);
    }
    
    togglePlayback() {
        if (this.isActive()) {
            this.stop();
        } else {
            this.start();
        }
    }
    
    nextBeat() {
        this.currentBeat++;
        this.beatCount++;
        
        if (this.currentBeat > this.beatsPerBar) {
            this.currentBeat = 1;
            this.barCount++;
            this.nextBar();
        }
        
        // Notify UI of beat change
        if (this.onBeatChange) {
            this.onBeatChange();
        }
    }
    
    nextSubdivision() {
        this.currentSubdivision++;
        
        // Determine how many subdivisions per beat based on subdivision setting
        let subdivisionsPerBeat;
        switch (this.subdivision) {
            case 'eighth':
                subdivisionsPerBeat = 2;
                break;
            case 'sixteenth':
                subdivisionsPerBeat = 4;
                break;
            default: // quarter
                subdivisionsPerBeat = 1;
                break;
        }
        
        // Check if we've completed a full beat
        if (this.currentSubdivision >= subdivisionsPerBeat) {
            this.currentSubdivision = 0;
            this.nextBeat();
        }
        
        // Play sound for this subdivision
        this.playBeat();
        
        // Update UI
        if (this.onBeatChange) {
            this.onBeatChange();
        }
    }
    
    nextBar() {
        // Simple mode mute pattern
        if (this.mutePatternEnabled) {
            this.currentBar++;
            if (this.currentBar > 2) {
                this.currentBar = 1;
            }
            this.isCurrentBarMuted = (this.currentBar === 2);
        }
        
        // Advanced mode pattern handling
        if (this.patternMode === 'pattern') {
            this.patternBarsRemaining--;
            if (this.patternBarsRemaining <= 0) {
                if (this.patternPhase === 'active') {
                    this.patternPhase = 'silent';
                    this.patternBarsRemaining = this.silentBarsPattern;
                    this.isSilent = true;
                } else {
                    this.patternPhase = 'active';
                    this.patternBarsRemaining = this.activeBars;
                    this.isSilent = false;
                }
            }
        }
    }
    
    resetPattern() {
        this.currentBar = 1;
        this.isCurrentBarMuted = false;
        this.patternPhase = 'active';
        this.patternBarsRemaining = this.activeBars;
        this.isSilent = false;
    }
    
    playBeat() {
        // Check if we should be silent
        const shouldBeSilent = (this.mutePatternEnabled && this.isCurrentBarMuted) || 
                              (this.patternMode === 'pattern' && this.isSilent);
        
        if (shouldBeSilent) {
            return;
        }
        
        // Determine if this is a main beat (subdivision 0) or a subdivision
        const isMainBeat = this.currentSubdivision === 0;
        
        // Only play subdivision sounds if enabled, or if it's a main beat
        if (!isMainBeat && !this.playSubdivisionSounds) {
            return;
        }
        
        // Determine if this is an emphasized beat - only emphasize explicitly selected beats
        const isEmphasized = this.emphasizedBeats.includes(this.currentBeat);
        
        // Record audio event for performance monitoring
        this.recordAudioEvent();
        
        try {
            // Play the appropriate sound with error recovery
            if (this.beatSound === 'classic') {
                this.playClassicClick(isEmphasized, isMainBeat);
            } else {
                this.playBeatWithRecovery(this.beatSound, this.currentBeat, isEmphasized);
            }
        } catch (error) {
            console.error('Error playing beat:', error);
            this.recordAudioDropout();
            this.handleAudioError(error);
        }
    }
    
    // Play beat with error recovery
    async playBeatWithRecovery(soundType, beatNumber, isEmphasized) {
        try {
            await this.audioManager.playBeat(soundType, beatNumber, isEmphasized);
        } catch (error) {
            console.warn('Primary audio playback failed, trying recovery:', error);
            
            // Try to recover audio context
            const recovered = await this.audioManager.ensureAudioContextReady();
            if (recovered) {
                try {
                    // Try again with recovered context
                    await this.audioManager.playBeat(soundType, beatNumber, isEmphasized);
                    return;
                } catch (retryError) {
                    console.warn('Retry after recovery failed:', retryError);
                }
            }
            
            // Fallback to classic click
            console.log('Falling back to classic click sound');
            this.playClassicClick(isEmphasized, true);
        }
    }
    
    // Handle audio errors
    handleAudioError(error) {
        console.error('Audio error occurred:', error);
        
        // Try to recover the audio system
        if (this.audioManager) {
            this.audioManager.ensureAudioContextReady().then(recovered => {
                if (recovered) {
                    console.log('Audio system recovered successfully');
                } else {
                    console.error('Failed to recover audio system');
                }
            });
        }
        
        // Notify UI of error if callback is set
        if (this.onAudioError) {
            this.onAudioError(error);
        }
    }
    
    playClassicClick(isEmphasized = false, isMainBeat = true) {
        // Determine sound characteristics based on emphasis and whether it's a main beat
        let frequency, volume;
        
        if (isEmphasized) {
            frequency = 1200;
            volume = 0.8;
        } else if (isMainBeat) {
            frequency = 800;
            volume = 0.6;
        } else {
            // Subdivision sound - softer and lower pitch
            frequency = 600;
            volume = 0.3;
        }
        
        if (this.audioManager && this.audioManager.audioContext) {
            try {
                const now = this.audioManager.audioContext.currentTime;
                const duration = 0.1;
                
                const osc = this.audioManager.audioContext.createOscillator();
                const gain = this.audioManager.audioContext.createGain();
                
                osc.frequency.setValueAtTime(frequency, now);
                osc.type = 'square';
                
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(volume, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
                
                osc.connect(gain);
                gain.connect(this.audioManager.masterGain);
                
                osc.start(now);
                osc.stop(now + duration);
                
            } catch (error) {
                console.warn('Error playing classic click:', error);
            }
        }
    }
    
    // Tempo control methods
    setTempo(newTempo) {
        this.tempo = Math.max(30, Math.min(300, newTempo));
        
        if (this.isPlaying) {
            // Update timing without stopping completely
            this.updateTiming();
        }
    }
    
    updateTiming() {
        if (!this.isPlaying) return;
        
        // Calculate new subdivision interval
        const baseInterval = (60 / this.tempo) * 1000;
        let subdivisionInterval;
        switch (this.subdivision) {
            case 'eighth':
                subdivisionInterval = baseInterval / 2;
                break;
            case 'sixteenth':
                subdivisionInterval = baseInterval / 4;
                break;
            default:
                subdivisionInterval = baseInterval;
                break;
        }
        
        this.subdivisionIntervalSeconds = subdivisionInterval / 1000;
        
        // Clear existing scheduling
        if (this.schedulingInterval) {
            clearInterval(this.schedulingInterval);
        }
        this.scheduledEvents = [];
        this.nextScheduledTime = 0;
        
        // Restart scheduling with new timing
        this.startAudioScheduling();
    }
    
    adjustTempo(change) {
        this.setTempo(this.tempo + change);
    }
    
    tapTempo() {
        const now = Date.now();
        this.tapTimes.push(now);
        
        // Keep only the last 4 taps
        if (this.tapTimes.length > 4) {
            this.tapTimes.shift();
        }
        
        // Calculate average interval if we have enough taps
        if (this.tapTimes.length >= 2) {
            const intervals = [];
            for (let i = 1; i < this.tapTimes.length; i++) {
                intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
            }
            
            const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
            const newTempo = Math.round(60000 / avgInterval);
            
            if (newTempo >= 30 && newTempo <= 300) {
                this.setTempo(newTempo);
            }
        }
        
        // Clear taps after 3 seconds of inactivity
        setTimeout(() => {
            const timeSinceLastTap = Date.now() - now;
            if (timeSinceLastTap >= 3000) {
                this.tapTimes = [];
            }
        }, 3000);
    }
    
    // Beat and time signature methods
    setBeatsPerBar(beats) {
        this.beatsPerBar = beats;
        this.currentBeat = 1;
        this.resetPattern();
        
        // Update time signature for advanced mode
        this.timeSignature.numerator = beats;
    }
    
    setTimeSignature(signature) {
        const [numerator, denominator] = signature.split('/').map(Number);
        this.timeSignature = { numerator, denominator };
        this.setBeatsPerBar(numerator);
    }
    
    // Pattern methods
    setPatternMode(mode) {
        this.patternMode = mode;
        this.resetPattern();
    }
    
    setMutePattern(enabled) {
        this.mutePatternEnabled = enabled;
        this.resetPattern();
    }
    
    // Advanced feature methods
    setSubdivision(subdivision) {
        this.subdivision = subdivision;
    }
    
    setEmphasizedBeats(beats) {
        this.emphasizedBeats = beats;
    }
    
    setBeatSound(soundType) {
        this.beatSound = soundType;
    }
    
    setDisplayMode(mode) {
        this.displayMode = mode;
    }
    
    resetCounters() {
        this.barCount = 0;
        this.beatCount = 0;
    }
    
    // Microphone input methods
    async startMicrophoneListening() {
        if (this.microphoneInput) {
            const success = await this.microphoneInput.startListening();
            if (success) {
                this.isMicrophoneEnabled = true;
                console.log('Started microphone listening');
                return true;
            }
        }
        return false;
    }
    
    stopMicrophoneListening() {
        if (this.microphoneInput) {
            this.isMicrophoneEnabled = false;
            this.microphoneInput.stopListening();
            console.log('Stopped microphone listening');
        }
    }
    
    toggleMicrophoneListening() {
        if (this.isMicrophoneEnabled) {
            this.stopMicrophoneListening();
        } else {
            this.startMicrophoneListening();
        }
    }
    
    setMicrophoneSensitivity(sensitivity) {
        if (this.microphoneInput) {
            this.microphoneInput.setSensitivity(sensitivity);
        }
    }
    
    setMicrophoneMinInterval(interval) {
        if (this.microphoneInput) {
            this.microphoneInput.setMinBeatInterval(interval);
        }
    }
    
    setMicrophoneMaxInterval(interval) {
        if (this.microphoneInput) {
            this.microphoneInput.setMaxBeatInterval(interval);
        }
    }
    
    setMicrophoneDetectionMode(mode) {
        if (this.microphoneInput) {
            this.microphoneInput.setDetectionMode(mode);
        }
    }
    
    setMicrophoneOnsetThreshold(threshold) {
        if (this.microphoneInput) {
            this.microphoneInput.setOnsetThreshold(threshold);
        }
    }
    
    resetMicrophoneDetection() {
        if (this.microphoneInput) {
            this.microphoneInput.reset();
        }
    }
    
    getMicrophoneStatus() {
        if (this.microphoneInput) {
            return this.microphoneInput.getStatus();
        }
        return null;
    }
    
    applyDetectedTempo(tempo) {
        if (tempo >= 30 && tempo <= 300) {
            this.setTempo(tempo);
            console.log(`Applied detected tempo: ${tempo} BPM`);
            return true;
        }
        return false;
    }
    
    // Count-in methods
    startCountIn() {
        if (this.isPlaying || this.isCountInActive) return;
        
        this.isCountInActive = true;
        this.countInBeats = this.timeSignature.numerator;
        
        console.log(`Starting count-in: ${this.countInBeats} beats at ${this.tempo} BPM`);
        
        // Play complete count-in in one go
        this.playCountInBeat();
        
        // Calculate total count-in duration (one full measure)
        const beatDuration = (60 / this.tempo) * 1000; // Duration in milliseconds per beat
        const totalDuration = beatDuration * this.countInBeats; // Total duration for full count
        
        // Set up timer to start regular metronome after count-in
        this.countInIntervalId = setTimeout(() => {
            this.finishCountIn();
        }, totalDuration);
    }
    
    playCountInBeat() {
        // Play the complete count-in using TTS
        this.audioManager.playCountInVoice(false, this.tempo, this.timeSignature.numerator);
        console.log(`Count-in: ${this.countInBeats} beats at ${this.tempo} BPM`);
    }
    
    finishCountIn() {
        // Clear count-in timeout
        if (this.countInIntervalId) {
            clearTimeout(this.countInIntervalId);
            this.countInIntervalId = null;
        }
        
        // Reset count-in state
        this.isCountInActive = false;
        this.countInBeats = 0;
        
        // Reset bar counter as requested
        this.barCount = 0;
        this.beatCount = 0;
        
        // Start regular metronome
        this.start();
        console.log('Count-in finished, starting regular metronome');
    }
    
    stopCountIn() {
        if (this.countInIntervalId) {
            clearTimeout(this.countInIntervalId);
            this.countInIntervalId = null;
        }
        
        this.isCountInActive = false;
        this.countInBeats = 0;
        
        console.log('Count-in stopped');
    }
    
    // Override stop method to handle count-in
    stop() {
        if (this.isCountInActive) {
            this.stopCountIn();
        }
        
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        this.currentBeat = 1;
        this.currentSubdivision = 0;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // Update UI when stopped
        if (this.onBeatChange) {
            this.onBeatChange();
        }
        
        console.log('Metronome stopped');
    }
    
    // Check if metronome is active (playing or count-in)
    isActive() {
        return this.isPlaying || this.isCountInActive;
    }
}

class UIController {
    constructor(metronomeCore) {
        this.core = metronomeCore;
        this.currentMode = 'advanced';
        this.isSimpleOptionsExpanded = false;
        
        // UI state
        this.draggedElement = null;
        this.dragOffset = { x: 0, y: 0 };
        this.isDragging = false;
        
        this.init();
    }
    
    init() {
        this.setupAdvancedModeControls();
        this.setupSharedControls();
        this.setupDragAndDrop();
        this.setupFeedbackModal();
        this.loadUserPreferences();
        
        // Set up beat change callback
        this.core.onBeatChange = () => {
            this.updateDisplay();
        };
        
        // Set up microphone callbacks
        this.core.onTempoDetected = (tempo, confidence) => {
            this.updateMicrophoneDisplay(tempo, confidence);
        };
        
        this.core.onMicrophoneError = (error) => {
            this.showMicrophoneError(error);
        };
        
        this.core.onVolumeUpdate = (volume) => {
            this.updateVolumeDisplay(volume);
        };
        
        this.updateDisplay();
        
        // Ensure time signature is properly initialized to 4/4
        this.core.setTimeSignature('4/4');
        this.updateDisplay();
        
        console.log('UIController initialized in advanced mode');
    }
    
    
    
    setupAdvancedModeControls() {
        // Metronome display click (retain existing functionality)
        const metronomeDisplay = document.getElementById('metronomeDisplay');
        if (metronomeDisplay) {
            metronomeDisplay.addEventListener('click', (e) => {
                // Only toggle if clicking on the display area, not the buttons
                if (e.target === metronomeDisplay || e.target.closest('.beat-visualization') || e.target.closest('.tempo-display')) {
                    this.core.togglePlayback();
                    this.updateDisplay();
                    this.updateMetronomeButtons();
                }
            });
        }

        
        // Initialize display mode and beat generation
        this.updateDisplayMode();
        
        // Load and apply saved settings to UI
        this.loadSettingsToUI();
        
        // Tempo controls (display)
        document.getElementById('tempoMinus10Display').addEventListener('click', () => {
            this.core.adjustTempo(-10);
            this.updateDisplay();
            this.core.saveSettings();
        });
        
        document.getElementById('tempoMinus1Display').addEventListener('click', () => {
            this.core.adjustTempo(-1);
            this.updateDisplay();
            this.core.saveSettings();
        });
        
        document.getElementById('tempoPlus1Display').addEventListener('click', () => {
            this.core.adjustTempo(1);
            this.updateDisplay();
            this.core.saveSettings();
        });
        
        document.getElementById('tempoPlus10Display').addEventListener('click', () => {
            this.core.adjustTempo(10);
            this.updateDisplay();
            this.core.saveSettings();
        });
        
        document.getElementById('tapTempoDisplay').addEventListener('click', () => {
            this.core.tapTempo();
            this.updateDisplay();
            this.core.saveSettings();
        });
        
        // Time signature
        document.getElementById('timeSignatureSelect').addEventListener('change', (e) => {
            this.core.setTimeSignature(e.target.value);
            this.generateBeatDots(); // Update simple mode dots
            this.generateBeatOptions(); // Update beat options
            this.updateDisplayMode(); // Update advanced dots
            this.updateDisplay();
            this.core.saveSettings();
        });
        
        // Subdivision controls
        document.querySelectorAll('.subdivision-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.subdivision-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.core.setSubdivision(e.target.dataset.subdivision);
                // Regenerate beat dots to show new subdivision pattern
                this.updateDisplayMode();
                this.updateDisplay();
                this.core.saveSettings();
            });
        });
        
        // Beat emphasis
        document.querySelectorAll('.emphasis-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateBeatEmphasis();
                this.core.saveSettings();
            });
        });
        
        // Preset buttons removed - only Beat 1 emphasis is available
        
        // Sound selection
        document.querySelectorAll('input[name="beatSound"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.core.setBeatSound(e.target.value);
                this.core.saveSettings();
            });
        });
        
        // Subdivision emphasis toggle
        document.getElementById('subdivisionEmphasisToggle').addEventListener('change', (e) => {
            this.core.playSubdivisionSounds = e.target.checked;
            this.updateDisplay();
            this.core.saveSettings();
        });
        
        // Display mode
        document.querySelectorAll('.display-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.display-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.core.setDisplayMode(e.target.dataset.display);
                this.updateDisplayMode();
                this.updateDisplay();
                this.core.saveSettings();
            });
        });
        
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('change', (e) => {
            this.toggleTheme(e.target.checked);
        });
        
        // Counter reset
        document.getElementById('counterResetBtn').addEventListener('click', () => {
            this.core.resetCounters();
            this.updateDisplay();
        });
        
        // Voice Commands
        document.getElementById('voiceToggle').addEventListener('click', () => {
            this.toggleVoiceRecognition();
        });
        
        document.getElementById('voiceHelpBtn').addEventListener('click', () => {
            this.showVoiceHelp();
        });
        
        // Silent pattern controls
        document.querySelectorAll('.pattern-mode-selector .mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.pattern-mode-selector .mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.core.setPatternMode(e.target.dataset.mode);
                
                const patternMode = document.getElementById('patternModeAdvanced');
                if (e.target.dataset.mode === 'pattern') {
                    patternMode.style.display = 'block';
                } else {
                    patternMode.style.display = 'none';
                }
            });
        });
        
        // Pattern inputs
        document.getElementById('activeBarsInput').addEventListener('change', (e) => {
            this.core.activeBars = parseInt(e.target.value);
            this.core.resetPattern();
        });
        
        document.getElementById('silentBarsPatternInput').addEventListener('change', (e) => {
            this.core.silentBarsPattern = parseInt(e.target.value);
            this.core.resetPattern();
        });
        
        // Microphone input controls
        this.setupMicrophoneControls();
        
        // Count-in controls
        this.setupCountInControls();
    }
    
    setupSharedControls() {
        // Audio context resume on user interaction
        document.addEventListener('click', () => {
            if (this.core.audioManager && this.core.audioManager.audioContext && 
                this.core.audioManager.audioContext.state === 'suspended') {
                this.core.audioManager.audioContext.resume();
            }
        }, { once: true });

        // Space bar support for metronome control (moved here for better production reliability)
        const handleSpaceBar = (e) => {
            // Check if space bar is pressed
            if (e.code === 'Space' || e.keyCode === 32 || e.key === ' ') {
                // Check if user is typing in a form field
                const activeElement = document.activeElement;
                const isFormField = activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.contentEditable === 'true' ||
                    activeElement.isContentEditable
                );
                
                // If user is typing in a form field, don't interfere
                if (isFormField) {
                    console.log('Space bar pressed in form field - allowing normal typing');
                    return true; // Allow normal space bar behavior
                }
                
                // Prevent default space bar behavior (page scrolling)
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Space bar pressed - toggling metronome');
                
                // Toggle metronome playback
                this.core.togglePlayback();
                this.updateDisplay();
                this.updateMetronomeButtons();
                
                return false;
            }
        };

        // Add event listener with multiple methods for better compatibility
        document.addEventListener('keydown', handleSpaceBar, true);
        window.addEventListener('keydown', handleSpaceBar, true);
        
        // Also add to body for extra coverage
        document.body.addEventListener('keydown', handleSpaceBar, true);
    }
    
    setupDragAndDrop() {
        // Advanced mode drag and drop for tiles
        document.querySelectorAll('.drag-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                this.startDrag(e, handle.parentElement);
            });
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.handleDrag(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.endDrag();
        });
    }
    
    startDrag(e, element) {
        this.isDragging = true;
        this.draggedElement = element;
        const rect = element.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        element.style.zIndex = '1000';
        element.style.position = 'absolute';
    }
    
    handleDrag(e) {
        if (this.draggedElement) {
            this.draggedElement.style.left = (e.clientX - this.dragOffset.x) + 'px';
            this.draggedElement.style.top = (e.clientY - this.dragOffset.y) + 'px';
        }
    }
    
    endDrag() {
        if (this.draggedElement) {
            this.draggedElement.style.zIndex = '';
            this.draggedElement.style.position = '';
            this.draggedElement.style.left = '';
            this.draggedElement.style.top = '';
        }
        this.isDragging = false;
        this.draggedElement = null;
    }
    
    
    updateBeatEmphasis() {
        const checkedBoxes = document.querySelectorAll('.emphasis-checkbox:checked');
        const emphasizedBeats = Array.from(checkedBoxes).map(cb => parseInt(cb.dataset.beat));
        this.core.setEmphasizedBeats(emphasizedBeats);
        
        // Regenerate advanced beat dots to show emphasis changes
        if (this.core.displayMode === 'dots' || this.core.displayMode === 'both') {
            this.generateAdvancedBeatDots();
        }
        
    }
    
    generateAdvancedBeatDots() {
        const advancedBeatDots = document.getElementById('advancedBeatDots');
        if (!advancedBeatDots) {
            console.warn('Advanced beat dots container not found');
            return;
        }
        
        advancedBeatDots.innerHTML = '';
        
        // Determine how many subdivisions per beat
        let subdivisionsPerBeat;
        switch (this.core.subdivision) {
            case 'eighth':
                subdivisionsPerBeat = 2;
                break;
            case 'sixteenth':
                subdivisionsPerBeat = 4;
                break;
            default: // quarter
                subdivisionsPerBeat = 1;
                break;
        }
        
        // Generate dots for each beat and subdivision
        for (let beat = 1; beat <= this.core.beatsPerBar; beat++) {
            for (let sub = 0; sub < subdivisionsPerBeat; sub++) {
                const dot = document.createElement('div');
                dot.className = 'beat-dot';
                dot.dataset.beat = beat;
                dot.dataset.subdivision = sub;
                
                // Main beat dots are larger and emphasized if selected
                if (sub === 0) {
                    dot.classList.add('main-beat');
                    if (this.core.emphasizedBeats.includes(beat)) {
                        dot.classList.add('emphasized');
                    }
                } else {
                    dot.classList.add('subdivision');
                    // Always show subdivision dots when subdivisions are being used (8th or 16th notes)
                    const hasSubdivisions = this.core.subdivision === 'eighth' || this.core.subdivision === 'sixteenth';
                    if (!hasSubdivisions) {
                        dot.style.display = 'none';
                    }
                }
                
                advancedBeatDots.appendChild(dot);
            }
        }
        
        console.log(`Generated ${this.core.beatsPerBar} beats with ${subdivisionsPerBeat} subdivisions each`);
    }
    
    updateDisplayMode() {
        const pulsingCircle = document.getElementById('pulsingCircle');
        const advancedBeatDots = document.getElementById('advancedBeatDots');
        
        if (!pulsingCircle || !advancedBeatDots) {
            console.warn('Display elements not found:', { pulsingCircle, advancedBeatDots });
            return;
        }
        
        // Reset display
        pulsingCircle.style.display = 'none';
        advancedBeatDots.style.display = 'none';
        
        console.log('Updating display mode to:', this.core.displayMode);
        
        switch (this.core.displayMode) {
            case 'circle':
                pulsingCircle.style.display = 'flex';
                console.log('Showing circle only');
                break;
            case 'dots':
                advancedBeatDots.style.display = 'flex';
                this.generateAdvancedBeatDots();
                console.log('Showing dots only');
                break;
            case 'both':
                pulsingCircle.style.display = 'flex';
                advancedBeatDots.style.display = 'flex';
                this.generateAdvancedBeatDots();
                console.log('Showing both circle and dots');
                break;
            default:
                pulsingCircle.style.display = 'flex';
                console.log('Default: showing circle only');
        }
    }
    
    updateDisplay() {
        // Update tempo displays
        const tempoValue = document.getElementById('tempoValue');
        if (tempoValue) tempoValue.textContent = this.core.tempo;
        
        // Update beat displays
        const beatNumber = document.getElementById('beatNumber');
        if (beatNumber) beatNumber.textContent = this.core.currentBeat;
        
        // Update advanced beat dots
        const advancedDots = document.querySelectorAll('#advancedBeatDots .beat-dot');
        console.log(`Found ${advancedDots.length} advanced dots, current beat: ${this.core.currentBeat}, subdivision: ${this.core.currentSubdivision}`);
        
        advancedDots.forEach((dot) => {
            const beat = parseInt(dot.dataset.beat);
            const subdivision = parseInt(dot.dataset.subdivision);
            
            // Check if this dot should be active
            const isActive = (beat === this.core.currentBeat && subdivision === this.core.currentSubdivision);
            dot.classList.toggle('active', isActive);
            
            // Always show subdivision dots when subdivisions are being used (8th or 16th notes)
            if (dot.classList.contains('subdivision')) {
                const hasSubdivisions = this.core.subdivision === 'eighth' || this.core.subdivision === 'sixteenth';
                dot.style.display = hasSubdivisions ? '' : 'none';
            }
        });
        
        // Update pulsing circle
        const pulsingCircle = document.getElementById('pulsingCircle');
        if (pulsingCircle) {
            // Remove all pulse classes first
            pulsingCircle.classList.remove('pulse', 'pulse-main', 'pulse-subdivision');
            
            if (this.core.isPlaying) {
                const isMainBeat = this.core.currentSubdivision === 0;
                
                if (isMainBeat) {
                    pulsingCircle.classList.add('pulse-main');
                } else {
                    // Always show subdivision pulses when subdivisions are active
                    pulsingCircle.classList.add('pulse-subdivision');
                }
            }
        }
        
        
        // Update counters (advanced mode)
        const barCount = document.getElementById('barCount');
        const beatCount = document.getElementById('beatCount');
        if (barCount) barCount.textContent = this.core.barCount;
        if (beatCount) beatCount.textContent = this.core.beatCount;
        
        // Update time signature
        const timeSignatureSelect = document.getElementById('timeSignatureSelect');
        if (timeSignatureSelect) {
            timeSignatureSelect.value = `${this.core.timeSignature.numerator}/${this.core.timeSignature.denominator}`;
        }
        
        // Update metronome button states
        this.updateMetronomeButtons();
    }
    
    toggleVoiceRecognition() {
        if (!this.core.isVoiceEnabled) {
            this.startVoiceRecognition();
        } else {
            this.stopVoiceRecognition();
        }
    }
    
    startVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Voice recognition is not supported in this browser. Please use Chrome or Safari.');
            return;
        }
        
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.core.voiceRecognition = new SpeechRecognition();
            
            this.core.voiceRecognition.continuous = true;
            this.core.voiceRecognition.interimResults = false;
            this.core.voiceRecognition.lang = 'en-US';
            
            this.core.voiceRecognition.onstart = () => {
                this.core.isVoiceEnabled = true;
                document.getElementById('voiceIndicator').classList.add('active');
                document.getElementById('voiceStatus').textContent = 'Listening...';
                console.log('Voice recognition started');
            };
            
            this.core.voiceRecognition.onresult = (event) => {
                const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
                console.log('Voice command received:', command);
                this.processVoiceCommand(command);
            };
            
            this.core.voiceRecognition.onerror = (event) => {
                console.warn('Voice recognition error:', event.error);
                document.getElementById('voiceStatus').textContent = `Error: ${event.error}`;
            };
            
            this.core.voiceRecognition.onend = () => {
                if (this.core.isVoiceEnabled) {
                    // Restart if still enabled
                    setTimeout(() => {
                        if (this.core.isVoiceEnabled) {
                            this.core.voiceRecognition.start();
                        }
                    }, 100);
                }
            };
            
            this.core.voiceRecognition.start();
            
        } catch (error) {
            console.error('Failed to start voice recognition:', error);
            alert('Failed to start voice recognition. Please check your microphone permissions.');
        }
    }
    
    stopVoiceRecognition() {
        if (this.core.voiceRecognition) {
            this.core.isVoiceEnabled = false;
            this.core.voiceRecognition.stop();
            document.getElementById('voiceIndicator').classList.remove('active');
            document.getElementById('voiceStatus').textContent = 'Voice recognition disabled';
        }
    }
    
    processVoiceCommand(command) {
        document.getElementById('voiceStatus').textContent = `Command: "${command}"`;
        
        // Tempo commands
        if (command.includes('tempo')) {
            const tempoMatch = command.match(/tempo (\d+)/);
            if (tempoMatch) {
                const newTempo = parseInt(tempoMatch[1]);
                this.core.setTempo(newTempo);
                this.updateDisplay();
                return;
            }
        }
        
        if (command.includes('faster')) {
            this.core.adjustTempo(10);
            this.updateDisplay();
            return;
        }
        
        if (command.includes('slower')) {
            this.core.adjustTempo(-10);
            this.updateDisplay();
            return;
        }
        
        // Control commands
        if (command.includes('start') || command.includes('play')) {
            if (!this.core.isPlaying) {
                this.core.start();
                this.updateDisplay();
            }
            return;
        }
        
        if (command.includes('stop')) {
            if (this.core.isPlaying) {
                this.core.stop();
                this.updateDisplay();
            }
            return;
        }
        
        // Time signature commands
        if (command.includes('time signature')) {
            const signatures = ['4/4', '3/4', '2/4', '6/8', '9/8', '12/8'];
            for (const sig of signatures) {
                if (command.includes(sig.replace('/', ' '))) {
                    this.core.setTimeSignature(sig);
                    this.updateDisplay();
                    return;
                }
            }
        }
        
        // Beat count commands
        const beatMatch = command.match(/(\d+) beats?/);
        if (beatMatch) {
            const beats = parseInt(beatMatch[1]);
            if (beats >= 1 && beats <= 12) {
                this.core.setBeatsPerBar(beats);
                this.updateDisplayMode(); // Regenerate advanced dots if needed
                this.updateDisplay();
                return;
            }
        }
        
        // Reset commands
        if (command.includes('reset')) {
            this.core.resetCounters();
            this.updateDisplay();
            return;
        }
        
        console.log('Unrecognized voice command:', command);
    }
    
    showVoiceHelp() {
        const helpText = `Voice Commands:
        
Tempo:
• "tempo 120" - Set specific tempo
• "faster" - Increase tempo by 10
• "slower" - Decrease tempo by 10

Control:
• "start" or "play" - Start metronome
• "stop" - Stop metronome

Time Signature:
• "time signature 3 4" - Set to 3/4
• "time signature 6 8" - Set to 6/8

Beat Count:
• "4 beats" - Set to 4 beats per bar
• "3 beats" - Set to 3 beats per bar

Other:
• "reset" - Reset counters`;
        
        alert(helpText);
    }
    
    loadUserPreferences() {
        // Load other preferences
        const savedTempo = localStorage.getItem('metronome-tempo');
        if (savedTempo) {
            this.core.setTempo(parseInt(savedTempo));
        }
        
        const savedBeats = localStorage.getItem('metronome-beats');
        if (savedBeats) {
            this.core.setBeatsPerBar(parseInt(savedBeats));
            // Regenerate advanced dots if needed
            this.updateDisplayMode();
        }
    }
    
    saveUserPreferences() {
        localStorage.setItem('metronome-mode', this.currentMode);
        localStorage.setItem('metronome-tempo', this.core.tempo.toString());
        localStorage.setItem('metronome-beats', this.core.beatsPerBar.toString());
    }
    
    toggleTheme(isDarkMode) {
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('metronome-theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('metronome-theme', 'light');
        }
    }
    
    loadTheme() {
        const savedTheme = localStorage.getItem('metronome-theme');
        const themeToggle = document.getElementById('themeToggle');
        
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            if (themeToggle) themeToggle.checked = true;
        } else {
            document.body.classList.remove('dark-mode');
            if (themeToggle) themeToggle.checked = false;
        }
    }
    
    setupMicrophoneControls() {
        // Microphone toggle button
        document.getElementById('microphoneToggle').addEventListener('click', () => {
            this.toggleMicrophoneListening();
        });
        
        // Microphone reset button
        document.getElementById('microphoneReset').addEventListener('click', () => {
            this.resetMicrophoneDetection();
        });
        
        // Sensitivity slider
        const sensitivitySlider = document.getElementById('sensitivitySlider');
        const sensitivityValue = document.getElementById('sensitivityValue');
        
        sensitivitySlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            sensitivityValue.textContent = value + '%';
            this.core.setMicrophoneSensitivity(value);
        });
        
        // Min interval input
        document.getElementById('minIntervalInput').addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            this.core.setMicrophoneMinInterval(value);
        });
        
        // Max interval input
        document.getElementById('maxIntervalInput').addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            this.core.setMicrophoneMaxInterval(value);
        });
        
        // Detection mode select
        document.getElementById('detectionModeSelect').addEventListener('change', (e) => {
            const mode = e.target.value;
            this.core.setMicrophoneDetectionMode(mode);
            console.log(`Detection mode changed to: ${mode}`);
        });
        
        // Onset detection slider
        const onsetSlider = document.getElementById('onsetSlider');
        const onsetValue = document.getElementById('onsetValue');
        
        onsetSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            onsetValue.textContent = value + '%';
            this.core.setMicrophoneOnsetThreshold(value / 100);
        });
        
        // Microphone help button
        document.getElementById('microphoneHelpBtn').addEventListener('click', () => {
            this.showMicrophoneHelp();
        });
        
        
        // Click to apply detected tempo
        document.getElementById('detectedTempoValue').addEventListener('click', () => {
            this.applyDetectedTempo();
        });
        
        // Initialize microphone display
        this.updateMicrophoneStatus();
        
        // Set default sensitivity
        this.core.setMicrophoneSensitivity(90);
    }
    
    async toggleMicrophoneListening() {
        if (this.core.isMicrophoneEnabled) {
            this.core.stopMicrophoneListening();
            this.updateMicrophoneStatus();
        } else {
            console.log('Attempting to start microphone listening...');
            console.log('Microphone input instance:', this.core.microphoneInput);
            console.log('Microphone input status:', this.core.getMicrophoneStatus());
            
            try {
                const success = await this.core.startMicrophoneListening();
                console.log('Start listening result:', success);
                if (success) {
                    console.log('Microphone listening started successfully');
                    this.updateMicrophoneStatus();
                } else {
                    console.error('Failed to start microphone listening');
                    this.showMicrophoneError('Failed to start microphone listening. Please check microphone permissions.');
                }
            } catch (error) {
                console.error('Error starting microphone listening:', error);
                this.showMicrophoneError('Failed to start microphone listening. Please check microphone permissions.');
            }
        }
    }
    
    resetMicrophoneDetection() {
        this.core.resetMicrophoneDetection();
        this.updateMicrophoneDisplay('--', '--');
        console.log('Microphone detection reset');
    }
    
    updateMicrophoneStatus() {
        const status = this.core.getMicrophoneStatus();
        const indicator = document.getElementById('microphoneIndicator');
        const toggleBtn = document.getElementById('microphoneToggle');
        
        if (status && status.isInitialized) {
            if (status.isListening) {
                indicator.classList.add('active');
                toggleBtn.textContent = 'Stop Listening';
                toggleBtn.classList.add('listening');
            } else {
                indicator.classList.remove('active');
                toggleBtn.textContent = 'Start Listening';
                toggleBtn.classList.remove('listening');
            }
        } else {
            indicator.classList.remove('active');
            toggleBtn.textContent = 'Start Listening';
            toggleBtn.disabled = false;
        }
    }
    
    updateMicrophoneDisplay(tempo, confidence) {
        const tempoValue = document.getElementById('detectedTempoValue');
        const confidenceValue = document.getElementById('confidenceValue');
        
        if (tempoValue) tempoValue.textContent = tempo;
        if (confidenceValue) confidenceValue.textContent = confidence;
        
        // Update status indicator to show activity
        const indicator = document.getElementById('microphoneIndicator');
        if (indicator) {
            indicator.classList.add('active');
            setTimeout(() => {
                if (!this.core.isMicrophoneEnabled) {
                    indicator.classList.remove('active');
                }
            }, 200);
        }
    }
    
    updateVolumeDisplay(volume) {
        const volumeFill = document.getElementById('volumeFill');
        const volumeValue = document.getElementById('volumeValue');
        
        if (volumeFill) {
            const percentage = Math.min(100, volume * 100);
            volumeFill.style.width = percentage + '%';
        }
        
        if (volumeValue) {
            volumeValue.textContent = (volume * 100).toFixed(1) + '%';
        }
    }
    
    showMicrophoneError(error) {
        console.error('Microphone error:', error);
        alert(`Microphone Error: ${error}`);
        
        // Update UI to show error state
        const indicator = document.getElementById('microphoneIndicator');
        const toggleBtn = document.getElementById('microphoneToggle');
        
        if (indicator) {
            indicator.classList.remove('active');
        }
        if (toggleBtn) {
            toggleBtn.textContent = 'Microphone Error';
            toggleBtn.disabled = true;
        }
    }
    
    applyDetectedTempo() {
        const status = this.core.getMicrophoneStatus();
        if (status && status.detectedTempo && status.detectedTempo !== 120) {
            const success = this.core.applyDetectedTempo(status.detectedTempo);
            if (success) {
                this.updateDisplay();
                console.log(`Applied detected tempo: ${status.detectedTempo} BPM`);
                
                // Show confirmation
                const tempoValue = document.getElementById('detectedTempoValue');
                if (tempoValue) {
                    const originalText = tempoValue.textContent;
                    tempoValue.textContent = 'Applied!';
                    tempoValue.style.color = '#4CAF50';
                    setTimeout(() => {
                        tempoValue.textContent = originalText;
                        tempoValue.style.color = '';
                    }, 1000);
                }
            }
        } else {
            alert('No valid tempo detected yet. Please start listening and provide audio input.');
        }
    }
    
    
    showMicrophoneHelp() {
        const helpText = `Enhanced Microphone Tempo Detection Help:

How it works:
• Click "Start Listening" to begin detecting beats
• Play music or tap near your microphone
• The system analyzes frequency content and rhythm patterns
• Detected tempo and confidence will be displayed

Instrument Detection Modes:
• Other: General purpose detection for any instrument (default)
• Drums: Optimized for percussive attacks and kick/snare
• Guitar: Tuned for mid-range frequencies and guitar sounds

Advanced Settings:
• Sensitivity: Overall volume threshold for beat detection
  - Higher = more sensitive (detects quieter sounds)
  - Lower = less sensitive (only detects loud sounds)
• Onset Detection: How sensitive to sudden audio changes
  - Higher = better for drums and percussive instruments
  - Lower = better for sustained instruments
• Min Beat Interval: Prevents detecting beats too close together
  - 100ms = max 600 BPM (default, good for fast music)
  - 200ms = max 300 BPM (for moderate tempos)
  - 500ms = max 120 BPM (for slow music)
• Max Beat Interval: Ignores beats too far apart
  - 2000ms = min 30 BPM (default, good for most music)
  - 1000ms = min 60 BPM (for faster music)
  - 5000ms = min 12 BPM (for very slow music)

Instrument-Specific Tips:
• Drums: Use "Drums" mode, higher sensitivity (70-90%)
• Guitar: Use "Guitar" mode, moderate sensitivity (60-80%)
• Other: Use "Other" mode for bass, piano, or mixed instruments

Best Results:
• Place microphone close to your instrument
• Use appropriate instrument mode for your instrument type
• Adjust sensitivity based on your playing volume
• Works best with clear, rhythmic playing

The detected tempo can be applied to your metronome by clicking the detected tempo value.`;
        
        alert(helpText);
    }
    
    setupCountInControls() {
        // Start with Count-In button
        document.getElementById('metronomeCountInBtn').addEventListener('click', () => {
            this.toggleCountIn();
        });
        
        // Update button states
        this.updateMetronomeButtons();
    }
    
    setupFeedbackModal() {
        console.log('Setting up feedback modal...');
        
        // Check if elements exist
        const feedbackBtn = document.getElementById('feedbackBtn');
        const feedbackModal = document.getElementById('feedbackModal');
        const feedbackClose = document.getElementById('feedbackClose');
        const feedbackCancel = document.getElementById('feedbackCancel');
        const feedbackForm = document.getElementById('feedbackForm');
        
        if (!feedbackBtn) {
            console.error('Feedback button not found!');
            return;
        }
        
        if (!feedbackModal) {
            console.error('Feedback modal not found!');
            return;
        }
        
        console.log('Feedback elements found, setting up event listeners...');
        
        // Feedback button
        feedbackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Feedback button clicked!');
            this.showFeedbackModal();
        });
        
        // Close button
        if (feedbackClose) {
            feedbackClose.addEventListener('click', () => {
                console.log('Close button clicked!');
                this.hideFeedbackModal();
            });
        }
        
        // Cancel button
        if (feedbackCancel) {
            feedbackCancel.addEventListener('click', () => {
                console.log('Cancel button clicked!');
                this.hideFeedbackModal();
            });
        }
        
        // Close modal when clicking outside
        feedbackModal.addEventListener('click', (e) => {
            if (e.target.id === 'feedbackModal') {
                console.log('Modal background clicked!');
                this.hideFeedbackModal();
            }
        });
        
        // Handle form submission
        if (feedbackForm) {
            feedbackForm.addEventListener('submit', (e) => {
                console.log('Form submitted!');
                this.handleFeedbackSubmission(e);
            });
        }
        
        console.log('Feedback modal setup complete!');
    }
    
    showFeedbackModal() {
        console.log('Showing feedback modal...');
        const modal = document.getElementById('feedbackModal');
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
            console.log('Modal displayed successfully');
        } else {
            console.error('Modal element not found!');
        }
    }
    
    hideFeedbackModal() {
        document.getElementById('feedbackModal').style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scrolling
        this.resetFeedbackForm();
    }
    
    resetFeedbackForm() {
        document.getElementById('feedbackForm').reset();
    }
    
    handleFeedbackSubmission(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const name = formData.get('name') || 'Anonymous';
        const email = formData.get('email') || 'No email provided';
        const message = formData.get('message');
        
        if (!message.trim()) {
            alert('Please enter your feedback message.');
            return;
        }
        
        // Show loading state
        const submitBtn = e.target.querySelector('.feedback-submit');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
        
        // Submit the form
        fetch('feedback.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.text())
        .then(data => {
            if (data.includes('success')) {
                alert('Thank you for your feedback! We appreciate your input.');
                this.hideFeedbackModal();
            } else {
                throw new Error('Server error');
            }
        })
        .catch(error => {
            console.error('Error submitting feedback:', error);
            alert('Sorry, there was an error sending your feedback. Please try again later.');
        })
        .finally(() => {
            // Restore button state
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        });
    }
    
    toggleCountIn() {
        if (this.core.isActive()) {
            this.core.stop();
            this.updateMetronomeButtons();
        } else {
            this.core.startCountIn();
            this.updateMetronomeButtons();
        }
    }
    
    updateMetronomeButtons() {
        const countInBtn = document.getElementById('metronomeCountInBtn');
        
        if (this.core.isCountInActive) {
            // Count-in is active, show counting-in button
            countInBtn.textContent = 'Counting-In';
            countInBtn.classList.add('counting-in');
        } else if (this.core.isPlaying) {
            // Metronome is playing, show stop button
            countInBtn.textContent = 'Stop Metronome';
            countInBtn.classList.add('stopped');
            countInBtn.classList.remove('counting-in');
        } else {
            // Metronome is stopped, show start button
            countInBtn.textContent = 'Start with Count-In';
            countInBtn.classList.remove('stopped', 'counting-in');
        }
    }
    
    loadSettingsToUI() {
        // Update tempo display
        this.updateDisplay();
        
        // Update time signature select
        const timeSignatureSelect = document.getElementById('timeSignatureSelect');
        if (timeSignatureSelect) {
            timeSignatureSelect.value = `${this.core.timeSignature.numerator}/${this.core.timeSignature.denominator}`;
        }
        
        // Update beat sound selection
        const beatSoundRadios = document.querySelectorAll('input[name="beatSound"]');
        beatSoundRadios.forEach(radio => {
            if (radio.value === this.core.beatSound) {
                radio.checked = true;
            }
        });
        
        // Update subdivision selection
        const subdivisionBtns = document.querySelectorAll('.subdivision-btn');
        subdivisionBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.subdivision === this.core.subdivision) {
                btn.classList.add('active');
            }
        });
        
        // Update microphone status
        this.updateMicrophoneStatus();
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Create metronome core
        const metronomeCore = new MetronomeCore();
        await metronomeCore.init();
        
        // Create UI controller
        const uiController = new UIController(metronomeCore);
        
        // Load saved theme
        uiController.loadTheme();
        
        // Make available globally for debugging
        window.metronome = metronomeCore;
        window.ui = uiController;
        
        // Add testing framework
        window.audioTest = new AudioStabilityTest(metronomeCore);
        
        // Add testing commands to console
        console.log('Audio stability testing available:');
        console.log('- window.audioTest.quickCheck() - Run quick stability check');
        console.log('- window.audioTest.runStabilityTest(30000) - Run full stability test (30 seconds)');
        
        // Save preferences when page unloads
        window.addEventListener('beforeunload', () => {
            uiController.saveUserPreferences();
        });
        
        console.log('Hathaway Metronome v10 initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize metronome:', error);
    }
});
