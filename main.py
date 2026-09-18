from flask import Flask, render_template, request
from logica.regole import calcola_punti_voto
from logica.modelli import Lega
import json
import os

# --- LOGICA DEL DATABASE TEMPORANEO ---
DB_FILE = "database.json"

def init_db():
    # Se il file non esiste, lo crea vuoto con le TRE ceste
    if not os.path.exists(DB_FILE):
        with open(DB_FILE, "w") as f:
            json.dump({
                "carte_in_sospeso": [], 
                "carte_da_analizzare": [],
                "carte_accettate": []
            }, f)

def read_db():
    init_db()
    with open(DB_FILE, "r") as f:
        return json.load(f)

def write_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)
# --------------------------------------

app = Flask(__name__, template_folder="interfaccia", static_folder="grafica")

@app.route("/")
def home():
    # 1. Creiamo dei dati "dal vivo" (simulando che arrivino da un Database)
    lega_corrente = Lega(nome_lega="Classe 3Dia", id_admin="admin_id", crediti_iniziali=500)
    
    # 2. Creiamo una classifica dinamica
    classifica_squadre = [
        {"posizione": 1, "nome": "Real Prof", "punti": 312, "mia_squadra": False},
        {"posizione": 2, "nome": "I Sognatori", "punti": 298, "mia_squadra": False},
        {"posizione": 3, "nome": "Fanta Classe", "punti": 287, "mia_squadra": True},
        {"posizione": 4, "nome": "Gli Insospettabili", "punti": 275, "mia_squadra": False},
        {"posizione": 5, "nome": "ClassiTard", "punti": 260, "mia_squadra": False},
    ]

    # 3. Passiamo i dati all'HTML 
    # Ora è Python a dire all'HTML cosa stampare
    return render_template(
        "index.html", 
        lega=lega_corrente, 
        classifica=classifica_squadre, 
        totale_utenti=12
    )

# NUOVA ROTTA: Il Mercato (legge le carte_accettate dal database)
@app.route("/mercato")
def mercato():
    db = read_db()
    carte_disponibili = db["carte_accettate"]
    return render_template("mercato.html", carte=carte_disponibili)

# NUOVA ROTTA: Suggerisci Carta (aggiunge alle carte_in_sospeso nel database)
@app.route("/suggerisci", methods=["GET", "POST"])
def suggerisci():
    messaggio = None
    if request.method == "POST":
        nuova_carta = {
            "nome": request.form.get("nome"),
            "classe": request.form.get("classe"),
            "materie": request.form.getlist("materie") # getlist per leggere tutte le spunte!
        }
        
        # Apriamo la cesta, mettiamo la carta in sospeso, e richiudiamo!
        db = read_db()
        db["carte_in_sospeso"].append(nuova_carta)
        write_db(db)
        
        messaggio = "Carta inviata con successo! In attesa di approvazione dell'Admin."
        
    return render_template("suggerisci.html", messaggio=messaggio)

if __name__ == "__main__":
    app.run(debug=True)
