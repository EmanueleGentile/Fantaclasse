from flask import Flask, render_template, request
from logica.regole import calcola_punti_voto
from logica.modelli import Lega

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

    # 3. Passiamo i dati all'HTML (il Volto)!
    # Ora è Python a dire all'HTML cosa stampare.
    return render_template(
        "index.html", 
        lega=lega_corrente, 
        classifica=classifica_squadre, 
        totale_utenti=12
    )

# Vecchio calcolatore
@app.route("/calcolatore", methods=["GET", "POST"])
def calcolatore():
    risultato = None
    if request.method == "POST":
        voto_str = request.form.get("voto")
        if voto_str:
            voto_float = float(voto_str)
            risultato = calcola_punti_voto(voto_float)
    return f"Calcolatore disattivato dalla UI. Risultato test: {risultato}"

if __name__ == "__main__":
    app.run(debug=True)
