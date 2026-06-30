/**
 * ═══════════════════════════════════════════════════
 *  KSP Crime Intelligence — Voice Input/Output
 *  Uses browser Web Speech API (SpeechRecognition +
 *  SpeechSynthesis) for hands-free interaction.
 * ═══════════════════════════════════════════════════
 */

const KSPVoice = (() => {
    // ── State ────────────────────────────────────
    let recognition = null;
    let isListening = false;
    let currentLanguage = 'en-IN'; // Default: English (India)
    let onResultCallback = null;

    // Language mapping for speech recognition
    const LANG_MAP = {
        en: 'en-IN',
        kn: 'kn-IN' // Kannada
    };

    // ── Initialize Speech Recognition ────────────
    function init(onResult) {
        onResultCallback = onResult;

        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[KSPVoice] SpeechRecognition not supported in this browser.');
            return false;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = false;      // Stop after one utterance
        recognition.interimResults = true;   // Show partial results
        recognition.maxAlternatives = 1;
        recognition.lang = currentLanguage;

        // ── Event Handlers ─────────────────────
        recognition.onstart = () => {
            isListening = true;
            updateVoiceButton(true);
            console.log('[KSPVoice] Listening...');
        };

        recognition.onresult = (event) => {
            let transcript = '';
            let isFinal = false;

            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    isFinal = true;
                }
            }

            // Show interim results in input field
            const inputEl = document.getElementById('chatInput');
            if (inputEl) {
                inputEl.value = transcript;
            }

            // Auto-send on final result
            if (isFinal && onResultCallback) {
                onResultCallback(transcript.trim());
            }
        };

        recognition.onerror = (event) => {
            console.warn('[KSPVoice] Error:', event.error);
            stopListening();

            // Show user-friendly messages for common errors
            if (event.error === 'not-allowed') {
                alert('Microphone access denied. Please allow microphone access in your browser settings.');
            }
        };

        recognition.onend = () => {
            isListening = false;
            updateVoiceButton(false);
            console.log('[KSPVoice] Stopped listening.');
        };

        return true;
    }

    // ── Start Listening ──────────────────────────
    function startListening() {
        if (!recognition) {
            console.warn('[KSPVoice] Not initialized.');
            return;
        }
        if (isListening) {
            stopListening();
            return;
        }
        try {
            recognition.lang = currentLanguage;
            recognition.start();
        } catch (e) {
            console.warn('[KSPVoice] Failed to start:', e.message);
        }
    }

    // ── Stop Listening ───────────────────────────
    function stopListening() {
        if (recognition && isListening) {
            recognition.stop();
        }
        isListening = false;
        updateVoiceButton(false);
    }

    // ── Toggle Listening ─────────────────────────
    function toggle() {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }

    // ── Update Voice Button UI ───────────────────
    function updateVoiceButton(active) {
        const btn = document.getElementById('voiceBtn');
        const wave = document.getElementById('geminiWaveBar');
        if (!btn) return;

        if (active) {
            btn.classList.add('listening');
            btn.title = 'Listening... Click to stop';
            if (wave) wave.style.display = 'flex';
        } else {
            btn.classList.remove('listening');
            btn.title = 'Click to speak';
            if (wave) wave.style.display = 'none';
        }
    }

    // ── Set Language ─────────────────────────────
    function setLanguage(lang) {
        currentLanguage = LANG_MAP[lang] || 'en-IN';
        if (recognition) {
            recognition.lang = currentLanguage;
        }
    }

    // ── Text-to-Speech (read response aloud) ────
    function speak(text, lang = 'en') {
        if (!window.speechSynthesis) {
            console.warn('[KSPVoice] SpeechSynthesis not supported.');
            return;
        }

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        // Clean text: remove emojis, markdown, etc.
        const cleanText = text
            .replace(/[\u{1F600}-\u{1F9FF}]/gu, '')  // Remove emojis
            .replace(/[#*_~`]/g, '')                    // Remove markdown
            .replace(/\n+/g, '. ')                      // Newlines to pauses
            .trim();

        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = LANG_MAP[lang] || 'en-IN';
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.volume = 0.8;

        // Try to find a good voice
        const voices = window.speechSynthesis.getVoices();
        const targetLang = LANG_MAP[lang] || 'en';
        const preferredVoice = voices.find(v => v.lang.startsWith(targetLang) && v.localService);
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        window.speechSynthesis.speak(utterance);
    }

    // ── Stop Speaking ────────────────────────────
    function stopSpeaking() {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    }

    // ── Check Support ────────────────────────────
    function isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    // ── Public API ───────────────────────────────
    return {
        init,
        startListening,
        stopListening,
        toggle,
        setLanguage,
        speak,
        stopSpeaking,
        isSupported,
        get isListening() { return isListening; }
    };
})();
