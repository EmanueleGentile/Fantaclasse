/**
 * Fantaclasse Frontend Service Layer, AuthStore & 4-State UI Engine
 * - Zero utilizzi di innerHTML / outerHTML / document.write (100% DOM API sicure + textContent)
 * - Gestione deterministica dei 4 stati asincroni: loading, success, empty-state, error (con retry)
 * - Validazione client-side speculare allo schema PocketBase (users, Carte)
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
   * 1. Configurazione centralizzata (Zero Hardcoding nei componenti)
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
   * 4. Safe Error Handler centralizzato (Zero Information Disclosure)
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
      inputs.forEach((input) => input.classList.remove("input-invalid"));
      const banner = formEl.querySelector("[data-form-banner]");
      if (banner) {
        banner.textContent = "";
        banner.hidden = true;
      }
    },

    renderFieldErrors(formEl, fieldErrors, bannerMessage) {
      if (!formEl) return;
      this.clearFormErrors(formEl);

      if (bannerMessage) {
        const banner = formEl.querySelector("[data-form-banner]");
        if (banner) {
          banner.textContent = bannerMessage;
          banner.hidden = false;
        }
      }

      if (!fieldErrors || typeof fieldErrors !== "object") return;

      Object.keys(fieldErrors).forEach((fieldName) => {
        const msg = fieldErrors[fieldName];
        const errEl = formEl.querySelector('[data-field-error="' + fieldName + '"]');
        const inputEl = formEl.querySelector('[name="' + fieldName + '"]');
        if (errEl && msg) {
          errEl.textContent = String(msg);
          errEl.hidden = false;
        }
        if (inputEl) {
          inputEl.classList.add("input-invalid");
        }
      });
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
   * Costruisce i nodi DOM esclusivamente con document.createElement e textContent.
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

      for (let i = 0; i < 3; i += 1) {
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

      const title = document.createElement("h4");
      title.className = "state-title";
      title.textContent = "Nessuna carta presente";

      const desc = document.createElement("p");
      desc.className = "state-desc";
      desc.textContent =
        message || "Non sono state trovate carte per il filtro selezionato nel database.";

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

      const title = document.createElement("h4");
      title.className = "state-title";
      title.textContent = "Errore di caricamento";

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
        retryBtn.textContent = "Riprova";
        retryBtn.addEventListener("click", onRetry);
        box.appendChild(retryBtn);
      }

      container.appendChild(box);
    },

    renderCarteSuccess(container, items) {
      if (!container) return;
      this.clearContainer(container);
      container.setAttribute("data-async-state", "success");

      items.forEach((carta) => {
        const isApproved = carta.stato === "approvata";
        const card = document.createElement("article");
        card.className = isApproved
          ? "player-card"
          : "player-card player-card--pending";
        if (SchemaValidator.isValidPocketBaseId(carta.id)) {
          card.setAttribute("data-record-id", carta.id);
        }

        const topBar = document.createElement("div");
        topBar.className = "rpg-card-top";

        const factionTag = document.createElement("span");
        factionTag.className = "rpg-faction-tag";
        factionTag.textContent = isApproved
          ? "FAZIONE CAMPO // SCHIERABILE"
          : "FAZIONE CATTEDRA // VERIFICA";

        const statusBadge = document.createElement("span");
        statusBadge.className = isApproved
          ? "status-pill status-approved"
          : "status-pill status-pending";
        statusBadge.textContent = isApproved ? "Approvata" : "In Revisione";

        topBar.appendChild(factionTag);
        topBar.appendChild(statusBadge);
        card.appendChild(topBar);

        const header = document.createElement("div");
        header.className = "player-header";

        const avatar = document.createElement("div");
        avatar.className = "player-avatar";
        const initial = (carta.nome || "?").trim().charAt(0).toUpperCase() || "?";
        avatar.textContent = initial;

        const info = document.createElement("div");
        info.className = "player-info";

        const nameEl = document.createElement("div");
        nameEl.className = "player-name";
        nameEl.textContent = carta.nome || "Carta senza nome";

        const roleRow = document.createElement("div");
        roleRow.className = "player-meta-row";

        const roleBadge = document.createElement("span");
        roleBadge.className = "role-badge";
        roleBadge.textContent = "RUOLO: " + (carta.ruolo || "Non assegnato");

        roleRow.appendChild(roleBadge);
        info.appendChild(nameEl);
        info.appendChild(roleRow);

        header.appendChild(avatar);
        header.appendChild(info);
        card.appendChild(header);

        const footer = document.createElement("div");
        footer.className = "player-footer";

        const idTag = document.createElement("span");
        idTag.className = "record-meta";
        idTag.textContent = "ID: " + (carta.id || "n/d");

        const dateTag = document.createElement("span");
        dateTag.className = "record-meta";
        const rawDate = String(carta.created || "").slice(0, 10);
        dateTag.textContent = rawDate ? "REG: " + rawDate : "";

        footer.appendChild(idTag);
        footer.appendChild(dateTag);
        card.appendChild(footer);

        container.appendChild(card);
      });
    },
  };

  /**
   * 7. Bootstrap dei Form e delle Viste Dinamiche
   */
  function initFormsValidation() {
    // Form Login
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

    // Form Registrazione
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

    // Form Suggerisci Carta
    const cartaForm = document.getElementById("form-suggerisci");
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

  function initMercatoAsyncCatalog() {
    const container = document.getElementById("carte-async-container");
    if (!container) return;

    const filterButtons = Array.from(document.querySelectorAll("[data-stato-filter]"));
    const countBadge = document.getElementById("carte-count-badge");
    let activeFilter = "";

    async function loadCarte(filterValue) {
      activeFilter = filterValue || "";
      UIStateManager.renderLoading(container, filterButtons);

      try {
        const items = await FantaclasseAPI.fetchCarte(activeFilter);
        if (countBadge) {
          countBadge.textContent = String(items.length);
        }
        if (items.length === 0) {
          UIStateManager.renderEmptyState(
            container,
            activeFilter === "in_attesa"
              ? "Non ci sono carte in attesa di approvazione in questo momento."
              : "Nessuna carta approvata disponibile nel catalogo PocketBase.",
            "Proponi una Carta",
            "/suggerisci"
          );
        } else {
          UIStateManager.renderCarteSuccess(container, items);
        }
      } catch (err) {
        UIStateManager.renderError(container, err.message, function () {
          loadCarte(activeFilter);
        });
      } finally {
        filterButtons.forEach((btn) => {
          btn.disabled = false;
        });
      }
    }

    filterButtons.forEach((btn) => {
      btn.addEventListener("click", function () {
        const filterVal = btn.getAttribute("data-stato-filter") || "";
        filterButtons.forEach((b) => b.classList.remove("filter-btn-active"));
        btn.classList.add("filter-btn-active");
        loadCarte(filterVal);
      });
    });

    // Esegue il caricamento reattivo iniziale se richiesto o al click sul pulsante aggiorna
    const refreshBtn = document.getElementById("btn-refresh-carte");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        loadCarte(activeFilter);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    FantaclasseAuthStore.verifySessionOnStartup();
    initFormsValidation();
    initMercatoAsyncCatalog();
  });
})();
