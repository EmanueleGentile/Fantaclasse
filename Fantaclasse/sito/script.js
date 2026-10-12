/* ==========================================================================
   FANTASTUDENTE — script.js
   Logica interattiva, gestione form, upvotes, confetti e predisposizione DB
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

        // Evidenziazione link attivo durante lo scroll
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

    // Menu Hamburger Mobile
    navToggle.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        navToggle.classList.toggle('open', isOpen);
        navToggle.setAttribute('aria-expanded', isOpen);
    });

    // Chiudi menu al click su un link
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


    /* ── 3. CONTATORI ANIMATI (HERO & STATS) ── */
    function animateNumber(el, target, duration = 1500) {
        const start = 0;
        let startTime = null;

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            // Easing cubico
            const ease = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(start + (target - start) * ease);
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = target;
            }
        }
        requestAnimationFrame(step);
    }

    const statObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const targetVal = parseInt(el.dataset.target, 10);
                if (!isNaN(targetVal)) {
                    animateNumber(el, targetVal);
                }
                statObserver.unobserve(el);
            }
        });
    }, { threshold: 0.4 });

    document.querySelectorAll('.stat-num[data-target]').forEach(el => statObserver.observe(el));


    /* ── 4. RATING A STELLE (1-5 STELLE) ── */
    let selectedRating = 5; // Default 5 stelle
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
        starHint.textContent = val > 0 ? starLabels[val] : 'Clicca sulle stelle per votare';
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

    // Inizializza con 5 stelle
    setStars(selectedRating);


    /* ── 5. SELEZIONE ANONIMATO (ANONIMO VS NOMINATIVO) ── */
    const radioAnon = document.getElementById('radioAnon');
    const radioNamed = document.getElementById('radioNamed');
    const nameGroup = document.getElementById('nameGroup');
    const userNameInput = document.getElementById('userName');
    const nameError = document.getElementById('nameError');

    function handleAnonChange() {
        if (radioNamed.checked) {
            nameGroup.style.display = 'block';
            setTimeout(() => userNameInput.focus(), 100);
        } else {
            nameGroup.style.display = 'none';
            nameError.classList.remove('visible');
            userNameInput.classList.remove('error');
        }
    }

    radioAnon.addEventListener('change', handleAnonChange);
    radioNamed.addEventListener('change', handleAnonChange);


    /* ── 6. CONTEGGIO CARATTERI TEXTAREA ── */
    const feedbackText = document.getElementById('feedbackText');
    const charCount = document.getElementById('charCount');
    const textError = document.getElementById('textError');

    feedbackText.addEventListener('input', () => {
        const len = feedbackText.value.length;
        charCount.textContent = len;
        charCount.style.color = len > 950 ? '#ef4444' : '';
        if (len >= 5) {
            textError.classList.remove('visible');
            feedbackText.classList.remove('error');
        }
    });

    userNameInput.addEventListener('input', () => {
        if (userNameInput.value.trim().length >= 2) {
            nameError.classList.remove('visible');
            userNameInput.classList.remove('error');
        }
    });


    /* ── 7. PROMPT CREATIVI "HAI UN'IDEA?" ── */
    // Cliccando su una card, precompila il form e scrolla dolcemente
    const promptCards = document.querySelectorAll('.prompt-card');
    promptCards.forEach(card => {
        card.addEventListener('click', () => {
            const category = card.dataset.category || 'idea';
            const prompt = card.dataset.prompt || '';

            // Seleziona categoria corrispondente nel form
            const catRadio = document.querySelector(`input[name="category"][value="${category}"]`);
            if (catRadio) catRadio.checked = true;

            // Inserisci prompt nella textarea
            feedbackText.value = prompt;
            charCount.textContent = prompt.length;

            // Scroll fluido alla sezione feedback
            const feedbackSection = document.getElementById('feedback');
            if (feedbackSection) {
                feedbackSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            setTimeout(() => {
                feedbackText.focus();
                // Posiziona il cursore alla fine
                feedbackText.selectionStart = feedbackText.selectionEnd = feedbackText.value.length;
            }, 600);
        });
    });


    /* ── 8. GESTIONE DATABASE & ARCHIVIAZIONE (POCKETBASE) ── */
    const STORAGE_KEY = 'fantastudente_feedbacks';
    const UPVOTES_KEY = 'fantastudente_voted_ids';

    // Inserisci l'URL del tuo PocketBase
    const POCKETBASE_URL = 'https://surveillance-jam-such-locked.trycloudflare.com/';

    const FeedbackService = {
        // Recupera feedback salvati dall'utente (manteniamo la cache locale per la UI)
        getLocalFeedbacks() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            } catch (e) {
                return [];
            }
        },

        // Salva un nuovo feedback sia in locale che su PocketBase
        async saveFeedback(data) {
            // 1. Salvataggio locale immediato per aggiornare subito la UI
            const current = this.getLocalFeedbacks();
            current.unshift(data);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));

            // 2. Invio effettivo a PocketBase
            try {
                // Prepariamo l'oggetto con i nomi dei campi esatti per PocketBase
                const pbData = {
                    nome_utente: data.name,           // Modificato per matchare PocketBase
                    messaggio_feedback: data.text,    // Modificato per matchare PocketBase
                    categoria: data.category,
                    voto: data.rating,
                    anonimo: data.anonymity === 'anon'
                };

                const response = await fetch(`${POCKETBASE_URL}/api/collections/Feedback/records`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(pbData)
                });

                if (!response.ok) {
                    const err = await response.json();
                    console.error("Errore da PocketBase:", err);
                    // Rimuove il salvataggio locale se fallisce il db
                    current.shift();
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
                    throw new Error("Errore nel salvataggio su database");
                }

                console.log("Feedback salvato con successo su PocketBase!");
                return true;

            } catch (error) {
                console.error('Errore di connessione a PocketBase:', error);
                alert("Salvataggio locale riuscito, ma impossibile connettersi al database in questo momento.");
                return false;
            }
        },

        // Gestione Upvote (rimane locale per ora)
        getVotedIds() {
            try {
                return new Set(JSON.parse(localStorage.getItem(UPVOTES_KEY) || '[]'));
            } catch (e) {
                return new Set();
            }
        },

        toggleUpvote(id) {
            const votedSet = this.getVotedIds();
            const isVoted = votedSet.has(id);
            if (isVoted) {
                votedSet.delete(id);
            } else {
                votedSet.add(id);
            }
            localStorage.setItem(UPVOTES_KEY, JSON.stringify(Array.from(votedSet)));
            return !isVoted;
        }
    };

    /* ── 9. IDEE DEMO DELLA COMMUNITY ── */
    const DEMO_IDEAS = [
        {
            id: 'demo-1',
            title: '🏅 Bonus "Salva-Classe" volontario',
            text: 'Se ti offri volontario all\'interrogazione evitando che il prof chiami a sorte un compagno disperato: +2 punti bonus istantanei!',
            category: 'idea',
            author: 'Giacomo M. (4A)',
            votes: 54,
            stars: 5,
            date: 'Ieri'
        },
        {
            id: 'demo-2',
            title: '💀 Malus "Dimenticato il diario/calcolatrice"',
            text: 'Dimenticare la calcolatrice scientifica il giorno del compito in classe di fisica deve valere almeno -2 punti e un giorno di squalifica dal mercato!',
            category: 'idea',
            author: 'Anonimo',
            votes: 41,
            stars: 5,
            date: '2 giorni fa'
        },
        {
            id: 'demo-3',
            title: '🚀 Asta live alla LIM con i Fanta-Crediti',
            text: 'Creiamo una schermata proiettabile sulla lavagna interattiva della classe per fare l\'asta con timer da 30 secondi a studente!',
            category: 'feature',
            author: 'Sara T. (3B)',
            votes: 78,
            stars: 5,
            date: '3 giorni fa'
        },
        {
            id: 'demo-4',
            title: '⭐ La classifica settimanale tra sezioni',
            text: 'Adoro l\'idea del fantacalcio a scuola! Il derby 4A contro 4B accenderà la competizione in tutto l\'istituto.',
            category: 'like',
            author: 'Lorenzo V. (5C)',
            votes: 33,
            stars: 5,
            date: '4 giorni fa'
        },
        {
            id: 'demo-5',
            title: '🔧 Notifiche push immediate sui voti',
            text: 'Sarebbe comodo ricevere un alert appena un prof pubblica un voto per aggiornare subito i bonus della giornata.',
            category: 'improve',
            author: 'Anonimo',
            votes: 29,
            stars: 4,
            date: '5 giorni fa'
        },
        {
            id: 'demo-6',
            title: '🐛 Evitare voti duplicati nei compiti di gruppo',
            text: 'Attenzione ai progetti di gruppo dove tutti prendono lo stesso voto: bisognerebbe dare un bonus solo a chi ha presentato!',
            category: 'bug',
            author: 'Anonimo',
            votes: 18,
            stars: 4,
            date: '6 giorni fa'
        }
    ];

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


    /* ── 10. RENDERING BACHECA COMMUNITY ── */
    const communityGrid = document.getElementById('communityGrid');
    const filterChips = document.querySelectorAll('.filter-chip');
    const countAllEl = document.getElementById('countAll');
    let activeFilter = 'all';

    function getAllCommunityCards() {
        const userFeedbacks = FeedbackService.getLocalFeedbacks();
        // Mappa i feedback salvati nel formato card della community
        const formattedUserFeedbacks = userFeedbacks.map(f => ({
            id: f.id,
            title: f.category === 'idea' ? '💡 Proposta da studente' :
                f.category === 'feature' ? '🚀 Nuova funzionalità' :
                    f.category === 'like' ? '⭐ Apprezzamento' :
                        f.category === 'improve' ? '🔧 Suggerimento' :
                            f.category === 'bug' ? '🐛 Segnalazione' : '🎯 Feedback',
            text: f.text,
            category: f.category,
            author: f.anonymity === 'anon' ? 'Anonimo' : f.name,
            votes: f.votes || 1,
            stars: f.rating || 5,
            date: 'Appena inviato',
            isNew: true
        }));

        return [...formattedUserFeedbacks, ...DEMO_IDEAS];
    }

    function renderCommunityCards() {
        const allCards = getAllCommunityCards();
        if (countAllEl) countAllEl.textContent = allCards.length;

        const votedIds = FeedbackService.getVotedIds();

        const filtered = activeFilter === 'all'
            ? allCards
            : allCards.filter(c => c.category === activeFilter);

        communityGrid.innerHTML = '';

        if (filtered.length === 0) {
            communityGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; background: #fff; border-radius: 20px; border: 1.5px dashed var(--gray-300);">
                    <div style="font-size: 2.8rem; margin-bottom: 12px;">📭</div>
                    <h3 style="font-size: 1.3rem; margin-bottom: 8px;">Nessuna idea in questa categoria per ora</h3>
                    <p style="color: var(--gray-600); margin-bottom: 20px;">Sii tu il primo a proporne una!</p>
                    <a href="#feedback" class="btn btn-primary" style="padding: 10px 22px; font-size: 0.9rem;">💡 Scrivi la prima idea</a>
                </div>
            `;
            return;
        }

        filtered.forEach(item => {
            const card = document.createElement('div');
            card.className = `idea-card ${item.isNew ? 'is-new' : ''}`;
            const hasVoted = votedIds.has(item.id);
            const starsDisplay = '★'.repeat(item.stars || 5);

            card.innerHTML = `
                ${item.isNew ? '<span class="new-badge">✨ Novità</span>' : ''}
                <div class="idea-card-header">
                    <h4 class="idea-card-title">${escapeHtml(item.title)}</h4>
                    <span class="cat-badge ${categoryClasses[item.category] || 'cat-other'}">
                        ${categoryNames[item.category] || item.category}
                    </span>
                </div>
                <p class="idea-card-text">${escapeHtml(item.text)}</p>
                <div class="idea-card-stars" title="${item.stars || 5} stelle">${starsDisplay}</div>
                <div class="idea-card-footer">
                    <span class="idea-author ${item.author === 'Anonimo' ? 'author-anon' : ''}">
                        👤 ${escapeHtml(item.author)}
                    </span>
                    <button type="button" class="vote-btn ${hasVoted ? 'voted' : ''}" data-id="${item.id}" aria-label="Vota questa idea">
                        <span class="vote-thumb">👍</span>
                        <span class="vote-count">${item.votes + (hasVoted ? 1 : 0)}</span>
                    </button>
                </div>
            `;

            // Gestione voto interattivo
            const voteBtn = card.querySelector('.vote-btn');
            const countEl = card.querySelector('.vote-count');

            voteBtn.addEventListener('click', () => {
                const isNowVoted = FeedbackService.toggleUpvote(item.id);
                voteBtn.classList.toggle('voted', isNowVoted);
                const currentCount = parseInt(countEl.textContent, 10);
                countEl.textContent = isNowVoted ? currentCount + 1 : currentCount - 1;
            });

            communityGrid.appendChild(card);
        });
    }

    // Filtri Categorie
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeFilter = chip.dataset.category;
            renderCommunityCards();
        });
    });

    renderCommunityCards();


    /* ── 11. AGGIORNAMENTO CONTATORI FEEDBACK ── */
    const baseCount = 127;
    function updateGlobalCounters() {
        const storedCount = FeedbackService.getLocalFeedbacks().length;
        const total = baseCount + storedCount;

        const navCounter = document.getElementById('feedbackCounter');
        if (navCounter) navCounter.textContent = `${total} feedback ricevuti`;

        const heroNum = document.getElementById('heroFeedbackNum');
        if (heroNum) heroNum.textContent = total;

        const sideNum = document.getElementById('sideTotalFeedback');
        if (sideNum) sideNum.textContent = total;
    }

    updateGlobalCounters();


    /* ── 12. INVIO FORM FEEDBACK CON CELEBRAZIONE ── */
    const feedbackForm = document.getElementById('feedbackForm');
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const submitSpinner = document.getElementById('submitSpinner');
    const successCard = document.getElementById('successCard');
    const successPreview = document.getElementById('successPreview');
    const newFeedbackBtn = document.getElementById('newFeedbackBtn');

    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let isValid = true;

        // 1. Validazione Nome (solo se ha scelto di farsi sapere)
        const isNamed = radioNamed.checked;
        const nameVal = userNameInput.value.trim();
        if (isNamed && nameVal.length < 2) {
            nameError.classList.add('visible');
            userNameInput.classList.add('error');
            userNameInput.focus();
            isValid = false;
        } else {
            nameError.classList.remove('visible');
            userNameInput.classList.remove('error');
        }

        // 2. Validazione Testo Feedback
        const textVal = feedbackText.value.trim();
        if (textVal.length < 5) {
            textError.classList.add('visible');
            feedbackText.classList.add('error');
            if (isValid) feedbackText.focus();
            isValid = false;
        } else {
            textError.classList.remove('visible');
            feedbackText.classList.remove('error');
        }

        if (!isValid) return;

        // Stato di caricamento
        submitBtn.disabled = true;
        submitText.textContent = 'Invio in corso...';
        submitSpinner.style.display = 'inline-block';

        // Raccolta dati form
        const categoryVal = feedbackForm.querySelector('input[name="category"]:checked')?.value || 'idea';
        const feedbackPayload = {
            id: 'fb-' + Date.now(),
            anonymity: isNamed ? 'named' : 'anon',
            name: isNamed ? nameVal : 'Anonimo',
            category: categoryVal,
            text: textVal,
            rating: selectedRating,
            timestamp: new Date().toISOString(),
            votes: 1
        };

        // Simulazione latenza di rete realistica
        await new Promise(res => setTimeout(res, 600));

        // Salvataggio nel service (localStorage + predisposto per database)
        await FeedbackService.saveFeedback(feedbackPayload);

        // Aggiorna i contatori
        updateGlobalCounters();

        // Esplosione di coriandoli celebrativi! 🎉
        triggerConfettiCelebration();

        // Mostra schermata di successo con riassunto
        submitSpinner.style.display = 'none';
        submitText.textContent = '⚽ Invia feedback';
        submitBtn.disabled = false;

        feedbackForm.style.display = 'none';

        // Mostra anteprima del feedback inviato
        successPreview.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="cat-badge ${categoryClasses[feedbackPayload.category] || 'cat-other'}">
                    ${categoryNames[feedbackPayload.category]}
                </span>
                <span style="font-weight:700; color:var(--gold-500);">${'★'.repeat(feedbackPayload.rating)}</span>
            </div>
            <p style="font-size:0.95rem; color:var(--gray-800); margin-bottom:8px;">"${escapeHtml(feedbackPayload.text)}"</p>
            <small style="color:var(--gray-500); font-weight:600;">
                Inviato da: <b>${escapeHtml(feedbackPayload.name)}</b> (${feedbackPayload.anonymity === 'anon' ? 'Anonimo 🕵️' : 'Nominativo 👋'})
            </small>
        `;

        successCard.style.display = 'block';

        // Ricarica la bacheca community in modo che la nuova idea compaia subito
        renderCommunityCards();
    });

    // Reset Form per inviare un altro feedback
    newFeedbackBtn.addEventListener('click', () => {
        feedbackForm.reset();
        selectedRating = 5;
        setStars(5);
        charCount.textContent = '0';
        handleAnonChange();
        successCard.style.display = 'none';
        feedbackForm.style.display = 'block';
        feedbackText.value = '';
        userNameInput.value = '';
    });

    // Effetto Coriandoli con canvas-confetti
    function triggerConfettiCelebration() {
        if (typeof confetti === 'function') {
            // Primo lancio
            confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#2563eb', '#10b981', '#fbbf24', '#ffffff']
            });

            // Secondo lancio laterale
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


    /* ── 13. UTILITY ESCAPE HTML ── */
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

