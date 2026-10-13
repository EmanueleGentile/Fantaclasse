/* ==========================================================================
   FANTASTUDENTE — script.js (REWORK 100% DINAMICO & REALTIME)
   Integrazione PocketBase reale, statistiche live, ricerca, ordinamento,
   sistema di upvote condiviso e badge lifecycle.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    /* ── 1. NAVBAR SCROLL & MENU MOBILE ── */
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    const sections = document.querySelectorAll('section[id]');
    const navItems = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        navbar.classList.toggle('scrolled', scrollY > 30);

        let currentId = '';
        sections.forEach(sec => {
            const top = sec.offsetTop - 120;
            const height = sec.offsetHeight;
            if (scrollY >= top && scrollY < top + height) {
                currentId = sec.getAttribute('id');
            }
        });

        navItems.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${currentId}`);
        });
    }, { passive: true });

    navToggle?.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        navToggle.classList.toggle('open', isOpen);
        navToggle.setAttribute('aria-expanded', isOpen);
    });

    navItems.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('open');
            navToggle.classList.remove('open');
            navToggle.setAttribute('aria-expanded', 'false');
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
            el.textContent = isFloat ? current.toFixed(1) : Math.round(current);
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = isFloat ? target.toFixed(1) : target;
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
        starButtons.forEach((btn, idx) => {
            btn.classList.toggle('active', idx < val);
        });
        if (starHint) {
            starHint.textContent = val > 0 ? starLabels[val] : 'Clicca sulle stelle per votare';
        }
    }

    starButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedRating = parseInt(btn.dataset.val, 10);
            setStars(selectedRating);
        });

        btn.addEventListener('mouseenter', () => {
            const hoverVal = parseInt(btn.dataset.val, 10);
            setStars(hoverVal);
        });

        btn.addEventListener('mouseleave', () => {
            setStars(selectedRating);
        });
    });

    setStars(selectedRating);


    /* ── 5. SELEZIONE ANONIMATO (ANONIMO VS NOMINATIVO) ── */
    const radioAnon = document.getElementById('radioAnon');
    const radioNamed = document.getElementById('radioNamed');
    const nameGroup = document.getElementById('nameGroup');
    const userNameInput = document.getElementById('userName');
    const nameError = document.getElementById('nameError');

    function handleAnonChange() {
        if (radioNamed?.checked) {
            nameGroup.style.display = 'block';
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

    feedbackText?.addEventListener('input', () => {
        const len = feedbackText.value.length;
        if (charCount) {
            charCount.textContent = len;
            charCount.style.color = len > 950 ? '#ef4444' : '';
        }
        if (len >= 5) {
            textError?.classList.remove('visible');
            feedbackText?.classList.remove('error');
        }
    });

    userNameInput?.addEventListener('input', () => {
        if (userNameInput.value.trim().length >= 2) {
            nameError?.classList.remove('visible');
            userNameInput?.classList.remove('error');
        }
    });


    /* ── 7. PROMPT CREATIVI "HAI UN'IDEA?" ── */
    const promptCards = document.querySelectorAll('.prompt-card');
    promptCards.forEach(card => {
        card.addEventListener('click', () => {
            const category = card.dataset.category || 'idea';
            const prompt = card.dataset.prompt || '';

            const catRadio = document.querySelector(`input[name="category"][value="${category}"]`);
            if (catRadio) catRadio.checked = true;

            if (feedbackText) {
                feedbackText.value = prompt;
                if (charCount) charCount.textContent = prompt.length;
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
    const STORAGE_VOTED_KEY = 'fantastudente_voted_feedbacks';

    /* ── 9. STATO LOCALE E SERVIZIO FEEDBACK REALE ── */
    let liveFeedbacks = [];
    let currentCategory = 'all';
    let searchQuery = '';
    let currentSort = 'newest';

    const FeedbackService = {
        getVotedIds() {
            try {
                return new Set(JSON.parse(localStorage.getItem(STORAGE_VOTED_KEY) || '[]'));
            } catch (e) {
                return new Set();
            }
        },

        saveVotedId(id) {
            const set = this.getVotedIds();
            set.add(id);
            localStorage.setItem(STORAGE_VOTED_KEY, JSON.stringify(Array.from(set)));
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
                return data.items || [];
            } catch (err) {
                console.warn('Connessione al database non riuscita o offline:', err);
                // Fallback ai dati demo minimi se il database è offline
                return this.getFallbackFeedbacks();
            }
        },

        async createFeedback(payload) {
            const pbData = {
                nome_utente: payload.name || '',
                titolo: payload.title || '',
                messaggio_feedback: payload.text,
                categoria: payload.category,
                voto: payload.rating,
                anonimo: payload.anonymity === 'anon',
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

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                console.error('Errore PocketBase durante il salvataggio:', errJson);
                throw new Error('Impossibile salvare il feedback su PocketBase');
            }

            return await response.json();
        },

        async incrementUpvote(id, currentVotes) {
            const newVotes = (parseInt(currentVotes, 10) || 0) + 1;
            try {
                const response = await fetch(`${PB_API_URL}/api/collections/Feedback/records/${id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ upvotes: newVotes })
                });

                if (response.ok) {
                    this.saveVotedId(id);
                    return newVotes;
                }
            } catch (e) {
                console.warn('Errore salvataggio upvote su server:', e);
            }
            this.saveVotedId(id);
            return newVotes;
        },

        getFallbackFeedbacks() {
            return [
                {
                    id: 'seed-1',
                    titolo: 'Bonus "Salva-Classe" volontario',
                    messaggio_feedback: 'Se ti offri volontario all\'interrogazione evitando che il prof chiami a sorte un compagno disperato: +2 punti bonus istantanei!',
                    categoria: 'idea',
                    nome_utente: 'Giacomo M. (4A)',
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
                    nome_utente: 'Sara T. (3B)',
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


    /* ── 11. AGGIORNAMENTO DINAMICO DELLE STATISTICHE ── */
    function updateLiveStats(items) {
        const total = items.length;
        const totalIdeas = items.filter(f => f.categoria === 'idea' || f.categoria === 'feature').length;
        const totalImplemented = items.filter(f => f.stato === 'implementato').length;

        // Calcolo reale media stelle
        const validVotes = items.map(f => parseFloat(f.voto) || 5);
        const avg = validVotes.length > 0 
            ? (validVotes.reduce((a, b) => a + b, 0) / validVotes.length) 
            : 5.0;

        // Aggiorna contatore Navbar
        const navCounter = document.getElementById('feedbackCounter');
        if (navCounter) navCounter.textContent = `${total} feedback raccolti`;

        // Aggiorna Hero stats con animazione
        const heroFeedbackNum = document.getElementById('heroFeedbackNum');
        if (heroFeedbackNum) animateNumber(heroFeedbackNum, total);

        const heroIdeasNum = document.getElementById('heroIdeasNum');
        if (heroIdeasNum) animateNumber(heroIdeasNum, totalIdeas);

        const heroImplementedNum = document.getElementById('heroImplementedNum');
        if (heroImplementedNum) animateNumber(heroImplementedNum, totalImplemented);

        const heroRatingNum = document.getElementById('heroRatingNum');
        if (heroRatingNum) animateNumber(heroRatingNum, avg, 1200, true);

        // Aggiorna Sidebar stats
        const sideTotal = document.getElementById('sideTotalFeedback');
        if (sideTotal) sideTotal.textContent = total;

        const sideIdeas = document.getElementById('sideIdeasCount');
        if (sideIdeas) sideIdeas.textContent = totalIdeas;

        const sideImplemented = document.getElementById('sideImplementedCount');
        if (sideImplemented) sideImplemented.textContent = totalImplemented;

        const sideAvg = document.getElementById('sideAvgRating');
        if (sideAvg) sideAvg.textContent = `⭐ ${avg.toFixed(1)} / 5`;

        // Aggiorna badge numerici categorie
        const countMap = {
            all: total,
            idea: items.filter(f => f.categoria === 'idea').length,
            feature: items.filter(f => f.categoria === 'feature').length,
            like: items.filter(f => f.categoria === 'like').length,
            improve: items.filter(f => f.categoria === 'improve').length,
            bug: items.filter(f => f.categoria === 'bug').length
        };

        const countAll = document.getElementById('countAll');
        if (countAll) countAll.textContent = countMap.all;
        const countIdea = document.getElementById('countIdea');
        if (countIdea) countIdea.textContent = countMap.idea;
        const countFeature = document.getElementById('countFeature');
        if (countFeature) countFeature.textContent = countMap.feature;
        const countLike = document.getElementById('countLike');
        if (countLike) countLike.textContent = countMap.like;
        const countImprove = document.getElementById('countImprove');
        if (countImprove) countImprove.textContent = countMap.improve;
        const countBug = document.getElementById('countBug');
        if (countBug) countBug.textContent = countMap.bug;

        // Aggiorna dinamicamente il ticker dei bonus/malus con le vere idee ricevute
        updateLiveTicker(items);
    }

    function updateLiveTicker(items) {
        const tickerTrack = document.querySelector('.ticker-content');
        if (!tickerTrack) return;

        const validItems = items.filter(i => i.messaggio_feedback && i.messaggio_feedback.length > 5);
        if (validItems.length === 0) return;

        const tickerHTML = validItems.slice(0, 10).map(item => {
            const isNegative = item.categoria === 'bug' || (item.messaggio_feedback && item.messaggio_feedback.toLowerCase().includes('malus'));
            const dot = isNegative ? '🔴' : '🟢';
            const cls = isNegative ? 'bonus-neg' : 'bonus-pos';
            const label = escapeHtml(item.titolo || item.messaggio_feedback.substring(0, 45) + '...');
            return `<span class="ticker-item ${cls}">${dot} ${label}</span>`;
        }).join('');

        // Raddoppia per effetto loop continuo
        tickerTrack.innerHTML = tickerHTML + tickerHTML;
    }


    /* ── 12. RENDERING BACHECA COMMUNITY (RICERCA, ORDINAMENTO, FILTRI) ── */
    const communityGrid = document.getElementById('communityGrid');
    const communitySearch = document.getElementById('communitySearch');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const communitySort = document.getElementById('communitySort');
    const filterChips = document.querySelectorAll('.filter-chip');

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
            communityGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; background: #fff; border-radius: 20px; border: 1.5px dashed var(--gray-300);">
                    <div style="font-size: 2.8rem; margin-bottom: 12px;">📭</div>
                    <h3 style="font-size: 1.3rem; margin-bottom: 8px;">Nessuna idea trovata</h3>
                    <p style="color: var(--gray-600); margin-bottom: 20px;">
                        ${searchQuery ? `Nessun risultato corrisponde a "${escapeHtml(searchQuery)}".` : 'Sii tu il primo studente a proporre un\'idea!'}
                    </p>
                    <a href="#feedback" class="btn btn-primary" style="padding: 10px 22px; font-size: 0.9rem;">💡 Scrivi la prima idea</a>
                </div>
            `;
            return;
        }

        // 5. Creazione Card
        communityGrid.innerHTML = '';
        filtered.forEach(item => {
            const card = document.createElement('div');
            card.className = 'idea-card';

            const authorName = item.anonimo ? 'Anonimo' : (item.nome_utente || 'Studente');
            const authorClass = item.anonimo ? 'author-anon' : '';
            const isVoted = votedSet.has(item.id);
            const votesCount = parseInt(item.upvotes, 10) || 0;
            const starsDisplay = '★'.repeat(parseInt(item.voto, 10) || 5);

            // Titolo della card
            let cardTitle = item.titolo;
            if (!cardTitle || cardTitle.trim() === '') {
                cardTitle = categoryNames[item.categoria] || 'Proposta Community';
            }

            // Badge di stato
            const statusKey = item.stato || 'in_valutazione';
            const statusInfo = statusLabels[statusKey] || statusLabels.in_valutazione;

            // Box Risposta Ufficiale Admin (se presente)
            let devReplyHTML = '';
            if (item.risposta_admin && item.risposta_admin.trim().length > 0) {
                devReplyHTML = `
                    <div class="dev-reply-box">
                        <div class="dev-reply-header">
                            <span>💬</span> Risposta del Team Fantaclasse
                        </div>
                        <p class="dev-reply-text">"${escapeHtml(item.risposta_admin)}"</p>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="idea-card-header">
                    <div>
                        <div class="status-badge ${statusInfo.class}">${statusInfo.text}</div>
                        <h4 class="idea-card-title">${escapeHtml(cardTitle)}</h4>
                    </div>
                    <span class="cat-badge ${categoryClasses[item.categoria] || 'cat-other'}">
                        ${categoryNames[item.categoria] || item.categoria}
                    </span>
                </div>

                <p class="idea-card-text">${escapeHtml(item.messaggio_feedback)}</p>

                ${devReplyHTML}

                <div class="idea-card-stars" title="${item.voto || 5} stelle su 5">
                    ${starsDisplay}
                </div>

                <div class="idea-card-footer">
                    <div class="idea-author ${authorClass}">
                        <span>👤 ${escapeHtml(authorName)}</span>
                        <span class="card-date-time">• ${formatRelativeDate(item.created)}</span>
                    </div>

                    <button type="button" class="vote-btn ${isVoted ? 'voted' : ''}" data-id="${item.id}" aria-label="Vota questa idea">
                        <span class="vote-thumb">👍</span>
                        <span class="vote-count">${votesCount}</span>
                    </button>
                </div>
            `;

            // Click su Upvote
            const voteBtn = card.querySelector('.vote-btn');
            const countEl = card.querySelector('.vote-count');

            voteBtn.addEventListener('click', async () => {
                if (FeedbackService.getVotedIds().has(item.id)) {
                    // Già votato
                    voteBtn.classList.add('voted');
                    return;
                }

                // UI ottimistica immediata
                const current = parseInt(countEl.textContent, 10) || 0;
                countEl.textContent = current + 1;
                voteBtn.classList.add('voted');

                // Salva su PocketBase
                item.upvotes = current + 1;
                await FeedbackService.incrementUpvote(item.id, current);
            });

            communityGrid.appendChild(card);
        });
    }

    // Gestione Filtri Categoria
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentCategory = chip.dataset.category || 'all';
            renderCommunity();
        });
    });

    // Gestione Ricerca
    communitySearch?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
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
        currentSort = e.target.value;
        renderCommunity();
    });


    /* ── 13. CARICAMENTO INIZIALE DATI DAL SERVER ── */
    async function loadData() {
        if (communityGrid) {
            communityGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--gray-600);">
                    <div class="spinner" style="border-top-color: var(--blue-600); margin: 0 auto 12px;"></div>
                    <p style="font-weight: 600;">Caricamento bacheca community dal database...</p>
                </div>
            `;
        }

        liveFeedbacks = await FeedbackService.fetchAll();
        updateLiveStats(liveFeedbacks);
        renderCommunity();
    }

    loadData();


    /* ── 14. INVIO FORM FEEDBACK CON CELEBRAZIONE ── */
    const feedbackForm = document.getElementById('feedbackForm');
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const submitSpinner = document.getElementById('submitSpinner');
    const successCard = document.getElementById('successCard');
    const successPreview = document.getElementById('successPreview');
    const newFeedbackBtn = document.getElementById('newFeedbackBtn');

    feedbackForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        let isValid = true;

        const isNamed = radioNamed?.checked;
        const nameVal = userNameInput?.value.trim() || '';
        if (isNamed && nameVal.length < 2) {
            nameError?.classList.add('visible');
            userNameInput?.classList.add('error');
            userNameInput?.focus();
            isValid = false;
        } else {
            nameError?.classList.remove('visible');
            userNameInput?.classList.remove('error');
        }

        const textVal = feedbackText?.value.trim() || '';
        if (textVal.length < 5) {
            textError?.classList.add('visible');
            feedbackText?.classList.add('error');
            if (isValid) feedbackText?.focus();
            isValid = false;
        } else {
            textError?.classList.remove('visible');
            feedbackText?.classList.remove('error');
        }

        if (!isValid) return;

        submitBtn.disabled = true;
        submitText.textContent = 'Invio a PocketBase in corso...';
        submitSpinner.style.display = 'inline-block';

        const categoryVal = feedbackForm.querySelector('input[name="category"]:checked')?.value || 'idea';
        const titleVal = feedbackTitle?.value.trim() || '';

        const feedbackPayload = {
            anonymity: isNamed ? 'named' : 'anon',
            name: isNamed ? nameVal : 'Anonimo',
            title: titleVal,
            category: categoryVal,
            text: textVal,
            rating: selectedRating
        };

        try {
            // Invio effettivo a PocketBase
            const createdRecord = await FeedbackService.createFeedback(feedbackPayload);

            // Inserisci in cima alla lista live locale
            liveFeedbacks.unshift(createdRecord);
            updateLiveStats(liveFeedbacks);
            renderCommunity();

            // Effetto Coriandoli 🎉
            triggerConfettiCelebration();

            submitSpinner.style.display = 'none';
            submitText.textContent = '⚽ Invia feedback';
            submitBtn.disabled = false;

            feedbackForm.style.display = 'none';

            if (successPreview) {
                successPreview.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span class="cat-badge ${categoryClasses[feedbackPayload.category] || 'cat-other'}">
                            ${categoryNames[feedbackPayload.category]}
                        </span>
                        <span style="font-weight:700; color:var(--gold-500);">${'★'.repeat(feedbackPayload.rating)}</span>
                    </div>
                    ${feedbackPayload.title ? `<h4 style="margin: 6px 0; color: var(--gray-900);">${escapeHtml(feedbackPayload.title)}</h4>` : ''}
                    <p style="font-size:0.95rem; color:var(--gray-800); margin-bottom:8px;">"${escapeHtml(feedbackPayload.text)}"</p>
                    <small style="color:var(--gray-500); font-weight:600;">
                        Inviato da: <b>${escapeHtml(feedbackPayload.name)}</b> (${feedbackPayload.anonymity === 'anon' ? 'Anonimo 🕵️' : 'Nominativo 👋'})
                    </small>
                `;
            }

            if (successCard) successCard.style.display = 'block';

        } catch (err) {
            console.error(err);
            alert('Errore durante l\'invio del feedback al database. Riprova tra poco.');
            submitSpinner.style.display = 'none';
            submitText.textContent = '⚽ Invia feedback';
            submitBtn.disabled = false;
        }
    });

    newFeedbackBtn?.addEventListener('click', () => {
        feedbackForm?.reset();
        selectedRating = 5;
        setStars(5);
        if (charCount) charCount.textContent = '0';
        handleAnonChange();
        if (successCard) successCard.style.display = 'none';
        if (feedbackForm) feedbackForm.style.display = 'block';
        if (feedbackText) feedbackText.value = '';
        if (userNameInput) userNameInput.value = '';
        if (feedbackTitle) feedbackTitle.value = '';
    });

    function triggerConfettiCelebration() {
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#2563eb', '#10b981', '#fbbf24', '#ffffff']
            });
            setTimeout(() => {
                confetti({
                    particleCount: 50,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#10b981', '#fbbf24']
                });
                confetti({
                    particleCount: 50,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#2563eb', '#38bdf8']
                });
            }, 250);
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
