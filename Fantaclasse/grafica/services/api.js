/**
 * Service Layer Frontend per Fantaclasse — Liceo Scientifico Edition (grafica/services/api.js)
 * - Validazione per le 9 Materie Curricolari del Liceo Scientifico.
 * - Zero esposizione di ID database, email o metadati interni (GDPR & Security by Design).
 * - Gestione esplicita dei 4 stati asincroni per componente:
 *   1. `loading` (Skeleton UI)
 *   2. `success` (Rendering sicuro con createElement / textContent)
 *   3. `empty-state` (Illustrazione + CTA contestuale)
 *   4. `error` (Banner accessibile con pulsante Riprova)
 */

(function () {
    "use strict";

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
            "Informatica": { codice: "INF", area: "Area Scientifica" },
            "Matematica": { codice: "MAT", area: "Area Scientifica" },
            "Scienze": { codice: "SCI", area: "Area Scientifica" },
            "Italiano": { codice: "ITA", area: "Area Umanistica" },
            "Filosofia": { codice: "FIL", area: "Area Umanistica" },
            "Storia": { codice: "STO", area: "Area Umanistica" },
            "Inglese": { codice: "ING", area: "Area Linguistica & Arte" },
            "Disegno e Storia dell'Arte": { codice: "ART", area: "Area Linguistica & Arte" },
            "Scienze Motorie": { codice: "MOT", area: "Area Linguistica & Arte" }
        },

        isNonEmptyString: function (val) {
            return typeof val === "string" && val.trim().length > 0;
        },

        getMateriaMeta: function (ruolo) {
            if (ruolo && SchemaValidator.materieMeta[ruolo]) {
                return SchemaValidator.materieMeta[ruolo];
            }
            return { codice: "MAT", area: "Liceo Scientifico" };
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

    function buildCartaNode(carta) {
        var meta = SchemaValidator.getMateriaMeta(carta.ruolo);
        var codice = carta.codice_materia || meta.codice;
        var area = carta.area_materia || meta.area;

        var article = document.createElement("article");
        article.className = "player-card";
        article.setAttribute("data-ruolo", carta.ruolo);
        article.setAttribute("data-stato", carta.stato);
        article.setAttribute("data-codice", codice);

        var top = document.createElement("div");
        top.className = "player-card__top";

        var roleCode = document.createElement("span");
        roleCode.className = "role-code";
        roleCode.setAttribute("data-codice", codice);
        roleCode.textContent = codice;

        var statusTag = document.createElement("span");
        statusTag.className = "status-tag " + (
            carta.stato === "approvata" ? "status-tag--ok" : "status-tag--wait"
        );
        statusTag.textContent = carta.stato === "approvata" ? "Approvata" : "In Verifica";

        top.appendChild(roleCode);
        top.appendChild(statusTag);

        var visual = document.createElement("div");
        visual.className = "player-card__visual";
        visual.setAttribute("aria-hidden", "true");

        var emblem = document.createElement("div");
        emblem.className = "player-card__emblem";
        emblem.setAttribute("data-codice", codice);

        var initial = document.createElement("span");
        initial.textContent = carta.nome.charAt(0).toUpperCase();
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

        article.appendChild(top);
        article.appendChild(visual);
        article.appendChild(body);
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
            emptyTitle.textContent = "Nessuna carta per questa materia";

            var emptyDesc = document.createElement("p");
            emptyDesc.className = "state-box__desc";
            emptyDesc.textContent = "Nessuno Studente o Professore corrisponde ai filtri selezionati.";

            var actions = document.createElement("div");
            actions.className = "state-box__actions";

            var resetBtn = document.createElement("a");
            resetBtn.href = "/mercato";
            resetBtn.className = "btn btn--secondary btn--sm";
            resetBtn.textContent = "Mostra tutte le 9 materie";

            var cta = document.createElement("a");
            cta.href = "/suggerisci";
            cta.className = "btn btn--primary btn--sm";
            cta.textContent = "+ Crea Carta";

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
                grid.appendChild(buildCartaNode(c));
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
        }, 180);
    }

    function initMercatoFilters() {
        var container = document.getElementById("carte-state-container");
        var totalBadge = document.getElementById("carte-total-badge");
        var statoButtons = document.querySelectorAll("[data-filter-stato]");
        var ruoloButtons = document.querySelectorAll("[data-filter-ruolo]");

        if (!container || (statoButtons.length === 0 && ruoloButtons.length === 0)) {
            return;
        }

        var activeStato = "";
        var activeRuolo = "";

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

        function refreshCatalog() {
            renderCarteState(container, "loading", {});
            FantaclasseAPI.listCarte(activeStato)
                .then(function (items) {
                    var filtered = items;
                    if (activeRuolo) {
                        filtered = items.filter(function (c) {
                            return c.ruolo === activeRuolo;
                        });
                    }
                    if (totalBadge) {
                        totalBadge.textContent = filtered.length + " Carte";
                    }
                    if (filtered.length === 0) {
                        renderCarteState(container, "empty-state", {});
                    } else {
                        renderCarteState(container, "success", { items: filtered });
                    }
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
                    var isCurrent = b === btn;
                    b.classList.toggle("is-active", isCurrent);
                    b.setAttribute("aria-pressed", isCurrent ? "true" : "false");
                });
                refreshCatalog();
            });
        });
    }

    function initSuggerisciForm() {
        var form = document.getElementById("form-suggerisci");
        var feedbackBox = document.getElementById("suggerisci-feedback");
        var submitBtn = document.getElementById("btn-submit-carta");
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
                previewInitial.textContent = currentNome ? currentNome.charAt(0).toUpperCase() : "F";
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
                            title.textContent = "Proposta inviata con successo";

                            var text = document.createElement("p");
                            text.className = "status-banner__text";
                            text.textContent = res.message || "La carta è stata inviata ed è in attesa di verifica.";

                            wrap.appendChild(title);
                            wrap.appendChild(text);
                            banner.appendChild(wrap);
                            feedbackBox.appendChild(banner);
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
                            submitBtn.textContent = "Invia Proposta Carta";
                        }
                    });
            }
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        initAppSplash();
        initMercatoFilters();
        initSuggerisciForm();
    });

    window.FantaclasseService = {
        SchemaValidator: SchemaValidator,
        API: FantaclasseAPI,
        renderCarteState: renderCarteState
    };
})();
