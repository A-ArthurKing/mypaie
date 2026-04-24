
from routes.dw_api_heures_endpoint import app, FLASK_PORT, logger

if __name__ == "__main__":
    logger.info("Démarrage du serveur Flask sur le port %d", FLASK_PORT)
    app.run(host="0.0.0.0", port=FLASK_PORT, debug=False)
