# Normes de Nommage des Fichiers DataWeave

## 📜 Philosophie du Nommage
Dans une architecture à grande échelle (Grand Scale), le nom d'un fichier doit immédiatement refléter son **action**, son **sujet** et son **contexte**. Cela élimine toute ambiguïté lors de la navigation dans le projet.

Le préfixe global **`dw_`** (DataWeave) est utilisé pour identifier les composants officiels de la plateforme.

## 🛠️ Structure du Nom
Le format standard est :
**`dw_[Action]_[Sujet]_[Contexte].py`**

### 1. [Action] — Que fait le script ?
- **`ingest_`** : Récupère des données de sources externes.
- **`identify_`** : Analyse et découvre des structures de données.
- **`clean_`** : Transforme des données brutes (Dirty) en données traitées (Clean).
- **`api_`** : Sert des données via des points d'entrée HTTP.
- **`admin_`** : Tâches d'administration et de maintenance du système.

### 2. [Sujet] — Sur quoi porte l'action ?
- **`pvcp`**, **`orange`**, **`gta`** : Nom d'un client ou d'un outil source.
- **`heures`**, **`performance`** : Domaine métier.
- **`mapping_rules`** : Configuration technique.

### 3. [Contexte] — Où se situe-t-il dans le flux ?
- **`source`** / **`raw`** : Données brutes entrantes.
- **`endpoint`** : Route API finale.
- **`provider`** : Service de fourniture de données.
- **`logic`** : Cœur de transformation algorithmique.

---

## 📂 Exemples de Mapping

| Type de Composant | Convention | Exemple |
| :--- | :--- | :--- |
| **Ingestion** | `dw_ingest_[Source]_raw_source.py` | `dw_ingest_pvcp_raw_source.py` |
| **Orchestration** | `dw_clean_dirty_data.py` | `dw_clean_dirty_data.py` |
| **Découverte** | `dw_identify_dirty_sources.py` | `dw_identify_dirty_sources.py` |
| **API Endpoint** | `dw_api_[Domaine]_endpoint.py` | `dw_api_heures_endpoint.py` |
| **Service Data** | `dw_api_[Domaine]_provider.py` | `dw_api_heures_provider.py` |
| **Connecteur Tech**| `dw_api_[Tech]_connector.py` | `dw_api_bigquery_connector.py` |

## 🚀 Bénéfices Scalables
1. **Recherche Facilitée** : Une recherche `dw_ingest` liste tous les flux d'entrée.
2. **Auto-explicatif** : Le rôle de chaque fichier est clair sans ouvrir le code.
3. **Zéro Tautologie** : Évite les noms comme `transcribe/transcriber.py`.
