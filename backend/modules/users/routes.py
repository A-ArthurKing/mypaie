import os
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash
from config.db_mysql_connector import get_mysql_connection

users_bp = Blueprint('users', __name__)

@users_bp.route('/api/users', methods=['GET'])
def get_users():
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, email, nom, prenom, role, actif, created_at FROM app_users ORDER BY id DESC")
            users = cur.fetchall()
        return jsonify({"data": users}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@users_bp.route('/api/users', methods=['POST'])
def create_user():
    data = request.json
    if not data or not data.get('email') or not data.get('password') or not data.get('nom') or not data.get('prenom'):
        return jsonify({"error": "Tous les champs sont requis"}), 400
    
    email = data['email']
    password = data['password']
    nom = data['nom']
    prenom = data['prenom']
    role = data.get('role', 'Collaborateur')
    
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM app_users WHERE email = %s", (email,))
            if cur.fetchone():
                return jsonify({"error": "Cet email est déjà utilisé"}), 400
            
            pwd_hash = generate_password_hash(password)
            cur.execute(
                "INSERT INTO app_users (email, password_hash, nom, prenom, role, actif) VALUES (%s, %s, %s, %s, %s, 1)",
                (email, pwd_hash, nom, prenom, role)
            )
            conn.commit()
        return jsonify({"success": True}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@users_bp.route('/api/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.json
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            if 'password' in data and data['password']:
                pwd_hash = generate_password_hash(data['password'])
                cur.execute(
                    "UPDATE app_users SET nom=%s, prenom=%s, role=%s, actif=%s, password_hash=%s WHERE id=%s",
                    (data['nom'], data['prenom'], data['role'], data['actif'], pwd_hash, user_id)
                )
            else:
                cur.execute(
                    "UPDATE app_users SET nom=%s, prenom=%s, role=%s, actif=%s WHERE id=%s",
                    (data['nom'], data['prenom'], data['role'], data['actif'], user_id)
                )
            conn.commit()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@users_bp.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM app_users WHERE id = %s", (user_id,))
            conn.commit()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
