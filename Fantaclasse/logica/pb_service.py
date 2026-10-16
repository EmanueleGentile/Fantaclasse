"""
Service Layer centralizzato per la comunicazione con PocketBase REST API.
- Zero URL hardcoded nei controller/template (configurazione da POCKETBASE_URL con fallback locale).
- Gestione rigorosa di sessioni e token JWT (authStore / auth-refresh).
- Safe Error Handling centralizzato: mappatura in italiano degli errori per singolo campo,
  zero esposizione di stack trace, JSON grezzi o filtri interni.
"""

import base64
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from logica.modelli import AuthSession, CartaModel, UserModel
from logica.regole import (
    BUDGET_INIZIALE_FANTA_MILIONI,
    STATI_CARTE_AMMESSI,
    valida_carta_input,
    valida_login_input,
    valida_registrazione_input,
)


def get_pocketbase_base_url() -> str:
    """Restituisce l'URL base di PocketBase da variabile d'ambiente con fallback sicuro."""
    return os.environ.get("POCKETBASE_URL", "http://127.0.0.1:8090").rstrip("/")


@dataclass
class SafeServiceError:
    """Errore sanitizzato pronto per il livello di presentazione (Zero Information Disclosure)."""
    status_code: int
    message: str
    field_errors: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status_code,
            "message": self.message,
            "field_errors": self.field_errors,
        }


# Mappatura codici errore PocketBase -> Italiano
PB_FIELD_ERROR_MAP: Dict[str, str] = {
    "validation_required": "Questo campo è obbligatorio.",
    "validation_invalid_email": "Inserisci un indirizzo email valido.",
    "validation_not_unique": "Questo valore è già registrato nel sistema.",
    "validation_min_text_constraint": "Il testo inserito è troppo corto.",
    "validation_max_text_constraint": "Il testo inserito supera la lunghezza massima.",
    "validation_length_out_of_range": "La lunghezza del valore non è valida.",
    "validation_values_mismatch": "I valori inseriti non coincidono.",
    "validation_match_invalid": "Il formato inserito contiene caratteri non validi.",
}


class SafeErrorHandler:
    """Intercetta e trasforma qualsiasi errore HTTP o di rete in messaggi sicuri in italiano."""

    @staticmethod
    def from_http_error(status_code: int, raw_body: str, context: str = "generic") -> SafeServiceError:
        field_errors: Dict[str, str] = {}
        try:
            payload = json.loads(raw_body) if raw_body else {}
        except (ValueError, TypeError):
            payload = {}

        pb_data = payload.get("data")
        if isinstance(pb_data, dict):
            for field_name, err_obj in pb_data.items():
                if isinstance(err_obj, dict):
                    code = str(err_obj.get("code", ""))
                    if field_name == "email" and code == "validation_not_unique":
                        field_errors["email"] = "Questa email è già associata a un account registrato."
                    elif code in PB_FIELD_ERROR_MAP:
                        field_errors[field_name] = PB_FIELD_ERROR_MAP[code]
                    else:
                        field_errors[field_name] = "Valore non valido per questo campo."

        if status_code == 400:
            if context == "login":
                return SafeServiceError(
                    status_code=400,
                    message="Credenziali non valide. Verifica email e password.",
                    field_errors=field_errors,
                )
            if field_errors:
                return SafeServiceError(
                    status_code=400,
                    message="Verifica i campi evidenziati e riprova.",
                    field_errors=field_errors,
                )
            return SafeServiceError(
                status_code=400,
                message="I dati inviati non rispettano i requisiti richiesti.",
            )

        if status_code == 401:
            return SafeServiceError(
                status_code=401,
                message="Sessione scaduta o non autenticata. Effettua nuovamente l'accesso.",
            )

        if status_code == 403:
            return SafeServiceError(
                status_code=403,
                message="Non disponi dei permessi necessari per eseguire questa operazione.",
            )

        if status_code == 404:
            return SafeServiceError(
                status_code=404,
                message="La risorsa richiesta non è disponibile.",
            )

        return SafeServiceError(
            status_code=500,
            message="Servizio temporaneamente non disponibile. Riprova tra qualche istante.",
        )

    @staticmethod
    def from_network_error() -> SafeServiceError:
        return SafeServiceError(
            status_code=503,
            message="Impossibile contattare il database PocketBase. Verifica la connessione e riprova.",
        )


class PocketBaseService:
    """Client service centralizzato per le collezioni reali `users` e `Carte`."""

    def __init__(self, base_url: Optional[str] = None, timeout: int = 6):
        self.base_url = (base_url or get_pocketbase_base_url()).rstrip("/")
        self.timeout = timeout

    def _request(
        self,
        method: str,
        endpoint: str,
        token: Optional[str] = None,
        body: Optional[Dict[str, Any]] = None,
        query: Optional[Dict[str, str]] = None,
        context: str = "generic",
    ) -> Tuple[Optional[Dict[str, Any]], Optional[SafeServiceError]]:
        url = f"{self.base_url}{endpoint}"
        if query:
            url = f"{url}?{urllib.parse.urlencode(query)}"

        headers: Dict[str, str] = {
            "Accept": "application/json",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"

        data_bytes: Optional[bytes] = None
        if body is not None:
            headers["Content-Type"] = "application/json; charset=utf-8"
            data_bytes = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                parsed = json.loads(raw) if raw else {}
                return parsed, None
        except urllib.error.HTTPError as http_err:
            try:
                err_body = http_err.read().decode("utf-8", errors="replace")
            except Exception:
                err_body = ""
            return None, SafeErrorHandler.from_http_error(http_err.code, err_body, context=context)
        except Exception:
            return None, SafeErrorHandler.from_network_error()

    @staticmethod
    def is_jwt_unexpired(token: Optional[str]) -> bool:
        """Verifica localmente la struttura e la scadenza (`exp`) del token JWT PocketBase."""
        if not token or not isinstance(token, str):
            return False
        parts = token.split(".")
        if len(parts) != 3:
            return False
        try:
            payload_b64 = parts[1]
            padding = "=" * (-len(payload_b64) % 4)
            payload_json = base64.urlsafe_b64decode(payload_b64 + padding).decode("utf-8")
            payload = json.loads(payload_json)
            exp = int(payload.get("exp", 0))
            return exp > int(time.time()) + 5
        except Exception:
            return False

    def validate_session(self, token: Optional[str]) -> Tuple[Optional[AuthSession], Optional[SafeServiceError]]:
        """
        Verifica la validità del token (`authStore.isValid`) interrogando `/api/collections/users/auth-refresh`.
        Restituisce la sessione aggiornata con il modello `UserModel` reale o `None` se scaduta/invalida.
        """
        if not self.is_jwt_unexpired(token):
            return None, SafeServiceError(
                status_code=401,
                message="Sessione non attiva o scaduta.",
            )

        data, err = self._request(
            method="POST",
            endpoint="/api/collections/users/auth-refresh",
            token=token,
            context="auth_refresh",
        )
        if err or not data:
            return None, err or SafeServiceError(status_code=401, message="Sessione non valida.")

        refreshed_token = str(data.get("token") or token)
        record = data.get("record") or {}
        user = UserModel.from_pb_record(record)
        if not user.id:
            return None, SafeServiceError(status_code=401, message="Profilo utente non trovato.")

        return AuthSession(token=refreshed_token, user=user), None

    def login(self, identity: str, password: str) -> Tuple[Optional[AuthSession], Optional[SafeServiceError]]:
        """Autentica un utente sulla collezione `users` tramite `/api/collections/users/auth-with-password`."""
        field_errors = valida_login_input(identity, password)
        if field_errors:
            return None, SafeServiceError(
                status_code=400,
                message="Controlla i campi inseriti.",
                field_errors=field_errors,
            )

        data, err = self._request(
            method="POST",
            endpoint="/api/collections/users/auth-with-password",
            body={
                "identity": identity.strip(),
                "password": password,
            },
            context="login",
        )
        if err or not data:
            return None, err

        token = str(data.get("token", "")).strip()
        record = data.get("record") or {}
        user = UserModel.from_pb_record(record)
        if not token or not user.id:
            return None, SafeServiceError(
                status_code=401,
                message="Impossibile completare l'autenticazione.",
            )

        return AuthSession(token=token, user=user), None

    def register(
        self,
        email: str,
        name: str,
        password: str,
        password_confirm: str,
    ) -> Tuple[Optional[UserModel], Optional[SafeServiceError]]:
        """
        Crea un nuovo utente nella collezione `users` (`/api/collections/users/records`)
        con i soli campi realmente presenti nello schema (`email`, `name`, `password`, `passwordConfirm`, `fanta_milioni`).
        """
        field_errors = valida_registrazione_input(email, name, password, password_confirm)
        if field_errors:
            return None, SafeServiceError(
                status_code=400,
                message="Correggi gli errori nel modulo di registrazione.",
                field_errors=field_errors,
            )

        data, err = self._request(
            method="POST",
            endpoint="/api/collections/users/records",
            body={
                "email": email.strip(),
                "name": name.strip(),
                "password": password,
                "passwordConfirm": password_confirm,
                "fanta_milioni": BUDGET_INIZIALE_FANTA_MILIONI,
            },
            context="register",
        )
        if err or not data:
            return None, err

        return UserModel.from_pb_record(data), None

    def list_carte(
        self,
        token: Optional[str] = None,
        stato_filter: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> Tuple[Optional[List[CartaModel]], Optional[SafeServiceError]]:
        """
        Recupera i record dalla collezione `Carte` (`/api/collections/Carte/records`).
        Rispetta rigorosamente la API Rule: `stato = 'approvata' || @request.auth.id != ''`.
        """
        is_authenticated = self.is_jwt_unexpired(token)
        query: Dict[str, str] = {
            "page": str(max(1, int(page))),
            "perPage": str(min(100, max(1, int(per_page)))),
            "sort": "-created",
        }

        if not is_authenticated:
            # Utente non autenticato: le API Rules consentono solo `stato = 'approvata'`
            query["filter"] = "stato = 'approvata'"
        elif stato_filter in STATI_CARTE_AMMESSI:
            query["filter"] = f"stato = '{stato_filter}'"

        data, err = self._request(
            method="GET",
            endpoint="/api/collections/Carte/records",
            token=token if is_authenticated else None,
            query=query,
            context="list_carte",
        )
        if err or data is None:
            return None, err

        raw_items = data.get("items") or []
        carte = [CartaModel.from_pb_record(item) for item in raw_items if isinstance(item, dict)]
        return carte, None

    def create_carta(
        self,
        token: Optional[str],
        nome: str,
        ruolo: str,
    ) -> Tuple[Optional[CartaModel], Optional[SafeServiceError]]:
        """
        Crea una nuova carta nella collezione `Carte` (`/api/collections/Carte/records`).
        API Rule: `@request.auth.id != ''` (richiede utente autenticato).
        """
        if not self.is_jwt_unexpired(token):
            return None, SafeServiceError(
                status_code=401,
                message="Devi effettuare l'accesso per proporre una nuova carta.",
            )

        field_errors = valida_carta_input(nome, ruolo)
        if field_errors:
            return None, SafeServiceError(
                status_code=400,
                message="Controlla i dati della carta proposta.",
                field_errors=field_errors,
            )

        data, err = self._request(
            method="POST",
            endpoint="/api/collections/Carte/records",
            token=token,
            body={
                "nome": nome.strip(),
                "ruolo": ruolo.strip(),
                "stato": "in_attesa",
            },
            context="create_carta",
        )
        if err or not data:
            return None, err

        return CartaModel.from_pb_record(data), None
