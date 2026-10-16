"""
Regole di validazione e costanti applicative speculari allo schema PocketBase (pb_data/data.db).
Tutte le funzioni restituiscono un dizionario di errori per singolo campo (vuoto se valido).
"""

import re
from typing import Dict

BUDGET_INIZIALE_FANTA_MILIONI: int = 100

# Pattern nativo PocketBase per gli ID dei record (15 caratteri alfanumerici minuscoli)
PB_ID_REGEX = re.compile(r"^[a-z0-9]{15}$")

# Pattern email conforme RFC / PocketBase
EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")

# Pattern anti-HTML/XSS per i campi testuali (nessun tag < o >)
SAFE_TEXT_REGEX = re.compile(r"^[^<>]*$")

# Valori ammessi per i ruoli e gli stati della collezione Carte
RUOLI_CARTE_AMMESSI = ("Portiere", "Difensore", "Centrocampista", "Attaccante")
STATI_CARTE_AMMESSI = ("in_attesa", "approvata")


def valida_id_pocketbase(record_id: str) -> bool:
    """Verifica che un ID rispetti il formato a 15 caratteri di PocketBase."""
    if not isinstance(record_id, str):
        return False
    return bool(PB_ID_REGEX.match(record_id.strip()))


def valida_login_input(identity: str, password: str) -> Dict[str, str]:
    """Valida i campi di autenticazione per /api/collections/users/auth-with-password."""
    errors: Dict[str, str] = {}
    clean_identity = (identity or "").strip()
    clean_password = password or ""

    if not clean_identity:
        errors["email"] = "Inserisci il tuo indirizzo email."
    elif len(clean_identity) > 255 or not EMAIL_REGEX.match(clean_identity):
        errors["email"] = "Inserisci un indirizzo email valido."

    if not clean_password:
        errors["password"] = "Inserisci la password."
    elif len(clean_password) < 8:
        errors["password"] = "La password deve contenere almeno 8 caratteri."
    elif len(clean_password) > 72:
        errors["password"] = "La password supera la lunghezza massima consentita."

    return errors


def valida_registrazione_input(
    email: str,
    name: str,
    password: str,
    password_confirm: str,
) -> Dict[str, str]:
    """
    Valida il payload di creazione utente sulla collezione `users`:
    - email: required, formato email valido
    - name: text opzionale/consigliato, max 255 caratteri, privo di tag HTML
    - password: required, min 8 caratteri, max 72 caratteri
    - passwordConfirm: deve coincidere con password
    """
    errors: Dict[str, str] = {}
    clean_email = (email or "").strip()
    clean_name = (name or "").strip()
    clean_password = password or ""
    clean_confirm = password_confirm or ""

    if not clean_email:
        errors["email"] = "L'indirizzo email è obbligatorio."
    elif len(clean_email) > 255 or not EMAIL_REGEX.match(clean_email):
        errors["email"] = "Formato email non valido."

    if not clean_name:
        errors["name"] = "Inserisci un nome o nickname visibile."
    elif len(clean_name) < 2:
        errors["name"] = "Il nome deve avere almeno 2 caratteri."
    elif len(clean_name) > 255:
        errors["name"] = "Il nome non può superare i 255 caratteri."
    elif not SAFE_TEXT_REGEX.match(clean_name):
        errors["name"] = "Il nome contiene caratteri non consentiti (< o >)."

    if not clean_password:
        errors["password"] = "La password è obbligatoria."
    elif len(clean_password) < 8:
        errors["password"] = "La password deve contenere almeno 8 caratteri."
    elif len(clean_password) > 72:
        errors["password"] = "La password non può superare i 72 caratteri."

    if not clean_confirm:
        errors["passwordConfirm"] = "Conferma la password inserita."
    elif clean_password != clean_confirm:
        errors["passwordConfirm"] = "Le due password non coincidono."

    return errors


def valida_carta_input(nome: str, ruolo: str) -> Dict[str, str]:
    """
    Valida il payload di creazione record sulla collezione `Carte`:
    - Campi reali nello schema: `nome` (text), `ruolo` (text), `stato` (text)
    """
    errors: Dict[str, str] = {}
    clean_nome = (nome or "").strip()
    clean_ruolo = (ruolo or "").strip()

    if not clean_nome:
        errors["nome"] = "Il nome della carta è obbligatorio."
    elif len(clean_nome) < 2:
        errors["nome"] = "Il nome della carta deve contenere almeno 2 caratteri."
    elif len(clean_nome) > 100:
        errors["nome"] = "Il nome della carta non può superare i 100 caratteri."
    elif not SAFE_TEXT_REGEX.match(clean_nome):
        errors["nome"] = "Il nome contiene caratteri HTML non ammessi (< o >)."
    elif re.search(r"(https?://|www\.)", clean_nome, re.IGNORECASE):
        errors["nome"] = "Non è consentito inserire link nel nome della carta."

    if not clean_ruolo:
        errors["ruolo"] = "Seleziona un ruolo per la carta."
    elif clean_ruolo not in RUOLI_CARTE_AMMESSI:
        errors["ruolo"] = f"Ruolo non valido. Scegli tra: {', '.join(RUOLI_CARTE_AMMESSI)}."

    return errors