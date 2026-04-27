# ============================================================
# Fichier : Dockerfile
# Rôle    : Image Docker du backend Flask — Python 3.10 slim.
#           Installe les dépendances et lance run.py.
# Module  : mypaie / backend
# ============================================================

FROM python:3.10-slim

WORKDIR /app

# Dépendances système minimales pour gcc (grpcio wheel) et SSL (pymysql)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    gcc \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Installer les dépendances Python en premier (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code source
COPY . .

# Port Flask exposé à l'intérieur du réseau Docker
EXPOSE 5001

# Démarrage du serveur
CMD ["python", "run.py"]
