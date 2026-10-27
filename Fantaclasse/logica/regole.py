"""
Regole di validazione e costanti applicative per Fantaclasse (Liceo Scientifico).
Tutte le funzioni restituiscono un dizionario di errori per singolo campo (vuoto se valido).
"""

import re
from typing import Dict

BUDGET_INIZIALE_FANTA_MILIONI: int = 100

# Pattern nativo per la validazione interna degli ID backend (15 caratteri alfanumerici)
PB_ID_REGEX = re.compile(r"^[a-z0-9]{15}$")

# Pattern email conforme RFC
EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")

# Pattern anti-HTML/XSS per i campi testuali (nessun tag < o >)
SAFE_TEXT_REGEX = re.compile(r"^[^<>]*$")

# Le 9 Materie Ufficiali del Liceo Scientifico (Ruoli delle Carte Studenti/Professori)
RUOLI_CARTE_AMMESSI = (
    "Informatica",
    "Matematica",
    "Scienze",
    "Italiano",
    "Filosofia",
    "Storia",
    "Inglese",
    "Disegno e Storia dell'Arte",
    "Scienze Motorie",
)

# Metadati per ciascuna materia (codice breve e area dipartimentale)
MATERIE_META = {
    "Informatica": {"codice": "INF", "area": "Area Scientifica"},
    "Matematica": {"codice": "MAT", "area": "Area Scientifica"},
    "Scienze": {"codice": "SCI", "area": "Area Scientifica"},
    "Italiano": {"codice": "ITA", "area": "Area Umanistica"},
    "Filosofia": {"codice": "FIL", "area": "Area Umanistica"},
    "Storia": {"codice": "STO", "area": "Area Umanistica"},
    "Inglese": {"codice": "ING", "area": "Area Linguistica & Arte"},
    "Disegno e Storia dell'Arte": {"codice": "ART", "area": "Area Linguistica & Arte"},
    "Scienze Motorie": {"codice": "MOT", "area": "Area Linguistica & Arte"},
}

STATI_CARTE_AMMESSI = ("in_attesa", "approvata")

# Mappa di conversione automatica per eventuali vecchi record calcistici nel database
LEGACY_ROLE_MAP = {
    "Attaccante": "Informatica",
    "Centrocampista": "Matematica",
    "Difensore": "Scienze",
    "Portiere": "Italiano",
}


def normalizza_materia(ruolo_raw: str) -> str:
    """Converte eventuali vecchi ruoli calcistici in materie del Liceo Scientifico."""
    pulito = (ruolo_raw or "").strip()
    if pulito in RUOLI_CARTE_AMMESSI:
        return pulito
    if pulito in LEGACY_ROLE_MAP:
        return LEGACY_ROLE_MAP[pulito]
    return "Informatica" if not pulito else pulito


def valida_id_pocketbase(record_id: str) -> bool:
    """Verifica internamente nel backend che un ID rispetti il formato a 15 caratteri."""
    if not isinstance(record_id, str):
        return False
    return bool(PB_ID_REGEX.match(record_id.strip()))


def valida_login_input(identity: str, password: str) -> Dict[str, str]:
    """Valida i campi di autenticazione."""
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
    """Valida i campi di registrazione nuovo allenatore."""
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
    Valida il payload di creazione di una Carta Studente/Professore:
    - `nome`: nome dello studente o professore (2-100 caratteri, no HTML/link)
    - `ruolo`: una delle 9 materie ufficiali del Liceo Scientifico
    """
    errors: Dict[str, str] = {}
    clean_nome = (nome or "").strip()
    clean_ruolo = (ruolo or "").strip()

    if not clean_nome:
        errors["nome"] = "Inserisci il nome dello studente o professore."
    elif len(clean_nome) < 2:
        errors["nome"] = "Il nome deve contenere almeno 2 caratteri."
    elif len(clean_nome) > 100:
        errors["nome"] = "Il nome non può superare i 100 caratteri."
    elif not SAFE_TEXT_REGEX.match(clean_nome):
        errors["nome"] = "Il nome contiene caratteri non ammessi (< o >)."
    elif re.search(r"(https?://|www\.)", clean_nome, re.IGNORECASE):
        errors["nome"] = "Non è consentito inserire link nel nome."

    if not clean_ruolo:
        errors["ruolo"] = "Seleziona la materia del Liceo Scientifico."
    elif clean_ruolo not in RUOLI_CARTE_AMMESSI:
        errors["ruolo"] = f"Materia non valida. Scegli tra: {', '.join(RUOLI_CARTE_AMMESSI)}."

    return errors
