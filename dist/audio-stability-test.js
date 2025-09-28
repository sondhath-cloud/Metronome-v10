// Audio Stability Testing Framework for Metronome App
// Tests audio timing accuracy and stability across different conditions

class AudioStabilityTest {
    constructor(metronomeCore) {
        this.core = metronomeCore;
        this.testResults = [];
        this.isRunning = false;
        this.testDuration = 30000; // 30 seconds default
        this.expectedBeats = 0;
        this.actualBeats = 0;
        this.beatTimes = [];
        this.startTime = 0;
    }
    
    // Run comprehensive stability test
    async runStabilityTest(duration = 30000) {
        console.log('Starting audio stability test...');
        this.testDuration = duration;
        this.isRunning = true;
        this.testResults = [];
        this.beatTimes = [];
        this.actualBeats = 0;
        
        // Test different tempos
        const testTempos = [60, 120, 180, 240];
        
        for (const tempo of testTempos) {
            console.log(`Testing tempo: ${tempo} BPM`);
            await this.testTempoStability(tempo);
        }
        
        // Test different time signatures
        const testSignatures = ['4/4', '3/4', '6/8'];
        
        for (const signature of testSignatures) {
            console.log(`Testing time signature: ${signature}`);
            await this.testTimeSignatureStability(signature);
        }
        
        // Test performance under load
        await this.testPerformanceUnderLoad();
        
        this.isRunning = false;
        this.generateReport();
    }
    
    // Test tempo stability
    async testTempoStability(tempo) {
        this.core.setTempo(tempo);
        this.core.start();
        
        // Calculate expected beats
        const beatsPerSecond = tempo / 60;
        this.expectedBeats = Math.floor(beatsPerSecond * (this.testDuration / 1000));
        
        // Set up beat monitoring
        this.setupBeatMonitoring();
        
        // Run test
        await this.runTest();
        
        // Analyze results
        const accuracy = this.calculateAccuracy();
        const timingVariance = this.calculateTimingVariance();
        
        this.testResults.push({
            test: 'tempo_stability',
            tempo: tempo,
            expectedBeats: this.expectedBeats,
            actualBeats: this.actualBeats,
            accuracy: accuracy,
            timingVariance: timingVariance,
            passed: accuracy > 0.95 && timingVariance < 50
        });
        
        this.core.stop();
        this.cleanupBeatMonitoring();
    }
    
    // Test time signature stability
    async testTimeSignatureStability(signature) {
        this.core.setTimeSignature(signature);
        this.core.start();
        
        // Calculate expected beats
        const [numerator] = signature.split('/').map(Number);
        const beatsPerSecond = (this.core.tempo / 60) * numerator;
        this.expectedBeats = Math.floor(beatsPerSecond * (this.testDuration / 1000));
        
        // Set up beat monitoring
        this.setupBeatMonitoring();
        
        // Run test
        await this.runTest();
        
        // Analyze results
        const accuracy = this.calculateAccuracy();
        const timingVariance = this.calculateTimingVariance();
        
        this.testResults.push({
            test: 'time_signature_stability',
            signature: signature,
            expectedBeats: this.expectedBeats,
            actualBeats: this.actualBeats,
            accuracy: accuracy,
            timingVariance: timingVariance,
            passed: accuracy > 0.95 && timingVariance < 50
        });
        
        this.core.stop();
        this.cleanupBeatMonitoring();
    }
    
    // Test performance under load
    async testPerformanceUnderLoad() {
        console.log('Testing performance under load...');
        
        // Create CPU load
        const loadInterval = setInterval(() => {
            // Simulate CPU load
            for (let i = 0; i < 1000000; i++) {
                Math.random();
            }
        }, 100);
        
        // Run normal tempo test under load
        this.core.setTempo(120);
        this.core.start();
        
        const beatsPerSecond = 120 / 60;
        this.expectedBeats = Math.floor(beatsPerSecond * (this.testDuration / 1000));
        
        this.setupBeatMonitoring();
        await this.runTest();
        
        const accuracy = this.calculateAccuracy();
        const timingVariance = this.calculateTimingVariance();
        
        this.testResults.push({
            test: 'performance_under_load',
            expectedBeats: this.expectedBeats,
            actualBeats: this.actualBeats,
            accuracy: accuracy,
            timingVariance: timingVariance,
            passed: accuracy > 0.90 && timingVariance < 100
        });
        
        // Cleanup
        clearInterval(loadInterval);
        this.core.stop();
        this.cleanupBeatMonitoring();
    }
    
    // Set up beat monitoring
    setupBeatMonitoring() {
        this.actualBeats = 0;
        this.beatTimes = [];
        this.startTime = performance.now();
        
        // Override the core's beat change callback temporarily
        this.originalBeatCallback = this.core.onBeatChange;
        this.core.onBeatChange = () => {
            this.recordBeat();
            if (this.originalBeatCallback) {
                this.originalBeatCallback();
            }
        };
    }
    
    // Clean up beat monitoring
    cleanupBeatMonitoring() {
        if (this.originalBeatCallback) {
            this.core.onBeatChange = this.originalBeatCallback;
        }
    }
    
    // Record beat timing
    recordBeat() {
        this.actualBeats++;
        this.beatTimes.push(performance.now());
    }
    
    // Run test for specified duration
    async runTest() {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve();
            }, this.testDuration);
        });
    }
    
    // Calculate accuracy percentage
    calculateAccuracy() {
        if (this.expectedBeats === 0) return 0;
        return Math.min(1, this.actualBeats / this.expectedBeats);
    }
    
    // Calculate timing variance
    calculateTimingVariance() {
        if (this.beatTimes.length < 2) return 0;
        
        const intervals = [];
        for (let i = 1; i < this.beatTimes.length; i++) {
            intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
        }
        
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
        
        return Math.sqrt(variance);
    }
    
    // Generate test report
    generateReport() {
        console.log('\n=== AUDIO STABILITY TEST REPORT ===');
        
        let passedTests = 0;
        let totalTests = this.testResults.length;
        
        this.testResults.forEach(result => {
            const status = result.passed ? 'PASS' : 'FAIL';
            console.log(`${status} - ${result.test}: ${result.accuracy.toFixed(3)} accuracy, ${result.timingVariance.toFixed(1)}ms variance`);
            
            if (result.passed) passedTests++;
        });
        
        console.log(`\nOverall: ${passedTests}/${totalTests} tests passed`);
        
        if (passedTests === totalTests) {
            console.log('✅ All tests passed! Audio system is stable.');
        } else {
            console.log('⚠️ Some tests failed. Check audio system configuration.');
        }
        
        return {
            totalTests,
            passedTests,
            results: this.testResults
        };
    }
    
    // Quick stability check
    async quickCheck() {
        console.log('Running quick stability check...');
        
        this.core.setTempo(120);
        this.core.start();
        
        const beatsPerSecond = 2; // 120 BPM = 2 beats per second
        this.expectedBeats = Math.floor(beatsPerSecond * 10); // 10 seconds
        
        this.setupBeatMonitoring();
        await this.runTest();
        
        const accuracy = this.calculateAccuracy();
        const timingVariance = this.calculateTimingVariance();
        
        this.core.stop();
        this.cleanupBeatMonitoring();
        
        const passed = accuracy > 0.95 && timingVariance < 50;
        console.log(`Quick check: ${passed ? 'PASS' : 'FAIL'} (${accuracy.toFixed(3)} accuracy, ${timingVariance.toFixed(1)}ms variance)`);
        
        return passed;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioStabilityTest;
} else {
    window.AudioStabilityTest = AudioStabilityTest;
}
