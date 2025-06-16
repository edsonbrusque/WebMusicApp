import { formatAudioTime, linearToDb, dbToLinear, MIN_DB, MAX_DB } from './utils.js';

/**
 * Initializes the Audio Player UI, event listeners, and state management.
 * Handles playlist, playback, speed, volume, and keyboard shortcuts.
 */
export function initAudioPlayer() {
    console.log("Initialising Audio Player...");

    // --- DOM Elements ---
    const fileInput = document.getElementById('audio-player-file-input');
    const addTracksLabel = document.getElementById('audio-player-add-tracks-label');
    const playlistElement = document.getElementById('audio-player-playlist');
    const combinedTrackInfoDisplay = document.getElementById('audio-player-combined-track-info');
    const currentTimeDisplay = document.getElementById('audio-player-current-time');
    const totalTimeDisplay = document.getElementById('audio-player-total-time');
    const progressBar = document.getElementById('audio-player-progress-bar');
    const prevBtn = document.getElementById('audio-player-prevBtn');
    const playPauseBtn = document.getElementById('audio-player-playPauseBtn');
    const stopBtn = document.getElementById('audio-player-stopBtn');
    const nextBtn = document.getElementById('audio-player-nextBtn');
    const volumeSlider = document.getElementById('audio-player-volume-slider');
    const silenceIntervalInput = document.getElementById('audio-player-silence-interval');
    const speedSlider = document.getElementById('audio-player-speed-slider');
    const volumeDbDisplay = document.getElementById('audio-player-volume-db-display');
    const speedDisplay = document.getElementById('audio-player-speed-display');
    const loopTrackToggle = document.getElementById('audio-player-loop-track-toggle');
    const loopPlaylistToggle = document.getElementById('audio-player-loop-playlist-toggle');
    const audioElement = document.getElementById('audio-player-element');
    const clearPlaylistBtn = document.getElementById('audio-player-clear-playlist-btn');

    // --- State Variables ---
    // Playlist items: { file: File, name: string, url: string, duration: number, originalBPM?: number, userSetSpeed?: number }
    // userSetSpeed: target BPM if originalBPM exists, otherwise playback rate multiplier.
    let playlist = [];
    let currentTrackIndex = -1;
    let isPlaying = false;
    let silenceTimerId = null; // To manage the silence timeout
    let silenceCountdownIntervalId = null; // To manage the UI countdown for silence
    let currentSilenceIntervalMs = 0; // Silence interval in milliseconds
    let currentSpeedMode = 'multiplier'; // 'bpm' or 'multiplier'

    const PLAY_ICON = '▶️';
    const PAUSE_ICON = '⏸️';
    const LOCAL_STORAGE_VOLUME_KEY = 'audioPlayerVolume';
    const LOCAL_STORAGE_SPEED_KEY = 'audioPlayerSpeedMultiplier'; // Stores last used multiplier
    const LOCAL_STORAGE_LOOP_TRACK_KEY = 'audioPlayerLoopTrack';
    const LOCAL_STORAGE_LOOP_PLAYLIST_KEY = 'audioPlayerLoopPlaylist';
    const LOCAL_STORAGE_TRACK_SPEED_PREFIX = 'audioPlayerTrackSpeed_'; // Prefix for individual track speeds
    const DEFAULT_DB = -6;
    const BPM_SLIDER_MIN = 40;
    const BPM_SLIDER_MAX = 300;
    const MULTIPLIER_SLIDER_MIN = 0.5;
    const MULTIPLIER_SLIDER_MAX = 2.0;

    const LOCAL_STORAGE_SILENCE_KEY = 'audioPlayerSilenceInterval';

    // --- Playlist Management ---
    /**
     * Render the playlist UI based on the current playlist state.
     */
    function renderPlaylist() {
        playlistElement.innerHTML = '';
        if (playlist.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Playlist is empty. Add some tracks!';
            li.classList.add('empty-playlist-message');
            playlistElement.appendChild(li);
        } else {
            playlist.forEach((track, index) => {
                const li = document.createElement('li');
                li.classList.toggle('playing', index === currentTrackIndex);
                li.dataset.index = index;

                const trackNameSpan = document.createElement('span');
                let trackDisplayText = `${index + 1}. ${track.name}`;
                if (track.originalBPM && typeof track.userSetSpeed === 'number') {
                    const displayBPM = Math.round(track.userSetSpeed);
                    trackDisplayText += ` [${displayBPM}/${track.originalBPM} BPM]`;
                } else if (typeof track.userSetSpeed === 'number') {
                    trackDisplayText += ` [${track.userSetSpeed.toFixed(2)}x]`;
                }
                trackNameSpan.textContent = trackDisplayText;

                trackNameSpan.classList.add('track-item-name');
                trackNameSpan.addEventListener('click', () => {
                    loadAndPlayTrack(index);
                });

                const controlsDiv = document.createElement('div');
                controlsDiv.classList.add('playlist-item-controls');

                const upBtn = document.createElement('button');
                upBtn.textContent = '↑';
                upBtn.title = 'Move Up';
                upBtn.disabled = index === 0;
                upBtn.addEventListener('click', (e) => { e.stopPropagation(); moveTrack(index, -1); });

                const downBtn = document.createElement('button');
                downBtn.textContent = '↓';
                downBtn.title = 'Move Down';
                downBtn.disabled = index === playlist.length - 1;
                downBtn.addEventListener('click', (e) => { e.stopPropagation(); moveTrack(index, 1); });

                const removeBtn = document.createElement('button');
                removeBtn.textContent = '✕';
                removeBtn.title = 'Remove';
                removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeTrack(index); });

                controlsDiv.appendChild(upBtn);
                controlsDiv.appendChild(downBtn);
                controlsDiv.appendChild(removeBtn);

                li.appendChild(trackNameSpan);
                li.appendChild(controlsDiv);
                playlistElement.appendChild(li);
            });
        }
        updateCombinedTrackInfo();
    }

    /**
     * Parse a filename for a BPM value (e.g., "120BPM").
     * @param {string} filename
     * @returns {number|undefined}
     */
    function parseBPMFromName(filename) {
        const bpmRegex = /(\d+)BPM/i; // Matches "100BPM", case insensitive
        const match = filename.match(bpmRegex);
        if (match && match[1]) {
            const bpm = parseInt(match[1], 10);
            if (bpm >= BPM_SLIDER_MIN && bpm <= BPM_SLIDER_MAX) return bpm; // Ensure parsed BPM is within a sensible range
        }
        return undefined;
    }

    /**
     * Add new tracks to the playlist from file input.
     * @param {Event} event
     */
    function handleFileSelect(event) {
        const files = Array.from(event.target.files);
        const newTracks = files.map(file => {
            const originalBPM = parseBPMFromName(file.name);
            const trackStorageKey = LOCAL_STORAGE_TRACK_SPEED_PREFIX + file.name;
            const savedUserSpeedString = localStorage.getItem(trackStorageKey);
            let userSetSpeed;

            if (savedUserSpeedString !== null) {
                const savedSpeed = parseFloat(savedUserSpeedString);
                if (!isNaN(savedSpeed)) {
                    if (originalBPM) { // If it's a BPM track
                        // Ensure saved speed is within BPM range, otherwise default to originalBPM
                        userSetSpeed = (savedSpeed >= BPM_SLIDER_MIN && savedSpeed <= BPM_SLIDER_MAX) ? savedSpeed : originalBPM;
                    } else { // If it's a multiplier track
                        // Ensure saved speed is within multiplier range, otherwise default to 1.0x
                        userSetSpeed = (savedSpeed >= MULTIPLIER_SLIDER_MIN && savedSpeed <= MULTIPLIER_SLIDER_MAX) ? savedSpeed : 1.0;
                    }
                } else { // Invalid saved string, fallback
                    userSetSpeed = originalBPM ? originalBPM : 1.0;
                }
            } else { // No saved speed for this track, use default
                userSetSpeed = originalBPM ? originalBPM : 1.0;
            }

            return {
                file: file, name: file.name, url: URL.createObjectURL(file), duration: 0, // Will be updated on loadedmetadata
                originalBPM: originalBPM,
                userSetSpeed: userSetSpeed
            };
        });
        playlist.push(...newTracks);
        renderPlaylist();
        if (currentTrackIndex === -1 && playlist.length > 0) {
            loadTrack(0);
        }
        fileInput.value = ''; // Reset file input
    }

    /**
     * Remove a track from the playlist by index.
     * @param {number} index
     */
    function removeTrack(index) {
        if (index < 0 || index >= playlist.length) return;
        URL.revokeObjectURL(playlist[index].url); // Clean up
        playlist.splice(index, 1);

        if (playlist.length === 0) {
            currentTrackIndex = -1;
            stopPlayback(true); // Full stop and clear display
        } else if (index === currentTrackIndex) {
            if (index >= playlist.length) { // If last track was removed
                currentTrackIndex = playlist.length - 1;
            }
            loadTrack(currentTrackIndex, isPlaying); // Reload current or new current, maintain play state
        } else if (index < currentTrackIndex) {
            currentTrackIndex--;
        }
        renderPlaylist();
    }

    /**
     * Move a track up or down in the playlist.
     * @param {number} index
     * @param {number} direction -1 for up, 1 for down
     */
    function moveTrack(index, direction) { // direction: -1 for up, 1 for down
        if (index < 0 || index >= playlist.length) return;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= playlist.length) return;

        [playlist[index], playlist[newIndex]] = [playlist[newIndex], playlist[index]];

        if (index === currentTrackIndex) {
            currentTrackIndex = newIndex;
        } else if (newIndex === currentTrackIndex) {
            currentTrackIndex = index;
        }
        renderPlaylist();
    }

    /**
     * Clear the entire playlist and reset the player.
     */
    function clearPlaylist() {
        stopPlayback(true); // Full stop, clear display, reset speed slider to default multiplier

        // Revoke object URLs for all tracks in the current playlist before clearing
        playlist.forEach(track => {
            if (track.url) URL.revokeObjectURL(track.url);
        });

        playlist = []; // Empty the playlist array
        renderPlaylist(); // Re-render to show "Playlist is empty"
    }

    // --- Playback Logic ---
    /**
     * Load a track by index and optionally start playback.
     * @param {number} index
     * @param {boolean} [shouldPlay=false]
     */
    function loadTrack(index, shouldPlay = false) {
        clearSilenceTimeout(); // Always clear previous silence timer when attempting to load/change track.

        if (playlist.length === 0) {
            // No tracks to load. Ensure player is fully stopped and UI reflects empty state.
            // stopPlayback(true) also sets currentTrackIndex = -1.
            stopPlayback(true);
            return;
        }

        if (index < 0 || index >= playlist.length) {
            // Caller provided an invalid index for a non-empty playlist.
            // This implies an issue or an unhandled edge case by the caller.
            // `nextTrack` and `previousTrack` should handle looping and provide a valid index.
            // If they don't, or if `loadTrack` is called from elsewhere with a bad index, stop.
            console.warn(`AudioPlayer: loadTrack called with invalid index ${index} for playlist of length ${playlist.length}. Stopping playback.`);
            stopPlayback(true); // This sets currentTrackIndex = -1.
            return;
        }

        // At this point, index is valid (0 <= index < playlist.length)
        currentTrackIndex = index;

        // If the original code reached here after looping, currentTrackIndex would be set.
        // If it reached here because index was valid, currentTrackIndex would be set.
        // The following lines remain the same.

        const track = playlist[currentTrackIndex];
        audioElement.src = track.url;
        audioElement.load(); // Important for some browsers
        // trackNameDisplay.textContent = track.name; // Replaced by updateCombinedTrackInfo
        progressBar.value = 0;
        currentTimeDisplay.textContent = formatAudioTime(0);
        totalTimeDisplay.textContent = formatAudioTime(track.duration || 0); // Use stored if available

        configureAndApplySpeed(track);

        if (shouldPlay) {
            audioElement.play().catch(e => console.error("Error playing track:", e));
        }
        updateCombinedTrackInfo();
        renderPlaylist(); // To highlight the current track
        updatePlayPauseButton();
    }

    function clearSilenceTimeout() {
        if (silenceTimerId) clearTimeout(silenceTimerId);
        if (silenceCountdownIntervalId) clearInterval(silenceCountdownIntervalId);
        silenceTimerId = null;
        silenceCountdownIntervalId = null;
        // If a countdown was active, ensure the display is reset to normal track info
        // This will be called if stopPlayback or loadTrack happens during silence.
        if (combinedTrackInfoDisplay.textContent.startsWith("Pausing for")) {
            updateCombinedTrackInfo();
        }
    }

    function startSilenceCountdownDisplay(durationMs) {
        if (silenceCountdownIntervalId) clearInterval(silenceCountdownIntervalId); // Clear previous if any

        let endTime = Date.now() + durationMs;

        function updateCountdown() {
            const remainingMs = Math.max(0, endTime - Date.now());
            const remainingSeconds = (remainingMs / 1000).toFixed(1);
            combinedTrackInfoDisplay.textContent = `Pausing for ${remainingSeconds}s...`;

            if (remainingMs === 0) {
                clearInterval(silenceCountdownIntervalId);
                silenceCountdownIntervalId = null;
                // Now that the countdown is officially over and its state variable is cleared,
                // update the track info display. This is crucial for "Loop Track" with silence.
                updateCombinedTrackInfo();
            }
        }
        updateCountdown(); // Initial display
        silenceCountdownIntervalId = setInterval(updateCountdown, 100); // Update every 100ms
    }

    /**
     * Load and play a track by index.
     * @param {number} index
     */
    function loadAndPlayTrack(index) {
        loadTrack(index, true);
    }

    function playPause() {
        if (currentTrackIndex === -1 && playlist.length > 0) {
            loadAndPlayTrack(0);
            return;
        }
        if (!audioElement.src) return;

        if (audioElement.paused) {
            audioElement.play().catch(e => console.error("Error playing audio:", e));
        } else {
            audioElement.pause();
        }
    }

    function stopPlayback(clearDisplay = false) {
        clearSilenceTimeout(); // Clear timeout on stop
        audioElement.pause();
        audioElement.currentTime = 0;
        progressBar.value = 0;
        if (clearDisplay) {
            currentTrackIndex = -1; // Indicate no track is active
            updateCombinedTrackInfo(); // This will set the appropriate "No track loaded" or "Playlist empty" message
            // currentTimeDisplay and totalTimeDisplay are reset by loadTrack if a new track is loaded, or remain if just stopping.
            renderPlaylist();

            // When playlist becomes empty and display is cleared, revert speed slider to 1.0x multiplier default.
            // This does not change the stored global default speed, only the current UI state.
            currentSpeedMode = 'multiplier';
            speedSlider.min = MULTIPLIER_SLIDER_MIN;
            speedSlider.max = MULTIPLIER_SLIDER_MAX;
            speedSlider.step = 0.01;
            const defaultMultiplierWhenEmpty = 1.0;
            speedSlider.value = defaultMultiplierWhenEmpty;
            audioElement.playbackRate = defaultMultiplierWhenEmpty; // Set on audio element for consistency
            speedDisplay.textContent = `${defaultMultiplierWhenEmpty.toFixed(2)}x`;

        }
        updatePlayPauseButton();
    }

    function nextTrack() {
        if (playlist.length === 0) return;
        let newIndex = currentTrackIndex + 1;
        if (newIndex >= playlist.length) {
            if (loopPlaylistToggle.checked) {
                newIndex = 0;
            } else {
                stopPlayback(false); // Stop at end of playlist if not looping
                return;
            }
        }
        loadAndPlayTrack(newIndex);
    }

    function previousTrack() {
        if (playlist.length === 0) return;
        // If more than 3 seconds in, restart current track, else go to previous
        if (audioElement.currentTime > 3 && currentTrackIndex !== -1) {
            audioElement.currentTime = 0;
            if (!isPlaying) playPause(); // If paused, start playing from beginning
        } else {
            let newIndex = currentTrackIndex - 1;
            if (newIndex < 0) {
                if (loopPlaylistToggle.checked) {
                    newIndex = playlist.length - 1;
                } else {
                    if (playlist.length > 0) loadAndPlayTrack(0); // Go to first track if not looping
                    return;
                }
            }
            loadAndPlayTrack(newIndex);
        }
    }

    /**
     * Set the audio volume and update the UI.
     * @param {number} linearValue
     * @param {boolean} [updateSlider=true]
     */
    function setAudioVolume(linearValue, updateSlider = true) {
        const clampedLinear = Math.max(0, Math.min(1, linearValue));
        audioElement.volume = clampedLinear;
        localStorage.setItem(LOCAL_STORAGE_VOLUME_KEY, clampedLinear.toString());

        const dbValue = linearToDb(clampedLinear);
        if (updateSlider) {
            volumeSlider.value = dbValue;
        }
        if (volumeDbDisplay) {
            volumeDbDisplay.textContent = `${dbValue} dB`;
        }
    }

    /**
     * Configure and apply playback speed for a track.
     * @param {object|null} track
     * @param {number} [newSpeedValue]
     */
    function configureAndApplySpeed(track, newSpeedValue) {
        if (!track) { // Initial setup or no track loaded
            currentSpeedMode = 'multiplier';
            speedSlider.min = MULTIPLIER_SLIDER_MIN;
            speedSlider.max = MULTIPLIER_SLIDER_MAX;
            speedSlider.step = 0.01;
            // Global default multiplier is always 1.0x when no track is loaded or for initial setup.
            // LOCAL_STORAGE_SPEED_KEY is not used for this default.
            const initialMultiplier = 1.0;
            speedSlider.value = initialMultiplier;
            audioElement.playbackRate = initialMultiplier;
            speedDisplay.textContent = `${initialMultiplier.toFixed(2)}x`;
            return;
        }

        if (typeof newSpeedValue === 'number') {
            track.userSetSpeed = newSpeedValue;
        }

        // track.userSetSpeed should be initialized by handleFileSelect (from localStorage or defaults)
        // or updated by user interaction (newSpeedValue).
        // If for some reason track.userSetSpeed is undefined here (e.g. direct call without prior init),
        // we might need a fallback, but current flow should ensure it's set.
        // For safety, let's ensure it has a value if newSpeedValue wasn't provided.
        if (typeof track.userSetSpeed === 'undefined') track.userSetSpeed = track.originalBPM ? track.originalBPM : 1.0;
        let targetSpeed = track.userSetSpeed;

        if (track.originalBPM) {
            currentSpeedMode = 'bpm';
            speedSlider.min = BPM_SLIDER_MIN;
            speedSlider.max = BPM_SLIDER_MAX;
            speedSlider.step = 1;

            targetSpeed = Math.max(BPM_SLIDER_MIN, Math.min(BPM_SLIDER_MAX, targetSpeed));
            track.userSetSpeed = targetSpeed; // Update track with clamped value

            audioElement.playbackRate = track.originalBPM > 0 ? (targetSpeed / track.originalBPM) : 1.0;
            speedSlider.value = targetSpeed;
            speedDisplay.textContent = `${Math.round(targetSpeed)} BPM`;
        } else {
            currentSpeedMode = 'multiplier';
            speedSlider.min = MULTIPLIER_SLIDER_MIN;
            speedSlider.max = MULTIPLIER_SLIDER_MAX;
            speedSlider.step = 0.01;

            targetSpeed = Math.max(MULTIPLIER_SLIDER_MIN, Math.min(MULTIPLIER_SLIDER_MAX, targetSpeed));
            track.userSetSpeed = targetSpeed; // Update track with clamped value

            audioElement.playbackRate = targetSpeed;
            speedSlider.value = targetSpeed;
            speedDisplay.textContent = `${targetSpeed.toFixed(2)}x`;
            localStorage.setItem(LOCAL_STORAGE_SPEED_KEY, targetSpeed.toString());
        }

        // Save the specific track's userSetSpeed regardless of mode
        if (track && track.name) { // track.name should always exist here
            const trackStorageKey = LOCAL_STORAGE_TRACK_SPEED_PREFIX + track.name;
            localStorage.setItem(trackStorageKey, track.userSetSpeed.toString());
        }
        audioElement.preservesPitch = true; // Attempt to preserve pitch
    }

    // This function is now a wrapper or will be replaced by direct calls to configureAndApplySpeed
    // For now, let's ensure existing calls to setSpeed are handled, though they should be refactored.
    function setSpeed(value) { /* Deprecated or needs careful refactoring. configureAndApplySpeed is preferred */ }

    function updateSilenceInterval() {
        const intervalSeconds = parseFloat(silenceIntervalInput.value);
        if (!isNaN(intervalSeconds) && intervalSeconds >= 0) {
            currentSilenceIntervalMs = intervalSeconds * 1000;
            localStorage.setItem(LOCAL_STORAGE_SILENCE_KEY, intervalSeconds.toString());
        } else {
            currentSilenceIntervalMs = 0; // Invalid input or negative
        }
    }

    // --- UI Updates ---
    /**
     * Update the play/pause button UI.
     */
    function updatePlayPauseButton() {
        isPlaying = !audioElement.paused;
        playPauseBtn.textContent = isPlaying ? PAUSE_ICON : PLAY_ICON;
        playPauseBtn.title = isPlaying ? "Pause (C)" : "Play (C)";
    }

    /**
     * Update the combined track info display.
     */
    function updateCombinedTrackInfo() {
        const currentNum = currentTrackIndex === -1 ? 0 : currentTrackIndex + 1;
        const totalTracks = playlist.length;
        let namePart = 'No track loaded';

        // If a silence countdown is NOT active, display normal track info
        if (!silenceCountdownIntervalId) {
            if (currentTrackIndex !== -1 && playlist[currentTrackIndex]) {
                namePart = playlist[currentTrackIndex].name;
            } else if (totalTracks === 0 && currentTrackIndex === -1) {
                namePart = 'Playlist empty';
            }
            // If currentTrackIndex is -1 but playlist is not empty (e.g., after stop),
            // namePart remains 'No track loaded', which is correct.
            combinedTrackInfoDisplay.textContent = `Track ${currentNum}/${totalTracks}: ${namePart}`;
        }
        // If silenceCountdownIntervalId is active, its interval function handles the display.
    }

    /**
     * Update the progress bar and current time display.
     */
    function updateProgress() {
        if (audioElement.duration) {
            progressBar.value = (audioElement.currentTime / audioElement.duration) * 100;
            currentTimeDisplay.textContent = formatAudioTime(audioElement.currentTime);
        }
    }

    // --- Event Listeners ---
    if (fileInput && addTracksLabel && playlistElement && combinedTrackInfoDisplay &&
        currentTimeDisplay && totalTimeDisplay && progressBar && prevBtn && playPauseBtn && silenceIntervalInput && clearPlaylistBtn &&
        stopBtn && nextBtn && volumeSlider && speedSlider && speedDisplay && volumeDbDisplay &&
        loopTrackToggle && loopPlaylistToggle && audioElement) {

        // If 'audio-player-add-tracks-label' is an HTML <label> element with its 'for' attribute
        // correctly pointing to 'audio-player-file-input', clicking the label will natively
        // trigger the file input. The explicit .click() call below is redundant in that case
        // and can cause the file dialog to open twice on some browsers (e.g., Chrome).
        // addTracksLabel.addEventListener('click', () => fileInput.click()); // Removed to prevent double dialog opening.

        fileInput.addEventListener('change', handleFileSelect);

        playPauseBtn.addEventListener('click', playPause);
        stopBtn.addEventListener('click', () => stopPlayback(false));
        nextBtn.addEventListener('click', nextTrack);
        prevBtn.addEventListener('click', previousTrack);
        clearPlaylistBtn.addEventListener('click', clearPlaylist);

        volumeSlider.addEventListener('input', (e) => {
            const dbValue = parseFloat(e.target.value);
            const linearValue = dbToLinear(dbValue);
            setAudioVolume(linearValue, false); // false: slider is source, don't update it back
        });

        speedSlider.addEventListener('input', (e) => {
            const newSpeedValue = parseFloat(e.target.value);
            if (currentTrackIndex !== -1) {
                configureAndApplySpeed(playlist[currentTrackIndex], newSpeedValue);
                renderPlaylist(); // Update BPM display in playlist
            } else {
                // Playlist is empty, or no track is currently loaded.
                // The slider should be in multiplier mode (enforced by stopPlayback or initial configureAndApplySpeed(null)).
                // Update the UI and playbackRate for the current empty state, but do NOT save this as a global default.
                // The global default is always 1.0x for empty/initial states.
                currentSpeedMode = 'multiplier'; // Ensure mode is correct
                // Slider min/max/step should already be set correctly for multiplier mode.

                const clampedSpeed = Math.max(MULTIPLIER_SLIDER_MIN, Math.min(MULTIPLIER_SLIDER_MAX, newSpeedValue));
                audioElement.playbackRate = clampedSpeed; // Affects potential immediate playback if a track were added
                speedDisplay.textContent = `${clampedSpeed.toFixed(2)}x`;
                // DO NOT save to LOCAL_STORAGE_SPEED_KEY here.
                // localStorage.setItem(LOCAL_STORAGE_SPEED_KEY, clampedSpeed.toString()); // This line is removed.
            }
        });

        progressBar.addEventListener('input', (e) => {
            if (audioElement.duration) {
                audioElement.currentTime = (e.target.value / 100) * audioElement.duration;
            }
        });

        loopTrackToggle.addEventListener('change', (e) => {
            audioElement.loop = false; // Always false; 'ended' event will handle looping.
            localStorage.setItem(LOCAL_STORAGE_LOOP_TRACK_KEY, e.target.checked);

            if (e.target.checked && loopPlaylistToggle) {
                loopPlaylistToggle.checked = false;
                localStorage.setItem(LOCAL_STORAGE_LOOP_PLAYLIST_KEY, false);
                // audioElement.loop is already false.
            }
        });
        loopPlaylistToggle.addEventListener('change', (e) => {
            audioElement.loop = false; // Always false; 'ended' event will handle looping.
            localStorage.setItem(LOCAL_STORAGE_LOOP_PLAYLIST_KEY, e.target.checked);

            if (e.target.checked && loopTrackToggle) {
                loopTrackToggle.checked = false;
                localStorage.setItem(LOCAL_STORAGE_LOOP_TRACK_KEY, false);
                // audioElement.loop is already false.
            }
        });
        silenceIntervalInput.addEventListener('input', updateSilenceInterval);
        silenceIntervalInput.addEventListener('change', updateSilenceInterval); // Also update on change

        audioElement.addEventListener('loadedmetadata', () => {
            if (currentTrackIndex !== -1 && playlist[currentTrackIndex]) {
                playlist[currentTrackIndex].duration = audioElement.duration;
                totalTimeDisplay.textContent = formatAudioTime(audioElement.duration);
                progressBar.max = 100; // Ensure progress bar max is set
            }
        });

        // The 'ended' event only fires when audioElement.loop is false.
        audioElement.addEventListener('ended', () => {
            if (loopTrackToggle.checked) { // "Loop Track" is active
                if (currentSilenceIntervalMs > 0) {
                    startSilenceCountdownDisplay(currentSilenceIntervalMs);
                    silenceTimerId = setTimeout(() => {
                        if (currentTrackIndex !== -1) { // Ensure track is still valid
                            // The track info display is now updated by startSilenceCountdownDisplay when it finishes.
                            audioElement.currentTime = 0;
                            audioElement.play().catch(e => console.error("Error re-playing track for loop:", e));
                        }
                    }, currentSilenceIntervalMs);
                } else { // No silence, loop current track immediately
                    if (currentTrackIndex !== -1) {
                        audioElement.currentTime = 0;
                        audioElement.play().catch(e => console.error("Error re-playing track for loop:", e));
                        // If no silence, the "Pausing..." message wasn't shown.
                        // Calling updateCombinedTrackInfo() here is generally harmless and ensures UI consistency
                        // if other states could have changed the display.
                        updateCombinedTrackInfo();
                    }
                }
            } else { // "Loop Track" is NOT active. This covers "Loop Playlist" or no loop at all.
                // nextTrack() handles "Loop Playlist" internally or stops if no loops are active.
                if (currentSilenceIntervalMs > 0) {
                    startSilenceCountdownDisplay(currentSilenceIntervalMs); // Shows "Pausing..."
                    // When its interval ends, it calls updateCombinedTrackInfo()
                    // which will revert to the current track's name.
                    silenceTimerId = setTimeout(() => {
                        // Then, nextTrack() is called, which will load the new track
                        // and updateCombinedTrackInfo() will be called again with the new track's details.
                        nextTrack();
                    }, currentSilenceIntervalMs);
                } else {
                    nextTrack(); // No silence, proceed to next track or stop. updateCombinedTrackInfo will be called.
                }
            }
        });
        audioElement.addEventListener('timeupdate', updateProgress);
        audioElement.addEventListener('play', updatePlayPauseButton);
        audioElement.addEventListener('pause', updatePlayPauseButton);
        const savedVolumeLinear = localStorage.getItem(LOCAL_STORAGE_VOLUME_KEY);
        let initialLinearVolume = dbToLinear(DEFAULT_DB); // Default to -6dB linear equivalent

        if (savedVolumeLinear !== null) {
            initialLinearVolume = parseFloat(savedVolumeLinear);
        } else {
            initialLinearVolume = dbToLinear(parseFloat(volumeSlider.value)); // Use slider's default HTML value if nothing in LS
        }
        setAudioVolume(initialLinearVolume); // This sets audio.volume, slider.value, and display

        // Initial speed slider setup (before any track is loaded)
        configureAndApplySpeed(null);
        const savedLoopTrack = localStorage.getItem(LOCAL_STORAGE_LOOP_TRACK_KEY) === 'true';
        // audioElement.loop must always be false for the 'ended' event to fire and handle custom looping.
        // The loopTrackToggle.checked state will determine if custom looping occurs.
        loopTrackToggle.checked = savedLoopTrack;
        audioElement.loop = false;

        const savedLoopPlaylist = localStorage.getItem(LOCAL_STORAGE_LOOP_PLAYLIST_KEY) === 'true';
        loopPlaylistToggle.checked = savedLoopPlaylist;

        const savedSilenceInterval = localStorage.getItem(LOCAL_STORAGE_SILENCE_KEY);
        if (savedSilenceInterval !== null && !isNaN(parseFloat(savedSilenceInterval))) {
            silenceIntervalInput.value = savedSilenceInterval;
        } else {
            silenceIntervalInput.value = 0; // Default to 0 seconds
        }
        updateSilenceInterval(); // Initialize the state variable

        // Initial UI
        renderPlaylist(); // Show empty message
        updatePlayPauseButton(); // renderPlaylist calls updateCombinedTrackInfo

    } else {
        console.error("Audio Player: One or more essential DOM elements are missing. Player will not function.");
    }

    // --- Keyboard Shortcuts ---
    window.addEventListener('keydown', (event) => {
        const target = event.target;
        if (target.tagName === 'INPUT' && target.type !== 'checkbox' && target.type !== 'number' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
            return; // Don't interfere with text inputs
        }

        // Ignore shortcuts if Ctrl key is pressed (unless the shortcut is specifically for Ctrl+Key)
        if (event.ctrlKey) {
            return;
        }

        let relevantKeyPressed = false;
        const keyUpper = event.key.toUpperCase();

        const currentTrack = currentTrackIndex !== -1 ? playlist[currentTrackIndex] : null;
        let step = 0;
        let newSpeed;

        switch (keyUpper) {
            case 'T': addTracksLabel.click(); relevantKeyPressed = true; break; // Changed from P to T
            case 'Q': // Decrement volume by ~3dB
                {
                    const currentLin = audioElement.volume;
                    const newLin = Math.max(0, currentLin / Math.pow(10, 3 / 20));
                    setAudioVolume(newLin);
                    relevantKeyPressed = true;
                    break;
                }
            case 'W': // Increment volume by ~3dB
                {
                    const currentLin = audioElement.volume;
                    const newLin = Math.min(1, currentLin * Math.pow(10, 3 / 20));
                    setAudioVolume(newLin);
                    relevantKeyPressed = true;
                    break;
                }
            case 'E': // Decrement speed by 0.05
                if (currentTrack) {
                    if (currentSpeedMode === 'bpm') {
                        step = event.shiftKey ? -1 : -5;
                        newSpeed = Math.max(BPM_SLIDER_MIN, currentTrack.userSetSpeed + step);
                    } else { // multiplier
                        step = event.shiftKey ? -0.01 : -0.05;
                        newSpeed = Math.max(MULTIPLIER_SLIDER_MIN, parseFloat((currentTrack.userSetSpeed + step).toFixed(2)));
                    }
                    configureAndApplySpeed(currentTrack, newSpeed);
                    renderPlaylist();
                    relevantKeyPressed = true;
                }
                break;
            case 'R': // Increment speed by 0.05
                if (currentTrack) {
                    if (currentSpeedMode === 'bpm') {
                        step = event.shiftKey ? 1 : 5;
                        newSpeed = Math.min(BPM_SLIDER_MAX, currentTrack.userSetSpeed + step);
                    } else { // multiplier
                        step = event.shiftKey ? 0.01 : 0.05;
                        newSpeed = Math.min(MULTIPLIER_SLIDER_MAX, parseFloat((currentTrack.userSetSpeed + step).toFixed(2)));
                    }
                    configureAndApplySpeed(currentTrack, newSpeed);
                    renderPlaylist();
                    relevantKeyPressed = true;
                }
                break;
            case 'A': audioElement.currentTime = Math.max(0, audioElement.currentTime - 20); relevantKeyPressed = true; break;
            case 'S': audioElement.currentTime = Math.max(0, audioElement.currentTime - 2); relevantKeyPressed = true; break;
            case 'D': if (audioElement.duration) audioElement.currentTime = Math.min(audioElement.duration, audioElement.currentTime + 2); relevantKeyPressed = true; break;
            case 'F': if (audioElement.duration) audioElement.currentTime = Math.min(audioElement.duration, audioElement.currentTime + 20); relevantKeyPressed = true; break;
            case 'Z': previousTrack(); relevantKeyPressed = true; break;
            case 'V': nextTrack(); relevantKeyPressed = true; break;
            case 'X': stopPlayback(false); relevantKeyPressed = true; break;
            case 'C':
                // If user presses C during silence, it should cancel silence and play/pause.
                clearSilenceTimeout(); // Cancel any pending silence
                playPause(); // Then toggle play/pause
                relevantKeyPressed = true;
                break;
            case 'G':
                if (clearPlaylistBtn) clearPlaylistBtn.click();
                relevantKeyPressed = true;
                break;
        }

        if (relevantKeyPressed) {
            // If the key was 'G' for clear playlist, we don't want to preventDefault
            // if the target was an input field, but the initial check in the
            // event listener should handle that.
            event.preventDefault();
        }
    });
}