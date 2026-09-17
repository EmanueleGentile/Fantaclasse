import uuid
from dataclasses import dataclass, field
from typing import List, Dict

# Le 9 materie ufficiali del regolamento Fantastudente
MATERIE_UFFICIALI: List[str] = [
    "informatica",
    "italiano",
    "matematica",
    "scienze",
    "storia",
    "filosofia",
    "inglese",
    "scienze motorie",
    "disegno e storia dell’arte"
]

@dataclass
class Utente:
    id_utente: str = field(default_factory=lambda: str(uuid.uuid4()))
    email: str = ""
    password_hash: str = ""      # Password salvata in modo sicuro
    nome_visualizzato: str = ""  # Nickname o nome reale
    leghe_iscritte_ids: List[str] = field(default_factory=list)

@dataclass
class Lega:
    nome_lega: str
    id_admin: str                          # L'Utente che crea la lega
    crediti_iniziali: int                  # SCELTI DALL'ADMIN
    id_lega: str = field(default_factory=lambda: str(uuid.uuid4())[:8])  # Codice d'invito breve
    partecipanti_ids: List[str] = field(default_factory=list)

    @property
    def link_invito(self) -> str:
        """Genera il link d'invito unico per far unire i compagni via WhatsApp/Telegram."""
        return f"https://fantastudente.app/join/{self.id_lega}"

@dataclass
class Studente:
    id_studente: int
    id_lega: str            # Ogni lega ha il suo listone di compagni
    nome: str
    classe: str
    quotazione_base: int    # Prezzo di partenza indicativo per l'asta
    foto_url: str = ""      # Foto del campioncino

@dataclass
class AcquistoAsta:
    id_studente: int
    prezzo_acquisto: int    # Prezzo finale battuto all'asta

@dataclass
class RosaUtente:
    id_utente: str          # L'Utente proprietario della squadra
    id_lega: str            # La lega di appartenenza
    nome_squadra: str
    crediti_rimasti: int    # Parte dai crediti_iniziali della Lega e scende con gli acquisti
    # Lista dei giocatori acquistati all'asta (indipendenti dalla materia)
    giocatori_acquistati: List[AcquistoAsta] = field(default_factory=list)

@dataclass
class FormazioneGiornata:
    id_utente: str
    id_lega: str
    giornata: int
    # Qui assegni liberamente lo studente acquistato alla materia desiderata per la settimana:
    # Mappa: materia -> id_studente
    schieramento: Dict[str, int] = field(default_factory=dict)

@dataclass
class EventoDisciplinare:
    id_studente: int
    id_lega: str
    giornata: int
    assenze: int = 0
    ritardi: int = 0
    note_generiche: int = 0
    note_disciplinari: int = 0

@dataclass
class VotoScolastico:
    id_studente: int
    id_lega: str
    giornata: int
    materia: str
    voto: float             # Es. 8.5, 6.0, 4.5