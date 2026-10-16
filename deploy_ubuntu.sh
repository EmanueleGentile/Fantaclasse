#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DI DEPLOY AUTOMATICO & HARDENING: FANTACLASSE PER SERVER UBUNTU
# DOMINIO UFFICIALE: playfantaclasse.com / www.playfantaclasse.com (Cloudflare)
# IP TARGET: 148.113.194.186
# Eseguire come: sudo bash deploy_ubuntu.sh
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo "🚀 AVVIO DEPLOYMENT & HARDENING FANTACLASSE (PRODUZIONE)"
echo "=========================================================="

# ------------------------------------------------------------------------------
# STEP 1: PREPARAZIONE DEL SISTEMA (System Prep)
# ------------------------------------------------------------------------------
echo "📦 [1/8] Aggiornamento pacchetti e installazione prerequisiti..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ufw ca-certificates gnupg lsb-release nginx apache2-utils sqlite3 openssl python3

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

if id "ubuntu" &>/dev/null; then
    usermod -aG docker ubuntu
    echo "✅ Utente ubuntu aggiunto al gruppo docker."
fi

# ------------------------------------------------------------------------------
# STEP 3: CLONE E SINCRONIZZAZIONE DEL REPOSITORY
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

# Sincronizza i file applicativi se presenti nella sottocartella monorepo Fantaclasse/
mkdir -p "$TARGET_DIR/pb_data" "$TARGET_DIR/pb_hooks" "$TARGET_DIR/sito"
if [ -d "$TARGET_DIR/Fantaclasse" ]; then
    cp -rn "$TARGET_DIR/Fantaclasse/pb_data/"* "$TARGET_DIR/pb_data/" 2>/dev/null || true
    cp -rf "$TARGET_DIR/Fantaclasse/pb_hooks/"* "$TARGET_DIR/pb_hooks/" 2>/dev/null || true
    for item in main.py logica interfaccia grafica assets; do
        if [ -e "$TARGET_DIR/Fantaclasse/$item" ] && [ ! -e "$TARGET_DIR/$item" ]; then
            cp -rf "$TARGET_DIR/Fantaclasse/$item" "$TARGET_DIR/"
        fi
    done
fi

# ------------------------------------------------------------------------------
# STEP 4: GESTIONE FILE APPLICATIVI, DOCKERFILE, REQUISITI & HARDENING POCKETBASE
# ------------------------------------------------------------------------------
echo "📝 [4/8] Verifica file applicativi e Hardening API Rules di PocketBase..."

cat << 'EOF' > "$TARGET_DIR/Dockerfile"
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "main:app"]
EOF

cat << 'EOF' > "$TARGET_DIR/requirements.txt"
Flask
gunicorn
pocketbase
EOF

# Hardening automatico delle API Rules nel database SQLite di PocketBase:
# - Utenti pubblici (@request.auth.id = ""): SOLO list/view e create validato su Feedback
# - NESSUN permesso pubblico di update o delete (updateRule = NULL, deleteRule = NULL)
if [ -f "$TARGET_DIR/pb_data/data.db" ]; then
    python3 - "$TARGET_DIR/pb_data/data.db" << 'PYEOF'
import sqlite3, json, sys

db_path = sys.argv[1]
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT fields FROM _collections WHERE name = 'Feedback'")
row = cur.fetchone()
if row:
    fields = json.loads(row[0])
    for f in fields:
        name = f.get("name")
        if name == "nome_utente":
            f["max"] = 40
            f["pattern"] = "^[^<>]*$"
        elif name == "titolo":
            f["max"] = 80
            f["pattern"] = "^[^<>]*$"
        elif name == "messaggio_feedback":
            f["required"] = True
            f["min"] = 5
            f["max"] = 1000
            f["pattern"] = "^[^<>]*$"
        elif name == "categoria":
            f["required"] = True
            f["max"] = 20
            f["pattern"] = "^(idea|like|improve|bug|feature|other)$"
        elif name == "voto":
            f["required"] = True
            f["min"] = 1
            f["max"] = 5
            f["onlyInt"] = True
        elif name == "upvotes":
            f["min"] = 0
            f["onlyInt"] = True
        elif name == "stato":
            f["max"] = 30
            f["pattern"] = "^(in_valutazione|in_sviluppo|approvato|implementato|rifiutato)?$"
        elif name == "risposta_admin":
            f["max"] = 1000

    feedback_create_rule = (
        '(@request.auth.id = "" || @request.auth.id != "") && '
        '@request.body.messaggio_feedback:isset = true && '
        '@request.body.messaggio_feedback:length >= 5 && '
        '@request.body.messaggio_feedback:length <= 1000 && '
        '(@request.body.categoria = "idea" || @request.body.categoria = "like" || '
        '@request.body.categoria = "improve" || @request.body.categoria = "bug" || '
        '@request.body.categoria = "feature" || @request.body.categoria = "other") && '
        '@request.body.voto >= 1 && @request.body.voto <= 5 && '
        '(@request.body.nome_utente:isset = false || @request.body.nome_utente:length <= 40) && '
        '(@request.body.titolo:isset = false || @request.body.titolo:length <= 80) && '
        '(@request.body.stato:isset = false || @request.body.stato = "" || @request.body.stato = "in_valutazione") && '
        '(@request.body.risposta_admin:isset = false || @request.body.risposta_admin = "") && '
        '(@request.body.upvotes:isset = false || @request.body.upvotes = 0)'
    )

    cur.execute("""
        UPDATE _collections
        SET listRule = '',
            viewRule = '',
            createRule = ?,
            updateRule = NULL,
            deleteRule = NULL,
            fields = ?
        WHERE name = 'Feedback'
    """, (feedback_create_rule, json.dumps(fields)))

cur.execute("""
    UPDATE _collections
    SET listRule = "stato = 'approvata' || @request.auth.id != ''",
        viewRule = "stato = 'approvata' || @request.auth.id != ''",
        createRule = "@request.auth.id != ''",
        updateRule = NULL,
        deleteRule = NULL
    WHERE name = 'Carte'
""")

cur.execute("UPDATE _collections SET deleteRule = NULL WHERE name = 'users'")
conn.commit()
conn.close()
print("✅ PocketBase API Rules blindate con successo.")
PYEOF
fi

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
FLASK_ENV=production
FLASK_DEBUG=0
EOF
    echo "✅ File .env generato con chiave segreta sicura."
else
    echo "ℹ️  File .env già presente, mantenuto."
fi
chmod 600 "$TARGET_DIR/.env"
chown -R ubuntu:ubuntu "$TARGET_DIR"

# ------------------------------------------------------------------------------
# STEP 6: DOCKER COMPOSE BLINDATO (Bind esclusivo su 127.0.0.1)
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
      - FLASK_ENV=production
      - FLASK_DEBUG=0
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
      - ./pb_hooks:/pb_hooks:ro
    networks:
      - fantaclasse-net
    restart: unless-stopped

  sito_web:
    image: nginx:alpine
    container_name: fantaclasse_sito
    ports:
      - "127.0.0.1:8080:80"
    volumes:
      - ./sito:/usr/share/nginx/html:ro
    networks:
      - fantaclasse-net
    restart: unless-stopped

networks:
  fantaclasse-net:
    driver: bridge
EOF

chown -R ubuntu:ubuntu "$TARGET_DIR"

# ------------------------------------------------------------------------------
# STEP 7: CONFIGURAZIONE NGINX (Cloudflare, SSL, Rate-Limit, Headers) & UFW
# ------------------------------------------------------------------------------
echo "🌐 [7/8] Configurazione Certificato SSL Origin, Nginx Hardening e Firewall UFW..."

# Genera certificato SSL Origin per Cloudflare Full SSL se Let's Encrypt non è presente
SSL_CERT="/etc/nginx/ssl/playfantaclasse.crt"
SSL_KEY="/etc/nginx/ssl/playfantaclasse.key"
if [ -f "/etc/letsencrypt/live/playfantaclasse.com/fullchain.pem" ]; then
    SSL_CERT="/etc/letsencrypt/live/playfantaclasse.com/fullchain.pem"
    SSL_KEY="/etc/letsencrypt/live/playfantaclasse.com/privkey.pem"
elif [ ! -f "$SSL_CERT" ] || [ ! -f "$SSL_KEY" ]; then
    mkdir -p /etc/nginx/ssl
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$SSL_KEY" \
        -out "$SSL_CERT" \
        -subj "/C=IT/ST=Italy/L=Maddaloni/O=Fantaclasse/CN=playfantaclasse.com" \
        -addext "subjectAltName=DNS:playfantaclasse.com,DNS:www.playfantaclasse.com"
    chmod 600 "$SSL_KEY"
    chmod 644 "$SSL_CERT"
fi

cat << EOF > /etc/nginx/sites-available/fantaclasse
# ==============================================================================
# NGINX REVERSE PROXY HARDENED — playfantaclasse.com (Cloudflare Protected)
# ==============================================================================

# 1. Ripristino IP reale dei visitatori da Cloudflare
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;

real_ip_header CF-Connecting-IP;
real_ip_recursive on;

# 2. Rate Limiting Anti-Raid / Anti-Flood (max 5 richieste/minuto per IP su invio feedback)
map \$request_method \$feedback_write_ip {
    default "";
    POST    \$binary_remote_addr;
}

limit_req_zone \$feedback_write_ip zone=feedback_limit:10m rate=5r/m;
limit_req_zone \$binary_remote_addr zone=api_read_limit:10m rate=30r/m;
limit_req_status 429;

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;

    server_name playfantaclasse.com www.playfantaclasse.com;

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    server_tokens off;
    client_max_body_size 2M;

    # 3. Security Headers (OWASP / GDPR Hardening)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # 4. BLOCCO TOTALE ACCESSO PUBBLICO AL PANNELLO ADMIN DI POCKETBASE (/_/)
    # Accessibile SOLO da localhost / tunnel SSH (es: ssh -L 8090:127.0.0.1:8090 ubuntu@playfantaclasse.com)
    location /_/ {
        allow 127.0.0.1;
        allow ::1;
        deny all;

        proxy_pass http://127.0.0.1:8090/_/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Blocco autenticazione/gestione superuser da internet
    location ~ ^/api/(admins|collections/_superusers) {
        allow 127.0.0.1;
        allow ::1;
        deny all;
    }

    # 5. API Feedback di PocketBase (Rate Limited a 5 req/minuto per IP in scrittura + Blocco PATCH/DELETE)
    location /api/collections/Feedback/records {
        limit_req zone=feedback_limit burst=2 nodelay;
        limit_req zone=api_read_limit burst=10 nodelay;

        limit_except GET HEAD POST OPTIONS {
            deny all;
        }

        proxy_pass http://127.0.0.1:8090/api/collections/Feedback/records;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Endpoint atomico Upvote (Rate Limited a 5 req/minuto per IP)
    location /api/feedback/ {
        limit_req zone=feedback_limit burst=3 nodelay;

        limit_except POST OPTIONS {
            deny all;
        }

        proxy_pass http://127.0.0.1:8090/api/feedback/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Altre API di PocketBase (sola lettura / health check, rate limited)
    location /api/ {
        limit_req zone=api_read_limit burst=10 nodelay;

        limit_except GET HEAD POST OPTIONS {
            deny all;
        }

        proxy_pass http://127.0.0.1:8090/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # 6. Portale Pubblico Feedback (cartella sito/) su dominio principale e su /sito/
    location /sito/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /app/ {
        proxy_pass http://127.0.0.1:5000/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Attiva il sito e disattiva il default
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/fantaclasse /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

echo "🛡️ Configurazione Firewall UFW (Default Deny Incoming + solo SSH, 80, 443)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 22/tcp
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
echo "Verifica risposta Portale Sito (8080):"
curl -Is http://127.0.0.1:8080 | head -n 5 || echo "Sito in avvio..."

echo ""
echo "Verifica risposta PocketBase (8090):"
curl -Is http://127.0.0.1:8090/api/health | head -n 5 || echo "PocketBase in avvio..."

echo ""
echo "=========================================================="
echo "🎉 DEPLOY E HARDENING COMPLETATI CON SUCCESSO!"
echo "👉 Dominio Pubblico:  https://playfantaclasse.com"
echo "👉 Sito Feedback:     https://playfantaclasse.com/sito/"
echo "🔒 PocketBase Admin:  BLOCCATO DA INTERNET (Accessibile solo via SSH tunnel: ssh -L 8090:127.0.0.1:8090 ubuntu@playfantaclasse.com -> http://127.0.0.1:8090/_/)"
echo "=========================================================="
