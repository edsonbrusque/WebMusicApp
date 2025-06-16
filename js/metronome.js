import { createAudioContext } from './utils.js';

export function initMetronome() {
    console.log("Initialising Metronome...");
    // --- Constants & Variables ---
    const TEXT_START = 'Start (M)';
    const TEXT_STOP = 'Stop (M)';
    const TEXT_LOADING = 'Loading...';
    const MIN_BPM = 40;
    const MAX_BPM = 240;
    const LOCAL_STORAGE_BPM_KEY = 'metronomeBpm';
    const LOCAL_STORAGE_ADVANCED_PREFIX = 'metronomeAdvanced_';
    
    let audioContext = null;
    let decodedAudioBuffer = null;
    const lookahead = 25.0;
    const scheduleAheadTime = 0.1;
    let currentBpm = 120;
    let isRunning = false;
    let nextNoteTime = 0.0;
    let timerID = null;

    // Advanced mode variables
    let advancedMode = {
        active: false,
        stopAtFinish: true,
        startBpm: 60,
        finishBpm: 120,
        practiceTimeMinutes: 5.0,
        sessionStartTime: null,
        sessionElapsedTime: 0, // in milliseconds
        isProgressing: false
    };

    // --- DOM Elements ---
    const bpmSlider = document.getElementById('metronome-bpm-slider');
    const bpmNumberInput = document.getElementById('metronome-bpm-number');
    const startStopBtn = document.getElementById('metronome-startStopBtn');
    const visualIndicator = document.getElementById('metronome-visual-indicator');
    const dec10Btn = document.getElementById('metronome-dec10Btn');
    const dec5Btn = document.getElementById('metronome-dec5Btn');
    const dec1Btn = document.getElementById('metronome-dec1Btn');
    const inc1Btn = document.getElementById('metronome-inc1Btn');
    const inc5Btn = document.getElementById('metronome-inc5Btn');
    const inc10Btn = document.getElementById('metronome-inc10Btn');

    // Advanced mode DOM elements
    const advancedToggleBtn = document.getElementById('metronome-advanced-toggle');
    const advancedControls = document.getElementById('metronome-advanced-controls');
    const advancedActiveCheckbox = document.getElementById('metronome-advanced-active');
    const stopAtFinishCheckbox = document.getElementById('metronome-advanced-stop-at-finish');
    const startBpmInput = document.getElementById('metronome-start-bpm');
    const finishBpmInput = document.getElementById('metronome-finish-bpm');
    const practiceTimeInput = document.getElementById('metronome-practice-time');
    const progressSlider = document.getElementById('metronome-progress-slider');
    const progressDisplay = document.getElementById('metronome-progress-display');

    // --- Audio Functions ---
    async function ensureAudioContext() {
        if (!audioContext) {
            try {
                window.AudioContext = window.AudioContext || window.webkitAudioContext;
                audioContext = new AudioContext();
                console.log("Metronome AudioContext created. Initial state:", audioContext.state);
            } catch (e) {
                console.error('Web Audio API is not supported in this browser.');
                console.error("Failed to create Metronome AudioContext:", e);
                audioContext = null;
                return false;
            }
        }

        if (audioContext && audioContext.state === 'suspended') {
            console.log("Metronome AudioContext is suspended, attempting to resume...");
            try {
                await audioContext.resume();
                console.log("Metronome AudioContext resumed. New state:", audioContext.state);
            } catch (e) { 
                console.error("Error resuming Metronome AudioContext:", e); 
                return false; 
            }
        }
        return audioContext && audioContext.state === 'running';
    }

    async function loadAudio() {
        if (decodedAudioBuffer) return true;
        if (!ensureAudioContext()) return false;

        startStopBtn.disabled = true;
        startStopBtn.textContent = TEXT_LOADING;
        try {
            const response = await fetch('tick.mp3');
            if (!response.ok) {
                throw new Error(`Failed to fetch tick.mp3: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            decodedAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            console.log("Metronome audio decoded.");
            return true;
        } catch (e) {
            console.error("Metronome loadAudio Error:", e);
            console.error(`Failed to load Metronome sound: ${e.message}`);
            return false;
        } finally {
            startStopBtn.disabled = false;
            startStopBtn.textContent = isRunning ? TEXT_STOP : TEXT_START;
        }
    }

    function playTick(time) {
        if (!audioContext || !decodedAudioBuffer) return;
        const source = audioContext.createBufferSource();
        source.buffer = decodedAudioBuffer;
        source.connect(audioContext.destination);
        source.start(time);
    }

    // --- Advanced Mode Functions ---
    function validateAndCorrectAdvancedInputs() {
        // Auto-correct invalid values
        const startBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(parseFloat(startBpmInput.value) || 60)));
        const finishBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(parseFloat(finishBpmInput.value) || 120)));
        const practiceTime = Math.max(0.1, parseFloat(practiceTimeInput.value) || 5.0);

        startBpmInput.value = startBpm;
        finishBpmInput.value = finishBpm;
        practiceTimeInput.value = practiceTime;

        advancedMode.startBpm = startBpm;
        advancedMode.finishBpm = finishBpm;
        advancedMode.practiceTimeMinutes = practiceTime;
    }

    function calculateCurrentBpmInProgression() {
        if (!advancedMode.isProgressing) return advancedMode.startBpm;
        
        const totalDurationMs = advancedMode.practiceTimeMinutes * 60 * 1000;
        const progress = Math.min(1, advancedMode.sessionElapsedTime / totalDurationMs);
        
        const bpmDifference = advancedMode.finishBpm - advancedMode.startBpm;
        const currentBpm = advancedMode.startBpm + (bpmDifference * progress);
        
        return Math.round(currentBpm);
    }

    function updateProgressDisplay() {
        if (!advancedMode.active) return;
        
        const totalDurationMs = advancedMode.practiceTimeMinutes * 60 * 1000;
        const progress = Math.min(100, (advancedMode.sessionElapsedTime / totalDurationMs) * 100);
        
        progressSlider.value = progress;
        
        const elapsedMinutes = Math.floor(advancedMode.sessionElapsedTime / 60000);
        const elapsedSeconds = Math.floor((advancedMode.sessionElapsedTime % 60000) / 1000);
        const totalMinutes = Math.floor(advancedMode.practiceTimeMinutes);
        const totalSeconds = Math.floor((advancedMode.practiceTimeMinutes % 1) * 60);
        
        progressDisplay.textContent = `${elapsedMinutes}:${elapsedSeconds.toString().padStart(2, '0')} / ${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;
    }

    function handleProgressSliderChange() {
        if (!advancedMode.active || !advancedMode.isProgressing) return;
        
        const newProgress = parseFloat(progressSlider.value) / 100;
        const totalDurationMs = advancedMode.practiceTimeMinutes * 60 * 1000;
        advancedMode.sessionElapsedTime = newProgress * totalDurationMs;
          // Update current BPM based on new position
        const newBpm = calculateCurrentBpmInProgression();
        updateTempoDisplay(newBpm);
        updateProgressDisplay();
    }

    function checkAdvancedModeCompletion() {
        if (!advancedMode.active || !advancedMode.isProgressing) return;
        
        const totalDurationMs = advancedMode.practiceTimeMinutes * 60 * 1000;
        
        if (advancedMode.sessionElapsedTime >= totalDurationMs) {
            console.log("Advanced mode practice session completed");
            // Practice session completed
            advancedMode.isProgressing = false;
            advancedMode.sessionElapsedTime = totalDurationMs; // Cap at max
            updateTempoDisplay(advancedMode.finishBpm);
            updateProgressDisplay();
            
            if (advancedMode.stopAtFinish) {
                console.log("Stopping metronome automatically");
                stopMetronome();
            } else {
                console.log("Continuing at finish BPM");
                // Continue at finish BPM indefinitely
                advancedMode.isProgressing = false;
            }
        }
    }

    function saveAdvancedSettings() {
        const settings = {
            active: advancedActiveCheckbox.checked,
            stopAtFinish: stopAtFinishCheckbox.checked,
            startBpm: parseInt(startBpmInput.value),
            finishBpm: parseInt(finishBpmInput.value),
            practiceTime: parseFloat(practiceTimeInput.value)
        };
        
        Object.keys(settings).forEach(key => {
            localStorage.setItem(LOCAL_STORAGE_ADVANCED_PREFIX + key, settings[key].toString());
        });
    }

    function loadAdvancedSettings() {
        const defaults = {
            active: false,
            stopAtFinish: true,
            startBpm: 60,
            finishBpm: 120,
            practiceTime: 5.0
        };
        
        Object.keys(defaults).forEach(key => {
            const saved = localStorage.getItem(LOCAL_STORAGE_ADVANCED_PREFIX + key);
            if (saved !== null) {
                if (key === 'active' || key === 'stopAtFinish') {
                    defaults[key] = saved === 'true';
                } else if (key === 'practiceTime') {
                    defaults[key] = parseFloat(saved) || defaults[key];
                } else {
                    defaults[key] = parseInt(saved) || defaults[key];
                }
            }
        });
        
        advancedActiveCheckbox.checked = defaults.active;
        stopAtFinishCheckbox.checked = defaults.stopAtFinish;
        startBpmInput.value = defaults.startBpm;
        finishBpmInput.value = defaults.finishBpm;
        practiceTimeInput.value = defaults.practiceTime;
        
        advancedMode.active = defaults.active;
        advancedMode.stopAtFinish = defaults.stopAtFinish;
        advancedMode.startBpm = defaults.startBpm;
        advancedMode.finishBpm = defaults.finishBpm;
        advancedMode.practiceTimeMinutes = defaults.practiceTime;
        
        updateProgressDisplay();
    }

    // --- UI & Logic Functions ---
    function flashIndicator() {
        visualIndicator.classList.add('active');
        setTimeout(() => {
            visualIndicator.classList.remove('active');
        }, 80);
    }    function scheduler() {
        if (!isRunning) {
            console.log("Scheduler called but metronome is not running - stopping scheduler");
            return;
        }
        
        while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
            playTick(nextNoteTime);
            const visualDelay = Math.max(0, (nextNoteTime - audioContext.currentTime)) * 1000;
            setTimeout(flashIndicator, visualDelay);
            
            // Update advanced mode progression
            if (advancedMode.active && advancedMode.isProgressing) {
                const currentTime = performance.now();
                advancedMode.sessionElapsedTime = currentTime - advancedMode.sessionStartTime;
                
                const newBpm = calculateCurrentBpmInProgression();
                if (newBpm !== currentBpm) {
                    updateTempoDisplay(newBpm);
                }
                updateProgressDisplay();
                checkAdvancedModeCompletion();
                
                // If checkAdvancedModeCompletion stopped the metronome, break out
                if (!isRunning) {
                    console.log("Metronome was stopped by advanced mode completion");
                    return;
                }
            }
            
            const secondsPerBeat = 60.0 / currentBpm;
            nextNoteTime += secondsPerBeat;
        }
        
        if (isRunning) {
            timerID = window.setTimeout(scheduler, lookahead);
        }
    }async function startMetronome() {
        console.log("startMetronome called. isRunning:", isRunning);
        if (isRunning) return;

        // Check if we need to stop for advanced mode toggle
        if (advancedActiveCheckbox.checked !== advancedMode.active) {
            alert("Please stop the metronome before changing Advanced mode.");
            advancedActiveCheckbox.checked = advancedMode.active; // Revert checkbox
            return;
        }

        const contextReady = await ensureAudioContext();
        if (!contextReady) return;
        
        const audioFileReady = await loadAudio();
        if (!audioFileReady) {
            console.warn("Metronome audio file not loaded.");
            return;
        }

        // Initialize advanced mode if active
        if (advancedMode.active) {
            validateAndCorrectAdvancedInputs();
            advancedMode.sessionStartTime = performance.now() - advancedMode.sessionElapsedTime;
            advancedMode.isProgressing = true;
            
            const initialBpm = calculateCurrentBpmInProgression();
            updateTempoDisplay(initialBpm);
            console.log("Advanced mode started. Start BPM:", advancedMode.startBpm, "Finish BPM:", advancedMode.finishBpm, "Time:", advancedMode.practiceTimeMinutes, "min");
        }

        isRunning = true;
        nextNoteTime = audioContext.currentTime + 0.05;
        scheduler();
        startStopBtn.textContent = TEXT_STOP;
        startStopBtn.classList.add('stop');
        console.log("Metronome started. isRunning:", isRunning);
    }function stopMetronome() {
        if (!isRunning) return;
        isRunning = false;
        window.clearTimeout(timerID);
        visualIndicator.classList.remove('active');
        startStopBtn.textContent = TEXT_START;
        startStopBtn.classList.remove('stop');
        
        // Advanced mode remains in its current state when stopped
        // This allows resuming from the current position
        console.log("Metronome stopped. isRunning:", isRunning);
    }

    function updateTempoDisplay(newBpm) {
        const clampedBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(newBpm)));
        currentBpm = clampedBpm;
        bpmSlider.value = currentBpm;
        bpmNumberInput.value = currentBpm;
        
        // Only save to localStorage if not in advanced mode progression
        if (!advancedMode.active || !advancedMode.isProgressing) {
            localStorage.setItem(LOCAL_STORAGE_BPM_KEY, currentBpm.toString());
        }
    }

    function changeTempo(amount) {
        // Prevent manual tempo changes during advanced mode progression
        if (advancedMode.active && isRunning) {
            return;
        }
        updateTempoDisplay(currentBpm + amount);
    }

    function toggleAdvancedControls() {
        const isHidden = advancedControls.classList.contains('hidden');
        advancedControls.classList.toggle('hidden');
        advancedToggleBtn.textContent = isHidden ? 'Advanced ▲' : 'Advanced ▼';
        
        // Save visibility state
        localStorage.setItem(LOCAL_STORAGE_ADVANCED_PREFIX + 'visible', (!isHidden).toString());
    }

    // --- Event Listeners ---
    if (startStopBtn && bpmSlider && bpmNumberInput && visualIndicator &&
        dec10Btn && dec5Btn && dec1Btn && inc1Btn && inc5Btn && inc10Btn &&
        advancedToggleBtn && advancedControls && advancedActiveCheckbox && 
        stopAtFinishCheckbox && startBpmInput && finishBpmInput && 
        practiceTimeInput && progressSlider && progressDisplay) {        // Existing event listeners
        startStopBtn.addEventListener('click', () => {
            console.log("Start/Stop button clicked. isRunning:", isRunning);
            if (isRunning) {
                stopMetronome();
            } else {
                startMetronome();
            }
        });

        bpmSlider.addEventListener('input', () => {
            if (advancedMode.active && isRunning) return; // Prevent changes during progression
            updateTempoDisplay(parseInt(bpmSlider.value, 10));
        });
        
        bpmNumberInput.addEventListener('input', () => {
            if (advancedMode.active && isRunning) return; // Prevent changes during progression
            const val = parseInt(bpmNumberInput.value, 10);
            if (!isNaN(val)) updateTempoDisplay(val);
        });
        
        bpmNumberInput.addEventListener('change', () => {
            if (isNaN(parseInt(bpmNumberInput.value, 10))) bpmNumberInput.value = currentBpm;
        });

        dec10Btn.addEventListener('click', () => changeTempo(-10));
        dec5Btn.addEventListener('click', () => changeTempo(-5));
        dec1Btn.addEventListener('click', () => changeTempo(-1));
        inc1Btn.addEventListener('click', () => changeTempo(1));
        inc5Btn.addEventListener('click', () => changeTempo(5));
        inc10Btn.addEventListener('click', () => changeTempo(10));

        // Advanced mode event listeners
        advancedToggleBtn.addEventListener('click', toggleAdvancedControls);
        
        advancedActiveCheckbox.addEventListener('change', () => {
            if (isRunning) {
                alert("Please stop the metronome before changing Advanced mode.");
                advancedActiveCheckbox.checked = advancedMode.active; // Revert
                return;
            }
            advancedMode.active = advancedActiveCheckbox.checked;
            
            if (advancedMode.active) {
                validateAndCorrectAdvancedInputs();
                // Reset progression state
                advancedMode.sessionElapsedTime = 0;
                advancedMode.isProgressing = false;
                updateTempoDisplay(advancedMode.startBpm);
            }
            
            updateProgressDisplay();
            saveAdvancedSettings();
        });

        stopAtFinishCheckbox.addEventListener('change', () => {
            advancedMode.stopAtFinish = stopAtFinishCheckbox.checked;
            saveAdvancedSettings();
        });

        [startBpmInput, finishBpmInput, practiceTimeInput].forEach(input => {
            input.addEventListener('change', () => {
                validateAndCorrectAdvancedInputs();
                
                if (advancedMode.active && !isRunning) {
                    // Reset progression if settings changed while stopped
                    advancedMode.sessionElapsedTime = 0;
                    advancedMode.isProgressing = false;
                    updateTempoDisplay(advancedMode.startBpm);
                }
                
                updateProgressDisplay();
                saveAdvancedSettings();
            });
        });

        progressSlider.addEventListener('input', handleProgressSliderChange);

        // Initialize
        loadAdvancedSettings();
        
        // Load visibility state
        const savedVisibility = localStorage.getItem(LOCAL_STORAGE_ADVANCED_PREFIX + 'visible');
        if (savedVisibility === 'true') {
            advancedControls.classList.remove('hidden');
            advancedToggleBtn.textContent = 'Advanced ▲';
        }

        const savedBpm = localStorage.getItem(LOCAL_STORAGE_BPM_KEY);
        const initialBpm = savedBpm !== null && !isNaN(parseInt(savedBpm, 10)) ? 
            parseInt(savedBpm, 10) : parseInt(bpmSlider.value, 10);
        
        if (advancedMode.active) {
            updateTempoDisplay(advancedMode.startBpm);
        } else {
            updateTempoDisplay(initialBpm);
        }

        // Preload the audio file
        loadAudio();

    } else {
        console.error("Metronome: One or more essential DOM elements are missing. Metronome will not function.");
    }

    // Keyboard listeners
    window.addEventListener('keydown', (event) => {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' && activeElement.type !== 'range' && activeElement.type !== 'checkbox' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT')) {
            if (activeElement === bpmNumberInput && event.key.startsWith('Arrow')) return;
        }
        
        let relevantKeyPressed = false;
        const keyUpper = event.key.toUpperCase();
        switch (keyUpper) {
            case 'M': startStopBtn.click(); relevantKeyPressed = true; break;
            case 'ARROWUP': changeTempo(1); relevantKeyPressed = true; break;
            case 'ARROWDOWN': changeTempo(-1); relevantKeyPressed = true; break;
            case 'ARROWRIGHT': changeTempo(5); relevantKeyPressed = true; break;
            case 'ARROWLEFT': changeTempo(-5); relevantKeyPressed = true; break;
        }
        if (relevantKeyPressed) event.preventDefault();
    });
}