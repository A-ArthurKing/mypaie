import os
import pymysql
from dotenv import load_dotenv

# Charger .env depuis le dossier backend
load_dotenv(dotenv_path='backend/.env')

def get_columns(table):
    conn = pymysql.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", 3308)),
        user=os.getenv("MYSQL_USER", "mypaie"),
        password=os.getenv("MYSQL_PASSWORD", "Mypaie2026!"),
        database=os.getenv("MYSQL_DATABASE", "mypaie_config"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute(f"DESCRIBE {table}")
            return cursor.fetchall()
    finally:
        conn.close()

print("--- matrice_primes ---")
for col in get_columns("matrice_primes"):
    print(f"{col['Field']}: {col['Type']}")

print("\n--- matrice_primes_configs ---")
for col in get_columns("matrice_primes_configs"):
    print(f"{col['Field']}: {col['Type']}")
