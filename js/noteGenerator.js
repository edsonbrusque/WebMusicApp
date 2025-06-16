import { shuffleArray } from './utils.js';

export function initNoteGenerator() {
    console.log("Initialising Note Generator...");
    // --- Base Data ---
    const baseNotes = ["C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"];

    // --- DOM Elements ---
    const generateBtn = document.getElementById('notes-generateBtn');
    const notesGrid = document.getElementById('notes-grid');

    function displayNotes(notesToShow) {
        notesGrid.innerHTML = ''; // Clear previous notes
        notesToShow.forEach(note => {
            const noteBox = document.createElement('div');
            noteBox.classList.add('note-box');
            noteBox.textContent = note;
            notesGrid.appendChild(noteBox);
        });
    }
    function handleGenerateClick() {
        let notesToShuffle = [...baseNotes];
        shuffleArray(notesToShuffle);
        displayNotes(notesToShuffle);
    }

    // Note Generator Keyboard Listener
    window.addEventListener('keydown', (event) => {
        const targetTagName = event.target.tagName;
        if (targetTagName === 'INPUT' || targetTagName === 'TEXTAREA' || targetTagName === 'SELECT') return;

        // Prevent default behavior only if N is pressed
        const keyUpper = event.key.toUpperCase();
        if (keyUpper === 'N') {
            if (generateBtn) generateBtn.click();
            event.preventDefault();
        }
    });

    // --- Event Listeners & Initialisation ---
    if (generateBtn && notesGrid) {
        generateBtn.addEventListener('click', handleGenerateClick);
        // Initial display
        displayNotes(baseNotes);
    } else {
        console.error("Note Generator: One or more essential DOM elements are missing. Note Generator will not function.");
    }
}