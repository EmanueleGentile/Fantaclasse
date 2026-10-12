from flask import Flask, render_template, request, session, redirect, url_for
from logica.regole import calcola_punti_voto
from logica.modelli import Lega
import os
from pocketbase import PocketBase

# --- CONNESSIONE POCKETBASE GLOBALE ---
PB_URL = os.environ.get('POCKETBASE_URL', 'http://127.0.0.1:8090')
pb = PocketBase(PB_URL)

app = Flask(__name__, template_folder="interfaccia", static_folder="grafica")
app.secret_key = os.environ.get("SECRET_KEY", "fanta_segreto_super_sicuro")  # Chiave per firmare i cookie della sessione

@app.route("/")
def home():
    # 1. Dati finti della lega per ora
    lega_corrente = Lega(nome_lega="Classe 3Dia", id_admin="admin_id", crediti_iniziali=500)
    
    classifica_squadre = [
        {"posizione": 1, "nome": "Real Prof", "punti": 312, "mia_squadra": False},
        {"posizione": 2, "nome": "I Sognatori", "punti": 298, "mia_squadra": False},
        {"posizione": 3, "nome": "Fanta Classe", "punti": 287, "mia_squadra": True},
        {"posizione": 4, "nome": "Gli Insospettabili", "punti": 275, "mia_squadra": False},
        {"posizione": 5, "nome": "ClassiTard", "punti": 260, "mia_squadra": False},
    ]

    return render_template(
        "index.html", 
        lega=lega_corrente, 
        classifica=classifica_squadre, 
        totale_utenti=12,
        username=session.get('username') # Passiamo il nome utente se è loggato!
    )

# --- SISTEMA DI AUTENTICAZIONE (LOGIN / REGISTRAZIONE / LOGOUT) ---

@app.route("/registrati", methods=["GET", "POST"])
def registrati():
    errore = None
    if request.method == "POST":
        dati_utente = {
            "username": request.form.get("username"),
            "email": request.form.get("email"),
            "emailVisibility": True,
            "password": request.form.get("password"),
            "passwordConfirm": request.form.get("passwordConfirm"),
            "name": request.form.get("name")
        }
        
        try:
            # Creiamo l'utente nella collection 'users' nativa di PocketBase
            pb.collection('users').create(dati_utente)
            return redirect(url_for('login', msg="Registrazione completata! Ora puoi fare il login."))
        except Exception as e:
            print("Errore PocketBase registrazione:", e)
            errore = "Errore durante la registrazione. Forse l'email/username è già in uso, o le password non coincidono."
            
    return render_template("registrati.html", errore=errore)

@app.route("/login", methods=["GET", "POST"])
def login():
    errore = None
    msg = request.args.get('msg')
    
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        try:
            # Autentichiamo l'utente con PocketBase
            auth_data = pb.collection('users').auth_with_password(email, password)
            
            # Salviamo il token e i dati nella sessione del browser (Flask Session)
            session['pb_token'] = pb.auth_store.token
            session['user_id'] = auth_data.record.id
            session['username'] = auth_data.record.username
            session['name'] = getattr(auth_data.record, 'name', auth_data.record.username)
            
            return redirect(url_for('home'))
        except Exception as e:
            print("Errore login PocketBase:", e)
            errore = "Email o password errati."
            
    return render_template("login.html", errore=errore, messaggio=msg)

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for('home'))

# --- ROTTE DI GIOCO ---

@app.route("/mercato")
def mercato():
    carte_disponibili = []
    try:
        records = pb.collection('carte').get_full_list(query_params={"filter": "stato='approvata'"})
        for r in records:
            carte_disponibili.append({
                "nome": getattr(r, 'nome', ''),
                "classe": getattr(r, 'classe', ''),
                "materie": getattr(r, 'materie', []), 
                "quotazione": getattr(r, 'quotazione', 0),
                "media_voti": getattr(r, 'media_voti', 0.0),
                "assenze_iniziali": getattr(r, 'assenze_iniziali', 0),
                "ritardi": getattr(r, 'ritardi', 0),
                "entrate_ritardo": getattr(r, 'entrate_ritardo', 0),
                "note_generiche": getattr(r, 'note_generiche', 0),
                "note_disciplinari": getattr(r, 'note_disciplinari', 0)
            })
    except Exception as e:
        print("Errore PocketBase durante il caricamento del mercato:", e)

    return render_template("mercato.html", carte=carte_disponibili)

@app.route("/suggerisci", methods=["GET", "POST"])
def suggerisci():
    # Se l'utente non è loggato, lo rimandiamo al login!
    if 'user_id' not in session:
        return redirect(url_for('login', msg="Devi fare il login per suggerire carte!"))
        
    messaggio = None
    if request.method == "POST":
        nuova_carta = {
            "nome": request.form.get("nome"),
            "classe": request.form.get("classe"),
            "materie": request.form.getlist("materie"),
            "stato": "in_attesa",
            "suggerita_da": session['user_id'] # Salviamo anche chi ha fatto la richiesta
        }
        
        try:
            pb.collection('carte').create(nuova_carta)
            messaggio = "Carta inviata con successo! Ora è in attesa di approvazione."
        except Exception as e:
            print("Errore PocketBase durante l'inserimento:", e)
            messaggio = "Errore di connessione al Database. Riprova più tardi."
        
    return render_template("suggerisci.html", messaggio=messaggio)

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0')
