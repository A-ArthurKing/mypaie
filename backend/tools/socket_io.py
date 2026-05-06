"""
Fichier : socket_io.py
Rôle    : Initialise SocketIO pour l'application Flask.
Module  : mypaie / backend / tools
"""

from flask_socketio import SocketIO

# Instance globale SocketIO
socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet")

def emit_update(event_name, data=None):
    """
    Emet un événement de mise à jour à tous les clients connectés.
    """
    socketio.emit(event_name, data or {"updated": True})
