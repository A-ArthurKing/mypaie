import pymysql
import os
from dotenv import load_dotenv

load_dotenv('backend/.env.docker')

def check_users():
    try:
        # We need to use 'localhost' and port 3308 because we are running from host
        conn = pymysql.connect(
            host='localhost',
            port=3308,
            user='mypaie',
            password='Mypaie2026!',
            database='mypaie_config',
            cursorclass=pymysql.cursors.DictCursor
        )
        with conn.cursor() as cur:
            cur.execute("SELECT id, email, nom, prenom FROM app_users")
            users = cur.fetchall()
            print(f"Nombre d'utilisateurs: {len(users)}")
            for u in users:
                print(u)
        conn.close()
    except Exception as e:
        print(f"Erreur: {e}")

if __name__ == "__main__":
    check_users()
