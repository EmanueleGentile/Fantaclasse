/* ==========================================================================
   FANTASTUDENTE — script.js (HARDENED CYBERSECURITY & GDPR EDITION)
   Integrazione PocketBase sicura, DOM rendering anti-XSS (zero innerHTML
   non sanitizzato), validazione rigorosa input, blocco link/script/PII,
   honeypot anti-bot, cooldown/debounce anti-spam e confetti canvas locale.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    /* ── 0. COSTANTI DI SICUREZZA & SANITIZZAZIONE (ANTI-XSS / ANTI-SPAM) ── */
    const ALLOWED_CATEGORIES = new Set(['idea', 'like', 'improve', 'bug', 'feature', 'other']);
    const ALLOWED_STATUSES = new Set(['in_valutazione', 'in_sviluppo', 'approvato', 'implementato', 'rifiutato']);
    const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,30}$/;

    // Cooldown anti-spam
    const SUBMIT_COOLDOWN_MS = 60 * 1000; // 60 secondi tra invii feedback
    const VOTE_DEBOUNCE_MS = 1500;        // 1.5 secondi tra click su Like

    // Storage tecnico locale (esente da cookie banner ex Linee Guida Garante Privacy)
    const STORAGE_VOTED_KEY = 'fantastudente_voted_feedbacks';
    const STORAGE_COOLDOWN_KEY = 'fantastudente_last_submit_ts';

    // Pattern di sicurezza: blocco URL/link, script/XSS, e dati personali (email/telefono)
    const LINK_PATTERN = /(?:https?:\/\/|ftp:\/\/|www\.|\b[a-z0-9-]+\.(?:com|it|org|net|edu|gov|io|gg|xyz|me|info|biz|co|uk|ru|cn|tk|ml|ga|cf|gq|top|club|online|site|tech|app|dev)\b)/i;
    const XSS_SCRIPT_PATTERN = /<[^>]*>|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|on(?:error|load|click|mouseover|focus|blur|submit|key|change|input)\s*=|\beval\s*\(|\balert\s*\(|\bdocument\.cookie\b|\bwindow\.location\b/i;
    const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const PHONE_PATTERN = /(?:\+39\s?)?\b3\d{2}[\s.-]?\d{6,7}\b/;
    const INVISIBLE_CHARS_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function sanitizeText(str, maxLength = 1000) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(INVISIBLE_CHARS_PATTERN, '')
            .replace(/[<>]/g, '')
            .trim()
            .slice(0, maxLength);
    }

    function validateFieldSecurity(value, fieldLabel) {
        if (!value) return { valid: true, reason: '' };
        if (XSS_SCRIPT_PATTERN.test(value) || /[<>]/.test(value)) {
            return {
                valid: false,
                reason: `Il campo "${fieldLabel}" contiene tag HTML o codice non consentito per motivi di sicurezza.`
            };
        }
        if (LINK_PATTERN.test(value)) {
            return {
                valid: false,
                reason: `Per sicurezza e anti-spam non è consentito inserire link o URL nel campo "${fieldLabel}".`
            };
        }
        if (EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value)) {
            return {
                valid: false,
                reason: `Nel rispetto della Privacy (Art. 5 GDPR), non inserire email o numeri di telefono nel campo "${fieldLabel}".`
            };
        }
        return { valid: true, reason: '' };
    }

    function normalizeRecord(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const safeId = VALID_ID_REGEX.test(String(raw.id || '')) ? String(raw.id) : `local-${Date.now()}`;
        const safeCategory = ALLOWED_CATEGORIES.has(raw.categoria) ? raw.categoria : 'other';
        const safeStatus = ALLOWED_STATUSES.has(raw.stato) ? raw.stato : 'in_valutazione';
        const rawVote = parseInt(raw.voto, 10);
        const safeVote = (!isNaN(rawVote) && rawVote >= 1 && rawVote <= 5) ? rawVote : 5;
        const rawUpvotes = parseInt(raw.upvotes, 10);
        const safeUpvotes = (!isNaN(rawUpvotes) && rawUpvotes >= 0) ? Math.min(rawUpvotes, 999999) : 0;

        return {
            id: safeId,
            titolo: sanitizeText(raw.titolo || '', 80),
            messaggio_feedback: sanitizeText(raw.messaggio_feedback || '', 1000),
            categoria: safeCategory,
            nome_utente: sanitizeText(raw.nome_utente || '', 40),
            anonimo: Boolean(raw.anonimo),
            upvotes: safeUpvotes,
            voto: safeVote,
            stato: safeStatus,
            risposta_admin: sanitizeText(raw.risposta_admin || '', 500),
            created: typeof raw.created === 'string' ? raw.created : ''
        };
    }


    /* ── 1. NAVBAR SCROLL & MENU MOBILE ── */
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    const sections = document.querySelectorAll('section[id]');
    const navItems = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        navbar?.classList.toggle('scrolled', scrollY > 30);

        let currentId = '';
        sections.forEach(sec => {
            const top = sec.offsetTop - 120;
            const height = sec.offsetHeight;
            if (scrollY >= top && scrollY < top + height) {
                currentId = sec.getAttribute('id') || '';
            }
        });

        navItems.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${currentId}`);
        });
    }, { passive: true });

    navToggle?.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        navToggle.classList.toggle('open', isOpen);
        navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navItems.forEach(link => {
        link.addEventListener('click', () => {
            navLinks?.classList.remove('open');
            navToggle?.classList.remove('open');
            navToggle?.setAttribute('aria-expanded', 'false');
        });
    });


    /* ── 2. SCROLL REVEAL (INTERSECTION OBSERVER) ── */
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));


    /* ── 3. CONTATORI ANIMATI ── */
    function animateNumber(el, target, duration = 1200, isFloat = false) {
        if (!el) return;
        const start = 0;
        let startTime = null;

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = start + (target - start) * ease;
            el.textContent = isFloat ? current.toFixed(1) : String(Math.round(current));
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = isFloat ? target.toFixed(1) : String(target);
            }
        }
        requestAnimationFrame(step);
    }


    /* ── 4. RATING A STELLE FORM (1-5 STELLE) ── */
    let selectedRating = 5;
    const starButtons = document.querySelectorAll('.star-btn');
    const starHint = document.getElementById('starHint');
    const starLabels = [
        '',
        'Non mi convince 😕',
        'Potrebbe migliorare 🤔',
        'Non è male! 😊',
        'Mi piace molto! 😄',
        'ASSOLUTAMENTE EPICO! 🔥⚽'
    ];

    function setStars(val) {
        const safeVal = Math.min(Math.max(parseInt(val, 10) || 5, 1), 5);
        starButtons.forEach((btn, idx) => {
            btn.classList.toggle('active', idx < safeVal);
        });
        if (starHint) {
            starHint.textContent = safeVal > 0 ? starLabels[safeVal] : 'Clicca sulle stelle per votare';
        }
    }

    starButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedRating = Math.min(Math.max(parseInt(btn.dataset.val, 10) || 5, 1), 5);
            setStars(selectedRating);
        });

        btn.addEventListener('mouseenter', () => {
            const hoverVal = Math.min(Math.max(parseInt(btn.dataset.val, 10) || 5, 1), 5);
            setStars(hoverVal);
        });

        btn.addEventListener('mouseleave', () => {
            setStars(selectedRating);
        });
    });

    setStars(selectedRating);


    /* ── 5. SELEZIONE ANONIMATO (ANONIMO VS NICKNAME OPZIONALE) ── */
    const radioAnon = document.getElementById('radioAnon');
    const radioNamed = document.getElementById('radioNamed');
    const nameGroup = document.getElementById('nameGroup');
    const userNameInput = document.getElementById('userName');
    const nameError = document.getElementById('nameError');

    function handleAnonChange() {
        if (radioNamed?.checked) {
            if (nameGroup) nameGroup.style.display = 'block';
            setTimeout(() => userNameInput?.focus(), 100);
        } else if (nameGroup) {
            nameGroup.style.display = 'none';
            nameError?.classList.remove('visible');
            userNameInput?.classList.remove('error');
        }
    }

    radioAnon?.addEventListener('change', handleAnonChange);
    radioNamed?.addEventListener('change', handleAnonChange);


    /* ── 6. CONTEGGIO CARATTERI TEXTAREA & INPUTS ── */
    const feedbackText = document.getElementById('feedbackText');
    const charCount = document.getElementById('charCount');
    const textError = document.getElementById('textError');
    const feedbackTitle = document.getElementById('feedbackTitle');
    const titleError = document.getElementById('titleError');
    const legalConsent = document.getElementById('legalConsent');
    const consentError = document.getElementById('consentError');
    const securityError = document.getElementById('securityError');

    function hideSecurityError() {
        if (securityError) {
            securityError.style.display = 'none';
            securityError.textContent = '';
        }
    }

    function showSecurityError(message) {
        if (securityError) {
            securityError.textContent = message;
            securityError.style.display = 'block';
        }
    }

    feedbackText?.addEventListener('input', () => {
        const len = feedbackText.value.length;
        if (charCount) {
            charCount.textContent = String(len);
            charCount.style.color = len > 950 ? '#ef4444' : '';
        }
        if (len >= 5) {
            textError?.classList.remove('visible');
            feedbackText.classList.remove('error');
        }
        hideSecurityError();
    });

    userNameInput?.addEventListener('input', () => {
        if (userNameInput.value.trim().length >= 2) {
            nameError?.classList.remove('visible');
            userNameInput.classList.remove('error');
        }
        hideSecurityError();
    });

    feedbackTitle?.addEventListener('input', () => {
        titleError?.classList.remove('visible');
        feedbackTitle.classList.remove('error');
        hideSecurityError();
    });

    legalConsent?.addEventListener('change', () => {
        if (legalConsent.checked) {
            consentError?.classList.remove('visible');
        }
    });


    /* ── 7. PROMPT CREATIVI "HAI UN'IDEA?" ── */
    const promptCards = document.querySelectorAll('.prompt-card');
    promptCards.forEach(card => {
        card.addEventListener('click', () => {
            const category = ALLOWED_CATEGORIES.has(card.dataset.category) ? card.dataset.category : 'idea';
            const prompt = sanitizeText(card.dataset.prompt || '', 120);

            const catRadio = document.querySelector(`input[name="category"][value="${category}"]`);
            if (catRadio) catRadio.checked = true;

            if (feedbackText) {
                feedbackText.value = `${prompt} `;
                if (charCount) charCount.textContent = String(feedbackText.value.length);
            }

            const feedbackSection = document.getElementById('feedback');
            if (feedbackSection) {
                feedbackSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            setTimeout(() => {
                feedbackText?.focus();
                if (feedbackText) {
                    feedbackText.selectionStart = feedbackText.selectionEnd = feedbackText.value.length;
                }
            }, 600);
        });
    });


    /* ── 8. CONFIGURAZIONE ENDPOINT POCKETBASE DINAMICO ── */
    function getPocketBaseUrl() {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://127.0.0.1:8090';
        }
        if (window.location.port === '8080') {
            return `${window.location.protocol}//${hostname}:8090`;
        }
        return window.location.origin;
    }

    const PB_API_URL = getPocketBaseUrl();


    /* ── 9. STATO LOCALE E SERVIZIO FEEDBACK SICURO ── */
    let liveFeedbacks = [];
    let currentCategory = 'all';
    let searchQuery = '';
    let currentSort = 'newest';
    let isSubmitting = false;
    let lastVoteTimestamp = 0;
    const votingInProgress = new Set();

    const FeedbackService = {
        getVotedIds() {
            try {
                const raw = JSON.parse(localStorage.getItem(STORAGE_VOTED_KEY) || '[]');
                if (!Array.isArray(raw)) return new Set();
                return new Set(raw.filter(id => typeof id === 'string' && VALID_ID_REGEX.test(id)));
            } catch (e) {
                return new Set();
            }
        },

        saveVotedId(id) {
            if (!VALID_ID_REGEX.test(String(id || ''))) return;
            try {
                const set = this.getVotedIds();
                set.add(String(id));
                localStorage.setItem(STORAGE_VOTED_KEY, JSON.stringify(Array.from(set).slice(-500)));
            } catch (e) {
                // Storage pieno o disabilitato
            }
        },

        getRemainingCooldownSeconds() {
            try {
                const lastTs = parseInt(localStorage.getItem(STORAGE_COOLDOWN_KEY) || '0', 10);
                if (!lastTs || isNaN(lastTs)) return 0;
                const elapsed = Date.now() - lastTs;
                if (elapsed < SUBMIT_COOLDOWN_MS) {
                    return Math.ceil((SUBMIT_COOLDOWN_MS - elapsed) / 1000);
                }
                return 0;
            } catch (e) {
                return 0;
            }
        },

        recordSubmissionTimestamp() {
            try {
                localStorage.setItem(STORAGE_COOLDOWN_KEY, String(Date.now()));
            } catch (e) {
                // Ignora se localStorage è disattivato
            }
        },

        async fetchAll() {
            try {
                const response = await fetch(`${PB_API_URL}/api/collections/Feedback/records?sort=-created&perPage=100`, {
                    headers: { 'Accept': 'application/json' }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }

                const data = await response.json();
                const rawItems = Array.isArray(data.items) ? data.items : [];
                return rawItems.map(normalizeRecord).filter(Boolean);
            } catch (err) {
                console.warn('Connessione al database non riuscita o offline:', err);
                return this.getFallbackFeedbacks().map(normalizeRecord).filter(Boolean);
            }
        },

        async createFeedback(payload) {
            const safeCategory = ALLOWED_CATEGORIES.has(payload.category) ? payload.category : 'idea';
            const safeRating = Math.min(Math.max(parseInt(payload.rating, 10) || 5, 1), 5);
            const isAnon = payload.anonymity === 'anon';

            const pbData = {
                nome_utente: isAnon ? '' : sanitizeText(payload.name || '', 40),
                titolo: sanitizeText(payload.title || '', 80),
                messaggio_feedback: sanitizeText(payload.text || '', 1000),
                categoria: safeCategory,
                voto: safeRating,
                anonimo: isAnon,
                upvotes: 0,
                stato: 'in_valutazione',
                risposta_admin: ''
            };

            const response = await fetch(`${PB_API_URL}/api/collections/Feedback/records`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(pbData)
            });

            if (response.status === 429) {
                const rateErr = new Error('RATE_LIMIT');
                rateErr.code = 429;
                throw rateErr;
            }

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                console.error('Errore PocketBase durante il salvataggio:', errJson);
                throw new Error('Impossibile salvare il feedback su PocketBase');
            }

            const created = await response.json();
            return normalizeRecord(created) || normalizeRecord({ ...pbData, id: `local-${Date.now()}`, created: new Date().toISOString() });
        },

        async incrementUpvote(id, currentVotes) {
            const safeId = String(id || '');
            const newVotes = (parseInt(currentVotes, 10) || 0) + 1;
            if (!VALID_ID_REGEX.test(safeId)) return newVotes;

            try {
                // Endpoint custom sicuro (pb_hooks) per incrementare solo upvotes senza dare permessi update pubblici sulla collezione
                const response = await fetch(`${PB_API_URL}/api/feedback/${encodeURIComponent(safeId)}/upvote`, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' }
                });
                if (response.ok) {
                    const data = await response.json().catch(() => null);
                    this.saveVotedId(safeId);
                    if (data && typeof data.upvotes === 'number') {
                        return data.upvotes;
                    }
                    return newVotes;
                }
            } catch (e) {
                // Fallback locale se l'endpoint non è raggiungibile
            }
            this.saveVotedId(safeId);
            return newVotes;
        },

        getFallbackFeedbacks() {
            return [
                {
                    id: 'seed-1',
                    titolo: 'Bonus "Salva-Classe" volontario',
                    messaggio_feedback: 'Se ti offri volontario all\'interrogazione evitando che il prof chiami a sorte un compagno disperato: +2 punti bonus istantanei!',
                    categoria: 'idea',
                    nome_utente: 'FantaBomber_4A',
                    anonimo: false,
                    upvotes: 42,
                    voto: 5,
                    stato: 'in_sviluppo',
                    risposta_admin: 'Grande proposta! Stiamo testando l\'algoritmo nel calcolo delle formazioni.',
                    created: new Date(Date.now() - 3600000 * 24).toISOString()
                },
                {
                    id: 'seed-2',
                    titolo: 'Asta live alla LIM con fanta-crediti',
                    messaggio_feedback: 'Creiamo una schermata proiettabile sulla lavagna interattiva della classe per fare l\'asta con timer sonoro da 30 secondi a studente!',
                    categoria: 'feature',
                    nome_utente: 'MisterSara_3B',
                    anonimo: false,
                    upvotes: 68,
                    voto: 5,
                    stato: 'approvato',
                    risposta_admin: 'Approvata all\'unanimità! Sarà parte del prossimo grande aggiornamento.',
                    created: new Date(Date.now() - 3600000 * 48).toISOString()
                },
                {
                    id: 'seed-3',
                    titolo: 'Malus dimenticanza materiale / calcolatrice',
                    messaggio_feedback: 'Dimenticare la calcolatrice scientifica o il libro deve valere almeno -1.5 punti nel voto finale!',
                    categoria: 'idea',
                    nome_utente: '',
                    anonimo: true,
                    upvotes: 19,
                    voto: 4,
                    stato: 'in_valutazione',
                    risposta_admin: '',
                    created: new Date(Date.now() - 3600000 * 72).toISOString()
                }
            ];
        }
    };


    /* ── 10. CATEGORIE & STILI ── */
    const categoryNames = {
        idea: '💡 Idea',
        like: '⭐ Cosa piace',
        improve: '🔧 Miglioria',
        bug: '🐛 Problema',
        feature: '🚀 Feature',
        other: '🎯 Altro'
    };

    const categoryClasses = {
        idea: 'cat-idea',
        like: 'cat-like',
        improve: 'cat-improve',
        bug: 'cat-bug',
        feature: 'cat-feature',
        other: 'cat-other'
    };

    const statusLabels = {
        in_valutazione: { text: 'In Valutazione', class: 'status-in_valutazione' },
        in_sviluppo: { text: 'In Sviluppo 🚀', class: 'status-in_sviluppo' },
        approvato: { text: 'Approvata ⭐', class: 'status-approvato' },
        implementato: { text: 'Nel Gioco! 🏆', class: 'status-implementato' },
        rifiutato: { text: 'Archiviata', class: 'status-rifiutato' }
    };

    function formatRelativeDate(dateString) {
        if (!dateString) return 'Recentemente';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Recentemente';

        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHours = Math.floor(diffMin / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSec < 45) return 'Proprio adesso';
        if (diffMin < 60) return `${diffMin} min fa`;
        if (diffHours < 24) return `${diffHours} ore fa`;
        if (diffDays === 1) return 'Ieri';
        if (diffDays < 7) return `${diffDays} giorni fa`;

        return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    }


    /* ── 11. AGGIORNAMENTO DINAMICO DELLE STATISTICHE & TICKER (SAFE DOM) ── */
    function updateLiveStats(items) {
        const total = items.length;
        const totalIdeas = items.filter(f => f.categoria === 'idea' || f.categoria === 'feature').length;
        const totalImplemented = items.filter(f => f.stato === 'implementato').length;

        const validVotes = items.map(f => parseFloat(f.voto) || 5);
        const avg = validVotes.length > 0
            ? (validVotes.reduce((a, b) => a + b, 0) / validVotes.length)
            : 5.0;

        const navCounter = document.getElementById('feedbackCounter');
        if (navCounter) navCounter.textContent = `${total} feedback raccolti`;

        const heroFeedbackNum = document.getElementById('heroFeedbackNum');
        if (heroFeedbackNum) animateNumber(heroFeedbackNum, total);

        const heroIdeasNum = document.getElementById('heroIdeasNum');
        if (heroIdeasNum) animateNumber(heroIdeasNum, totalIdeas);

        const heroImplementedNum = document.getElementById('heroImplementedNum');
        if (heroImplementedNum) animateNumber(heroImplementedNum, totalImplemented);

        const heroRatingNum = document.getElementById('heroRatingNum');
        if (heroRatingNum) animateNumber(heroRatingNum, avg, 1200, true);

        const sideTotal = document.getElementById('sideTotalFeedback');
        if (sideTotal) sideTotal.textContent = String(total);

        const sideIdeas = document.getElementById('sideIdeasCount');
        if (sideIdeas) sideIdeas.textContent = String(totalIdeas);

        const sideImplemented = document.getElementById('sideImplementedCount');
        if (sideImplemented) sideImplemented.textContent = String(totalImplemented);

        const sideAvg = document.getElementById('sideAvgRating');
        if (sideAvg) sideAvg.textContent = `⭐ ${avg.toFixed(1)} / 5`;

        const countMap = {
            all: total,
            idea: items.filter(f => f.categoria === 'idea').length,
            feature: items.filter(f => f.categoria === 'feature').length,
            like: items.filter(f => f.categoria === 'like').length,
            improve: items.filter(f => f.categoria === 'improve').length,
            bug: items.filter(f => f.categoria === 'bug').length
        };

        const countAll = document.getElementById('countAll');
        if (countAll) countAll.textContent = String(countMap.all);
        const countIdea = document.getElementById('countIdea');
        if (countIdea) countIdea.textContent = String(countMap.idea);
        const countFeature = document.getElementById('countFeature');
        if (countFeature) countFeature.textContent = String(countMap.feature);
        const countLike = document.getElementById('countLike');
        if (countLike) countLike.textContent = String(countMap.like);
        const countImprove = document.getElementById('countImprove');
        if (countImprove) countImprove.textContent = String(countMap.improve);
        const countBug = document.getElementById('countBug');
        if (countBug) countBug.textContent = String(countMap.bug);

        updateLiveTicker(items);
    }

    function updateLiveTicker(items) {
        const tickerTrack = document.querySelector('.ticker-content');
        if (!tickerTrack) return;

        const validItems = items.filter(i => i.messaggio_feedback && i.messaggio_feedback.length > 5);
        if (validItems.length === 0) return;

        const slice = validItems.slice(0, 10);
        const doubled = [...slice, ...slice];
        const fragment = document.createDocumentFragment();

        doubled.forEach(item => {
            const isNegative = item.categoria === 'bug' || item.messaggio_feedback.toLowerCase().includes('malus');
            const dot = isNegative ? '🔴' : '🟢';
            const cls = isNegative ? 'bonus-neg' : 'bonus-pos';
            const rawLabel = item.titolo || `${item.messaggio_feedback.substring(0, 45)}...`;

            const span = document.createElement('span');
            span.className = `ticker-item ${cls}`;
            span.textContent = `${dot} ${sanitizeText(rawLabel, 80)}`;
            fragment.appendChild(span);
        });

        tickerTrack.replaceChildren(fragment);
    }


    /* ── 12. RENDERING BACHECA COMMUNITY (100% SAFE DOM, NO UNSANITIZED INNERHTML) ── */
    const communityGrid = document.getElementById('communityGrid');
    const communitySearch = document.getElementById('communitySearch');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const communitySort = document.getElementById('communitySort');
    const filterChips = document.querySelectorAll('.filter-chip');

    function renderEmptyState(query) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 48px 20px; background: #fff; border-radius: 20px; border: 1.5px dashed var(--gray-300);';

        const icon = document.createElement('div');
        icon.style.cssText = 'font-size: 2.8rem; margin-bottom: 12px;';
        icon.textContent = '📭';

        const heading = document.createElement('h3');
        heading.style.cssText = 'font-size: 1.3rem; margin-bottom: 8px;';
        heading.textContent = 'Nessuna idea trovata';

        const paragraph = document.createElement('p');
        paragraph.style.cssText = 'color: var(--gray-600); margin-bottom: 20px;';
        paragraph.textContent = query
            ? `Nessun risultato corrisponde a "${sanitizeText(query, 60)}".`
            : 'Sii tu il primo studente a proporre un\'idea!';

        const cta = document.createElement('a');
        cta.href = '#feedback';
        cta.className = 'btn btn-primary';
        cta.style.cssText = 'padding: 10px 22px; font-size: 0.9rem;';
        cta.textContent = '💡 Scrivi la prima idea';

        wrapper.append(icon, heading, paragraph, cta);
        return wrapper;
    }

    function createIdeaCardElement(item, votedSet) {
        const card = document.createElement('div');
        card.className = 'idea-card';

        const isAnon = Boolean(item.anonimo) || !item.nome_utente;
        const authorName = isAnon ? 'Anonimo' : sanitizeText(item.nome_utente, 40);
        const isVoted = votedSet.has(item.id);
        const votesCount = Math.max(parseInt(item.upvotes, 10) || 0, 0);
        const safeRating = Math.min(Math.max(parseInt(item.voto, 10) || 5, 1), 5);
        const starsDisplay = '★'.repeat(safeRating);

        const safeCat = ALLOWED_CATEGORIES.has(item.categoria) ? item.categoria : 'other';
        const cardTitle = (item.titolo && item.titolo.trim() !== '')
            ? sanitizeText(item.titolo, 80)
            : (categoryNames[safeCat] || 'Proposta Community');

        const statusKey = ALLOWED_STATUSES.has(item.stato) ? item.stato : 'in_valutazione';
        const statusInfo = statusLabels[statusKey] || statusLabels.in_valutazione;

        // Header
        const header = document.createElement('div');
        header.className = 'idea-card-header';

        const headerLeft = document.createElement('div');
        const statusBadge = document.createElement('div');
        statusBadge.className = `status-badge ${statusInfo.class}`;
        statusBadge.textContent = statusInfo.text;

        const titleEl = document.createElement('h4');
        titleEl.className = 'idea-card-title';
        titleEl.textContent = cardTitle;
        headerLeft.append(statusBadge, titleEl);

        const catBadge = document.createElement('span');
        catBadge.className = `cat-badge ${categoryClasses[safeCat] || 'cat-other'}`;
        catBadge.textContent = categoryNames[safeCat] || '🎯 Altro';

        header.append(headerLeft, catBadge);
        card.appendChild(header);

        // Body text
        const textEl = document.createElement('p');
        textEl.className = 'idea-card-text';
        textEl.textContent = sanitizeText(item.messaggio_feedback, 1000);
        card.appendChild(textEl);

        // Risposta ufficiale Admin (se presente)
        if (item.risposta_admin && item.risposta_admin.trim().length > 0) {
            const replyBox = document.createElement('div');
            replyBox.className = 'dev-reply-box';

            const replyHeader = document.createElement('div');
            replyHeader.className = 'dev-reply-header';
            const replyIcon = document.createElement('span');
            replyIcon.textContent = '💬';
            replyHeader.append(replyIcon, document.createTextNode(' Risposta del Team Fantaclasse'));

            const replyText = document.createElement('p');
            replyText.className = 'dev-reply-text';
            replyText.textContent = `"${sanitizeText(item.risposta_admin, 500)}"`;

            replyBox.append(replyHeader, replyText);
            card.appendChild(replyBox);
        }

        // Stelle
        const starsEl = document.createElement('div');
        starsEl.className = 'idea-card-stars';
        starsEl.setAttribute('title', `${safeRating} stelle su 5`);
        starsEl.textContent = starsDisplay;
        card.appendChild(starsEl);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'idea-card-footer';

        const authorWrap = document.createElement('div');
        authorWrap.className = `idea-author ${isAnon ? 'author-anon' : ''}`;

        const authorSpan = document.createElement('span');
        authorSpan.textContent = `👤 ${authorName}`;

        const dateSpan = document.createElement('span');
        dateSpan.className = 'card-date-time';
        dateSpan.textContent = `• ${formatRelativeDate(item.created)}`;

        authorWrap.append(authorSpan, dateSpan);

        const voteBtn = document.createElement('button');
        voteBtn.type = 'button';
        voteBtn.className = `vote-btn ${isVoted ? 'voted' : ''}`;
        voteBtn.setAttribute('aria-label', 'Vota questa idea');

        const thumbSpan = document.createElement('span');
        thumbSpan.className = 'vote-thumb';
        thumbSpan.textContent = '👍';

        const countEl = document.createElement('span');
        countEl.className = 'vote-count';
        countEl.textContent = String(votesCount);

        voteBtn.append(thumbSpan, countEl);

        // Click su Upvote con anti-spam debounce e blocco doppio voto
        voteBtn.addEventListener('click', async () => {
            if (FeedbackService.getVotedIds().has(item.id) || votingInProgress.has(item.id)) {
                voteBtn.classList.add('voted');
                return;
            }

            const now = Date.now();
            if (now - lastVoteTimestamp < VOTE_DEBOUNCE_MS) {
                return; // Ignora click multipli rapidi (anti-flood)
            }
            lastVoteTimestamp = now;
            votingInProgress.add(item.id);

            const current = parseInt(countEl.textContent, 10) || 0;
            countEl.textContent = String(current + 1);
            voteBtn.classList.add('voted');

            item.upvotes = current + 1;
            try {
                await FeedbackService.incrementUpvote(item.id, current);
            } finally {
                votingInProgress.delete(item.id);
            }
        });

        footer.append(authorWrap, voteBtn);
        card.appendChild(footer);

        return card;
    }

    function renderCommunity() {
        if (!communityGrid) return;

        const votedSet = FeedbackService.getVotedIds();

        // 1. Filtro Categoria
        let filtered = currentCategory === 'all'
            ? [...liveFeedbacks]
            : liveFeedbacks.filter(item => item.categoria === currentCategory);

        // 2. Filtro Ricerca
        if (searchQuery.trim().length > 0) {
            const q = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(item => {
                const title = (item.titolo || '').toLowerCase();
                const text = (item.messaggio_feedback || '').toLowerCase();
                const author = (item.nome_utente || '').toLowerCase();
                return title.includes(q) || text.includes(q) || author.includes(q);
            });
        }

        // 3. Ordinamento
        if (currentSort === 'popular') {
            filtered.sort((a, b) => (parseInt(b.upvotes, 10) || 0) - (parseInt(a.upvotes, 10) || 0));
        } else if (currentSort === 'newest') {
            filtered.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));
        } else if (currentSort === 'rating') {
            filtered.sort((a, b) => (parseFloat(b.voto) || 0) - (parseFloat(a.voto) || 0));
        }

        // 4. Stato Vuoto
        if (filtered.length === 0) {
            communityGrid.replaceChildren(renderEmptyState(searchQuery));
            return;
        }

        // 5. Creazione Card Sicure
        const fragment = document.createDocumentFragment();
        filtered.forEach(item => {
            fragment.appendChild(createIdeaCardElement(item, votedSet));
        });
        communityGrid.replaceChildren(fragment);
    }

    // Gestione Filtri Categoria
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const cat = chip.dataset.category || 'all';
            currentCategory = (cat === 'all' || ALLOWED_CATEGORIES.has(cat)) ? cat : 'all';
            renderCommunity();
        });
    });

    // Gestione Ricerca
    communitySearch?.addEventListener('input', (e) => {
        searchQuery = sanitizeText(e.target.value, 80);
        if (clearSearchBtn) {
            clearSearchBtn.style.display = searchQuery.length > 0 ? 'flex' : 'none';
        }
        renderCommunity();
    });

    clearSearchBtn?.addEventListener('click', () => {
        if (communitySearch) communitySearch.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        renderCommunity();
    });

    // Gestione Ordinamento
    communitySort?.addEventListener('change', (e) => {
        const val = e.target.value;
        currentSort = ['popular', 'newest', 'rating'].includes(val) ? val : 'newest';
        renderCommunity();
    });


    /* ── 13. CARICAMENTO INIZIALE DATI DAL SERVER ── */
    async function loadData() {
        if (communityGrid) {
            const loadingBox = document.createElement('div');
            loadingBox.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 40px; color: var(--gray-600);';

            const spinner = document.createElement('div');
            spinner.className = 'spinner';
            spinner.style.cssText = 'border-top-color: var(--blue-600); margin: 0 auto 12px;';

            const msg = document.createElement('p');
            msg.style.fontWeight = '600';
            msg.textContent = 'Caricamento bacheca community dal database...';

            loadingBox.append(spinner, msg);
            communityGrid.replaceChildren(loadingBox);
        }

        liveFeedbacks = await FeedbackService.fetchAll();
        updateLiveStats(liveFeedbacks);
        renderCommunity();
    }

    loadData();


    /* ── 14. INVIO FORM FEEDBACK CON VALIDAZIONE RIGOROSA & ANTI-SPAM ── */
    const feedbackForm = document.getElementById('feedbackForm');
    const websiteHp = document.getElementById('websiteHp');
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const submitSpinner = document.getElementById('submitSpinner');
    const successCard = document.getElementById('successCard');
    const successPreview = document.getElementById('successPreview');
    const newFeedbackBtn = document.getElementById('newFeedbackBtn');

    function renderSuccessPreview(payload) {
        if (!successPreview) return;

        const safeCat = ALLOWED_CATEGORIES.has(payload.category) ? payload.category : 'other';
        const safeRating = Math.min(Math.max(parseInt(payload.rating, 10) || 5, 1), 5);

        const topRow = document.createElement('div');
        topRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;';

        const catBadge = document.createElement('span');
        catBadge.className = `cat-badge ${categoryClasses[safeCat] || 'cat-other'}`;
        catBadge.textContent = categoryNames[safeCat] || '🎯 Altro';

        const starsSpan = document.createElement('span');
        starsSpan.style.cssText = 'font-weight:700; color:var(--gold-500);';
        starsSpan.textContent = '★'.repeat(safeRating);

        topRow.append(catBadge, starsSpan);

        const elements = [topRow];

        if (payload.title) {
            const titleEl = document.createElement('h4');
            titleEl.style.cssText = 'margin: 6px 0; color: var(--gray-900);';
            titleEl.textContent = sanitizeText(payload.title, 80);
            elements.push(titleEl);
        }

        const bodyEl = document.createElement('p');
        bodyEl.style.cssText = 'font-size:0.95rem; color:var(--gray-800); margin-bottom:8px;';
        bodyEl.textContent = `"${sanitizeText(payload.text, 1000)}"`;
        elements.push(bodyEl);

        const metaEl = document.createElement('small');
        metaEl.style.cssText = 'color:var(--gray-500); font-weight:600;';
        const authorBold = document.createElement('b');
        authorBold.textContent = sanitizeText(payload.name, 40);
        metaEl.append(
            document.createTextNode('Inviato da: '),
            authorBold,
            document.createTextNode(payload.anonymity === 'anon' ? ' (Anonimo 🕵️)' : ' (Nickname 👋)')
        );
        elements.push(metaEl);

        successPreview.replaceChildren(...elements);
    }

    feedbackForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideSecurityError();

        // 0. Blocco invii simultanei (debounce lock)
        if (isSubmitting) return;

        // 1. Controllo Honeypot anti-bot
        if (websiteHp && websiteHp.value.trim() !== '') {
            console.warn('Bot rilevato tramite honeypot.');
            return;
        }

        // 2. Controllo Cooldown anti-spam client-side
        const remainingCooldown = FeedbackService.getRemainingCooldownSeconds();
        if (remainingCooldown > 0) {
            showSecurityError(`⏳ Protezione Anti-Spam attiva: attendi ancora ${remainingCooldown} secondi prima di inviare un nuovo feedback.`);
            return;
        }

        let isValid = true;

        // 3. Validazione Nickname (se scelto)
        const isNamed = Boolean(radioNamed?.checked);
        const rawName = userNameInput?.value.trim() || '';
        if (isNamed) {
            const nameSec = validateFieldSecurity(rawName, 'Nickname');
            if (rawName.length < 2 || rawName.length > 40 || !nameSec.valid) {
                if (nameError) {
                    nameError.textContent = !nameSec.valid
                        ? nameSec.reason
                        : 'Inserisci un nickname valido (da 2 a 40 caratteri)!';
                    nameError.classList.add('visible');
                }
                userNameInput?.classList.add('error');
                userNameInput?.focus();
                isValid = false;
            } else {
                nameError?.classList.remove('visible');
                userNameInput?.classList.remove('error');
            }
        } else {
            nameError?.classList.remove('visible');
            userNameInput?.classList.remove('error');
        }

        // 4. Validazione Titolo (opzionale, ma max 80 char e senza link/script)
        const rawTitle = feedbackTitle?.value.trim() || '';
        if (rawTitle.length > 0) {
            const titleSec = validateFieldSecurity(rawTitle, 'Titolo');
            if (rawTitle.length > 80 || !titleSec.valid) {
                if (titleError) {
                    titleError.textContent = !titleSec.valid
                        ? titleSec.reason
                        : 'Il titolo non può superare gli 80 caratteri.';
                    titleError.classList.add('visible');
                }
                feedbackTitle?.classList.add('error');
                if (isValid) feedbackTitle?.focus();
                isValid = false;
            } else {
                titleError?.classList.remove('visible');
                feedbackTitle?.classList.remove('error');
            }
        } else {
            titleError?.classList.remove('visible');
            feedbackTitle?.classList.remove('error');
        }

        // 5. Validazione Testo Feedback (5 - 1000 caratteri, no link/script/email)
        const rawText = feedbackText?.value.trim() || '';
        const textSec = validateFieldSecurity(rawText, 'Proposta / Feedback');
        if (rawText.length < 5 || rawText.length > 1000 || !textSec.valid) {
            if (textError) {
                textError.textContent = !textSec.valid
                    ? textSec.reason
                    : 'Scrivi almeno 5 caratteri (massimo 1000) per inviare il tuo feedback! 😅';
                textError.classList.add('visible');
            }
            feedbackText?.classList.add('error');
            if (isValid) feedbackText?.focus();
            isValid = false;
        } else {
            textError?.classList.remove('visible');
            feedbackText?.classList.remove('error');
        }

        // 6. Validazione Checkbox Obbligatoria Età 14+ & Accettazione Termini e Privacy
        if (!legalConsent || !legalConsent.checked) {
            consentError?.classList.add('visible');
            if (isValid) legalConsent?.focus();
            isValid = false;
        } else {
            consentError?.classList.remove('visible');
        }

        if (!isValid) return;

        isSubmitting = true;
        if (submitBtn) submitBtn.disabled = true;
        if (submitText) submitText.textContent = 'Verifica e invio sicuro in corso...';
        if (submitSpinner) submitSpinner.style.display = 'inline-block';

        const rawCategory = feedbackForm.querySelector('input[name="category"]:checked')?.value || 'idea';
        const safeCategory = ALLOWED_CATEGORIES.has(rawCategory) ? rawCategory : 'idea';

        const feedbackPayload = {
            anonymity: isNamed ? 'named' : 'anon',
            name: isNamed ? sanitizeText(rawName, 40) : 'Anonimo',
            title: sanitizeText(rawTitle, 80),
            category: safeCategory,
            text: sanitizeText(rawText, 1000),
            rating: Math.min(Math.max(selectedRating, 1), 5)
        };

        try {
            const createdRecord = await FeedbackService.createFeedback(feedbackPayload);
            FeedbackService.recordSubmissionTimestamp();

            liveFeedbacks.unshift(createdRecord);
            updateLiveStats(liveFeedbacks);
            renderCommunity();

            triggerConfettiCelebration();

            if (submitSpinner) submitSpinner.style.display = 'none';
            if (submitText) submitText.textContent = '⚽ Invia feedback';
            if (submitBtn) submitBtn.disabled = false;

            feedbackForm.style.display = 'none';
            renderSuccessPreview(feedbackPayload);

            if (successCard) successCard.style.display = 'block';
        } catch (err) {
            console.error(err);
            if (err && err.code === 429) {
                showSecurityError('🛑 Hai inviato troppe richieste in poco tempo (Rate Limit raggiunto). Attendi un minuto prima di riprovare.');
            } else {
                showSecurityError('⚠️ Impossibile salvare il feedback in questo momento. Verifica che il testo non contenga caratteri non ammessi e riprova tra poco.');
            }
            if (submitSpinner) submitSpinner.style.display = 'none';
            if (submitText) submitText.textContent = '⚽ Invia feedback';
            if (submitBtn) submitBtn.disabled = false;
        } finally {
            isSubmitting = false;
        }
    });

    newFeedbackBtn?.addEventListener('click', () => {
        feedbackForm?.reset();
        selectedRating = 5;
        setStars(5);
        if (charCount) charCount.textContent = '0';
        handleAnonChange();
        hideSecurityError();
        if (successCard) successCard.style.display = 'none';
        if (feedbackForm) feedbackForm.style.display = 'block';
        if (feedbackText) feedbackText.value = '';
        if (userNameInput) userNameInput.value = '';
        if (feedbackTitle) feedbackTitle.value = '';
    });


    /* ── 15. MOTORE CORIANDOLI LOCALE (ZERO DIPENDENZE ESTERNE / GDPR SAFE) ── */
    function triggerConfettiCelebration() {
        try {
            const canvas = document.createElement('canvas');
            canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
            document.body.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                canvas.remove();
                return;
            }

            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            const colors = ['#2563eb', '#10b981', '#fbbf24', '#38bdf8', '#ffffff'];
            const particles = [];
            const count = 90;

            for (let i = 0; i < count; i++) {
                const angle = (Math.random() * Math.PI) - (Math.PI / 2);
                const speed = 6 + Math.random() * 10;
                particles.push({
                    x: canvas.width * (0.2 + Math.random() * 0.6),
                    y: canvas.height * 0.65,
                    vx: Math.sin(angle) * speed,
                    vy: -Math.cos(angle) * speed - (Math.random() * 4),
                    size: 6 + Math.random() * 6,
                    color: colors[i % colors.length],
                    rotation: Math.random() * 360,
                    rotSpeed: (Math.random() - 0.5) * 12,
                    gravity: 0.25 + Math.random() * 0.1,
                    opacity: 1
                });
            }

            let frame = 0;
            function renderFrame() {
                frame++;
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                let active = false;
                particles.forEach(p => {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += p.gravity;
                    p.rotation += p.rotSpeed;
                    if (frame > 75) p.opacity = Math.max(0, p.opacity - 0.025);

                    if (p.opacity > 0 && p.y < canvas.height + 40) {
                        active = true;
                        ctx.save();
                        ctx.globalAlpha = p.opacity;
                        ctx.translate(p.x, p.y);
                        ctx.rotate((p.rotation * Math.PI) / 180);
                        ctx.fillStyle = p.color;
                        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
                        ctx.restore();
                    }
                });

                if (active && frame < 140) {
                    requestAnimationFrame(renderFrame);
                } else {
                    canvas.remove();
                }
            }

            requestAnimationFrame(renderFrame);
        } catch (e) {
            // Ignora errori grafici non bloccanti
        }
    }
});
