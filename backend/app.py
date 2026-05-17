"""
Fichier : app.py
Rôle    : Fabrique Flask — enregistre tous les Blueprints de l'application.
          Point d'entrée unique pour la configuration de l'app et de SocketIO.
Module  : mypaie / backend
"""

# #region IMPORTS
import logging
import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from core.socket import socketio
from modules.heures_agents.routes import heures_agents_bp
from modules.notes_qualite.routes import notes_qualite_bp
from modules.performance.routes import performance_bp
from modules.regles_primes.routes import regles_primes_bp
from modules.parametres.routes import parametres_bp
from modules.agents.routes import agents_bp
from modules.auth.routes import auth_bp
from modules.users.routes import users_bp
# #endregion

# #region CONFIGURATION
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

cors_origin = os.getenv("CORS_ORIGIN", "http://localhost:5569")
CORS(app, resources={r"/api/*": {"origins": cors_origin}})

# Initialisation de SocketIO avec l'application
socketio.init_app(app, cors_allowed_origins=cors_origin)

FLASK_PORT = int(os.getenv("FLASK_PORT", 5000))

# Enregistrement des Blueprints
app.register_blueprint(heures_agents_bp)
app.register_blueprint(notes_qualite_bp)
app.register_blueprint(performance_bp)
app.register_blueprint(regles_primes_bp)
app.register_blueprint(parametres_bp)
app.register_blueprint(agents_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(users_bp)
# #endregion


# #region HEALTH
@app.route("/api/health", methods=["GET"])
def endpoint_health():
    """Endpoint de santé pour vérifier que le serveur Flask est actif."""
    return jsonify({"status": "ok"}), 200
# #endregion
