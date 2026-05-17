# ⚙️ Documentation : Service des Agents (`agents_data_provider.py`)

## 📍 Rôle du fichier
Le fichier `agents_data_provider.py` est le **Service métier** responsable de la base de données des collaborateurs dans MySQL (`ref_employes` et ses tables liées).

C'est ici qu'on gère le "SIRH local" (Système d'Information RH) de l'application : l'ajout d'un nouvel agent, l'affectation à un projet/opération spécifique, et la gestion des "statuts" (Période d'essai, CDD, Confirmé) qui ont un impact direct sur le calcul de sa prime.

---

## 🧠 Principes & Logique de conception

### 1. Jointure "Cerveau"
Pour ne pas stocker en dur "Projet X" ou "Opération Y" sur le profil de l'employé, on stocke un `id_structure`.
Quand le système lit un employé (ex: `get_all_agents_gestion()`), il fait un gros `LEFT JOIN` avec `ref_structure_map` (l'arbre de structure) pour reconstituer dynamiquement toute la hiérarchie de l'agent.

### 2. Le cache par Invalidation Globale
Ce fichier utilise la clé de cache `agents:gestion` (TTL de 5 minutes). 
Mais contrairement à d'autres caches de l'application, ce service fait de l'**invalidation préventive**. À la toute fin des requêtes d'`update_agent`, `add_agent` ou `delete_agent`, la commande `invalidate(_CACHE_KEY_AGENTS)` est exécutée. Ainsi, on est certain que le cache ne proposera jamais de données périmées après une modification RH.

### 3. La Surcouche "Gestion Manuelle"
La fonction `save_agent_manual_data()` est très intéressante : elle écrit dans `matrice_primes_agents_gestion`. 
Cela permet à un manager, pour un mois donné et une prime donnée, de cocher une case "Sanction" (qui annule la prime) ou de forcer un statut différent pour un agent, sans que cela modifie définitivement la fiche RH globale de l'employé. Le SQL utilise ici un astucieux `ON DUPLICATE KEY UPDATE` pour gérer la création ou la modification en une seule passe.

---

## 📂 Fonctions Exposées

1. **Général (Annuaire de l'entreprise)**
   - `get_all_agents_gestion()` : Lit tous les employés de la boîte.
   - `add_agent(...)`, `update_agent(...)`, `delete_agent(...)` : Gère le CRUD.
   - `update_agent_global_statut(...)` : Mise à jour rapide (Fast-Patch) du contrat/statut.

2. **Spécifique à une prime (Règle d'exception)**
   - `get_agents_manual_data(matrice_id)` : Lit les exceptions (sanctions, forçage) pour une règle précise.
   - `save_agent_manual_data(...)` : Sauvegarde ou met à jour une de ces exceptions.

---

## 🛠️ Comment ajouter un champ RH ?

Demain, on décide d'ajouter un champ `prime_anciennete` dans la fiche de l'employé.

1. Ajoutez la colonne `prime_anciennete DECIMAL(10,2)` dans la table MySQL `ref_employes`.
2. Mettez à jour la fonction `add_agent` et `update_agent` :
```python
def add_agent(matricule: str, nom: str, prenom: str, id_structure: int, prime_anciennete: float = 0):
    # [...]
            sql_insert = """
                INSERT INTO ref_employes (matricule, nom, prenom, id_structure, prime_anciennete)
                VALUES (%s, %s, %s, %s, %s) # <== Ne pas oublier de rajouter un %s
            """
            cursor.execute(sql_insert, (matricule, nom, prenom, id_structure, prime_anciennete))
```
3. Mettez à jour la grosse requête SQL dans `get_all_agents_gestion` pour que le frontend le reçoive :
```sql
                SELECT 
                    e.matricule, e.nom, e.prenom,
                    e.prime_anciennete, -- <== Ajouté ici
                    p.nom as projet,
```
