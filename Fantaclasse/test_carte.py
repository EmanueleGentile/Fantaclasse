import urllib.request
import urllib.error
import json

BASE_URL = "http://localhost:5000"

def suggerisci_carta(nome, ruolo):
    print(f"\n---> TEST: Invio suggerimento per la carta '{nome}'...")
    data = json.dumps({"nome": nome, "ruolo": ruolo}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/carte/suggerisci", data=data, method='POST')
    req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = json.loads(response.read().decode())
            print("✅ SUCCESSO:", res_body)
    except urllib.error.HTTPError as e:
        print("❌ ERRORE HTTP:", e.code, e.read().decode())
    except urllib.error.URLError as e:
        print("❌ ERRORE DI CONNESSIONE:", e.reason)

def vedi_carte_approvate():
    print("\n---> TEST: Lettura carte pubbliche (solo approvate)...")
    req = urllib.request.Request(f"{BASE_URL}/carte/approvate", method='GET')
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = json.loads(response.read().decode())
            print(f"✅ CARTE PUBBLICHE TROVATE ({len(res_body)}):")
            for c in res_body:
                print(f"  - {c['nome']} ({c['ruolo']}) [Stato: {c['stato']}]")
            if len(res_body) == 0:
                print("  Nessuna carta approvata al momento. (Vai su PocketBase ad approvarle!)")
    except urllib.error.HTTPError as e:
        print("❌ ERRORE HTTP:", e.code, e.read().decode())
    except urllib.error.URLError as e:
        print("❌ ERRORE DI CONNESSIONE:", e.reason)


if __name__ == "__main__":
    print("==================================================")
    print("🧪 SCRIPT DI TEST: MODERAZIONE CARTE FANTACLASSE")
    print("==================================================")
    
    suggerisci_carta("Mario Rossi", "Attaccante")
    vedi_carte_approvate()
    
    print("\n==================================================")
    print("👉 ORA FAI QUESTO:")
    print("1. Vai su http://localhost:8090/_/ in 'carte'")
    print("2. Modifica Mario Rossi, cambia 'stato' da 'in_attesa' a 'approvata'")
    print("3. Rilancia questo script! Vedrai Mario Rossi nella lista.")
