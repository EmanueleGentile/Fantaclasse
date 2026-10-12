#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DI DEPLOY AUTOMATICO: FANTACLASSE PER SERVER UBUNTU
# IP TARGET: 148.113.194.186
# Eseguire come: sudo bash deploy_ubuntu.sh
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo "🚀 AVVIO DEPLOYMENT COMPLETO FANTACLASSE"
echo "=========================================================="

# ------------------------------------------------------------------------------
# STEP 1: PREPARAZIONE DEL SISTEMA (System Prep)
# ------------------------------------------------------------------------------
echo "📦 [1/8] Aggiornamento pacchetti e installazione prerequisiti..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ufw ca-certificates gnupg lsb-release nginx apache2-utils

# ------------------------------------------------------------------------------
# STEP 2: INSTALLAZIONE DOCKER & DOCKER COMPOSE
# ------------------------------------------------------------------------------
echo "🐳 [2/8] Installazione Docker Engine e Docker Compose..."
if ! command -v docker &> /dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable docker
systemctl start docker

# Aggiunge l'utente ubuntu al gruppo docker se esiste
if id "ubuntu" &>/dev/null; then
    usermod -aG docker ubuntu
    echo "✅ Utente ubuntu aggiunto al gruppo docker."
fi

# ------------------------------------------------------------------------------
# STEP 3: CLONE DEL REPOSITORY
# ------------------------------------------------------------------------------
TARGET_DIR="/home/ubuntu/Fantaclasse"
echo "📂 [3/8] Preparazione directory di progetto in $TARGET_DIR..."

if [ -d "$TARGET_DIR/.git" ]; then
    echo "Repository esistente, sincronizzazione con origin/main..."
    cd "$TARGET_DIR"
    git fetch origin
    git reset --hard origin/main || true
else
    mkdir -p /home/ubuntu
    rm -rf "$TARGET_DIR"
    git clone https://github.com/EmanueleGentile/Fantaclasse.git "$TARGET_DIR"
    cd "$TARGET_DIR"
fi

# Assicuriamoci che la cartella appartenga all'utente ubuntu
chown -R ubuntu:ubuntu "$TARGET_DIR"

# ------------------------------------------------------------------------------
# STEP 4: GESTIONE FILE APPLICATIVI, DOCKERFILE & REQUISITI
# (Garantisce che i file di produzione siano sempre completi e aggiornati)
# ------------------------------------------------------------------------------
echo "📝 [4/8] Verifica e configurazione dei file applicativi..."

# Dockerfile
cat << 'EOF' > "$TARGET_DIR/Dockerfile"
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "main:app"]
EOF

# requirements.txt
cat << 'EOF' > "$TARGET_DIR/requirements.txt"
Flask
gunicorn
pocketbase
EOF

# ------------------------------------------------------------------------------
# STEP 5: CREAZIONE DEL FILE .ENV (Security & Secrets)
# ------------------------------------------------------------------------------
echo "🔐 [5/8] Configurazione Secrets (.env)..."
if [ ! -f "$TARGET_DIR/.env" ]; then
    GENERATED_SECRET=$(openssl rand -hex 32)
    cat << EOF > "$TARGET_DIR/.env"
# Generato automaticamente per Fantaclasse
SECRET_KEY=${GENERATED_SECRET}
POCKETBASE_URL=http://db:8090
EOF
    echo "✅ File .env generato con chiave segreta sicura."
else
    echo "ℹ️  File .env già presente, mantenuto."
fi
chmod 600 "$TARGET_DIR/.env"
chown ubuntu:ubuntu "$TARGET_DIR/.env"

# ------------------------------------------------------------------------------
# STEP 6: DOCKER COMPOSE OTTIMIZZATO PER PRODUZIONE (No Cloudflare Tunnels)
# ------------------------------------------------------------------------------
echo "⚙️ [6/8] Creazione docker-compose.yml di produzione..."
cat << 'EOF' > "$TARGET_DIR/docker-compose.yml"
version: '3.8'

services:
  web:
    build: .
    container_name: fantaclasse_web
    ports:
      - "127.0.0.1:5000:5000"
    depends_on:
      - db
    environment:
      - POCKETBASE_URL=http://db:8090
      - SECRET_KEY=${SECRET_KEY}
    networks:
      - fantaclasse-net
    restart: unless-stopped

  db:
    image: ghcr.io/muchobien/pocketbase:latest
    container_name: fantaclasse_db
    ports:
      - "127.0.0.1:8090:8090"
    volumes:
      - ./pb_data:/pb_data
    networks:
      - fantaclasse-net
    restart: unless-stopped

  sito_web:
    image: nginx:alpine
    container_name: fantaclasse_sito
    ports:
      - "127.0.0.1:8080:80"
    volumes:
      - ./sito:/usr/share/nginx/html
    networks:
      - fantaclasse-net
    restart: unless-stopped

networks:
  fantaclasse-net:
    driver: bridge
EOF

# Crea la cartella per pb_data se non esiste
mkdir -p "$TARGET_DIR/pb_data"
# Crea la cartella sito se non esiste
mkdir -p "$TARGET_DIR/sito"
chown -R ubuntu:ubuntu "$TARGET_DIR"

# ------------------------------------------------------------------------------
# STEP 7: CONFIGURAZIONE NGINX HOST (Reverse Proxy) & UFW (Firewall)
# ------------------------------------------------------------------------------
echo "🌐 [7/8] Configurazione Nginx Host come Reverse Proxy..."

cat << 'EOF' > /etc/nginx/sites-available/fantaclasse
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 50M;

    # 1. Applicazione Principale Fantaclasse (Flask)
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. PocketBase Admin UI e API (per il backend & gestione)
    location /api/ {
        proxy_pass http://127.0.0.1:8090/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /_/ {
        proxy_pass http://127.0.0.1:8090/_/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 3. Sito Secondario / Feedback
    location /sito/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# Attiva il sito e disattiva il default
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/fantaclasse /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

echo "🛡️ Configurazione Firewall UFW..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ------------------------------------------------------------------------------
# STEP 8: BUILD E AVVIO CON DOCKER COMPOSE
# ------------------------------------------------------------------------------
echo "🚀 [8/8] Build e avvio dei container Fantaclasse..."
cd "$TARGET_DIR"
docker compose down || true
docker compose up -d --build

echo ""
echo "=========================================================="
echo "🩺 VERIFICA DELLO STATO (Health Check)"
echo "=========================================================="
sleep 5
docker compose ps

echo ""
echo "Verifica risposta Flask:"
curl -Is http://127.0.0.1:5000 | head -n 5 || echo "Flask in avvio..."

echo ""
echo "Verifica risposta PocketBase:"
curl -Is http://127.0.0.1:8090/api/health | head -n 5 || echo "PocketBase in avvio..."

echo ""
echo "=========================================================="
echo "🎉 DEPLOY COMPLETATO CON SUCCESSO!"
echo "Accedi ora da browser su:"
echo "👉 App Principale: http://148.113.194.186"
echo "👉 PocketBase Admin: http://148.113.194.186/_/"
echo "👉 Sito Feedback:   http://148.113.194.186/sito/"
echo "=========================================================="
