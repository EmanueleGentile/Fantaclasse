# Fantaclasse
FantaClasse è il nome del progetto dato all'applicazione della classe 3DIA del Nino Cortese di Maddaloni.
Il progetto è basato sulle stesse regole del fantacalcio ma rivisitate per essere fatte con i propri compagni di classe!

## 🚀 Come testare l'App (Per Sviluppatori/Collaboratori)

Dato che l'app usa un backend in Python, **non basta aprire il file HTML**. Serve accendere il server locale.

**Se usi Windows:**
Ti basta fare doppio clic sul file `Avvia_Fantaclasse.bat`. Farà tutto da solo e potrai vedere l'app aprendo nel browser l'indirizzo: `http://127.0.0.1:5000`

**Se usi Mac/Linux o il Terminale:**
1. Installa i requisiti: `pip install flask`
2. Avvia il server: `python main.py`
3. Apri nel browser: `http://127.0.0.1:5000`

## 🧠 Roadmap e Nuove Idee (Brainstorming)
Il progetto si evolverà per supportare una distinzione chiara tra **Dati Statici** (anagrafica) e **Dati Dinamici** (voti, assenze).
Abbiamo ideato un **Workflow di Moderazione a 3 Step** per la creazione di nuove carte nel Mercato:

1. **Utente (L'App Web):** L'utente usa la funzione "Suggerisci Carta" fornendo solo dati anagrafici (Nome, Classe, Indirizzo di studio).
2. **Admin Panel (Step 1 - Verifica):** L'Admin riceve la richiesta nel terminale e verifica che il nome sia consono e che non ci siano doppioni. Se accetta, la carta NON va nel mercato, ma passa al Data Analyst.
3. **Data Analyst Panel (Step 2 - Statistiche):** Il team di Data Analysis riceve la carta "vergine". Tramite un secondo pannello, inseriscono le statistiche iniziali basate sui registri reali (es. quota iniziale, storico assenze). Una volta confermato, la carta appare finalmente nel Mercato ufficiale per essere comprata!

Questo sistema richiederà in futuro il passaggio dall'attuale `database.json` a un database relazionale (es. SQLite) per gestire in modo robusto queste tre fasi.

---
REGOLAMENTO FANTASTUDENTE
—————————————
in gioco:
ogni giocatore deve schierare almeno uno studente per ogni materia.
per comprare i giocatori, il fanta è a listone, ovvero c’è sempre un mercato aperto dove puoi comprare sempre i giocatori.
le materie sono 9
informatica
italiano
matematica
scienze
storia
filosofia
inglese
scienze motorie
disegno e storia dell’arte
quindi ogni squadra avrà 9 giocatori, e un totale di crediti (che verrà deciso alla creazione della lega) da spendere per formare la propria squadra.
ogni admin di lega procederà a creare i campioncini dei propri compagni di classe tramite un bot apposito, dove basterá inserire la foto e il campioncino verrà creato

—————————————————————
voti: (come i gol) 
se uno prende tra 9 e 10 è un +5
se uno prende tra 9- e 8 è un +4
se uno prende tra 7- a 8- è un +3
se uno prende tra 6,5 e 6 è un +1 
se uno prende tra 6- e 5 è un -1
se uno prende un voto tra 5- e 4,5 è un -2
se uno prende un voto tra 4+ e 4 è un -3
se uno prende un voto minore di 4 è un -5
—————————————————————
disciplina:
assenza -1
ritardo -0,5
entrata in ritardo/seconda/terza ora -0,5
nota generica -2
(se individuale o in un gruppo tra 2 e 5 persone) 
nota disciplinare -4
(se individuale o in un gruppo tra 2 e 5 persone)
—————————————————————
