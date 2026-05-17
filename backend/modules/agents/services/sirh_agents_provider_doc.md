# ⚙️ Documentation : Service SIRH Externe (`sirh_agents_provider.py`)

## 📍 Rôle du fichier
Le fichier `sirh_agents_provider.py` est le service d'intégration avec le **Système d'Information des Ressources Humaines (SIRH)** officiel de l'entreprise.

Contrairement aux autres providers qui interrogent MySQL (applicatif) ou BigQuery (data warehouse), ce fichier se connecte à une base de données **Microsoft SQL Server**. Son rôle est exclusivement de faire de la **lecture (Read-Only)** pour synchroniser ou récupérer les vrais matricules, noms, prénoms et affectations opérationnelles des employés de l'entreprise.

---

## 🧠 Principes & Logique de conception

### 1. Structure Base de données SIRH
La requête SQL montre que le SIRH d'origine a une structure très éclatée (en étoile / flocon). Le fichier fait de nombreuses jointures (`LEFT JOIN`) pour reconstruire un profil lisible :
- `sirh_poste` (La table centrale pivot d'affectation)
- `sirh_employ` (Les infos de l'employé : matricule, nom)
- `sirh_business` (L'opération ou le projet, appelé "libel_bus")
- `sirh_service` et `sirh_fonction` (Fonctions et services, non renvoyés au front actuellement mais utiles pour un filtrage futur).

> *Note de casting :* Un `CAST(... AS VARCHAR(50))` est utilisé dans la jointure entre le poste et l'employé pour prévenir les erreurs classiques de type (ex: un entier vs un varchar) fréquentes sur les anciennes bases SQL Server.

### 2. Le double système de filtrage
La fonction principale s'adapte à deux besoins différents :
- **`operations_list` (Le plus précis) :** Si on passe une liste explicite comme `['Ventes Entrantes', 'SAV']`, la requête utilisera une clause `IN (?, ?)` pour ramener exactement les employés affectés à ces opérations. C'est utilisé lors du mapping précis d'une Règle de Prime.
- **`projet_filter` (Filtre textuel) :** Si on passe une chaîne (ex: `"pvcp"`), la requête utilisera un simple `LIKE '%pvcp%'` pour chercher largement dans le nom de l'opération. 

### 3. Nettoyage post-récupération
SQL Server retourne parfois des types bizarres (comme des types `UUID`, des entiers `Decimal`, ou carrément des `None` pour des chaînes vides).
Avant de renvoyer le dictionnaire Python, la liste de compréhension finale convertit tout proprement en chaînes de caractères (`str()`) et retire les espaces superflus avec `.strip()`.

---

## 📂 Fonction Exposée

1. **`get_agents_sirh(projet_filter, operations_list) -> list`**
   - *Rôle :* Récupère la liste des agents depuis SQL Server selon le filtre passé.
   - *Exemple de sortie :*
     ```json
     [
       {
         "matricule": "12345",
         "prenom": "Jean",
         "nom": "DUPONT",
         "operation": "Ventes Inbound"
       }
     ]
     ```

---

## 🛠️ Comment ajouter un nouveau champ RH ?

Si vous souhaitez importer la "Date d'embauche" de l'agent depuis le SIRH pour, par exemple, calculer une prime d'ancienneté dans MyPaie :

1. **Modifier la requête SQL** (Si le champ `date_emb` est dans `sirh_employ`) :
```sql
                SELECT
                    e.Ref_employ   AS matricule,
                    e.firstname    AS prenom,
                    e.lastname     AS nom,
                    e.date_emb     AS date_embauche, -- <== Ajouter la colonne
                    b.libel_bus    AS operation,
```

2. **Formater le retour Python** :
```python
            return [
                {
                    "matricule":     str(r.get("matricule") or "").strip(),
                    "prenom":        str(r.get("prenom")    or "").strip(),
                    "nom":           str(r.get("nom")       or "").strip(),
                    "operation":     str(r.get("operation") or "").strip(),
                    # Gérer la date (convertir datetime en string ISO)
                    "date_embauche": r.get("date_embauche").isoformat() if r.get("date_embauche") else None
                }
                for r in rows
            ]
```
Vous pourrez ensuite utiliser cette nouvelle donnée `date_embauche` dans d'autres parties de l'application (par exemple pour remplir la base `ref_employes` de MySQL lors d'une synchronisation).
