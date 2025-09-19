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
        
        // Audio system
        this.audioManager = null;
        
        // UI callback
        this.onBeatChange = null;
        
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
        
        // Display
        this.displayMode = 'circle';
    }
    
    async init() {
        await this.setupAudioManager();
        console.log('MetronomeCore initialized');
    }
    
    async setupAudioManager() {
        this.audioManager = new AudioManager();
        await this.audioManager.init();
        console.log('Audio system ready:', this.audioManager.getAudioStatus());
    }
    
    // Core timing methods
    start() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.currentBeat = 1;
        this.resetPattern();
        
        const interval = (60 / this.tempo) * 1000;
        
        // Play first beat immediately
        this.playBeat();
        
        // Update UI for first beat
        if (this.onBeatChange) {
            this.onBeatChange();
        }
        
        // Set up interval for subsequent beats
        this.intervalId = setInterval(() => {
            this.nextBeat();
            this.playBeat();
        }, interval);
        
        console.log('Metronome started at', this.tempo, 'BPM');
    }
    
    stop() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        this.currentBeat = 1;
        
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
    
    togglePlayback() {
        if (this.isPlaying) {
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
        
        // Determine if this is an emphasized beat - only emphasize explicitly selected beats
        const isEmphasized = this.emphasizedBeats.includes(this.currentBeat);
        
        // Play the appropriate sound
        if (this.beatSound === 'classic') {
            this.playClassicClick(isEmphasized);
        } else {
            this.audioManager.playBeat(this.beatSound, this.currentBeat, isEmphasized);
        }
    }
    
    playClassicClick(isEmphasized = false) {
        const frequency = isEmphasized ? 1200 : 800;
        const volume = isEmphasized ? 0.8 : 0.6;
        
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
            this.stop();
            this.start();
        }
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
        this.loadUserPreferences();
        
        // Set up beat change callback
        this.core.onBeatChange = () => {
            this.updateDisplay();
        };
        
        this.updateDisplay();
        
        console.log('UIController initialized in advanced mode');
    }
    
    
    
    setupAdvancedModeControls() {
        // Metronome display click
        const metronomeDisplay = document.getElementById('metronomeDisplay');
        if (metronomeDisplay) {
            metronomeDisplay.addEventListener('click', () => {
                this.core.togglePlayback();
                this.updateDisplay();
            });
        }
        
        // Initialize display mode and beat generation
        this.updateDisplayMode();
        
        // Tempo controls
        document.getElementById('tempoMinus10').addEventListener('click', () => {
            this.core.adjustTempo(-10);
            this.updateDisplay();
        });
        
        document.getElementById('tempoMinus1').addEventListener('click', () => {
            this.core.adjustTempo(-1);
            this.updateDisplay();
        });
        
        document.getElementById('tempoPlus1').addEventListener('click', () => {
            this.core.adjustTempo(1);
            this.updateDisplay();
        });
        
        document.getElementById('tempoPlus10').addEventListener('click', () => {
            this.core.adjustTempo(10);
            this.updateDisplay();
        });
        
        document.getElementById('tapTempoAdvanced').addEventListener('click', () => {
            this.core.tapTempo();
            this.updateDisplay();
        });
        
        // Time signature
        document.getElementById('timeSignatureSelect').addEventListener('change', (e) => {
            this.core.setTimeSignature(e.target.value);
            this.generateBeatDots(); // Update simple mode dots
            this.generateBeatOptions(); // Update beat options
            this.updateDisplayMode(); // Update advanced dots
            this.updateDisplay();
        });
        
        // Subdivision controls
        document.querySelectorAll('.subdivision-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.subdivision-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.core.setSubdivision(e.target.dataset.subdivision);
            });
        });
        
        // Beat emphasis
        document.querySelectorAll('.emphasis-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateBeatEmphasis();
            });
        });
        
        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.applyEmphasisPreset(e.target.dataset.preset);
            });
        });
        
        // Sound selection
        document.querySelectorAll('input[name="beatSound"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.core.setBeatSound(e.target.value);
            });
        });
        
        // Display mode
        document.querySelectorAll('.display-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.display-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.core.setDisplayMode(e.target.dataset.display);
                this.updateDisplayMode();
                this.updateDisplay();
            });
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
    }
    
    setupSharedControls() {
        // Audio context resume on user interaction
        document.addEventListener('click', () => {
            if (this.core.audioManager && this.core.audioManager.audioContext && 
                this.core.audioManager.audioContext.state === 'suspended') {
                this.core.audioManager.audioContext.resume();
            }
        }, { once: true });
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
    
    applyEmphasisPreset(preset) {
        const checkboxes = document.querySelectorAll('.emphasis-checkbox');
        
        checkboxes.forEach(checkbox => {
            const beat = parseInt(checkbox.dataset.beat);
            
            switch (preset) {
                case 'all':
                    checkbox.checked = beat <= this.core.beatsPerBar;
                    break;
            }
        });
        
        this.updateBeatEmphasis();
    }
    
    generateAdvancedBeatDots() {
        const advancedBeatDots = document.getElementById('advancedBeatDots');
        if (!advancedBeatDots) {
            console.warn('Advanced beat dots container not found');
            return;
        }
        
        advancedBeatDots.innerHTML = '';
        
        for (let i = 1; i <= this.core.beatsPerBar; i++) {
            const dot = document.createElement('div');
            dot.className = 'beat-dot';
            dot.dataset.beat = i;
            
            // Check if this beat should be emphasized
            if (this.core.emphasizedBeats.includes(i)) {
                dot.classList.add('emphasized');
            }
            
            advancedBeatDots.appendChild(dot);
        }
        
        console.log(`Generated ${this.core.beatsPerBar} advanced beat dots`);
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
        console.log(`Found ${advancedDots.length} advanced dots, current beat: ${this.core.currentBeat}`);
        advancedDots.forEach((dot, index) => {
            const isActive = (index + 1) === this.core.currentBeat;
            dot.classList.toggle('active', isActive);
            if (isActive) {
                console.log(`Activating advanced dot ${index + 1}`);
            }
        });
        
        // Update pulsing circle
        const pulsingCircle = document.getElementById('pulsingCircle');
        if (pulsingCircle) {
            pulsingCircle.classList.toggle('pulse', this.core.isPlaying);
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
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Create metronome core
        const metronomeCore = new MetronomeCore();
        await metronomeCore.init();
        
        // Create UI controller
        const uiController = new UIController(metronomeCore);
        
        // Make available globally for debugging
        window.metronome = metronomeCore;
        window.ui = uiController;
        
        // Save preferences when page unloads
        window.addEventListener('beforeunload', () => {
            uiController.saveUserPreferences();
        });
        
        console.log('Hathaway Metronome v10 initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize metronome:', error);
    }
});
