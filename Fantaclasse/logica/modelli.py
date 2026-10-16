"""
Modelli dati rigorosamente allineati allo schema reale di PocketBase (pb_data/data.db).
Zero campi fantasma o collezioni inesistenti (rimossi i vecchi modelli mock Lega/Squadra).
"""

from dataclasses import dataclass
from typing import Optional, Dict, Any


@dataclass(frozen=True)
class UserModel:
    """Rappresenta un record reale della collezione auth `users` (_pb_users_auth_)."""
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
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name or self.email.split("@")[0],
            "fanta_milioni": int(self.fanta_milioni) if self.fanta_milioni.is_integer() else round(self.fanta_milioni, 2),
            "verified": self.verified,
            "created": self.created,
        }


@dataclass(frozen=True)
class CartaModel:
    """Rappresenta un record reale della collezione base `Carte` (pbc_2958257682)."""
    id: str
    nome: str
    ruolo: str
    stato: str
    created: str = ""
    updated: str = ""

    @classmethod
    def from_pb_record(cls, data: Dict[str, Any]) -> "CartaModel":
        return cls(
            id=str(data.get("id", "")).strip(),
            nome=str(data.get("nome", "") or "").strip(),
            ruolo=str(data.get("ruolo", "") or "").strip(),
            stato=str(data.get("stato", "") or "in_attesa").strip(),
            created=str(data.get("created", "") or ""),
            updated=str(data.get("updated", "") or ""),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "nome": self.nome,
            "ruolo": self.ruolo,
            "stato": self.stato,
            "created": self.created,
            "updated": self.updated,
        }


@dataclass(frozen=True)
class AuthSession:
    """Stato della sessione autenticata PocketBase (token JWT + modello utente)."""
    token: str
    user: Optional[UserModel]

    @property
    def is_valid(self) -> bool:
        return bool(self.token and self.user and self.user.id)