"""
Modelli dati backend con protezione privacy GDPR (nessuna esposizione di ID o email nel frontend).
"""

from dataclasses import dataclass
from typing import Optional, Dict, Any
from logica.regole import MATERIE_META, normalizza_materia


@dataclass(frozen=True)
class UserModel:
    """Rappresenta un profilo utente nel backend (ID ed email restano privati lato server)."""
    id: str
    email: str
    name: str = ""
    fanta_milioni: float = 0.0
    verified: bool = False
    email_visibility: bool = False
    avatar: str = ""
    created: str = ""
    updated: str = ""

    @classmethod
    def from_pb_record(cls, data: Dict[str, Any]) -> "UserModel":
        raw_fm = data.get("fanta_milioni", 0)
        try:
            fm_val = float(raw_fm) if raw_fm is not None else 0.0
        except (TypeError, ValueError):
            fm_val = 0.0

        return cls(
            id=str(data.get("id", "")).strip(),
            email=str(data.get("email", "")).strip(),
            name=str(data.get("name", "") or "").strip(),
            fanta_milioni=fm_val,
            verified=bool(data.get("verified", False)),
            email_visibility=bool(data.get("emailVisibility", False)),
            avatar=str(data.get("avatar", "") or "").strip(),
            created=str(data.get("created", "") or ""),
            updated=str(data.get("updated", "") or ""),
        )

    def to_public_dict(self) -> Dict[str, Any]:
        """Restituisce solo i dati pubblici sicuri per la UI (zero ID, zero email)."""
        safe_name = self.name or (self.email.split("@")[0] if self.email else "Allenatore")
        return {
            "name": safe_name,
            "fanta_milioni": int(self.fanta_milioni) if self.fanta_milioni.is_integer() else round(self.fanta_milioni, 2),
        }


@dataclass(frozen=True)
class CartaModel:
    """Rappresenta una Carta Studente/Professore associata a una Materia del Liceo Scientifico."""
    id: str
    nome: str
    ruolo: str
    stato: str
    created: str = ""
    updated: str = ""

    @property
    def codice_materia(self) -> str:
        meta = MATERIE_META.get(self.ruolo)
        if meta:
            return meta["codice"]
        return (self.ruolo[:3] if self.ruolo else "MAT").upper()

    @property
    def area_materia(self) -> str:
        meta = MATERIE_META.get(self.ruolo)
        if meta:
            return meta["area"]
        return "Liceo Scientifico"

    @classmethod
    def from_pb_record(cls, data: Dict[str, Any]) -> "CartaModel":
        raw_ruolo = str(data.get("ruolo", "") or "").strip()
        materia = normalizza_materia(raw_ruolo)
        return cls(
            id=str(data.get("id", "")).strip(),
            nome=str(data.get("nome", "") or "").strip(),
            ruolo=materia,
            stato=str(data.get("stato", "") or "in_attesa").strip(),
            created=str(data.get("created", "") or ""),
            updated=str(data.get("updated", "") or ""),
        )

    def to_dict(self) -> Dict[str, Any]:
        """Esporta solo i dati pubblici della carta (l'ID resta privato nel backend)."""
        return {
            "nome": self.nome,
            "ruolo": self.ruolo,
            "stato": self.stato,
            "codice_materia": self.codice_materia,
            "area_materia": self.area_materia,
        }


@dataclass(frozen=True)
class AuthSession:
    """Stato della sessione autenticata (conservato lato server)."""
    token: str
    user: Optional[UserModel]

    @property
    def is_valid(self) -> bool:
        return bool(self.token and self.user and self.user.id)
