import { logCurrentTime } from './js/utils.js';
import { initMetronome } from './js/metronome.js';
import { initStopwatch } from './js/stopwatch.js';
import { initNoteGenerator } from './js/noteGenerator.js';
import { initAudioPlayer } from './js/audioPlayer.js';

// --- General Page Code ---

document.addEventListener('DOMContentLoaded', () => {
    logCurrentTime();
    initMetronome();
    initStopwatch();
    initNoteGenerator();
    initAudioPlayer();

    // --- Day/Night Mode Toggle ---
    const themeToggle = document.getElementById('day-night-toggle');
    const body = document.body;
    const themeSwitcherLabel = document.querySelector('.theme-switcher-label');

    function applyTheme(isNight) {
        if (isNight) { // Night Mode is active
            body.classList.add('night-mode');
            if (themeSwitcherLabel) themeSwitcherLabel.textContent = 'Night Mode'; // Label reflects current status
            if (themeToggle) themeToggle.checked = true; // Switch is ON (right)
        } else { // Day Mode is active
            body.classList.remove('night-mode');
            if (themeSwitcherLabel) themeSwitcherLabel.textContent = 'Day Mode';   // Label reflects current status
            if (themeToggle) themeToggle.checked = false; // Switch is OFF (left)
        }
    }

    function setThemePreference(isNight) {
        applyTheme(isNight);
        localStorage.setItem('theme', isNight ? 'night' : 'day');
        console.log(`Switched to ${isNight ? 'Night' : 'Day'} Mode`);
    }

    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            setThemePreference(themeToggle.checked);
        });
    }

    // Load saved theme or system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme === 'night');
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        applyTheme(prefersDark.matches); // applyTheme will set the switch and label correctly

        prefersDark.addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                applyTheme(e.matches);
            }
        });
    }

    // --- Section Toggling ---
    const toggleButtons = document.querySelectorAll('.toggle-section-btn');
    const localStoragePrefix = 'sectionToggle_';

    toggleButtons.forEach(button => {
        const targetId = button.getAttribute('aria-controls');
        const contentWrapper = document.getElementById(targetId);
        // Ensure closest and id are available; otherwise, this part might fail if structure is unexpected.
        const parentArticle = button.closest('.app-container');
        const sectionId = parentArticle ? parentArticle.id : null;
        const storageKey = sectionId ? localStoragePrefix + sectionId : null;

        if (!contentWrapper) {
            console.warn(`No content wrapper found for toggle button with aria-controls="${targetId}"`);
            return;
        }
        if (!storageKey) {
            console.warn(`Could not determine storage key for toggle button in section with targetId="${targetId}". Ensure it's within an .app-container with an ID.`);
            // Optionally, allow toggling without persistence if storageKey is null
        }

        // Load saved state
        const savedState = storageKey ? localStorage.getItem(storageKey) : null;
        let isHidden = savedState === 'hidden'; // Default to shown if savedState is null or 'shown'

        contentWrapper.classList.toggle('hidden', isHidden);
        button.textContent = isHidden ? 'Show' : 'Hide';
        button.setAttribute('aria-expanded', !isHidden);

        button.addEventListener('click', () => {
            const currentlyHidden = contentWrapper.classList.toggle('hidden');
            button.textContent = currentlyHidden ? 'Show' : 'Hide';
            button.setAttribute('aria-expanded', !currentlyHidden);
            if (storageKey) {
                localStorage.setItem(storageKey, currentlyHidden ? 'hidden' : 'shown');
            }
        });
    });
});
