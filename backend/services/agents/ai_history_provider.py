"""
Fichier : ai_history_provider.py
Rôle    : Gère la persistance de l'historique des conversations avec l'IA.
Module  : mypaie / backend / services / agents
"""

import logging
from config.db_mysql_connector import get_mysql_connection

logger = logging.getLogger(__name__)

def create_conversation(regle_id: int, titre: str = "Nouvelle conversation") -> int:
    conn = None
    try:
        conn = get_mysql_connection()
        with conn.cursor() as cur:
            sql = "INSERT INTO ai_conversations (regle_id, titre) VALUES (%s, %s)"
            cur.execute(sql, (regle_id, titre))
            conn.commit()
            return cur.lastrowid
    except Exception as e:
        logger.error("Erreur create_conversation: %s", e)
        raise e
    finally:
        if conn: conn.close()

def get_conversations(regle_id: int) -> list:
    conn = None
    try:
        conn = get_mysql_connection()
        with conn.cursor() as cur:
            sql = "SELECT * FROM ai_conversations WHERE regle_id = %s ORDER BY updated_at DESC"
            cur.execute(sql, (regle_id,))
            rows = cur.fetchall()
            # Format dates
            for r in rows:
                r['created_at'] = str(r['created_at'])
                r['updated_at'] = str(r['updated_at'])
            return rows
    except Exception as e:
        logger.error("Erreur get_conversations: %s", e)
        return []
    finally:
        if conn: conn.close()

def get_messages(conversation_id: int) -> list:
    conn = None
    try:
        conn = get_mysql_connection()
        with conn.cursor() as cur:
            sql = "SELECT id, sender, text, created_at FROM ai_messages WHERE conversation_id = %s ORDER BY id ASC"
            cur.execute(sql, (conversation_id,))
            rows = cur.fetchall()
            for r in rows:
                r['created_at'] = str(r['created_at'])
            return rows
    except Exception as e:
        logger.error("Erreur get_messages: %s", e)
        return []
    finally:
        if conn: conn.close()

def add_message(conversation_id: int, sender: str, text: str):
    conn = None
    try:
        conn = get_mysql_connection()
        with conn.cursor() as cur:
            sql = "INSERT INTO ai_messages (conversation_id, sender, text) VALUES (%s, %s, %s)"
            cur.execute(sql, (conversation_id, sender, text))
            
            # Update conversation timestamp and generate title if it's the first user message
            if sender == 'user':
                cur.execute("SELECT COUNT(*) as cnt FROM ai_messages WHERE conversation_id = %s", (conversation_id,))
                cnt = cur.fetchone()['cnt']
                
                if cnt <= 2: # First user message (1 bot + 1 user) or just 1 user
                    # Generate a short title from the text (max 40 chars)
                    titre = text[:37] + "..." if len(text) > 40 else text
                    cur.execute("UPDATE ai_conversations SET titre = %s, updated_at = NOW() WHERE id = %s", (titre, conversation_id))
                else:
                    cur.execute("UPDATE ai_conversations SET updated_at = NOW() WHERE id = %s", (conversation_id,))

            conn.commit()
    except Exception as e:
        logger.error("Erreur add_message: %s", e)
    finally:
        if conn: conn.close()

def lock_conversation(conversation_id: int):
    conn = None
    try:
        conn = get_mysql_connection()
        with conn.cursor() as cur:
            sql = "UPDATE ai_conversations SET is_locked = 1 WHERE id = %s"
            cur.execute(sql, (conversation_id,))
            conn.commit()
    except Exception as e:
        logger.error("Erreur lock_conversation: %s", e)
    finally:
        if conn: conn.close()

def truncate_conversation(conversation_id: int, from_message_id: int):
    """Supprime tous les messages à partir d'un ID donné et déverrouille la conversation."""
    conn = None
    try:
        conn = get_mysql_connection()
        with conn.cursor() as cur:
            sql = "DELETE FROM ai_messages WHERE conversation_id = %s AND id >= %s"
            cur.execute(sql, (conversation_id, from_message_id))
            sql_unlock = "UPDATE ai_conversations SET is_locked = 0 WHERE id = %s"
            cur.execute(sql_unlock, (conversation_id,))
            conn.commit()
    except Exception as e:
        logger.error("Erreur truncate_conversation: %s", e)
    finally:
        if conn: conn.close()
