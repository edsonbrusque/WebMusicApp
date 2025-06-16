import { createAudioContext, formatTime } from './utils.js';

export function initStopwatch() {
    console.log("Initialising Stopwatch...");
    // --- Constants ---
    const TEXT_START = 'Start (Space)';
    const LOCAL_STORAGE_CHIME_KEY = 'stopwatchChimeInterval';
    const TEXT_PAUSE = 'Pause (Space)';
    const CHIME_SCHEDULE_TOLERANCE_MS = -50; // Max negative delay to still trigger chime immediately

    // --- State Variables ---
    let isRunning = false; let startTime = null; let pausedElapsedTime = 0;
    let lapStartTime = 0; let laps = []; let animationFrameId = null; // UI update

    // Chime feature variables
    let chimeAudioContext = null;
    let decodedChimeBuffer = null;
    let isLoadingChime = false;
    let currentChimeIntervalMs = 0; // Active interval in milliseconds
    let nextChimeTargetTotalElapsedTime = Infinity; // When the next chime should sound
    let chimeTimerID = null; // For setTimeout based chime scheduling

    // --- DOM Elements ---
    const displayElement = document.getElementById('stopwatch-display');
    const startPauseBtn = document.getElementById('stopwatch-startPauseBtn');
    const lapBtn = document.getElementById('stopwatch-lapBtn');
    const resetBtn = document.getElementById('stopwatch-resetBtn');
    const lapsList = document.getElementById('stopwatch-lapsList');
    const chimeIntervalInput = document.getElementById('stopwatch-chime-interval');

    function _getCurrentTotalElapsedTime() {
        if (isRunning && startTime) {
            return pausedElapsedTime + (performance.now() - startTime);
        }
        return pausedElapsedTime;
    }

    async function handleStartPause() { // Made async

        if (!isRunning) {
            // --- STARTING THE STOPWATCH ---

            // If a chime interval is set, ensure AudioContext is ready and audio is loaded.
            if (parseFloat(chimeIntervalInput.value) > 0) {
                const contextIsRunning = await ensureChimeAudioContext(); // Ensure context is created and running
                if (contextIsRunning) {
                    await ensureChimeAudioLoaded(); // Ensure audio file is loaded
                } else {
                    console.warn("Stopwatch: Chime AudioContext not ready after start attempt, chime may not play.");
                }
            }

            isRunning = true;
            startTime = performance.now();
            if (pausedElapsedTime === 0) {
                lapStartTime = startTime;
            }

            startPauseBtn.textContent = TEXT_PAUSE;
            startPauseBtn.classList.add('pause');
            lapBtn.disabled = false;
            resetBtn.disabled = false;
            animationFrameId = requestAnimationFrame(updateDisplay);

            // updateChimeSettings will call scheduleNextChime if a valid interval is set.
            // By this point, if a chime was configured, its audio context and buffer
            // should have been prepared by the awaits above.
            updateChimeSettings();

        } else {
            // --- PAUSING THE STOPWATCH ---
            isRunning = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            const currentTime = performance.now();
            pausedElapsedTime += (currentTime - startTime);
            startTime = null;
            startPauseBtn.textContent = TEXT_START;
            startPauseBtn.classList.remove('pause');
            lapBtn.disabled = true;

            if (chimeTimerID) {
                clearTimeout(chimeTimerID);
                chimeTimerID = null;
            }
        }
    }

    function handleLap() {
        if (!isRunning || lapBtn.disabled) return;
        const currentTime = performance.now();
        const totalElapsedTime = _getCurrentTotalElapsedTime(); // Use helper
        const currentLapTime = currentTime - lapStartTime;
        const lapNumber = laps.length + 1;
        laps.push({ lapNumber: lapNumber, lapTime: currentLapTime, totalTime: totalElapsedTime });
        const li = document.createElement('li');
        li.innerHTML = `<span class="lap-number">Lap ${lapNumber}</span><span class="lap-time">+ ${formatTime(currentLapTime)}</span><span class="total-time">${formatTime(totalElapsedTime)}</span>`;
        lapsList.prepend(li);
        lapStartTime = currentTime;
    }

    function handleReset() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (chimeTimerID) { // Clear pending chime timeout
            clearTimeout(chimeTimerID);
            chimeTimerID = null;
        }

        const wasRunning = isRunning;
        laps = [];
        lapsList.innerHTML = '';

        if (wasRunning) {
            startTime = performance.now();
            pausedElapsedTime = 0;
            lapStartTime = startTime;
            lapBtn.disabled = false;
            animationFrameId = requestAnimationFrame(updateDisplay);
        } else {
            startTime = null;
            pausedElapsedTime = 0;
            lapStartTime = 0;
            isRunning = false;
            displayElement.textContent = formatTime(0);
            startPauseBtn.textContent = TEXT_START;
            startPauseBtn.classList.remove('pause');
            lapBtn.disabled = true;
            resetBtn.disabled = true;
        }
        displayElement.textContent = formatTime(pausedElapsedTime);
        updateChimeSettings(); // Recalculate/reset chime state
        // scheduleNextChime() is called by updateChimeSettings if needed
    }

    // --- Chime Functions ---
    async function ensureChimeAudioContext() { // Made async
        if (!chimeAudioContext) {
            try {
                window.AudioContext = window.AudioContext || window.webkitAudioContext;
                chimeAudioContext = new AudioContext();
                console.log("Stopwatch Chime AudioContext created. Initial state:", chimeAudioContext.state);
            } catch (e) {
                console.error('Web Audio API is not supported in this browser for Stopwatch.');
                console.error("Failed to create Stopwatch Chime AudioContext:", e);
                chimeAudioContext = null;
                return false;
            }
        }

        if (chimeAudioContext && chimeAudioContext.state === 'suspended') {
            console.log("Stopwatch Chime AudioContext is suspended, attempting to resume...");
            try {
                await chimeAudioContext.resume();
                console.log("Stopwatch Chime AudioContext resumed. New state:", chimeAudioContext.state);
            } catch (e) {
                console.error("Error resuming Stopwatch Chime AudioContext:", e);
                return false;
            }
        }
        return chimeAudioContext && chimeAudioContext.state === 'running';
    }

    async function loadChimeAudio() {
        if (decodedChimeBuffer || isLoadingChime) return true;
        if (!(await ensureChimeAudioContext())) { // Await the context check
            console.error("Stopwatch: Chime AudioContext not available or not running for loading sound.");
            return false;
        }
        isLoadingChime = true;
        try {
            const response = await fetch('chime.mp3'); // Assumes chime.mp3 is in www/
            if (!response.ok) throw new Error(`Failed to fetch chime.mp3: ${response.statusText}`);
            const arrayBuffer = await response.arrayBuffer();
            decodedChimeBuffer = await chimeAudioContext.decodeAudioData(arrayBuffer);
            console.log("Stopwatch chime audio decoded.");
            // If stopwatch is running and a chime interval is set, try scheduling now that audio is ready.
            if (isRunning && currentChimeIntervalMs > 0) scheduleNextChime();
            isLoadingChime = false;
            return true;
        } catch (e) {
            console.error("Stopwatch loadChimeAudio Error:", e);
            decodedChimeBuffer = null;
            isLoadingChime = false;
            return false;
        }
    }

    function playChime() {
        if (!chimeAudioContext || !decodedChimeBuffer) {
            console.warn("Stopwatch: Chime audio not ready or context missing.");
            if (!decodedChimeBuffer && currentChimeIntervalMs > 0 && !isLoadingChime) {
                ensureChimeAudioLoaded(); // Attempt to load
            }
            return;
        }
        if (chimeAudioContext.state === 'running') {
            const source = chimeAudioContext.createBufferSource();
            source.buffer = decodedChimeBuffer;
            source.connect(chimeAudioContext.destination);
            source.start();
        } else {
            console.warn("Stopwatch: Chime AudioContext not running, cannot play chime.");
        }
    }

    async function ensureChimeAudioLoaded() {
        if (!decodedChimeBuffer && currentChimeIntervalMs > 0) {
            if (!isLoadingChime) {
                await loadChimeAudio();
            }
        }
        return decodedChimeBuffer != null;
    }
    function _calculateNextChimeTarget(totalElapsedTime, intervalMs) {
        const intervalsPassed = Math.floor(totalElapsedTime / intervalMs);
        return (intervalsPassed + 1) * intervalMs;
    }

    function triggerChimeAndReschedule() {
        if (!isRunning || currentChimeIntervalMs <= 0) {
            if (chimeTimerID) clearTimeout(chimeTimerID);
            chimeTimerID = null;
            return;
        }
        if (!decodedChimeBuffer) {
            console.warn("Stopwatch: Triggered chime but buffer not available.");
            ensureChimeAudioLoaded().then(loaded => { // Attempt to load and reschedule
                if (loaded) scheduleNextChime();
            });
            return;
        }

        playChime();

        const currentTotalActualElapsedTime = _getCurrentTotalElapsedTime();
        nextChimeTargetTotalElapsedTime = _calculateNextChimeTarget(currentTotalActualElapsedTime, currentChimeIntervalMs);
        scheduleNextChime();
    }

    async function scheduleNextChime() {
        if (chimeTimerID) {
            clearTimeout(chimeTimerID);
            chimeTimerID = null;
        }

        if (!isRunning || currentChimeIntervalMs <= 0) {
            return;
        }

        const audioReady = await ensureChimeAudioLoaded();
        if (!audioReady) {
            console.warn("Stopwatch: Chime audio not ready, cannot schedule chime yet.");
            return;
        }

        const currentTotalElapsedTime = _getCurrentTotalElapsedTime();

        if (nextChimeTargetTotalElapsedTime === Infinity || currentTotalElapsedTime >= nextChimeTargetTotalElapsedTime) {
            nextChimeTargetTotalElapsedTime = _calculateNextChimeTarget(currentTotalElapsedTime, currentChimeIntervalMs);
        }

        const delayMs = nextChimeTargetTotalElapsedTime - currentTotalElapsedTime;

        if (delayMs > 0) {
            chimeTimerID = setTimeout(triggerChimeAndReschedule, delayMs);
        } else if (delayMs <= 0 && delayMs > CHIME_SCHEDULE_TOLERANCE_MS) { // If very close or slightly past
            triggerChimeAndReschedule();
        } else {
            console.warn(`Stopwatch: Chime scheduling resulted in non-positive delay: ${delayMs}ms. Recalculating for next cycle.`);
            // This implies target is stale or time jumped; trigger will recalculate.
        }
    }

    function updateChimeSettings() {
        const intervalSeconds = parseFloat(chimeIntervalInput.value); // Renamed for clarity
        const oldChimeIntervalMs = currentChimeIntervalMs;

        if (!isNaN(intervalSeconds) && intervalSeconds > 0) {
            currentChimeIntervalMs = intervalSeconds * 1000; // Input is now in seconds
            const effectiveTotalElapsedTime = _getCurrentTotalElapsedTime();
            localStorage.setItem(LOCAL_STORAGE_CHIME_KEY, intervalSeconds.toString());
            nextChimeTargetTotalElapsedTime = _calculateNextChimeTarget(effectiveTotalElapsedTime, currentChimeIntervalMs);
        } else {
            currentChimeIntervalMs = 0;
            nextChimeTargetTotalElapsedTime = Infinity;
        }

        if (oldChimeIntervalMs !== currentChimeIntervalMs || (isRunning && currentChimeIntervalMs > 0)) {
            scheduleNextChime();
        } else if (currentChimeIntervalMs === 0 && chimeTimerID) {
            clearTimeout(chimeTimerID);
            chimeTimerID = null;
        }
    }

    // --- Original Functions Modified/Reviewed ---
    function updateDisplay() {
        if (!isRunning && pausedElapsedTime === 0) {
            displayElement.textContent = formatTime(0);
            return;
        }
        const totalElapsedTime = _getCurrentTotalElapsedTime();
        displayElement.textContent = formatTime(totalElapsedTime);

        if (isRunning) {
            animationFrameId = requestAnimationFrame(updateDisplay);
        }
    }
    // --- Event Listeners & Initialisation ---
    if (displayElement && startPauseBtn && lapBtn && resetBtn && lapsList && chimeIntervalInput) {
        startPauseBtn.addEventListener('click', handleStartPause);
        lapBtn.addEventListener('click', handleLap);
        resetBtn.addEventListener('click', handleReset);
        chimeIntervalInput.addEventListener('input', updateChimeSettings);

        // Initial UI setup
        const savedChimeInterval = localStorage.getItem(LOCAL_STORAGE_CHIME_KEY);
        if (savedChimeInterval !== null && !isNaN(parseFloat(savedChimeInterval))) {
            chimeIntervalInput.value = savedChimeInterval;
        } else {
            chimeIntervalInput.value = ''; // Default to no chime if nothing saved or invalid
        }
        displayElement.textContent = formatTime(0); // Initial display
        resetBtn.disabled = true;
        updateChimeSettings(); // Initialize chime state

        // Preload the chime audio file when the stopwatch module is initialized
        loadChimeAudio();

    } else {
        console.error("Stopwatch: One or more essential DOM elements are missing. Stopwatch will not function.");
    }

    // Stopwatch Keyboard Listener
    window.addEventListener('keydown', (event) => {
        const target = event.target;
        // Prevent shortcuts if typing in input fields (including the new chime input)
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
            // Allow space if it's the chime input and user might be typing a value then space (though unlikely)
            // However, space is a global shortcut for start/pause, so better to always let input fields consume it.
            // The main check `target.tagName === 'INPUT'` is sufficient.
            return;
        }

        // Ignore shortcuts if Ctrl key is pressed (unless the shortcut is specifically for Ctrl+Key)
        if (event.ctrlKey) {
            return;
        }

        let relevantKeyPressed = false;
        const keyUpper = event.key.toUpperCase();

        switch (keyUpper) {
            case ' ':
                startPauseBtn.click(); // Assumes element exists
                relevantKeyPressed = true;
                break;
            case 'L':
                if (!lapBtn.disabled) lapBtn.click(); // Assumes element exists
                relevantKeyPressed = true;
                break;
            case 'K': // Changed from 'R' to 'K'
                if (!resetBtn.disabled) resetBtn.click(); // Assumes element exists
                relevantKeyPressed = true;
                break;
        }
        if (relevantKeyPressed) { event.preventDefault(); }
    });
}