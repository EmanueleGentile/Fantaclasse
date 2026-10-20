/**
 * Fantaclasse Frontend Service Layer, AuthStore, Live Card Forge & 4-State UI Engine
 * - 100% DOM API sicure (document.createElement + textContent)
 * - Gestione deterministica dei 4 stati asincroni: loading, success, empty-state, error (con retry)
 * - Filtro combinato (Stato DB + Ruolo Tattico + Ricerca Testuale Live), Vista Griglia/Tabella e Live Preview
 */
(function () {
  "use strict";

  const PB_ID_REGEX = /^[a-z0-9]{15}$/;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const SAFE_TEXT_REGEX = /^[^<>]*$/;
  const URL_BLOCK_REGEX = /(https?:\/\/|www\.)/i;
  const ALLOWED_RUOLI = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];
  const ALLOWED_STATI = ["approvata", "in_attesa"];

  /**
   * 1. Configurazione centralizzata
   */
  const FantaclasseConfig = {
    get pbBaseUrl() {
      const rootAttr = document.documentElement.getAttribute("data-pb-url");
      return (rootAttr || "http://127.0.0.1:8090").replace(/\/+$/, "");
    },
    endpoints: {
      sessionCheck: "/api/auth/session",
      carteList: "/api/carte",
      carteCreate: "/api/carte",
    },
  };

  /**
   * 2. Validatore Client-Side Speculare al Database PocketBase
   */
  const SchemaValidator = {
    isValidPocketBaseId(id) {
      return typeof id === "string" && PB_ID_REGEX.test(id.trim());
    },

    validateLogin(email, password) {
      const errors = {};
      const cleanEmail = (email || "").trim();
      const cleanPass = password || "";

      if (!cleanEmail) {
        errors.email = "Inserisci il tuo indirizzo email.";
      } else if (cleanEmail.length > 255 || !EMAIL_REGEX.test(cleanEmail)) {
        errors.email = "Inserisci un indirizzo email valido.";
      }

      if (!cleanPass) {
        errors.password = "Inserisci la password.";
      } else if (cleanPass.length < 8) {
        errors.password = "La password deve contenere almeno 8 caratteri.";
      } else if (cleanPass.length > 72) {
        errors.password = "La password supera la lunghezza massima consentita.";
      }

      return errors;
    },

    validateRegistration(name, email, password, passwordConfirm) {
      const errors = {};
      const cleanName = (name || "").trim();
      const cleanEmail = (email || "").trim();
      const cleanPass = password || "";
      const cleanConfirm = passwordConfirm || "";

      if (!cleanName) {
        errors.name = "Inserisci un nome o nickname visibile.";
      } else if (cleanName.length < 2) {
        errors.name = "Il nome deve avere almeno 2 caratteri.";
      } else if (cleanName.length > 255) {
        errors.name = "Il nome non può superare i 255 caratteri.";
      } else if (!SAFE_TEXT_REGEX.test(cleanName)) {
        errors.name = "Il nome contiene caratteri non consentiti (< o >).";
      }

      if (!cleanEmail) {
        errors.email = "L'indirizzo email è obbligatorio.";
      } else if (cleanEmail.length > 255 || !EMAIL_REGEX.test(cleanEmail)) {
        errors.email = "Formato email non valido.";
      }

      if (!cleanPass) {
        errors.password = "La password è obbligatoria.";
      } else if (cleanPass.length < 8) {
        errors.password = "La password deve contenere almeno 8 caratteri.";
      } else if (cleanPass.length > 72) {
        errors.password = "La password non può superare i 72 caratteri.";
      }

      if (!cleanConfirm) {
        errors.passwordConfirm = "Conferma la password inserita.";
      } else if (cleanPass !== cleanConfirm) {
        errors.passwordConfirm = "Le due password non coincidono.";
      }

      return errors;
    },

    validateCarta(nome, ruolo) {
      const errors = {};
      const cleanNome = (nome || "").trim();
      const cleanRuolo = (ruolo || "").trim();

      if (!cleanNome) {
        errors.nome = "Il nome della carta è obbligatorio.";
      } else if (cleanNome.length < 2) {
        errors.nome = "Il nome della carta deve contenere almeno 2 caratteri.";
      } else if (cleanNome.length > 100) {
        errors.nome = "Il nome della carta non può superare i 100 caratteri.";
      } else if (!SAFE_TEXT_REGEX.test(cleanNome)) {
        errors.nome = "Il nome contiene caratteri HTML non ammessi (< o >).";
      } else if (URL_BLOCK_REGEX.test(cleanNome)) {
        errors.nome = "Non è consentito inserire link nel nome della carta.";
      }

      if (!cleanRuolo) {
        errors.ruolo = "Seleziona un ruolo per la carta.";
      } else if (!ALLOWED_RUOLI.includes(cleanRuolo)) {
        errors.ruolo = "Ruolo non valido. Scegli un ruolo dalla lista.";
      }

      return errors;
    },
  };

  /**
   * 3. Gestione Sessione e AuthStore PocketBase lato Client
   */
  const FantaclasseAuthStore = {
    STORAGE_KEY: "fc_pb_auth_model",

    saveModel(userModel) {
      try {
        if (userModel && SchemaValidator.isValidPocketBaseId(userModel.id)) {
          sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(userModel));
        }
      } catch (_) {
        // Ignora errori di storage privato
      }
    },

    clear() {
      try {
        sessionStorage.removeItem(this.STORAGE_KEY);
      } catch (_) {
        // Ignora
      }
    },

    async verifySessionOnStartup() {
      const requiresAuth = document.body.getAttribute("data-require-auth") === "true";
      try {
        const resp = await fetch(FantaclasseConfig.endpoints.sessionCheck, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        if (!resp.ok) {
          this.clear();
          if (requiresAuth) {
            window.location.replace("/login");
          }
          return null;
        }
        const payload = await resp.json();
        if (payload && payload.authenticated && payload.user) {
          this.saveModel(payload.user);
          return payload.user;
        }
        this.clear();
        if (requiresAuth) {
          window.location.replace("/login");
        }
        return null;
      } catch (_) {
        return null;
      }
    },
  };

  /**
   * 4. Safe Error Handler centralizzato con supporto WCAG 2.2 AA (aria-invalid & focus)
   */
  const SafeErrorMapper = {
    mapHttpStatus(status, serverMessage) {
      if (typeof serverMessage === "string" && serverMessage.trim().length > 0) {
        return serverMessage.trim();
      }
      switch (status) {
        case 400:
          return "I dati inseriti non sono validi. Controlla i campi evidenziati.";
        case 401:
          return "Sessione scaduta o non autenticata. Effettua nuovamente il login.";
        case 403:
          return "Non hai i permessi per eseguire questa operazione.";
        case 404:
          return "La risorsa richiesta non è disponibile.";
        default:
          return "Servizio temporaneamente non disponibile. Riprova tra qualche istante.";
      }
    },

    clearFormErrors(formEl) {
      if (!formEl) return;
      const errorSpans = formEl.querySelectorAll("[data-field-error]");
      errorSpans.forEach((el) => {
        el.textContent = "";
        el.hidden = true;
      });
      const inputs = formEl.querySelectorAll(".form-input");
      inputs.forEach((input) => {
        input.classList.remove("input-invalid");
        input.removeAttribute("aria-invalid");
      });
      const banner = formEl.querySelector("[data-form-banner]");
      if (banner) {
        banner.textContent = "";
        banner.hidden = true;
      }
    },

    renderFieldErrors(formEl, fieldErrors, bannerMessage) {
      if (!formEl) return;
      this.clearFormErrors(formEl);

      let firstInvalidInput = null;
      const banner = formEl.querySelector("[data-form-banner]");

      if (bannerMessage && banner) {
        banner.textContent = bannerMessage;
        banner.hidden = false;
        banner.setAttribute("tabindex", "-1");
      }

      if (fieldErrors && typeof fieldErrors === "object") {
        Object.keys(fieldErrors).forEach((fieldName) => {
          const msg = fieldErrors[fieldName];
          const errEl = formEl.querySelector('[data-field-error="' + fieldName + '"]');
          const inputEl = formEl.querySelector('[name="' + fieldName + '"]');
          if (errEl && msg) {
            errEl.textContent = String(msg);
            errEl.hidden = false;
            if (inputEl && inputEl.id && !errEl.id) {
              errEl.id = inputEl.id + "-error";
            }
            if (inputEl && errEl.id) {
              inputEl.setAttribute("aria-describedby", errEl.id);
            }
          }
          if (inputEl) {
            inputEl.classList.add("input-invalid");
            inputEl.setAttribute("aria-invalid", "true");
            if (!firstInvalidInput) {
              firstInvalidInput = inputEl;
            }
          }
        });
      }

      if (firstInvalidInput) {
        firstInvalidInput.focus();
      } else if (banner && !banner.hidden) {
        banner.focus();
      }
    },
  };

  /**
   * 5. Service API isolato per la collezione Carte
   */
  const FantaclasseAPI = {
    async fetchCarte(statoFilter) {
      const params = new URLSearchParams();
      if (statoFilter && ALLOWED_STATI.includes(statoFilter)) {
        params.set("stato", statoFilter);
      }
      const queryString = params.toString();
      const url = queryString
        ? FantaclasseConfig.endpoints.carteList + "?" + queryString
        : FantaclasseConfig.endpoints.carteList;

      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {
        payload = null;
      }

      if (!response.ok) {
        const err = new Error(
          SafeErrorMapper.mapHttpStatus(response.status, payload && payload.message)
        );
        err.status = response.status;
        throw err;
      }

      return Array.isArray(payload && payload.items) ? payload.items : [];
    },
  };

  /**
   * 6. Gestore Deterministico dei 4 Stati Asincroni (loading, success, empty-state, error)
   */
  const UIStateManager = {
    clearContainer(container) {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    },

    renderLoading(container, filterButtons) {
      if (!container) return;
      this.clearContainer(container);
      container.setAttribute("data-async-state", "loading");

      if (filterButtons) {
        filterButtons.forEach((btn) => {
          btn.disabled = true;
        });
      }

      for (let i = 0; i < 4; i += 1) {
        const skel = document.createElement("div");
        skel.className = "skeleton-card";
        const line1 = document.createElement("div");
        line1.className = "skeleton-line skeleton-title";
        const line2 = document.createElement("div");
        line2.className = "skeleton-line skeleton-subtitle";
        skel.appendChild(line1);
        skel.appendChild(line2);
        container.appendChild(skel);
      }
    },

    renderEmptyState(container, message, ctaText, ctaHref) {
      if (!container) return;
      this.clearContainer(container);
      container.setAttribute("data-async-state", "empty-state");

      const box = document.createElement("div");
      box.className = "state-box state-empty";

      const title = document.createElement("h3");
      title.className = "state-title";
      title.textContent = "Nessuna Carta Trovata nel Settore";

      const desc = document.createElement("p");
      desc.className = "state-desc";
      desc.textContent =
        message || "Non sono state trovate carte per i filtri tattici selezionati.";

      box.appendChild(title);
      box.appendChild(desc);

      if (ctaText && ctaHref) {
        const link = document.createElement("a");
        link.className = "btn-primary state-action-link";
        link.href = ctaHref;
        link.textContent = ctaText;
        box.appendChild(link);
      }

      container.appendChild(box);
    },

    renderError(container, errorMessage, onRetry) {
      if (!container) return;
      this.clearContainer(container);
      container.setAttribute("data-async-state", "error");

      const box = document.createElement("div");
      box.className = "state-box state-error";
      box.setAttribute("role", "alert");

      const title = document.createElement("h3");
      title.className = "state-title";
      title.textContent = "Errore di Sincronizzazione";

      const desc = document.createElement("p");
      desc.className = "state-desc";
      desc.textContent =
        errorMessage || "Impossibile recuperare i dati da PocketBase in questo momento.";

      box.appendChild(title);
      box.appendChild(desc);

      if (typeof onRetry === "function") {
        const retryBtn = document.createElement("button");
        retryBtn.type = "button";
        retryBtn.className = "btn-retry";
        retryBtn.textContent = "Riprova Connessione";
        retryBtn.addEventListener("click", onRetry);
        box.appendChild(retryBtn);
      }

      container.appendChild(box);
    },

    renderCarteSuccess(container, items) {
      if (!container) return;
      this.clearContainer(container);
      container.setAttribute("data-async-state", "success");

      const svgNS = "http://www.w3.org/2000/svg";

      items.forEach((carta) => {
        const isApproved = carta.stato === "approvata";
        const roleStr = (carta.ruolo || "").trim();
        const roleCode = roleStr ? roleStr.charAt(0).toUpperCase() : "?";
        const roleShort = roleStr ? roleStr.slice(0, 3).toUpperCase() : "N/D";
        const initial = (carta.nome || "?").trim().charAt(0).toUpperCase() || "?";
        const yearStr = String(carta.created || "").slice(0, 4) || "2026";

        const card = document.createElement("article");
        card.className = isApproved
          ? "player-card"
          : "player-card player-card--pending";
        if (SchemaValidator.isValidPocketBaseId(carta.id)) {
          card.setAttribute("data-record-id", carta.id);
        }
        card.setAttribute("data-card-ruolo", roleStr || "Non assegnato");
        card.setAttribute("data-card-nome", (carta.nome || "").toLowerCase());
        card.setAttribute("data-card-stato", carta.stato || "");

        const banner = document.createElement("div");
        banner.className = "tc-banner";

        const emblem = document.createElement("span");
        emblem.className = "tc-role-emblem";
        emblem.textContent = roleCode;

        const statusBadge = document.createElement("span");
        statusBadge.className = isApproved
          ? "status-pill status-approved"
          : "status-pill status-pending";
        statusBadge.textContent = isApproved ? "Schierabile" : "In Verifica";

        banner.appendChild(emblem);
        banner.appendChild(statusBadge);
        card.appendChild(banner);

        const medallionWrap = document.createElement("div");
        medallionWrap.className = "tc-medallion-wrap";

        const medallion = document.createElement("div");
        medallion.className = "tc-medallion";
        medallion.setAttribute("aria-hidden", "true");

        const jerseySvg = document.createElementNS(svgNS, "svg");
        jerseySvg.setAttribute("class", "tc-jersey-svg");
        const useEl = document.createElementNS(svgNS, "use");
        useEl.setAttribute("href", "#icon-jersey");
        jerseySvg.appendChild(useEl);

        const initSpan = document.createElement("span");
        initSpan.className = "tc-initial";
        initSpan.textContent = initial;

        medallion.appendChild(jerseySvg);
        medallion.appendChild(initSpan);
        medallionWrap.appendChild(medallion);
        card.appendChild(medallionWrap);

        const body = document.createElement("div");
        body.className = "tc-body";

        const nameEl = document.createElement("h3");
        nameEl.className = "player-name";
        nameEl.textContent = carta.nome || "Giocatore";

        const roleBadge = document.createElement("span");
        roleBadge.className = "role-badge";
        roleBadge.textContent = roleStr || "Non assegnato";

        body.appendChild(nameEl);
        body.appendChild(roleBadge);
        card.appendChild(body);

        const footer = document.createElement("div");
        footer.className = "tc-footer";

        const statReparto = document.createElement("div");
        statReparto.className = "tc-stat";
        const lblReparto = document.createElement("span");
        lblReparto.className = "tc-stat-label";
        lblReparto.textContent = "Reparto";
        const valReparto = document.createElement("strong");
        valReparto.className = "tc-stat-val";
        valReparto.textContent = roleShort;
        statReparto.appendChild(lblReparto);
        statReparto.appendChild(valReparto);

        const statSeason = document.createElement("div");
        statSeason.className = "tc-stat";
        const lblSeason = document.createElement("span");
        lblSeason.className = "tc-stat-label";
        lblSeason.textContent = "Stagione";
        const valSeason = document.createElement("strong");
        valSeason.className = "tc-stat-val";
        valSeason.textContent = yearStr;
        statSeason.appendChild(lblSeason);
        statSeason.appendChild(valSeason);

        footer.appendChild(statReparto);
        footer.appendChild(statSeason);
        card.appendChild(footer);

        container.appendChild(card);
      });
    },
  };

  /**
   * 7. Toggle Visibilità Password nei Form Auth
   */
  function initPasswordToggles() {
    const toggleButtons = Array.from(document.querySelectorAll("[data-toggle-password]"));
    toggleButtons.forEach((btn) => {
      btn.addEventListener("click", function () {
        const targetId = btn.getAttribute("data-toggle-password");
        const inputEl = targetId ? document.getElementById(targetId) : null;
        if (!inputEl) return;

        const isHidden = inputEl.type === "password";
        inputEl.type = isHidden ? "text" : "password";
        btn.textContent = isHidden ? "Nascondi" : "Mostra";
        btn.setAttribute("aria-pressed", isHidden ? "true" : "false");
      });
    });
  }

  /**
   * 8. Live Card Forge Preview (/suggerisci) & Validazione Form
   */
  function initForgeLivePreview() {
    const cartaForm =
      document.getElementById("form-suggerisci-carta") ||
      document.getElementById("form-suggerisci");
    if (!cartaForm) return;

    const nomeInput = document.getElementById("carta-nome");
    const nomeCounter = document.getElementById("carta-nome-counter");
    const ruoloSelect = document.getElementById("carta-ruolo");
    const previewArticle = document.getElementById("preview-card-article");
    const previewEmblem = document.getElementById("preview-card-emblem");
    const previewReparto = document.getElementById("preview-card-reparto");
    const previewAvatar = document.getElementById("preview-card-avatar");
    const previewName =
      document.getElementById("preview-card-nome") ||
      document.getElementById("preview-card-name");
    const previewRole =
      document.getElementById("preview-card-ruolo") ||
      document.getElementById("preview-card-role");
    const resetBtn = document.getElementById("btn-reset-forge");
    const quickRoleBtns = Array.from(document.querySelectorAll("[data-pick-ruolo]"));

    function syncPreview() {
      const rawName = (nomeInput && nomeInput.value) || "";
      const currentName = rawName.trim();
      const currentRole = ((ruoloSelect && ruoloSelect.value) || "").trim();
      const displayRole = currentRole || "Portiere";

      if (nomeCounter) {
        nomeCounter.textContent = rawName.length + " / 100";
      }
      if (previewName) {
        previewName.textContent = currentName || "Nome Giocatore";
      }
      if (previewAvatar) {
        previewAvatar.textContent = currentName
          ? currentName.charAt(0).toUpperCase()
          : "★";
      }
      if (previewRole) {
        previewRole.textContent = displayRole;
      }
      if (previewEmblem) {
        previewEmblem.textContent = displayRole.charAt(0).toUpperCase();
      }
      if (previewReparto) {
        previewReparto.textContent = displayRole.slice(0, 3).toUpperCase();
      }
      if (previewArticle) {
        previewArticle.setAttribute("data-card-ruolo", displayRole);
      }

      quickRoleBtns.forEach((btn) => {
        const val = btn.getAttribute("data-pick-ruolo");
        const isSelected = val === currentRole && currentRole !== "";
        if (isSelected) {
          btn.classList.add("active");
          btn.setAttribute("aria-pressed", "true");
        } else {
          btn.classList.remove("active");
          btn.setAttribute("aria-pressed", "false");
        }
      });
    }

    if (nomeInput) {
      nomeInput.addEventListener("input", syncPreview);
    }
    if (ruoloSelect) {
      ruoloSelect.addEventListener("change", syncPreview);
    }

    quickRoleBtns.forEach((btn) => {
      btn.addEventListener("click", function () {
        const picked = btn.getAttribute("data-pick-ruolo") || "";
        if (ruoloSelect) {
          ruoloSelect.value = picked;
        }
        syncPreview();
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        cartaForm.reset();
        if (nomeInput) nomeInput.value = "";
        if (ruoloSelect) ruoloSelect.value = "";
        SafeErrorMapper.clearFormErrors(cartaForm);
        syncPreview();
        if (nomeInput) nomeInput.focus();
      });
    }

    syncPreview();
  }

  function initFormsValidation() {
    const loginForm = document.getElementById("form-login");
    if (loginForm) {
      loginForm.addEventListener("submit", function (e) {
        const email = (loginForm.elements.email && loginForm.elements.email.value) || "";
        const password = (loginForm.elements.password && loginForm.elements.password.value) || "";
        const errors = SchemaValidator.validateLogin(email, password);

        if (Object.keys(errors).length > 0) {
          e.preventDefault();
          SafeErrorMapper.renderFieldErrors(
            loginForm,
            errors,
            "Controlla i campi evidenziati prima di procedere."
          );
          return;
        }
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Accesso in corso...";
        }
      });
    }

    const registerForm = document.getElementById("form-register");
    if (registerForm) {
      registerForm.addEventListener("submit", function (e) {
        const name = (registerForm.elements.name && registerForm.elements.name.value) || "";
        const email = (registerForm.elements.email && registerForm.elements.email.value) || "";
        const password =
          (registerForm.elements.password && registerForm.elements.password.value) || "";
        const passwordConfirm =
          (registerForm.elements.passwordConfirm &&
            registerForm.elements.passwordConfirm.value) ||
          "";

        const errors = SchemaValidator.validateRegistration(
          name,
          email,
          password,
          passwordConfirm
        );

        if (Object.keys(errors).length > 0) {
          e.preventDefault();
          SafeErrorMapper.renderFieldErrors(
            registerForm,
            errors,
            "Correggi i campi evidenziati per completare la registrazione."
          );
          return;
        }
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Registrazione in corso...";
        }
      });
    }

    const cartaForm =
      document.getElementById("form-suggerisci-carta") ||
      document.getElementById("form-suggerisci");
    if (cartaForm) {
      cartaForm.addEventListener("submit", function (e) {
        const nome = (cartaForm.elements.nome && cartaForm.elements.nome.value) || "";
        const ruolo = (cartaForm.elements.ruolo && cartaForm.elements.ruolo.value) || "";
        const errors = SchemaValidator.validateCarta(nome, ruolo);

        if (Object.keys(errors).length > 0) {
          e.preventDefault();
          SafeErrorMapper.renderFieldErrors(
            cartaForm,
            errors,
            "Verifica i dati della carta prima di inviare la proposta."
          );
          return;
        }
        const submitBtn = cartaForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Invio in corso...";
        }
      });
    }
  }

  /**
   * 9. Catalogo Carte Asincrono con Filtro Stato + Filtro Ruolo + Ricerca Live + Switcher Vista
   */
  function initMercatoAsyncCatalog() {
    const container =
      document.getElementById("carte-grid-container") ||
      document.getElementById("carte-async-container");
    if (!container) return;

    const filterButtons = Array.from(
      document.querySelectorAll("[data-stato], [data-stato-filter]")
    );
    const roleButtons = Array.from(
      document.querySelectorAll("[data-ruolo], [data-ruolo-filter]")
    );
    const viewButtons = Array.from(document.querySelectorAll("[data-view-mode]"));
    const tableHead = document.getElementById("listone-table-head");
    const searchInput = document.getElementById("search-carte-input");
    const clearSearchBtn = document.getElementById("btn-clear-search");
    const countBadge = document.getElementById("carte-count-badge");
    const statusAnnouncer = document.getElementById("carte-status-announcer");

    function getStatoAttr(btn) {
      if (!btn) return "";
      return btn.getAttribute("data-stato") || btn.getAttribute("data-stato-filter") || "";
    }

    function getRuoloAttr(btn) {
      if (!btn) return "";
      return btn.getAttribute("data-ruolo") || btn.getAttribute("data-ruolo-filter") || "";
    }

    const initialActiveStatoBtn = document.querySelector(".filter-btn.filter-btn-active");
    const initialActiveRoleBtn = document.querySelector(".role-filter-btn.role-filter-active");

    let activeStatoFilter = getStatoAttr(initialActiveStatoBtn);
    let activeRoleFilter = getRuoloAttr(initialActiveRoleBtn);
    let searchQuery = "";
    let cachedItems = null;

    function announceCount(count) {
      if (countBadge) {
        countBadge.textContent = String(count);
      }
      if (statusAnnouncer) {
        statusAnnouncer.textContent = count + " carte visualizzate nel listone.";
      }
    }

    function applyLocalFiltersAndRender(itemsSource) {
      const filtered = itemsSource.filter((item) => {
        const matchesRole = !activeRoleFilter || (item.ruolo || "") === activeRoleFilter;
        const matchesQuery =
          !searchQuery ||
          String(item.nome || "")
            .toLowerCase()
            .includes(searchQuery) ||
          String(item.ruolo || "")
            .toLowerCase()
            .includes(searchQuery);
        return matchesRole && matchesQuery;
      });

      announceCount(filtered.length);

      if (filtered.length === 0) {
        UIStateManager.renderEmptyState(
          container,
          "Nessun giocatore corrisponde ai filtri selezionati.",
          "+ Crea Carta",
          "/suggerisci"
        );
      } else {
        UIStateManager.renderCarteSuccess(container, filtered);
      }
    }

    async function loadCarte(statoValue) {
      activeStatoFilter = statoValue || "";
      UIStateManager.renderLoading(container, filterButtons);

      try {
        const items = await FantaclasseAPI.fetchCarte(activeStatoFilter);
        cachedItems = items;
        applyLocalFiltersAndRender(items);
      } catch (err) {
        UIStateManager.renderError(container, err.message, function () {
          loadCarte(activeStatoFilter);
        });
      } finally {
        filterButtons.forEach((btn) => {
          btn.disabled = false;
        });
      }
    }

    filterButtons.forEach((btn) => {
      btn.addEventListener("click", function () {
        const filterVal = getStatoAttr(btn);
        filterButtons.forEach((b) => {
          b.classList.remove("filter-btn-active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("filter-btn-active");
        btn.setAttribute("aria-pressed", "true");
        loadCarte(filterVal);
      });
    });

    roleButtons.forEach((btn) => {
      btn.addEventListener("click", async function () {
        activeRoleFilter = getRuoloAttr(btn);
        roleButtons.forEach((b) => {
          b.classList.remove("role-filter-active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("role-filter-active");
        btn.setAttribute("aria-pressed", "true");
        if (cachedItems === null) {
          await loadCarte(activeStatoFilter);
        } else {
          applyLocalFiltersAndRender(cachedItems);
        }
      });
    });

    viewButtons.forEach((btn) => {
      btn.addEventListener("click", function () {
        const mode = btn.getAttribute("data-view-mode") || "grid";
        viewButtons.forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");

        if (mode === "list") {
          container.classList.add("view-list");
          if (tableHead) tableHead.classList.add("is-visible");
        } else {
          container.classList.remove("view-list");
          if (tableHead) tableHead.classList.remove("is-visible");
        }
      });
    });

    if (searchInput) {
      searchInput.addEventListener("input", async function () {
        searchQuery = (searchInput.value || "").trim().toLowerCase();
        if (clearSearchBtn) {
          clearSearchBtn.hidden = searchQuery.length === 0;
        }
        if (cachedItems === null) {
          await loadCarte(activeStatoFilter);
        } else {
          applyLocalFiltersAndRender(cachedItems);
        }
      });
    }

    if (clearSearchBtn && searchInput) {
      clearSearchBtn.addEventListener("click", async function () {
        searchInput.value = "";
        searchQuery = "";
        clearSearchBtn.hidden = true;
        searchInput.focus();
        if (cachedItems === null) {
          await loadCarte(activeStatoFilter);
        } else {
          applyLocalFiltersAndRender(cachedItems);
        }
      });
    }

    const refreshBtn = document.getElementById("btn-refresh-carte");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        loadCarte(activeStatoFilter);
      });
    }

    if (activeRoleFilter) {
      loadCarte(activeStatoFilter);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    FantaclasseAuthStore.verifySessionOnStartup();
    initPasswordToggles();
    initFormsValidation();
    initForgeLivePreview();
    initMercatoAsyncCatalog();
  });
})();
