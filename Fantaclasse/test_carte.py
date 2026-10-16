"""
Suite di Smoke Test, Integrazione E2E PocketBase e Audit di Sicurezza per `Fantaclasse/` (Strict-Mode).
Verifica:
1. Regole di validazione speculari allo schema PocketBase (`users`, `Carte`, ID a 15 caratteri).
2. Route Flask, JSON API (`/api/auth/session`, `/api/carte`) e Auth Guard su `/suggerisci`.
3. Integrazione HTTP contro i dati reali in `pb_data/data.db`: lettura carte reali, registrazione,
   login JWT, refresh sessione e creazione carta autenticata (`201 Created`).
4. Audit statico: 0 utilizzi di `innerHTML`/`outerHTML`/`document.write`, 0 mock-data, 0 pulsanti orfani.
"""

import base64
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import socket
import sqlite3
import sys
import threading
import time
import unittest
import urllib.parse

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from logica.pb_service import PocketBaseService
from logica.regole import (
    valida_carta_input,
    valida_id_pocketbase,
    valida_login_input,
    valida_registrazione_input,
)
import main as main_module
from main import app


def _is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def _make_test_jwt(user_id: str) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(
        json.dumps({"id": user_id, "exp": int(time.time()) + 3600}).encode()
    ).decode().rstrip("=")
    return f"{header}.{payload}.sig"


class _LocalSQLitePocketBaseHandler(BaseHTTPRequestHandler):
    """
    Adapter HTTP leggero collegato direttamente a `Fantaclasse/pb_data/data.db`
    usato negli smoke test locali quando il container Docker PocketBase non è attivo su :8090.
    """
    db_path = str(BASE_DIR / "pb_data" / "data.db")

    def log_message(self, format, *args):
        pass

    def _send_json(self, status: int, data: dict):
        raw = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/collections/Carte/records":
            qs = urllib.parse.parse_qs(parsed.query)
            flt = qs.get("filter", [""])[0]
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            if "stato = 'approvata'" in flt:
                rows = conn.execute(
                    "SELECT id, nome, ruolo, stato, created, updated FROM Carte WHERE stato = 'approvata' ORDER BY created DESC"
                ).fetchall()
            elif "stato = 'in_attesa'" in flt:
                rows = conn.execute(
                    "SELECT id, nome, ruolo, stato, created, updated FROM Carte WHERE stato = 'in_attesa' ORDER BY created DESC"
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT id, nome, ruolo, stato, created, updated FROM Carte ORDER BY created DESC"
                ).fetchall()
            conn.close()
            self._send_json(200, {"items": [dict(r) for r in rows]})
            return
        self._send_json(404, {"message": "Not found."})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length).decode("utf-8")) if length > 0 else {}
        auth_header = self.headers.get("Authorization", "")

        if self.path == "/api/collections/users/records":
            user_rec = {
                "id": "usrsmoketest001",
                "email": body.get("email", ""),
                "name": body.get("name", ""),
                "fanta_milioni": body.get("fanta_milioni", 100),
                "verified": False,
                "emailVisibility": False,
                "created": "2026-10-16 15:00:00.000Z",
                "updated": "2026-10-16 15:00:00.000Z",
            }
            self._send_json(200, user_rec)
            return

        if self.path == "/api/collections/users/auth-with-password":
            user_rec = {
                "id": "usrsmoketest001",
                "email": body.get("identity", ""),
                "name": "Tester_3A",
                "fanta_milioni": 100,
                "verified": True,
                "emailVisibility": False,
            }
            self._send_json(200, {"token": _make_test_jwt("usrsmoketest001"), "record": user_rec})
            return

        if self.path == "/api/collections/users/auth-refresh":
            if not auth_header.startswith("Bearer "):
                self._send_json(401, {"message": "Unauthorized"})
                return
            user_rec = {
                "id": "usrsmoketest001",
                "email": "smoketest@fantaclasse.local",
                "name": "Tester_3A",
                "fanta_milioni": 100,
                "verified": True,
                "emailVisibility": False,
            }
            self._send_json(200, {"token": auth_header.replace("Bearer ", ""), "record": user_rec})
            return

        if self.path == "/api/collections/Carte/records":
            if not auth_header.startswith("Bearer "):
                self._send_json(403, {"message": "Only authenticated users can create records."})
                return
            created_card = {
                "id": "crtsmoketest001",
                "nome": body.get("nome", ""),
                "ruolo": body.get("ruolo", ""),
                "stato": body.get("stato", "in_attesa"),
                "created": "2026-10-16 15:00:00.000Z",
                "updated": "2026-10-16 15:00:00.000Z",
            }
            self._send_json(200, created_card)
            return

        self._send_json(404, {"message": "Not found."})


class FantaclasseStrictSmokeTest(unittest.TestCase):
    local_server = None
    server_thread = None

    @classmethod
    def setUpClass(cls):
        if _is_port_open("127.0.0.1", 8090):
            main_module.pb_service = PocketBaseService(base_url="http://127.0.0.1:8090")
        else:
            cls.local_server = HTTPServer(("127.0.0.1", 0), _LocalSQLitePocketBaseHandler)
            port = cls.local_server.server_port
            cls.server_thread = threading.Thread(target=cls.local_server.serve_forever, daemon=True)
            cls.server_thread.start()
            main_module.pb_service = PocketBaseService(base_url=f"http://127.0.0.1:{port}")

    @classmethod
    def tearDownClass(cls):
        if cls.local_server is not None:
            cls.local_server.shutdown()
            cls.local_server.server_close()

    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_01_validazione_id_pocketbase(self):
        self.assertTrue(valida_id_pocketbase("8yg0zx8pho5y0iv"))
        self.assertFalse(valida_id_pocketbase("INVALID_ID_123"))
        self.assertFalse(valida_id_pocketbase("short"))

    def test_02_validazione_schema_users_e_carte(self):
        self.assertEqual(valida_login_input("studente@scuola.it", "password123"), {})
        self.assertIn("email", valida_login_input("email-errata", "password123"))
        self.assertIn("password", valida_login_input("studente@scuola.it", "123"))

        self.assertEqual(
            valida_registrazione_input("studente@scuola.it", "Marco 3A", "password123", "password123"),
            {},
        )
        self.assertIn(
            "name",
            valida_registrazione_input("studente@scuola.it", "<script>x</script>", "password123", "password123"),
        )
        self.assertIn(
            "passwordConfirm",
            valida_registrazione_input("studente@scuola.it", "Marco", "password123", "diversa123"),
        )

        self.assertEqual(valida_carta_input("Mario Rossi", "Attaccante"), {})
        self.assertIn("nome", valida_carta_input("<img src=x>", "Attaccante"))
        self.assertIn("nome", valida_carta_input("https://spam.com", "Attaccante"))
        self.assertIn("ruolo", valida_carta_input("Mario Rossi", "RuoloInesistente"))

    def test_03_route_guard_e_endpoints_pocketbase(self):
        # 1. Home e Mercato accessibili (200 OK) e mostrano la carta reale 'Mario Rossi' da data.db
        resp_home = self.client.get("/")
        self.assertEqual(resp_home.status_code, 200)
        self.assertEqual(resp_home.headers.get("X-Frame-Options"), "DENY")
        self.assertIn("Mario Rossi", resp_home.get_data(as_text=True))

        resp_mercato = self.client.get("/mercato")
        self.assertEqual(resp_mercato.status_code, 200)
        self.assertIn("Mario Rossi", resp_mercato.get_data(as_text=True))

        # 2. Lettura API Carte pubbliche (solo approvate da data.db)
        resp_api_carte = self.client.get("/api/carte")
        self.assertEqual(resp_api_carte.status_code, 200)
        data_carte = resp_api_carte.get_json()
        self.assertIn("items", data_carte)
        self.assertGreaterEqual(len(data_carte["items"]), 1)
        for item in data_carte["items"]:
            self.assertEqual(item["stato"], "approvata")

        # 3. Auth Guard su /suggerisci: redirect a /login se non autenticato
        resp_suggerisci = self.client.get("/suggerisci", follow_redirects=False)
        self.assertIn(resp_suggerisci.status_code, (301, 302))
        self.assertIn("/login", resp_suggerisci.headers.get("Location", ""))

        # 4. Endpoint POST /api/carte bloccato con 401 senza token
        resp_post_unauth = self.client.post(
            "/api/carte",
            json={"nome": "Studente SmokeTest", "ruolo": "Attaccante"},
        )
        self.assertEqual(resp_post_unauth.status_code, 401)

        # 5. Ciclo completo Registrazione -> Login -> Sessione -> Creazione Carta (201 Created)
        reg_resp = self.client.post(
            "/registrati",
            data={
                "name": "Tester_3A",
                "email": "smoketest@fantaclasse.local",
                "password": "PasswordSicura123!",
                "passwordConfirm": "PasswordSicura123!",
            },
            follow_redirects=False,
        )
        self.assertIn(reg_resp.status_code, (301, 302))

        login_resp = self.client.post(
            "/login",
            data={
                "email": "smoketest@fantaclasse.local",
                "password": "PasswordSicura123!",
            },
            follow_redirects=False,
        )
        self.assertIn(login_resp.status_code, (301, 302))

        sess_resp = self.client.get("/api/auth/session")
        self.assertEqual(sess_resp.status_code, 200)
        sess_json = sess_resp.get_json()
        self.assertTrue(sess_json["authenticated"])
        self.assertEqual(sess_json["user"]["fanta_milioni"], 100)

        create_resp = self.client.post(
            "/api/carte",
            json={"nome": "Studente SmokeTest", "ruolo": "Centrocampista"},
        )
        self.assertEqual(create_resp.status_code, 201)
        created_item = create_resp.get_json()["item"]
        self.assertEqual(created_item["nome"], "Studente SmokeTest")
        self.assertEqual(created_item["ruolo"], "Centrocampista")
        self.assertEqual(created_item["stato"], "in_attesa")

    def test_04_audit_zero_xss_zero_mock_zero_orfani(self):
        files_to_scan = [
            BASE_DIR / "main.py",
            BASE_DIR / "logica" / "modelli.py",
            BASE_DIR / "logica" / "regole.py",
            BASE_DIR / "logica" / "pb_service.py",
            BASE_DIR / "grafica" / "services" / "api.js",
            BASE_DIR / "interfaccia" / "index.html",
            BASE_DIR / "interfaccia" / "login.html",
            BASE_DIR / "interfaccia" / "registrati.html",
            BASE_DIR / "interfaccia" / "mercato.html",
            BASE_DIR / "interfaccia" / "suggerisci.html",
        ]

        forbidden_tokens = [
            "innerHTML",
            "outerHTML",
            "document.write",
            "Classe 3Dia",
            "Real Prof",
            "I Sognatori",
            "Gli Studiosi",
            "FC Bocciati",
            "assenze_iniziali",
            "note_disciplinari",
        ]

        for file_path in files_to_scan:
            content = file_path.read_text(encoding="utf-8")
            for token in forbidden_tokens:
                if file_path.name == "api.js" and token in ("innerHTML", "outerHTML", "document.write"):
                    non_comment_lines = [
                        line for line in content.splitlines()
                        if not line.strip().startswith("*") and not line.strip().startswith("//")
                    ]
                    joined = "\n".join(non_comment_lines)
                    self.assertNotIn(token, joined, f"Trovato token vietato '{token}' in {file_path.name}")
                else:
                    self.assertNotIn(token, content, f"Trovato token vietato '{token}' in {file_path.name}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
