# Hathaway Metronome v10 - Distribution Package

## Overview
This is a complete, self-contained metronome application with advanced features including voice commands, microphone tempo detection, and multiple time signatures.

## Features
- **Hybrid Interface**: Simple and advanced modes
- **Multiple Time Signatures**: 4/4, 3/4, 2/4, 6/8, 9/8, 12/8, 5/4, 7/8, 5/8, 2/2, 3/8, 6/4
- **Subdivisions**: Quarter, eighth, and sixteenth notes
- **Voice Commands**: Control the metronome with your voice
- **Microphone Tempo Detection**: Tap or clap to detect tempo automatically
- **Count-In**: Text-to-speech count-in that matches your time signature
- **Multiple Beat Sounds**: Classic click, xylophone, bass guitar, drum, piano
- **Visual Displays**: Pulsing circle, beat dots, or both
- **Silent Patterns**: Create custom mute patterns
- **Dark Mode**: Toggle between light and dark themes
- **Responsive Design**: Works on desktop and mobile devices

## Installation
1. Download all files in this folder
2. Upload to your web server root directory
3. Open `index.html` in a web browser
4. Grant microphone permissions when prompted (for voice commands and tempo detection)

## Browser Requirements
- Modern web browser with JavaScript enabled
- Microphone access (for voice commands and tempo detection)
- Audio support (for metronome sounds)

## File Structure
```
dist/
├── index.html          # Main application file
├── style.css           # Styling and responsive design
├── script.js           # Main application logic
├── audio-manager.js    # Audio system and TTS
├── microphone-input.js # Microphone tempo detection
├── test.html           # Server diagnostic tool
└── README.md           # This file
```

## Usage
1. **Basic Metronome**: Click the tempo display or use +/- buttons to adjust tempo
2. **Start/Stop**: Click "Start with Count-In" to begin with a count-in, or use the display area
3. **Time Signature**: Select from the dropdown menu
4. **Voice Commands**: Click "Voice Commands" and say commands like "tempo 120", "start", "stop"
5. **Microphone Detection**: Click "Start Listening" and clap/tap to detect tempo
6. **Subdivisions**: Choose quarter, eighth, or sixteenth note subdivisions
7. **Visual Display**: Switch between pulsing circle, beat dots, or both
8. **Dark Mode**: Toggle the dark mode switch

## Voice Commands
- "tempo 120" - Set specific tempo
- "faster" / "slower" - Adjust tempo by 10 BPM
- "start" / "play" - Start metronome
- "stop" - Stop metronome
- "time signature 3 4" - Set time signature
- "4 beats" - Set beats per bar
- "reset" - Reset counters

## Troubleshooting
- **No Sound**: Check browser audio permissions and volume
- **Microphone Not Working**: Ensure microphone permissions are granted
- **Voice Commands Not Working**: Use Chrome or Safari for best compatibility
- **Count-In Wrong**: Make sure time signature is set correctly before starting

## Version
Hathaway Metronome v10 - Hybrid Simple/Advanced Interface

## License
This software is provided as-is for personal and educational use.