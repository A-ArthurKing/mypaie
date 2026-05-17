# ⚙️ Documentation : Façade SIRH Externe (`sirh_provider.py`)

## 📍 Rôle du fichier
Le fichier `sirh_provider.py` est la **seconde Façade (Alias de ré-exportation)** du module `agents`.

Il isole complètement la logique de communication avec la base de données SQL Server externe (le vrai logiciel RH de l'entreprise). Ce fichier n'exporte actuellement qu'une seule fonction depuis son implémentation `sirh_agents_provider.py`.

---

## 🧠 Principes & Logique de conception

### 1. Isolation de la source externe
Il est vital de séparer ce qui est **Local** (les employés saisis à la main dans MyPaie) de ce qui est **Externe** (les employés synchronisés depuis le SQL Server officiel de la boîte).
En utilisant la façade `sirh_provider.py`, les autres scripts (comme un script de synchronisation nocturne `sync_agents_nightly.py`) savent de manière évidente qu'ils sont en train d'importer de la donnée fraîche depuis la source de vérité de l'entreprise.

### 2. Anticiper les changements d'API
Si un jour l'entreprise décide de changer son SIRH (passer d'un SQL Server "maison" à un logiciel Cloud externe comme Workday ou Lucca) :
- Le développeur créera un `workday_api_provider.py`.
- Il mettra à jour l'import de cette façade.
- Tout le reste du backend MyPaie continuera de fonctionner sans savoir que la base de données sous-jacente a totalement changé. C'est la beauté du pattern Façade.

---

## 📂 Fonctions Ré-exposées

Pour le moment, il n'y a qu'une seule fonction :

1. **`get_agents_sirh`** 
   - *Rôle originel :* Va taper sur les tables `sirh_poste`, `sirh_employ`, `sirh_business`, etc. via une connexion SQL Server, et ramène les profils officiels filtrés par projets/opérations.

---

## 🛠️ Comment utiliser ou gérer ce fichier ?

### Cas d°1 : Vous créez une nouvelle requête SIRH
Imaginons que vous développiez une fonction pour vérifier les arrêts maladie officiels depuis le SIRH, dans le fichier `sirh_agents_provider.py` : `get_absences_sirh(...)`.

Il suffira de l'ajouter ici :
```python
from modules.agents.services.sirh_agents_provider import ( # noqa: F401
    get_agents_sirh,
    get_absences_sirh, # <== Ajouté ici
)
```

### Cas d°2 : Consommation dans un script
```python
# Un exemple clair d'utilisation conjointe des deux façades
from modules.agents.services.sirh_provider import get_agents_sirh
from modules.agents.services.agents_provider import add_agent

def import_nouveaux_employes():
    # 1. On lit la base externe
    nouveaux_agents_externes = get_agents_sirh()
    
    # 2. On les injecte dans notre base locale MyPaie
    for agent in nouveaux_agents_externes:
        add_agent(agent['matricule'], agent['nom'], agent['prenom'], ...)
```
