"""
Fichier : structure_provider.py
Rôle    : Gère le CRUD des entités structurelles (Projets, Opérations, Files, Activités).
Module  : mypaie / backend / services / parametres
"""

import logging
from config.db_mysql_connector import get_mysql_connection

logger = logging.getLogger(__name__)

# --- PROJETS ---
def add_project(nom: str, code: str = None):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO ref_projets (nom, code) VALUES (%s, %s)", (nom, code))
            conn.commit()
            return {"id": cur.lastrowid, "nom": nom, "code": code}
    finally: conn.close()

def update_project(id: int, nom: str, code: str = None):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE ref_projets SET nom = %s, code = %s WHERE id = %s", (nom, code, id))
            conn.commit()
            return {"id": id, "nom": nom, "code": code}
    finally: conn.close()

def delete_project(id: int):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ref_projets WHERE id = %s", (id,))
            conn.commit()
            return {"status": "deleted"}
    finally: conn.close()

# --- OPERATIONS ---
def add_operation(id_projet: int, libelle: str):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO ref_operations (id_projet, libelle) VALUES (%s, %s)", (id_projet, libelle))
            conn.commit()
            return {"id": cur.lastrowid, "id_projet": id_projet, "libelle": libelle}
    finally: conn.close()

def update_operation(id: int, libelle: str):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE ref_operations SET libelle = %s WHERE id = %s", (libelle, id))
            conn.commit()
            return {"id": id, "libelle": libelle}
    finally: conn.close()

def delete_operation(id: int):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ref_operations WHERE id = %s", (id,))
            conn.commit()
            return {"status": "deleted"}
    finally: conn.close()

# --- FILES ---
def add_file(libelle: str):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO ref_files (libelle) VALUES (%s)", (libelle,))
            conn.commit()
            return {"id": cur.lastrowid, "libelle": libelle}
    finally: conn.close()

def update_file(id: int, libelle: str):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE ref_files SET libelle = %s WHERE id = %s", (libelle, id))
            conn.commit()
            return {"id": id, "libelle": libelle}
    finally: conn.close()

def delete_file(id: int):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ref_files WHERE id = %s", (id,))
            conn.commit()
            return {"status": "deleted"}
    finally: conn.close()

# --- ACTIVITES ---
def add_activity(libelle: str):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO ref_activites (libelle) VALUES (%s)", (libelle,))
            conn.commit()
            return {"id": cur.lastrowid, "libelle": libelle}
    finally: conn.close()

def update_activity(id: int, libelle: str):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE ref_activites SET libelle = %s WHERE id = %s", (libelle, id))
            conn.commit()
            return {"id": id, "libelle": libelle}
    finally: conn.close()

def delete_activity(id: int):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ref_activites WHERE id = %s", (id,))
            conn.commit()
            return {"status": "deleted"}
    finally: conn.close()

# --- STRUCTURE MAP (Liaisons) ---
def add_structure_mapping(id_projet: int, id_operation: int, id_file: int = None, id_activite: int = None):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            sql = "INSERT INTO ref_structure_map (id_projet, id_operation, id_file, id_activite) VALUES (%s, %s, %s, %s)"
            cur.execute(sql, (id_projet, id_operation, id_file, id_activite))
            conn.commit()
            return {"id": cur.lastrowid, "status": "success"}
    finally: conn.close()

def delete_structure_mapping(id: int):
    conn = get_mysql_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ref_structure_map WHERE id = %s", (id,))
            conn.commit()
            return {"status": "deleted"}
    finally: conn.close()
