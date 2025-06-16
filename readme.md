# Brusque's Music Study Web Application

This project is a web-based application designed to provide a suite of tools useful for music study and practice. It features a Random Note Generator, a Metronome, a Stopwatch with chime functionality, and an Audio Player. The application is built with HTML, CSS, and modern JavaScript, emphasizing modularity and user experience with features like theme toggling and persistent settings.

## Features

### General
- **Day/Night Mode**: Toggle between light and dark themes, with preference saved in local storage.
- **Collapsible Sections**: Each tool can be individually shown or hidden, with its state saved.
- **Keyboard Shortcuts**: Many functions across the tools are accessible via keyboard shortcuts.
- **Responsive Design**: Basic layout adapts to different screen sizes.

### 1. Random Note Generator
- Displays all 12 chromatic musical notes.
- Button to shuffle and re-display the notes in a random order.
- Keyboard shortcut `(N)` to generate notes.

### 2. Metronome
- Adjustable BPM (Beats Per Minute) via slider and number input (40-240 BPM).
- Visual beat indicator.
- Audio tick using Web Audio API (loads `tick.mp3`).
- Start/Stop functionality.
- Quick BPM adjustment buttons (-10, -5, -1, +1, +5, +10 BPM).
- BPM setting is saved in local storage.
- Keyboard shortcuts: `(M)` for Start/Stop, Arrow keys for BPM adjustment.

### 3. Stopwatch
- Standard Start/Pause/Reset functionality.
- Lap timer: Record and display multiple lap times.
- **Chime Feature**:
    - Set an interval (in seconds) for an audible chime to play.
    - Uses Web Audio API (loads `chime.mp3`).
    - Chime interval is saved in local storage.
- Time display format: `HH:MM:SS.mmm`.
- Keyboard shortcuts: `(Space)` for Start/Pause, `(L)` for Lap, `(K)` for Reset.

### 4. Audio Player
- **Playlist Management**:
    - Add one or more audio tracks from local files.
    - Display tracks in a playlist.
    - Reorder tracks (move up/down).
    - Remove tracks from the playlist.
- **Playback Controls**: Play/Pause, Stop, Next Track, Previous Track.
- **Progress Bar**: Visual progress and clickable seeking.
- **Time Display**: Current time and total duration of the track.
- **Volume Control**: Slider to adjust volume (dB scale), saved in local storage.
- **Playback Speed Control**:
    - Adjust speed as a multiplier (e.g., 0.5x to 2.0x).
    - If a track name contains "BPM" (e.g., "MySong 120BPM.mp3"), the speed control switches to BPM mode for that track, allowing direct BPM adjustment.
    - Speed settings (both global multiplier and per-track BPM/multiplier) are saved in local storage.
    - Pitch preservation is attempted during speed changes.
- **Looping**:
    - Toggle loop for the current track.
    - Toggle loop for the entire playlist.
    - Loop settings saved in local storage.
- **Silence Interval**: Set a silence duration (in seconds) to play between tracks when not looping playlist. Saved in local storage.
- **Track Information Display**: Shows current track number, total tracks, and track name.
- Keyboard shortcuts for most controls (Add Tracks `(T)`, Play/Pause `(C)`, Stop `(X)`, Next `(V)`, Previous `(Z)`, Volume `(W/E)`, Speed `(Q/R)`, Seek `(A/S/D/F)`).

## How to Run

1.  Ensure all project files (`index.html`, `style.css`, `script.js`, and the `js/` directory with its contents, plus `tick.mp3` and `chime.mp3`) are in the same directory structure.
2.  Open `index.html` in a modern web browser (Chrome, Firefox, Edge, Opera, Brave).

## Technologies Used
- HTML5
- CSS3
- JavaScript (ES6 Modules)
- Web Audio API


## Changelog

### 20250609 1005

* Added the "Clear Playlist" button to the Audio Player.


### 20250606 1234

* Solved some issues with "silence after track" when Loop Track was selected when page loaded.


### 20250606 1105

* Added the About section.


### 20250606 1035

* Trying to preload tick.mp3 and chime.mp3 to reduce delay between clicking start and metronome/stopwatch actually starting.

* Adjusted "Silence after track:" field size.


### 20250605 1844

* Audio Player: Improvement: Bigger control buttons.

* Audio Player: Bug fix: "Loop Track" and "Loop Playlist" options could be selected simultaneously.

* Metronome: Bug fix: "Metronome AudioContext not ready or suspended." when clicking Start the first time.

* Stopwatch: Bug fix: "Stopwatch: Chime audio not ready, cannot schedule chime yet." when starting the first time.


### 20250605 - Initial Release



# TO DO


* Use file hash as identifier on the local storage instead of fileName.

* Include the option of playing a file multiple times.

