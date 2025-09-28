# Hathaway Metronome v10 - Deployment Package

## Overview
This is a complete, self-contained metronome application ready for deployment. All files are included and the application is fully functional.

## Quick Start
1. Upload all files in this folder to your web server
2. Open `index.html` in a web browser
3. Grant microphone permissions when prompted (for voice commands and tempo detection)

## Features
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Multiple Time Signatures**: 4/4, 3/4, 2/4, 6/8, 9/8, 12/8, 5/4, 7/8, 5/8, 2/2, 3/8, 6/4
- **Subdivisions**: Quarter, eighth, and sixteenth notes
- **Voice Commands**: Control the metronome with your voice
- **Microphone Tempo Detection**: Tap or clap to detect tempo automatically
- **Count-In**: Text-to-speech count-in that matches your time signature
- **Multiple Beat Sounds**: Classic click, xylophone, bass guitar, drum, piano
- **Visual Displays**: Pulsing circle, beat dots, or both
- **Silent Patterns**: Create custom mute patterns
- **Dark Mode**: Toggle between light and dark themes
- **Feedback System**: Users can submit feedback directly through the app

## File Structure
```
dist/
├── index.html              # Main application file
├── style.css               # Styling and responsive design
├── script.js               # Main application logic
├── audio-manager.js        # Audio system and TTS
├── microphone-input.js     # Microphone tempo detection
├── audio-stability-test.js # Audio stability testing
├── feedback.php            # Feedback form handler (PHP)
├── README.md               # Project documentation
└── DEPLOYMENT.md           # This file
```

## Browser Requirements
- Modern web browser with JavaScript enabled
- Microphone access (for voice commands and tempo detection)
- Audio support (for metronome sounds)

## Deployment Notes
- All files are self-contained (no external dependencies)
- Uses programmatically generated audio (no external audio files)
- Responsive design adapts to different screen sizes
- Works offline after initial load

## Feedback System
The app includes a built-in feedback system that allows users to submit feedback directly through the interface:
- **Feedback Button**: Green button below the main title
- **Modal Form**: Opens when feedback button is clicked
- **Email Integration**: Uses `feedback.php` to send emails to configured address
- **Form Fields**: Name (optional), Email (optional), Message (required)
- **Email Recipient**: Configured to send to `sondhath@gmail.com`

### Feedback System Requirements
- PHP support on your web server
- Email functionality enabled (PHP mail() function)
- All files must be uploaded to the same directory

### Customizing Feedback Email
To change the feedback email recipient:
1. Open `feedback.php`
2. Find the line: `$to = 'sondhath@gmail.com';`
3. Change to your preferred email address
4. Save and re-upload the file

## Version
Hathaway Metronome v10 - Clean Distribution Package with Feedback System
Generated: December 2024
