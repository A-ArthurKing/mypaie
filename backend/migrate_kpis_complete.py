"""
Migration script to refine matrice_kpis with source database info and new performance metrics.
"""
import os
import sys
from dotenv import load_dotenv

# Add current directory to path to allow absolute imports if run from here
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config.db_mysql_connector import get_mysql_connection

load_dotenv('.env')

def migrate():
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            # 1. Add source_db column
            print("Adding source_db column to matrice_kpis...")
            try:
                cursor.execute("ALTER TABLE matrice_kpis ADD COLUMN source_db VARCHAR(50) DEFAULT 'BigQuery' AFTER tech_key")
            except Exception as e:
                if "Duplicate column name" not in str(e): raise e

            # 2. Define the metrics map (Code, Libelle, Unite, Univers, TechKey, SourceDB)
            metrics = [
                # PERFORMANCE (BigQuery PVCP)
                ('CA', 'Chiffre d\'Affaires', 'EUR', 'PERF', 'chiffre_affaire', 'BigQuery (Perf)'),
                ('VENTES', 'Nombre de ventes', 'nb', 'PERF', 'nb_ventes', 'BigQuery (Perf)'),
                ('APPELS', 'Nombre d\'appels', 'nb', 'PERF', 'nb_appels', 'BigQuery (Perf)'),
                ('PROD_TIME', 'Temps de production', 'min', 'PERF', 'temps_production', 'BigQuery (Perf)'),
                ('TALK_TIME', 'Temps d\'appel', 'min', 'PERF', 'temps_appel', 'BigQuery (Perf)'),
                ('CONV', 'Taux de Conversion', '%', 'PERF', 'taux_conversion', 'BigQuery (Perf)'),
                ('CSAT', 'Score CSAT', 'nb', 'PERF', 'csat', 'BigQuery (Perf)'),
                ('NB_CSAT', 'Nombre de notes CSAT', 'nb', 'PERF', 'nb_csat', 'BigQuery (Perf)'),
                ('MEA', 'Taux de Mise en Attente', '%', 'PERF', 'tx_mea', 'BigQuery (Perf)'),
                ('DMT', 'Durée Moyenne de Traitement', 'min', 'PERF', 'dmt', 'BigQuery (Perf)'),
                
                # QUALITE (BigQuery EvalPlus)
                ('EVAL_PLUS', 'Note Qualité Globale', '%', 'QUALITE', 'note_globale', 'BigQuery (EvalPlus)'),
                
                # HEURES (MySQL App/Gestionpaie)
                ('HEURE_HT', 'Heures Prévues (HT)', 'h', 'HEURES', 'heure_ht', 'MySQL (gestionpaie)'),
                ('HEURE_HP', 'Heures Produites (HP)', 'h', 'HEURES', 'heure_hp', 'MySQL (gestionpaie)'),
                ('HEURE_HF', 'Heures Formation (HF)', 'h', 'HEURES', 'heure_hf', 'MySQL (gestionpaie)'),
                ('HEURE_HC', 'Heures Complémentaires (HC)', 'h', 'HEURES', 'heure_hc', 'MySQL (gestionpaie)'),
                ('HEURE_TOT', 'Heures Totales', 'h', 'HEURES', 'heure_total', 'MySQL (gestionpaie)'),
                
                # METADATA (BigQuery PVCP)
                ('SRC_TABLE', 'Table Source', 'txt', 'PERF', 'source_table', 'BigQuery (Perf)'),
                ('SNAP_DATE', 'Date Snapshot', 'date', 'PERF', 'snapshot_date', 'BigQuery (Perf)'),
                ('PROC_AT', 'Date Traitement', 'date', 'PERF', 'processed_at', 'BigQuery (Perf)'),
            ]

            print("Updating/Inserting metrics...")
            for code, libelle, unite, univers, tech_key, source_db in metrics:
                sql = """
                    INSERT INTO matrice_kpis (code, libelle, unite, univers, tech_key, source_db)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE 
                        libelle = VALUES(libelle),
                        unite = VALUES(unite),
                        univers = VALUES(univers),
                        tech_key = VALUES(tech_key),
                        source_db = VALUES(source_db)
                """
                cursor.execute(sql, (code, libelle, unite, univers, tech_key, source_db))

            connection.commit()
            print("Migration successful.")
    except Exception as e:
        print(f"Migration failed: {e}")
        connection.rollback()
    finally:
        connection.close()

if __name__ == "__main__":
    migrate()
