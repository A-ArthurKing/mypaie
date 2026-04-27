# ============================================================
# Fichier : Dockerfile
# Rôle    : Environnement de développement React/Vite.
# Module  : mypaie / frontend
# ============================================================

FROM node:20-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer toutes les dépendances (y compris devDependencies pour Vite)
RUN npm install

# Le code sera monté en volume via docker-compose pour le Hot Reload,
# mais on copie quand même la base au cas où.
COPY . .

# Exposer le port de Vite
EXPOSE 5569

# Démarrer le serveur de développement Vite en écoutant sur toutes les interfaces réseau
CMD ["npm", "run", "dev", "--", "--host"]
