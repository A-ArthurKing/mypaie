
from app import app, FLASK_PORT, logger, socketio

if __name__ == "__main__":
    logger.info("Démarrage du serveur Flask + SocketIO sur le port %d", FLASK_PORT)
    socketio.run(app, host="0.0.0.0", port=FLASK_PORT, debug=False)
