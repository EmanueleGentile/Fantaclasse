import json
import time
import os

DB_FILE = "database.json"

def pulisci_schermo():
    os.system('cls' if os.name == 'nt' else 'clear')

def stampa_titolo():
    print("="*50)
    print("    📊  PANNELLO DATA ANALYST  📊")
    print("     Inserimento Statistiche Iniziali")
    print("="*50)
    print("\nIn attesa di carte approvate dall'Admin...\n")

def read_db():
    if not os.path.exists(DB_FILE):
        return {"carte_in_sospeso": [], "carte_da_analizzare": [], "carte_accettate": []}
    try:
        with open(DB_FILE, "r") as f:
            return json.load(f)
    except:
        return {"carte_in_sospeso": [], "carte_da_analizzare": [], "carte_accettate": []}

def write_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

def main():
    pulisci_schermo()
    stampa_titolo()
    
    while True:
        db = read_db()
        da_analizzare = db.get("carte_da_analizzare", [])
        
        if len(da_analizzare) > 0:
            carta = da_analizzare[0]
            
            pulisci_schermo()
            print("="*50)
            print(" 📝 INSERIMENTO DATI INIZIALI 📝")
            print("="*50)
            print(f"Studente : {carta.get('nome', '')}")
            print(f"Classe   : {carta.get('classe', '')}")
            print(f"Materie  : {', '.join(carta.get('materie', []))}")
            print("="*50)
            
            try:
                print("\n--- INSERIMENTO STATISTICHE (Basato su regole.py) ---")
                quot = input("1. Quotazione iniziale (crediti) [es. 10]: ")
                media = input("2. Media voti scolastici attuale [es. 7.5]: ")
                assenze = input("3. Numero di assenze [es. 0]: ")
                ritardi = input("4. Numero di ritardi brevi [es. 0]: ")
                entrate_ritardo = input("5. Entrate in seconda/terza ora [es. 0]: ")
                note_gen = input("6. Note generiche (singole/gruppo) [es. 0]: ")
                note_disc = input("7. Note disciplinari gravi [es. 0]: ")
                
                # Aggiorniamo la carta con le statistiche reali (cast a interi o float)
                carta["quotazione"] = int(quot)
                carta["media_voti"] = float(media)
                carta["assenze_iniziali"] = int(assenze)
                carta["ritardi"] = int(ritardi)
                carta["entrate_ritardo"] = int(entrate_ritardo)
                carta["note_generiche"] = int(note_gen)
                carta["note_disciplinari"] = int(note_disc)
                
                print("\n✅ Statistiche complete salvate! La carta e' ora nel Mercato Ufficiale.")
                
                # Spostiamola nelle carte accettate e rimuoviamola dalla coda
                db["carte_accettate"].append(carta)
                db["carte_da_analizzare"].pop(0)
                write_db(db)
                
            except ValueError:
                print("\n❌ Errore: devi inserire dei NUMERI validi (usa il punto per i decimali, es: 7.5)! Riprova.")
            
            time.sleep(3)
            pulisci_schermo()
            stampa_titolo()
            
        time.sleep(2)

if __name__ == "__main__":
    main()
