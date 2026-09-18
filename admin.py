import json
import time
import os

DB_FILE = "database.json"

def pulisci_schermo():
    os.system('cls' if os.name == 'nt' else 'clear')

def stampa_titolo():
    print("="*50)
    print("    🛡️  FANTA-TERMINALE ADMIN  🛡️")
    print("      Moderazione Carte in Tempo Reale")
    print("="*50)
    print("\nIn attesa di nuove richieste dall'app...\n")

def read_db():
    if not os.path.exists(DB_FILE):
        return {"carte_in_sospeso": [], "carte_accettate": []}
    try:
        with open(DB_FILE, "r") as f:
            return json.load(f)
    except:
        return {"carte_in_sospeso": [], "carte_accettate": []}

def write_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

def main():
    pulisci_schermo()
    stampa_titolo()
    
    while True:
        db = read_db()
        in_sospeso = db.get("carte_in_sospeso", [])
        
        if len(in_sospeso) > 0:
            # Prendi la prima carta in coda
            carta = in_sospeso[0]
            
            pulisci_schermo()
            print("="*50)
            print(" 🚨 NUOVA RICHIESTA RICEVUTA 🚨")
            print("="*50)
            print(f"Nome   : {carta.get('nome', '')}")
            print(f"Classe : {carta.get('classe', '')}")
            materie = carta.get('materie', [])
            print(f"Materie: {', '.join(materie)}")
            print("="*50)
            
            scelta = input("Approvi nome e classe? (S/N): ").strip().upper()
            
            if scelta == "S":
                print("\n✅ Carta APPROVATA! Inviata al Data Analyst.")
                if "carte_da_analizzare" not in db:
                    db["carte_da_analizzare"] = []
                db["carte_da_analizzare"].append(carta)
            else:
                print("\n❌ Carta RIFIUTATA! Eliminata.")
                
            # Rimuoviamo la carta dalla coda
            db["carte_in_sospeso"].pop(0)
            write_db(db)
            
            time.sleep(2)
            pulisci_schermo()
            stampa_titolo()
            
        time.sleep(2)

if __name__ == "__main__":
    main()
