import os
import datetime
import jwt
from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
from config.db_mysql_connector import get_mysql_connection

auth_bp = Blueprint('auth', __name__)

JWT_SECRET = os.getenv('JWT_SECRET', 'super_secret_dev_key_mypaie_2026')

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({"error": "Email et mot de passe requis"}), 400
        
    email = data['email']
    password = data['password']
    
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password_hash, nom, prenom, role, actif FROM app_users WHERE email = %s",
                (email,)
            )
            user = cur.fetchone()
            
            if not user or not check_password_hash(user['password_hash'], password):
                return jsonify({"error": "Identifiants invalides"}), 401
                
            if not user['actif']:
                return jsonify({"error": "Ce compte est désactivé"}), 403
                
            # Create token
            payload = {
                'user_id': user['id'],
                'email': user['email'],
                'role': user['role'],
                'nom': user['nom'],
                'prenom': user['prenom'],
                'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
            }
            
            token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
            
            return jsonify({
                "token": token,
                "user": {
                    "id": user['id'],
                    "email": user['email'],
                    "nom": user['nom'],
                    "prenom": user['prenom'],
                    "role": user['role']
                }
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@auth_bp.route('/api/auth/login-collaborateur', methods=['POST'])
def login_collaborateur():
    data = request.json
    if not data or 'nom' not in data or 'prenom' not in data:
        return jsonify({"error": "Nom et prénom requis"}), 400

    nom = (data['nom'] or '').strip()
    prenom = (data['prenom'] or '').strip()

    if not nom or not prenom:
        return jsonify({"error": "Nom et prénom requis"}), 400

    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, matricule, nom, prenom, id_structure, id_statut
                   FROM ref_employes
                   WHERE LOWER(nom) = LOWER(%s) AND LOWER(prenom) = LOWER(%s) AND actif = 1
                   LIMIT 1""",
                (nom, prenom)
            )
            employe = cur.fetchone()

            if not employe:
                return jsonify({"error": "Collaborateur non trouvé"}), 401

            payload = {
                'user_id': f"c_{employe['id']}",
                'matricule': employe['matricule'],
                'nom': employe['nom'],
                'prenom': employe['prenom'],
                'role': 'Collaborateur',
                'id_structure': employe['id_structure'],
                'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
            }

            token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')

            return jsonify({
                "token": token,
                "user": {
                    "user_id": payload['user_id'],
                    "matricule": employe['matricule'],
                    "nom": employe['nom'],
                    "prenom": employe['prenom'],
                    "role": "Collaborateur",
                    "id_structure": employe['id_structure']
                }
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@auth_bp.route('/api/auth/me', methods=['GET'])
def get_me():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Token manquant"}), 401
        
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return jsonify({"user": payload})
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expiré"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Token invalide"}), 401
