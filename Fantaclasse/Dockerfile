# Usa Python 3.14 slim come base per un'immagine leggera (ideale per produzione)
FROM python:3.11-slim

# Imposta la working directory all'interno del container
WORKDIR /app

# Copia il file dei requisiti e installa le dipendenze
# (Facciamo prima questo step per sfruttare la cache di Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org -r requirements.txt

# Copia il resto del codice dell'applicazione
COPY . .

# Esponi la porta 5000 (su cui ascolterà Gunicorn)
EXPOSE 5000

# Comando per avviare l'applicazione in produzione tramite Gunicorn
# -w 4: utilizza 4 worker process per gestire richieste simultanee (regola in base alle CPU)
# -b 0.0.0.0:5000: fai il bind del server in modo che sia accessibile dall'esterno del container
# main:app: il primo 'main' indica il file main.py, il secondo 'app' indica l'istanza Flask
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "main:app"]
