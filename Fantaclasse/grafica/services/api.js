/**
 * Service Layer & Tactical UI Controller per Fantaclasse — Liceo Scientifico Edition
 * - Validazione per le 9 Materie Curricolari del Liceo Scientifico.
 * - Zero esposizione di ID database, email o metadati interni (GDPR & Security by Design).
 * - Gestione interattiva di:
 *   1. Campo Tattico 3-3-3 e Ispettore Posizione (assegnazione/rimozione titolare in tempo reale)
 *   2. Listone & Scouting (filtri per materia, stato, ricerca istantanea e schieramento rapido)
 *   3. Laboratorio Carte (anteprima live campioncino e coda di verifica in tempo reale)
 */

(function () {
    "use strict";

    var LINEUP_STORAGE_KEY = "fc_lineup_v2";

    var SchemaValidator = {
        allowedStati: ["in_attesa", "approvata"],
        allowedRuoli: [
            "Informatica",
            "Matematica",
            "Scienze",
            "Italiano",
            "Filosofia",
            "Storia",
            "Inglese",
            "Disegno e Storia dell'Arte",
            "Scienze Motorie"
        ],
        materieMeta: {
            "Informatica": { codice: "INF", area: "Area Scientifica", reparto: "scientifica" },
            "Matematica": { codice: "MAT", area: "Area Scientifica", reparto: "scientifica" },
            "Scienze": { codice: "SCI", area: "Area Scientifica", reparto: "scientifica" },
            "Italiano": { codice: "ITA", area: "Area Umanistica", reparto: "umanistica" },
            "Filosofia": { codice: "FIL", area: "Area Umanistica", reparto: "umanistica" },
            "Storia": { codice: "STO", area: "Area Umanistica", reparto: "umanistica" },
            "Inglese": { codice: "ING", area: "Area Linguistica & Arte", reparto: "linguistica" },
            "Disegno e Storia dell'Arte": { codice: "ART", area: "Area Linguistica & Arte", reparto: "linguistica" },
            "Scienze Motorie": { codice: "MOT", area: "Area Linguistica & Arte", reparto: "linguistica" }
        },

        isNonEmptyString: function (val) {
            return typeof val === "string" && val.trim().length > 0;
        },

        getMateriaMeta: function (ruolo) {
            if (ruolo && SchemaValidator.materieMeta[ruolo]) {
                return SchemaValidator.materieMeta[ruolo];
            }
            return { codice: "MAT", area: "Liceo Scientifico", reparto: "scientifica" };
        },

        getMonogram: function (nome) {
            if (!nome || typeof nome !== "string") {
                return "FC";
            }
            var cleaned = nome
                .replace(/^(prof\.ssa|prof\.|dott\.ssa|dott\.)\s*/i, "")
                .trim();
            if (!cleaned) {
                cleaned = nome.trim();
            }
            var parts = cleaned.split(/\s+/);
            if (parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0) {
                return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
            }
            return cleaned.slice(0, 2).toUpperCase();
        },

        validateCartaRecord: function (record) {
            if (!record || typeof record !== "object") {
                return false;
            }
            if (!this.isNonEmptyString(record.nome)) {
                return false;
            }
            if (!this.isNonEmptyString(record.ruolo)) {
                return false;
            }
            if (this.allowedStati.indexOf(record.stato) === -1) {
                return false;
            }
            return true;
        },

        validateCartaCreateInput: function (nome, ruolo) {
            var fieldErrors = {};
            var cleanNome = typeof nome === "string" ? nome.trim() : "";
            var cleanRuolo = typeof ruolo === "string" ? ruolo.trim() : "";

            if (!cleanNome) {
                fieldErrors.nome = "Il nome dello studente o professore è obbligatorio.";
            } else if (cleanNome.length < 2) {
                fieldErrors.nome = "Il nome deve contenere almeno 2 caratteri.";
            } else if (cleanNome.length > 80) {
                fieldErrors.nome = "Il nome non può superare 80 caratteri.";
            }

            if (!cleanRuolo) {
                fieldErrors.ruolo = "Seleziona una delle 9 materie del Liceo Scientifico.";
            } else if (this.allowedRuoli.indexOf(cleanRuolo) === -1) {
                fieldErrors.ruolo = "Materia non valida. Scegli una materia ufficiale del Liceo Scientifico.";
            }

            return {
                valid: Object.keys(fieldErrors).length === 0,
                fieldErrors: fieldErrors,
                payload: {
                    nome: cleanNome,
                    ruolo: cleanRuolo
                }
            };
        }
    };

    var LineupStore = {
        readMap: function () {
            try {
                if (!window.localStorage) {
                    return {};
                }
                var raw = window.localStorage.getItem(LINEUP_STORAGE_KEY);
                if (!raw) {
                    return {};
                }
                var parsed = JSON.parse(raw);
                return (parsed && typeof parsed === "object") ? parsed : {};
            } catch (e) {
                return {};
            }
        },

        writeMap: function (map) {
            try {
                if (window.localStorage) {
                    window.localStorage.setItem(LINEUP_STORAGE_KEY, JSON.stringify(map || {}));
                }
            } catch (e) {
                // localStorage non disponibile
            }
        },

        getStarterForSubject: function (materia, defaultName) {
            var map = this.readMap();
            if (Object.prototype.hasOwnProperty.call(map, materia)) {
                if (map[materia] === "__VACANT__") {
                    return "";
                }
                return map[materia] || "";
            }
            return defaultName || "";
        },

        setStarterForSubject: function (materia, nome) {
            var map = this.readMap();
            map[materia] = nome ? String(nome).trim() : "__VACANT__";
            this.writeMap(map);
        },

        resetAll: function () {
            try {
                if (window.localStorage) {
                    window.localStorage.removeItem(LINEUP_STORAGE_KEY);
                }
            } catch (e) {
                // ignore
            }
        }
    };

    var FantaclasseAPI = {
        getSession: function () {
            return fetch("/api/auth/session", {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "same-origin"
            }).then(function (res) {
                return res.json();
            });
        },

        listCarte: function (statoFilter) {
            var url = "/api/carte";
            if (statoFilter && SchemaValidator.allowedStati.indexOf(statoFilter) !== -1) {
                url += "?stato=" + encodeURIComponent(statoFilter);
            }
            return fetch(url, {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "same-origin"
            }).then(function (res) {
                return res.json().then(function (body) {
                    if (!res.ok) {
                        var err = new Error((body && body.message) || "Errore caricamento carte.");
                        err.status = res.status;
                        throw err;
                    }
                    var rawItems = (body && Array.isArray(body.items)) ? body.items : [];
                    var validItems = rawItems.filter(function (item) {
                        return SchemaValidator.validateCartaRecord(item);
                    });
                    return validItems;
                });
            });
        },

        createCarta: function (nome, ruolo) {
            var validation = SchemaValidator.validateCartaCreateInput(nome, ruolo);
            if (!validation.valid) {
                var validationErr = new Error("Controlla i campi evidenziati prima di inviare.");
                validationErr.fieldErrors = validation.fieldErrors;
                return Promise.reject(validationErr);
            }

            return fetch("/api/carte", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify(validation.payload)
            }).then(function (res) {
                return res.json().then(function (body) {
                    if (!res.ok) {
                        var err = new Error((body && body.message) || "Impossibile salvare la carta.");
                        err.status = res.status;
                        err.fieldErrors = (body && body.field_errors) ? body.field_errors : {};
                        throw err;
                    }
                    return body;
                });
            });
        }
    };

    function clearElement(el) {
        while (el && el.firstChild) {
            el.removeChild(el.firstChild);
        }
    }

    function buildCartaNode(carta, options) {
        var opts = options || {};
        var meta = SchemaValidator.getMateriaMeta(carta.ruolo);
        var codice = carta.codice_materia || meta.codice;
        var area = carta.area_materia || meta.area;
        var currentStarter = LineupStore.getStarterForSubject(carta.ruolo, opts.defaultStarter || "");
        var isStarter = carta.stato === "approvata" && currentStarter === carta.nome;

        var article = document.createElement("article");
        article.className = "player-card" + (isStarter ? " is-starter-card" : "");
        article.setAttribute("data-ruolo", carta.ruolo);
        article.setAttribute("data-stato", carta.stato);
        article.setAttribute("data-codice", codice);
        article.setAttribute("data-nome", carta.nome);

        var top = document.createElement("div");
        top.className = "player-card__top";

        var badgesWrap = document.createElement("div");
        badgesWrap.className = "player-card__badges";

        var roleCode = document.createElement("span");
        roleCode.className = "role-code";
        roleCode.setAttribute("data-codice", codice);
        roleCode.textContent = codice;
        badgesWrap.appendChild(roleCode);

        if (isStarter) {
            var starterTag = document.createElement("span");
            starterTag.className = "status-tag status-tag--starter";
            starterTag.textContent = "TITOLARE";
            badgesWrap.appendChild(starterTag);
        }

        var statusTag = document.createElement("span");
        statusTag.className = "status-tag " + (
            carta.stato === "approvata" ? "status-tag--ok" : "status-tag--wait"
        );
        statusTag.textContent = carta.stato === "approvata" ? "Approvata" : "In Verifica";

        top.appendChild(badgesWrap);
        top.appendChild(statusTag);

        var mainRow = document.createElement("div");
        mainRow.className = "player-card__main";

        var visual = document.createElement("div");
        visual.className = "player-card__visual";
        visual.setAttribute("aria-hidden", "true");

        var emblem = document.createElement("div");
        emblem.className = "player-card__emblem";
        emblem.setAttribute("data-codice", codice);

        var initial = document.createElement("span");
        initial.textContent = SchemaValidator.getMonogram(carta.nome);
        emblem.appendChild(initial);
        visual.appendChild(emblem);

        var body = document.createElement("div");
        body.className = "player-card__body";

        var title = document.createElement("h2");
        title.className = "player-card__name";
        title.textContent = carta.nome;

        var rolePill = document.createElement("span");
        rolePill.className = "player-card__role-pill";
        rolePill.setAttribute("data-codice", codice);
        rolePill.textContent = carta.ruolo;

        var dept = document.createElement("p");
        dept.className = "player-card__dept";
        dept.textContent = area;

        body.appendChild(title);
        body.appendChild(rolePill);
        body.appendChild(dept);

        mainRow.appendChild(visual);
        mainRow.appendChild(body);

        var actionsBar = document.createElement("div");
        actionsBar.className = "player-card__actions";

        var slotHint = document.createElement("span");
        slotHint.className = "player-card__slot-hint";
        slotHint.textContent = "Cattedra " + codice;
        actionsBar.appendChild(slotHint);

        if (carta.stato === "approvata") {
            var toggleBtn = document.createElement("button");
            toggleBtn.type = "button";
            toggleBtn.className = isStarter ? "btn btn--danger-soft btn--xs" : "btn btn--lime btn--xs";
            toggleBtn.textContent = isStarter ? "In Panchina" : "Schiera Titolare";
            toggleBtn.addEventListener("click", function () {
                if (isStarter) {
                    LineupStore.setStarterForSubject(carta.ruolo, "");
                } else {
                    LineupStore.setStarterForSubject(carta.ruolo, carta.nome);
                }
                if (typeof opts.onLineupChange === "function") {
                    opts.onLineupChange();
                }
            });
            actionsBar.appendChild(toggleBtn);
        } else {
            var waitHint = document.createElement("span");
            waitHint.className = "player-card__slot-hint";
            waitHint.textContent = "Attende convalida";
            actionsBar.appendChild(waitHint);
        }

        article.appendChild(top);
        article.appendChild(mainRow);
        article.appendChild(actionsBar);
        return article;
    }

    function renderCarteState(container, stateName, payload) {
        if (!container) {
            return;
        }
        container.setAttribute("data-ui-state", stateName);
        clearElement(container);

        if (stateName === "loading") {
            var skGrid = document.createElement("div");
            skGrid.className = "skeleton-grid";
            for (var i = 0; i < 4; i++) {
                var sk = document.createElement("div");
                sk.className = "skeleton-card";
                skGrid.appendChild(sk);
            }
            container.appendChild(skGrid);
            return;
        }

        if (stateName === "error") {
            var errBox = document.createElement("div");
            errBox.className = "state-box";
            errBox.setAttribute("role", "alert");

            var errTitle = document.createElement("h2");
            errTitle.className = "state-box__title";
            errTitle.textContent = "Impossibile aggiornare il Listone";

            var errDesc = document.createElement("p");
            errDesc.className = "state-box__desc";
            errDesc.textContent = (payload && payload.message) ? payload.message : "Errore di connessione.";

            var retryBtn = document.createElement("button");
            retryBtn.type = "button";
            retryBtn.className = "btn btn--primary btn--sm";
            retryBtn.textContent = "Riprova";
            retryBtn.addEventListener("click", function () {
                if (payload && typeof payload.onRetry === "function") {
                    payload.onRetry();
                } else {
                    window.location.reload();
                }
            });

            errBox.appendChild(errTitle);
            errBox.appendChild(errDesc);
            errBox.appendChild(retryBtn);
            container.appendChild(errBox);
            return;
        }

        if (stateName === "empty-state") {
            var emptyBox = document.createElement("div");
            emptyBox.className = "state-box";

            var emptyTitle = document.createElement("h2");
            emptyTitle.className = "state-box__title";
            emptyTitle.textContent = "Nessun candidato trovato";

            var emptyDesc = document.createElement("p");
            emptyDesc.className = "state-box__desc";
            emptyDesc.textContent = "Nessuno Studente o Professore corrisponde ai filtri o alla ricerca selezionata.";

            var actions = document.createElement("div");
            actions.className = "state-box__actions";

            var resetBtn = document.createElement("a");
            resetBtn.href = "/mercato";
            resetBtn.className = "btn btn--secondary btn--sm";
            resetBtn.textContent = "Mostra tutte le 9 materie";

            var cta = document.createElement("a");
            cta.href = (payload && payload.activeRuolo)
                ? ("/suggerisci?ruolo=" + encodeURIComponent(payload.activeRuolo))
                : "/suggerisci";
            cta.className = "btn btn--lime btn--sm";
            cta.textContent = "+ Proponi Candidato";

            actions.appendChild(resetBtn);
            actions.appendChild(cta);
            emptyBox.appendChild(emptyTitle);
            emptyBox.appendChild(emptyDesc);
            emptyBox.appendChild(actions);
            container.appendChild(emptyBox);
            return;
        }

        if (stateName === "success") {
            var grid = document.createElement("div");
            grid.className = "cards-grid";
            grid.id = "carte-grid";
            var items = (payload && Array.isArray(payload.items)) ? payload.items : [];
            items.forEach(function (c) {
                grid.appendChild(buildCartaNode(c, {
                    defaultStarter: (payload && payload.defaultStarters) ? payload.defaultStarters[c.ruolo] : "",
                    onLineupChange: payload ? payload.onLineupChange : null
                }));
            });
            container.appendChild(grid);
        }
    }

    function applyFieldErrors(formEl, fieldErrors) {
        if (!formEl) {
            return;
        }
        var errorNodes = formEl.querySelectorAll("[data-field-error]");
        errorNodes.forEach(function (node) {
            node.textContent = "";
            var group = node.closest(".form-group");
            if (group) {
                group.classList.remove("has-error");
                var ctrl = group.querySelector(".form-input, .form-select");
                if (ctrl) {
                    ctrl.setAttribute("aria-invalid", "false");
                }
            }
        });

        if (!fieldErrors || typeof fieldErrors !== "object") {
            return;
        }

        var firstInvalidInput = null;
        Object.keys(fieldErrors).forEach(function (fieldName) {
            var target = formEl.querySelector('[data-field-error="' + fieldName + '"]');
            if (target) {
                target.textContent = fieldErrors[fieldName];
                var group = target.closest(".form-group");
                if (group) {
                    group.classList.add("has-error");
                    var ctrl = group.querySelector(".form-input, .form-select");
                    if (ctrl) {
                        ctrl.setAttribute("aria-invalid", "true");
                        if (!firstInvalidInput) {
                            firstInvalidInput = ctrl;
                        }
                    }
                }
            }
        });

        if (firstInvalidInput && typeof firstInvalidInput.focus === "function") {
            firstInvalidInput.focus();
        }
    }

    function initAppSplash() {
        var splash = document.getElementById("app-splash-loader");
        if (!splash) {
            return;
        }
        try {
            if (window.sessionStorage && window.sessionStorage.getItem("fc_splash_seen") === "1") {
                splash.classList.add("is-dismissed");
                return;
            }
            if (window.sessionStorage) {
                window.sessionStorage.setItem("fc_splash_seen", "1");
            }
        } catch (e) {
            // sessionStorage non disponibile
        }
        window.setTimeout(function () {
            splash.classList.add("is-dismissed");
        }, 160);
    }

    /**
     * Vertical Slice 1: Interactive 3-3-3 Tactical Pitch & Position Inspector (index.html)
     */
    function initTacticalPitch() {
        var pitchEl = document.getElementById("tactical-pitch-board");
        var dockEl = document.getElementById("tactical-slot-dock");
        if (!pitchEl || !dockEl) {
            return;
        }

        var pitchNodes = pitchEl.querySelectorAll(".pitch-node[data-materia]");
        var matrixPills = document.querySelectorAll(".matrix-pill[data-materia]");
        var resetBtn = document.getElementById("btn-reset-lineup");

        var dockCodeEl = document.getElementById("dock-slot-code");
        var dockAreaEl = document.getElementById("dock-slot-area");
        var dockTitleEl = document.getElementById("dock-slot-title");
        var dockStatusEl = document.getElementById("dock-slot-status");
        var dockStarterBox = document.getElementById("dock-starter-box");
        var dockStarterMonogram = document.getElementById("dock-starter-monogram");
        var dockStarterName = document.getElementById("dock-starter-name");
        var dockStarterLabel = document.getElementById("dock-starter-label");
        var dockBenchBtn = document.getElementById("dock-btn-bench");
        var dockCandidatesList = document.getElementById("dock-candidate-list");
        var dockProposeLink = document.getElementById("dock-link-propose");
        var dockMercatoLink = document.getElementById("dock-link-mercato");

        var totalCoveredEl = document.getElementById("scoreboard-covered-count");
        var readinessStatusEl = document.getElementById("readiness-status-text");
        var readinessSegs = document.querySelectorAll("[data-readiness-seg]");

        // Build initial catalog map per subject from server-rendered pitch nodes + fetch fresh from /api/carte
        var defaultStarters = {};
        var candidatesBySubject = {};
        var pendingBySubject = {};

        SchemaValidator.allowedRuoli.forEach(function (r) {
            candidatesBySubject[r] = [];
            pendingBySubject[r] = [];
        });

        pitchNodes.forEach(function (node) {
            var mat = node.getAttribute("data-materia") || "";
            var defHolder = node.getAttribute("data-default-holder") || "";
            if (mat) {
                defaultStarters[mat] = defHolder;
                if (defHolder) {
                    candidatesBySubject[mat].push({
                        nome: defHolder,
                        ruolo: mat,
                        stato: "approvata"
                    });
                }
            }
        });

        var selectedMateria = "Informatica";

        function getActiveStarter(materia) {
            var candidateNames = (candidatesBySubject[materia] || []).map(function (c) {
                return c.nome;
            });
            var chosen = LineupStore.getStarterForSubject(materia, defaultStarters[materia] || "");
            if (chosen && candidateNames.length > 0 && candidateNames.indexOf(chosen) === -1) {
                return defaultStarters[materia] || "";
            }
            return chosen;
        }

        function syncPitchAndScoreboard() {
            var coveredCount = 0;
            var lineCounts = { scientifica: 0, umanistica: 0, linguistica: 0 };

            pitchNodes.forEach(function (node, idx) {
                var mat = node.getAttribute("data-materia") || "";
                var meta = SchemaValidator.getMateriaMeta(mat);
                var starterName = getActiveStarter(mat);
                var poolCount = (candidatesBySubject[mat] || []).length;
                var isOccupied = Boolean(starterName);

                if (isOccupied) {
                    coveredCount += 1;
                    if (lineCounts[meta.reparto] !== undefined) {
                        lineCounts[meta.reparto] += 1;
                    }
                }

                node.classList.toggle("is-occupied", isOccupied);
                node.classList.toggle("is-vacant", !isOccupied);
                node.classList.toggle("is-selected", mat === selectedMateria);
                node.setAttribute("aria-pressed", mat === selectedMateria ? "true" : "false");

                var monogramEl = node.querySelector("[data-node-monogram]");
                var holderEl = node.querySelector("[data-node-holder]");
                var poolEl = node.querySelector("[data-node-pool]");

                if (monogramEl) {
                    monogramEl.textContent = isOccupied ? SchemaValidator.getMonogram(starterName) : "+";
                }
                if (holderEl) {
                    holderEl.textContent = isOccupied ? starterName : "Schiera Titolare";
                }
                if (poolEl) {
                    poolEl.textContent = poolCount + " disp.";
                }

                if (readinessSegs[idx]) {
                    readinessSegs[idx].classList.toggle("is-filled", isOccupied);
                }
            });

            matrixPills.forEach(function (pill) {
                var mat = pill.getAttribute("data-materia") || "";
                var isOccupied = Boolean(getActiveStarter(mat));
                pill.classList.toggle("is-covered", isOccupied);
                pill.classList.toggle("is-selected", mat === selectedMateria);
            });

            var sciCountEl = document.getElementById("line-count-scientifica");
            var umaCountEl = document.getElementById("line-count-umanistica");
            var linCountEl = document.getElementById("line-count-linguistica");
            if (sciCountEl) { sciCountEl.textContent = lineCounts.scientifica + "/3"; }
            if (umaCountEl) { umaCountEl.textContent = lineCounts.umanistica + "/3"; }
            if (linCountEl) { linCountEl.textContent = lineCounts.linguistica + "/3"; }

            if (totalCoveredEl) {
                totalCoveredEl.textContent = coveredCount + " / 9";
            }
            if (readinessStatusEl) {
                var missing = 9 - coveredCount;
                readinessStatusEl.textContent = missing === 0
                    ? "Formazione 3-3-3 Completa!"
                    : (coveredCount + " di 9 cattedre schierate (" + missing + " scoperte)");
            }
        }

        function renderSelectedSlotDock() {
            var meta = SchemaValidator.getMateriaMeta(selectedMateria);
            var starterName = getActiveStarter(selectedMateria);
            var approvedList = candidatesBySubject[selectedMateria] || [];
            var pendingList = pendingBySubject[selectedMateria] || [];

            if (dockCodeEl) {
                dockCodeEl.textContent = meta.codice;
                dockCodeEl.setAttribute("data-codice", meta.codice);
            }
            if (dockAreaEl) {
                dockAreaEl.textContent = meta.area;
            }
            if (dockTitleEl) {
                dockTitleEl.textContent = selectedMateria;
            }
            if (dockStatusEl) {
                dockStatusEl.className = "status-tag " + (starterName ? "status-tag--ok" : "status-tag--wait");
                dockStatusEl.textContent = starterName ? "Titolare in Campo" : "Cattedra Scoperta";
            }

            if (dockStarterBox) {
                dockStarterBox.classList.toggle("is-empty", !starterName);
            }
            if (dockStarterMonogram) {
                dockStarterMonogram.textContent = starterName ? SchemaValidator.getMonogram(starterName) : meta.codice;
            }
            if (dockStarterLabel) {
                dockStarterLabel.textContent = starterName ? ("Titolare • " + meta.codice) : ("Posizione Vacante • " + meta.codice);
            }
            if (dockStarterName) {
                dockStarterName.textContent = starterName || "Nessun titolare assegnato";
            }
            if (dockBenchBtn) {
                dockBenchBtn.hidden = !starterName;
            }

            if (dockProposeLink) {
                dockProposeLink.href = "/suggerisci?ruolo=" + encodeURIComponent(selectedMateria);
                dockProposeLink.textContent = "+ Proponi " + meta.codice;
            }
            if (dockMercatoLink) {
                dockMercatoLink.href = "/mercato?ruolo=" + encodeURIComponent(selectedMateria);
            }

            if (dockCandidatesList) {
                clearElement(dockCandidatesList);
                if (approvedList.length === 0 && pendingList.length === 0) {
                    var emptyNotice = document.createElement("div");
                    emptyNotice.className = "dock-empty-notice";

                    var p = document.createElement("p");
                    p.textContent = "Nessuno Studente o Professore approvato per " + selectedMateria + ".";

                    var cta = document.createElement("a");
                    cta.href = "/suggerisci?ruolo=" + encodeURIComponent(selectedMateria);
                    cta.className = "btn btn--lime btn--xs";
                    cta.textContent = "+ Proponi il primo candidato per " + meta.codice;

                    emptyNotice.appendChild(p);
                    emptyNotice.appendChild(cta);
                    dockCandidatesList.appendChild(emptyNotice);
                } else {
                    approvedList.forEach(function (cand) {
                        var isCurrentStarter = cand.nome === starterName;
                        var row = document.createElement("div");
                        row.className = "dock-candidate-row" + (isCurrentStarter ? " is-active-starter" : "");

                        var left = document.createElement("div");
                        left.className = "dock-candidate-row__left";

                        var badge = document.createElement("div");
                        badge.className = "dock-candidate-row__badge";
                        badge.textContent = SchemaValidator.getMonogram(cand.nome);

                        var info = document.createElement("div");
                        var nameEl = document.createElement("p");
                        nameEl.className = "dock-candidate-row__name";
                        nameEl.textContent = cand.nome;

                        var subEl = document.createElement("p");
                        subEl.className = "dock-candidate-row__sub";
                        subEl.textContent = isCurrentStarter ? "Titolare schierato in campo" : "Disponibile nel Listone";

                        info.appendChild(nameEl);
                        info.appendChild(subEl);
                        left.appendChild(badge);
                        left.appendChild(info);

                        var actionBtn = document.createElement("button");
                        actionBtn.type = "button";
                        actionBtn.className = isCurrentStarter ? "btn btn--emerald btn--xs" : "btn btn--primary btn--xs";
                        actionBtn.textContent = isCurrentStarter ? "In Campo ✓" : "Schiera";
                        actionBtn.addEventListener("click", function () {
                            if (isCurrentStarter) {
                                LineupStore.setStarterForSubject(selectedMateria, "");
                            } else {
                                LineupStore.setStarterForSubject(selectedMateria, cand.nome);
                            }
                            syncPitchAndScoreboard();
                            renderSelectedSlotDock();
                        });

                        row.appendChild(left);
                        row.appendChild(actionBtn);
                        dockCandidatesList.appendChild(row);
                    });

                    pendingList.forEach(function (pend) {
                        var row = document.createElement("div");
                        row.className = "dock-candidate-row";

                        var left = document.createElement("div");
                        left.className = "dock-candidate-row__left";

                        var badge = document.createElement("div");
                        badge.className = "dock-candidate-row__badge";
                        badge.textContent = SchemaValidator.getMonogram(pend.nome);

                        var info = document.createElement("div");
                        var nameEl = document.createElement("p");
                        nameEl.className = "dock-candidate-row__name";
                        nameEl.textContent = pend.nome;

                        var subEl = document.createElement("p");
                        subEl.className = "dock-candidate-row__sub";
                        subEl.textContent = "Proposta in attesa di verifica";

                        info.appendChild(nameEl);
                        info.appendChild(subEl);
                        left.appendChild(badge);
                        left.appendChild(info);

                        var waitTag = document.createElement("span");
                        waitTag.className = "status-tag status-tag--wait";
                        waitTag.textContent = "In Verifica";

                        row.appendChild(left);
                        row.appendChild(waitTag);
                        dockCandidatesList.appendChild(row);
                    });
                }
            }
        }

        function selectSubject(materia, scrollOnMobile) {
            if (!materia || SchemaValidator.allowedRuoli.indexOf(materia) === -1) {
                return;
            }
            selectedMateria = materia;
            syncPitchAndScoreboard();
            renderSelectedSlotDock();
            if (scrollOnMobile && window.innerWidth < 1024 && dockEl.scrollIntoView) {
                dockEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }

        pitchNodes.forEach(function (node) {
            node.addEventListener("click", function () {
                var mat = node.getAttribute("data-materia") || "";
                selectSubject(mat, true);
            });
        });

        matrixPills.forEach(function (pill) {
            pill.addEventListener("click", function () {
                var mat = pill.getAttribute("data-materia") || "";
                selectSubject(mat, false);
            });
        });

        if (dockBenchBtn) {
            dockBenchBtn.addEventListener("click", function () {
                LineupStore.setStarterForSubject(selectedMateria, "");
                syncPitchAndScoreboard();
                renderSelectedSlotDock();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener("click", function () {
                LineupStore.resetAll();
                syncPitchAndScoreboard();
                renderSelectedSlotDock();
            });
        }

        // Initial render from SSR state, then enrich with full /api/carte dataset
        syncPitchAndScoreboard();
        renderSelectedSlotDock();

        FantaclasseAPI.listCarte("")
            .then(function (items) {
                SchemaValidator.allowedRuoli.forEach(function (r) {
                    candidatesBySubject[r] = [];
                    pendingBySubject[r] = [];
                });
                items.forEach(function (c) {
                    if (c.stato === "approvata" && candidatesBySubject[c.ruolo]) {
                        candidatesBySubject[c.ruolo].push(c);
                        if (!defaultStarters[c.ruolo]) {
                            defaultStarters[c.ruolo] = c.nome;
                        }
                    } else if (c.stato === "in_attesa" && pendingBySubject[c.ruolo]) {
                        pendingBySubject[c.ruolo].push(c);
                    }
                });
                syncPitchAndScoreboard();
                renderSelectedSlotDock();
            })
            .catch(function () {
                // Keep SSR state if offline
            });
    }

    /**
     * Vertical Slice 2: Class Roster & Candidate Scouting (mercato.html)
     */
    function initMercatoFilters() {
        var container = document.getElementById("carte-state-container");
        var totalBadge = document.getElementById("carte-total-badge");
        var statoButtons = document.querySelectorAll("[data-filter-stato]");
        var ruoloButtons = document.querySelectorAll("[data-filter-ruolo]");
        var searchInput = document.getElementById("mercato-search-input");

        if (!container || (statoButtons.length === 0 && ruoloButtons.length === 0)) {
            return;
        }

        var activeStato = "";
        var activeRuolo = "";
        var searchQuery = "";
        var cachedItems = null;
        var defaultStarters = {};

        statoButtons.forEach(function (b) {
            if (b.classList.contains("is-active")) {
                activeStato = b.getAttribute("data-filter-stato") || "";
            }
        });
        ruoloButtons.forEach(function (b) {
            if (b.classList.contains("is-active")) {
                activeRuolo = b.getAttribute("data-filter-ruolo") || "";
            }
        });

        function applyClientFilters(items) {
            var filtered = items.filter(function (c) {
                if (activeRuolo && c.ruolo !== activeRuolo) {
                    return false;
                }
                if (searchQuery) {
                    var q = searchQuery.toLowerCase();
                    var matchNome = c.nome.toLowerCase().indexOf(q) !== -1;
                    var matchRuolo = c.ruolo.toLowerCase().indexOf(q) !== -1;
                    if (!matchNome && !matchRuolo) {
                        return false;
                    }
                }
                return true;
            });

            if (totalBadge) {
                totalBadge.textContent = filtered.length + (filtered.length === 1 ? " Carta" : " Carte");
            }

            if (filtered.length === 0) {
                renderCarteState(container, "empty-state", { activeRuolo: activeRuolo });
            } else {
                renderCarteState(container, "success", {
                    items: filtered,
                    defaultStarters: defaultStarters,
                    onLineupChange: function () {
                        applyClientFilters(cachedItems || items);
                    }
                });
            }
        }

        function refreshCatalog() {
            renderCarteState(container, "loading", {});
            FantaclasseAPI.listCarte(activeStato)
                .then(function (items) {
                    cachedItems = items;
                    defaultStarters = {};
                    items.forEach(function (c) {
                        if (c.stato === "approvata" && !defaultStarters[c.ruolo]) {
                            defaultStarters[c.ruolo] = c.nome;
                        }
                    });
                    applyClientFilters(items);
                })
                .catch(function (err) {
                    renderCarteState(container, "error", {
                        message: err.message,
                        onRetry: refreshCatalog
                    });
                });
        }

        statoButtons.forEach(function (btn) {
            btn.addEventListener("click", function (ev) {
                ev.preventDefault();
                activeStato = btn.getAttribute("data-filter-stato") || "";
                statoButtons.forEach(function (b) {
                    var isCurrent = b === btn;
                    b.classList.toggle("is-active", isCurrent);
                    b.setAttribute("aria-pressed", isCurrent ? "true" : "false");
                });
                refreshCatalog();
            });
        });

        ruoloButtons.forEach(function (btn) {
            btn.addEventListener("click", function (ev) {
                ev.preventDefault();
                activeRuolo = btn.getAttribute("data-filter-ruolo") || "";
                ruoloButtons.forEach(function (b) {
                    var bRuolo = b.getAttribute("data-filter-ruolo") || "";
                    var isCurrent = bRuolo === activeRuolo;
                    b.classList.toggle("is-active", isCurrent);
                    b.setAttribute("aria-pressed", isCurrent ? "true" : "false");
                });
                if (cachedItems) {
                    applyClientFilters(cachedItems);
                } else {
                    refreshCatalog();
                }
            });
        });

        if (searchInput) {
            searchInput.addEventListener("input", function () {
                searchQuery = searchInput.value.trim();
                if (cachedItems) {
                    applyClientFilters(cachedItems);
                } else {
                    refreshCatalog();
                }
            });
        }

        // Hydrate starter buttons on SSR cards immediately
        var ssrCards = container.querySelectorAll(".player-card[data-ruolo][data-nome]");
        if (ssrCards.length > 0) {
            refreshCatalog();
        }
    }

    /**
     * Vertical Slice 3: Card Proposal & Live Verification Queue (suggerisci.html)
     */
    function initSuggerisciForm() {
        var form = document.getElementById("form-suggerisci");
        var feedbackBox = document.getElementById("suggerisci-feedback");
        var submitBtn = document.getElementById("btn-submit-carta");
        var queueList = document.getElementById("verification-queue-list");
        var queueCountBadge = document.getElementById("verification-queue-count");

        if (!form) {
            return;
        }

        var nomeInput = form.querySelector('[name="nome"]');
        var ruoloInput = form.querySelector('[name="ruolo"]');
        var quickButtons = form.querySelectorAll("[data-quick-role]");

        var previewName = document.getElementById("preview-card-name");
        var previewRole = document.getElementById("preview-card-role");
        var previewCode = document.getElementById("preview-role-code");
        var previewDept = document.getElementById("preview-card-dept");
        var previewInitial = document.getElementById("preview-initial");

        function updateLivePreview() {
            var currentNome = nomeInput ? nomeInput.value.trim() : "";
            var currentRuolo = ruoloInput ? ruoloInput.value.trim() : "";

            if (previewName) {
                previewName.textContent = currentNome || "Nome Studente / Prof";
            }
            if (previewInitial) {
                previewInitial.textContent = currentNome ? SchemaValidator.getMonogram(currentNome) : "FC";
            }
            if (previewRole) {
                previewRole.textContent = currentRuolo || "Seleziona Materia";
            }
            if (previewCode) {
                var meta = SchemaValidator.getMateriaMeta(currentRuolo);
                var code = currentRuolo ? meta.codice : "LICEO";
                previewCode.textContent = code;
                previewCode.setAttribute("data-codice", meta.codice);
            }
            if (previewDept) {
                var areaMeta = SchemaValidator.getMateriaMeta(currentRuolo);
                previewDept.textContent = currentRuolo ? areaMeta.area : "Liceo Scientifico";
            }
            quickButtons.forEach(function (btn) {
                var btnRole = btn.getAttribute("data-quick-role");
                var isSelected = btnRole === currentRuolo && currentRuolo !== "";
                btn.classList.toggle("is-selected", isSelected);
                btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
            });
        }

        if (nomeInput) {
            nomeInput.addEventListener("input", updateLivePreview);
        }
        if (ruoloInput) {
            ruoloInput.addEventListener("change", updateLivePreview);
        }
        quickButtons.forEach(function (btn) {
            btn.addEventListener("click", function () {
                var selectedRole = btn.getAttribute("data-quick-role") || "";
                if (ruoloInput) {
                    ruoloInput.value = selectedRole;
                }
                updateLivePreview();
            });
        });

        updateLivePreview();

        form.addEventListener("submit", function (ev) {
            var nomeVal = nomeInput ? nomeInput.value : "";
            var ruoloVal = ruoloInput ? ruoloInput.value : "";

            var check = SchemaValidator.validateCartaCreateInput(nomeVal, ruoloVal);
            if (!check.valid) {
                ev.preventDefault();
                applyFieldErrors(form, check.fieldErrors);
                return;
            }

            if (window.fetch) {
                ev.preventDefault();
                applyFieldErrors(form, {});
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = "Invio proposta in corso...";
                }

                FantaclasseAPI.createCarta(nomeVal, ruoloVal)
                    .then(function (res) {
                        var created = (res && res.item) ? res.item : { nome: nomeVal.trim(), ruolo: ruoloVal.trim(), stato: "in_attesa" };
                        form.reset();
                        updateLivePreview();
                        if (feedbackBox) {
                            clearElement(feedbackBox);
                            var banner = document.createElement("div");
                            banner.className = "status-banner status-banner--success";
                            banner.setAttribute("role", "status");

                            var wrap = document.createElement("div");
                            var title = document.createElement("p");
                            title.className = "status-banner__title";
                            title.textContent = "Proposta registrata nella coda di verifica";

                            var text = document.createElement("p");
                            text.className = "status-banner__text";
                            text.textContent = res.message || "La carta è stata inviata ed è in attesa di approvazione.";

                            wrap.appendChild(title);
                            wrap.appendChild(text);
                            banner.appendChild(wrap);
                            feedbackBox.appendChild(banner);
                        }

                        if (queueList) {
                            var emptyQueueMsg = queueList.querySelector("[data-empty-queue]");
                            if (emptyQueueMsg) {
                                emptyQueueMsg.remove();
                            }
                            var meta = SchemaValidator.getMateriaMeta(created.ruolo);
                            var row = document.createElement("div");
                            row.className = "queue-row";

                            var left = document.createElement("div");
                            left.className = "queue-row__left";

                            var codeBadge = document.createElement("span");
                            codeBadge.className = "role-code";
                            codeBadge.setAttribute("data-codice", meta.codice);
                            codeBadge.textContent = meta.codice;

                            var nameSpan = document.createElement("span");
                            nameSpan.className = "queue-row__name";
                            nameSpan.textContent = created.nome;

                            left.appendChild(codeBadge);
                            left.appendChild(nameSpan);

                            var tag = document.createElement("span");
                            tag.className = "status-tag status-tag--wait";
                            tag.textContent = "In Verifica";

                            row.appendChild(left);
                            row.appendChild(tag);
                            queueList.insertBefore(row, queueList.firstChild);

                            if (queueCountBadge) {
                                var currentCount = parseInt(queueCountBadge.textContent || "0", 10) || 0;
                                queueCountBadge.textContent = String(currentCount + 1) + " in verifica";
                            }
                        }
                    })
                    .catch(function (err) {
                        if (err && err.fieldErrors) {
                            applyFieldErrors(form, err.fieldErrors);
                        }
                        if (feedbackBox) {
                            clearElement(feedbackBox);
                            var banner = document.createElement("div");
                            banner.className = "status-banner status-banner--error";
                            banner.setAttribute("role", "alert");

                            var wrap = document.createElement("div");
                            var title = document.createElement("p");
                            title.className = "status-banner__title";
                            title.textContent = "Errore durante l'invio";

                            var text = document.createElement("p");
                            text.className = "status-banner__text";
                            text.textContent = (err && err.message) ? err.message : "Verifica i dati inseriti.";

                            wrap.appendChild(title);
                            wrap.appendChild(text);
                            banner.appendChild(wrap);
                            feedbackBox.appendChild(banner);
                        }
                    })
                    .finally(function () {
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = "Invia Proposta al Comitato";
                        }
                    });
            }
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        initAppSplash();
        initTacticalPitch();
        initMercatoFilters();
        initSuggerisciForm();
    });

    window.FantaclasseService = {
        SchemaValidator: SchemaValidator,
        LineupStore: LineupStore,
        API: FantaclasseAPI,
        renderCarteState: renderCarteState
    };
})();
