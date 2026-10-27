"""
Entry-point Flask per Fantaclasse (Strict-Mode Backend-Driven).
- Zero mock-data statici o collezioni fantasma.
- Comunicazione isolata tramite PocketBaseService (logica/pb_service.py).
- Gestione sessione basata su token JWT PocketBase verificato ad ogni richiesta protetta.
"""

from functools import wraps
import os
import secrets
from typing import Optional

from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

from logica.modelli import AuthSession
from logica.pb_service import PocketBaseService
from logica.regole import MATERIE_META, RUOLI_CARTE_AMMESSI, STATI_CARTE_AMMESSI

app = Flask(__name__, template_folder="interfaccia", static_folder="grafica")
app.secret_key = (
    os.environ.get("FLASK_SECRET_KEY")
    or os.environ.get("SECRET_KEY")
    or secrets.token_hex(32)
)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)

pb_service = PocketBaseService()


def _clear_auth_session() -> None:
    session.pop("pb_token", None)
    session.pop("pb_user", None)


def _save_auth_session(auth_session: AuthSession) -> None:
    session["pb_token"] = auth_session.token
    if auth_session.user:
        session["pb_user"] = auth_session.user.to_public_dict()


def _get_active_auth_session() -> Optional[AuthSession]:
    """
    Verifica la validità del token JWT salvato in sessione (authStore.isValid).
    Se il token è scaduto o rifiutato da PocketBase, pulisce immediatamente lo stato locale.
    """
    token = session.get("pb_token")
    if not token:
        return None

    validated, err = pb_service.validate_session(token)
    if err or not validated or not validated.is_valid:
        _clear_auth_session()
        return None

    _save_auth_session(validated)
    return validated


def login_required(view_func):
    """Route Guard per le viste che richiedono autenticazione PocketBase (`@request.auth.id != ''`)."""
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        auth_session = _get_active_auth_session()
        if not auth_session:
            return redirect(url_for("login"))
        return view_func(*args, **kwargs)
    return wrapped


@app.context_processor
def inject_global_context():
    return {
        "ruoli_ammessi": RUOLI_CARTE_AMMESSI,
        "materie_meta": MATERIE_META,
    }


@app.after_request
def apply_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    return response


@app.route("/")
def home():
    """
    Dashboard principale: mostra esclusivamente lo stato reale dell'utente autenticato (`users`)
    e il riepilogo reale della collezione `Carte` ospitata su PocketBase.
    """
    auth_session = _get_active_auth_session()
    token = auth_session.token if auth_session else None
    user_dict = auth_session.user.to_public_dict() if (auth_session and auth_session.user) else None

    carte_list, err = pb_service.list_carte(token=token)
    carte_approvate = []
    carte_in_attesa = []

    if carte_list is not None:
        carte_approvate = [c for c in carte_list if c.stato == "approvata"]
        carte_in_attesa = [c for c in carte_list if c.stato == "in_attesa"]

    conteggio_ruoli = {r: 0 for r in RUOLI_CARTE_AMMESSI}
    titolari_per_materia = {}
    for c in carte_approvate:
        if c.ruolo in conteggio_ruoli:
            conteggio_ruoli[c.ruolo] += 1
            if c.ruolo not in titolari_per_materia:
                titolari_per_materia[c.ruolo] = c

    formazione_materie = []
    for materia in RUOLI_CARTE_AMMESSI:
        meta = MATERIE_META.get(materia, {"codice": "MAT", "area": "Area Scientifica"})
        titolare = titolari_per_materia.get(materia)
        formazione_materie.append({
            "materia": materia,
            "codice": meta["codice"],
            "area": meta["area"],
            "titolare": titolare,
            "totale_materia": conteggio_ruoli.get(materia, 0),
        })

    totale_schierate = sum(1 for slot in formazione_materie if slot["titolare"] is not None)

    return render_template(
        "index.html",
        utente=user_dict,
        formazione_materie=formazione_materie,
        totale_schierate=totale_schierate,
        totale_approvate=len(carte_approvate),
        totale_in_attesa=len(carte_in_attesa),
        conteggio_ruoli=conteggio_ruoli,
        errore_caricamento=err.message if err else None,
    )


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        if _get_active_auth_session():
            return redirect(url_for("home"))
        registered_ok = request.args.get("registered") == "1"
        return render_template(
            "login.html",
            errore=None,
            field_errors={},
            email_val="",
            registered_ok=registered_ok,
        )

    email = request.form.get("email", "")
    password = request.form.get("password", "")

    auth_session, err = pb_service.login(email, password)
    if err or not auth_session:
        return (
            render_template(
                "login.html",
                errore=err.message if err else "Errore durante l'accesso.",
                field_errors=err.field_errors if err else {},
                email_val=email.strip(),
                registered_ok=False,
            ),
            err.status_code if err else 400,
        )

    _save_auth_session(auth_session)
    return redirect(url_for("home"))


@app.route("/registrati", methods=["GET", "POST"])
def registrati():
    if request.method == "GET":
        if _get_active_auth_session():
            return redirect(url_for("home"))
        return render_template(
            "registrati.html",
            errore=None,
            field_errors={},
            form_values={"name": "", "email": ""},
        )

    name = request.form.get("name", "")
    email = request.form.get("email", "")
    password = request.form.get("password", "")
    password_confirm = request.form.get("passwordConfirm", "")

    _, err = pb_service.register(
        email=email,
        name=name,
        password=password,
        password_confirm=password_confirm,
    )
    if err:
        return (
            render_template(
                "registrati.html",
                errore=err.message,
                field_errors=err.field_errors,
                form_values={"name": name.strip(), "email": email.strip()},
            ),
            err.status_code,
        )

    return redirect(url_for("login", registered="1"))


@app.route("/logout", methods=["GET", "POST"])
def logout():
    _clear_auth_session()
    return redirect(url_for("home"))


@app.route("/mercato")
def mercato():
    """
    Catalogo Carte reale collegato a `/api/collections/Carte/records`.
    - Utenti pubblici: visualizzano solo le carte con `stato = 'approvata'`.
    - Utenti autenticati: possono filtrare anche `stato = 'in_attesa'`.
    """
    auth_session = _get_active_auth_session()
    token = auth_session.token if auth_session else None
    user_dict = auth_session.user.to_public_dict() if (auth_session and auth_session.user) else None

    stato_filter = request.args.get("stato", "").strip()
    if stato_filter not in STATI_CARTE_AMMESSI:
        stato_filter = ""

    ruolo_filter = request.args.get("ruolo", "").strip()
    if ruolo_filter not in RUOLI_CARTE_AMMESSI:
        ruolo_filter = ""

    carte_list, err = pb_service.list_carte(
        token=token,
        stato_filter=stato_filter if stato_filter else None,
    )
    if carte_list is not None and ruolo_filter:
        carte_list = [c for c in carte_list if c.ruolo == ruolo_filter]

    return render_template(
        "mercato.html",
        utente=user_dict,
        carte=carte_list if carte_list is not None else [],
        stato_selezionato=stato_filter,
        ruolo_selezionato=ruolo_filter,
        errore_caricamento=err.message if err else None,
    )


@app.route("/suggerisci", methods=["GET", "POST"])
@login_required
def suggerisci():
    """
    Proposta nuova carta nella collezione `Carte` (protetta da `@login_required`
    in conformità con `createRule: "@request.auth.id != ''"`).
    """
    auth_session = _get_active_auth_session()
    token = auth_session.token if auth_session else None
    user_dict = auth_session.user.to_public_dict() if (auth_session and auth_session.user) else None

    if request.method == "GET":
        return render_template(
            "suggerisci.html",
            utente=user_dict,
            successo=None,
            errore=None,
            field_errors={},
            form_values={"nome": "", "ruolo": ""},
        )

    nome = request.form.get("nome", "")
    ruolo = request.form.get("ruolo", "")

    creata, err = pb_service.create_carta(token=token, nome=nome, ruolo=ruolo)
    if err or not creata:
        return (
            render_template(
                "suggerisci.html",
                utente=user_dict,
                successo=None,
                errore=err.message if err else "Impossibile salvare la carta.",
                field_errors=err.field_errors if err else {},
                form_values={"nome": nome.strip(), "ruolo": ruolo.strip()},
            ),
            err.status_code if err else 400,
        )

    return render_template(
        "suggerisci.html",
        utente=user_dict,
        successo=f"La carta '{creata.nome}' ({creata.ruolo}) è stata inviata ed è in attesa di approvazione.",
        errore=None,
        field_errors={},
        form_values={"nome": "", "ruolo": ""},
    )


# ==============================================================================
# ENDPOINT JSON PER IL SERVICE LAYER FRONTEND (grafica/services/api.js)
# ==============================================================================

@app.route("/api/auth/session", methods=["GET"])
def api_auth_session():
    """Verifica lo stato corrente della sessione PocketBase (`authStore.isValid`)."""
    auth_session = _get_active_auth_session()
    if not auth_session or not auth_session.user:
        return jsonify({"authenticated": False, "user": None}), 200
    return jsonify({
        "authenticated": True,
        "user": auth_session.user.to_public_dict(),
    }), 200


@app.route("/api/carte", methods=["GET", "POST"])
def api_carte():
    """
    Endpoint REST JSON per interrogare o creare record nella collezione `Carte`.
    Supporta i 4 stati asincroni lato client (`loading`, `success`, `empty-state`, `error`).
    """
    auth_session = _get_active_auth_session()
    token = auth_session.token if auth_session else None

    if request.method == "GET":
        stato_filter = request.args.get("stato", "").strip()
        if stato_filter not in STATI_CARTE_AMMESSI:
            stato_filter = None

        carte_list, err = pb_service.list_carte(token=token, stato_filter=stato_filter)
        if err or carte_list is None:
            status = err.status_code if err else 503
            return jsonify({
                "items": [],
                "message": err.message if err else "Errore nel caricamento delle carte.",
            }), status

        return jsonify({
            "items": [c.to_dict() for c in carte_list],
            "total": len(carte_list),
        }), 200

    # POST /api/carte (Richiede autenticazione)
    if not auth_session or not token:
        return jsonify({
            "message": "Devi effettuare l'accesso per proporre una nuova carta.",
            "field_errors": {},
        }), 401

    payload = request.get_json(silent=True) or {}
    nome = str(payload.get("nome", ""))
    ruolo = str(payload.get("ruolo", ""))

    creata, err = pb_service.create_carta(token=token, nome=nome, ruolo=ruolo)
    if err or not creata:
        status = err.status_code if err else 400
        return jsonify({
            "message": err.message if err else "Errore di validazione.",
            "field_errors": err.field_errors if err else {},
        }), status

    return jsonify({
        "item": creata.to_dict(),
        "message": "Carta creata con successo e posta in attesa di approvazione.",
    }), 201


if __name__ == "__main__":
    app.run(debug=False, host="127.0.0.1", port=5000)
