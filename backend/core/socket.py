"""
Fichier : core/socket.py
Rôle    : Initialise SocketIO pour l'application Flask.
          Expose l'instance socketio et la fonction d'émission temps-réel.
Module  : mypaie / backend / core
"""

from flask_socketio import SocketIO

# Instance globale SocketIO
socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet")


def emit_update(event_name: str, data=None) -> None:
    """Émet un événement de mise à jour à tous les clients connectés."""
    socketio.emit(event_name, data or {"updated": True})
