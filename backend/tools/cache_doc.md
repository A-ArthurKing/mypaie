# ⚙️ Documentation : Système de Cache en Mémoire (`cache.py`)

## 📍 Rôle du fichier
Le fichier `cache.py` (situé dans `tools/`) est un petit moteur d'optimisation des performances de MyPaie.

C'est un système de **Mise en cache en RAM (Mémoire Vive)** avec une notion de **TTL (Time To Live = Durée de vie)**. 
Son objectif est de soulager l'infrastructure (BigQuery et MySQL) et de rendre l'application ultra-réactive pour les utilisateurs, en gardant en mémoire le résultat des requêtes SQL lourdes qui ne changent pas toutes les secondes.

---

## 🧠 Principes & Logique de conception

### 1. Cache en Mémoire Interne (RAM)
Contrairement aux grosses architectures qui utilisent des serveurs externes dédiés (comme Redis ou Memcached), ce fichier utilise un simple dictionnaire Python (`_store = {}`).
- **Avantage :** Vitesse absolue. Pas de latence réseau pour aller chercher le cache. Zéro configuration d'infrastructure nécessaire.
- **Inconvénient / Comportement :** Si l'application Flask est redémarrée (ou que le backend crash), le cache est instantanément perdu. S'il y a plusieurs processus/workers Flask en parallèle (via Gunicorn/uWSGI), chaque processus aura *son propre cache*. (Dans le cadre actuel de MyPaie, cette limitation est acceptable).

### 2. Le concept de TTL (Time To Live) et `time.monotonic()`
Lorsqu'une donnée est sauvegardée en cache, on lui attribue une durée de vie en secondes. Le système calcule l'heure exacte à laquelle elle devra "mourir".
Le fichier utilise intelligemment `time.monotonic()` (qui compte les secondes depuis le démarrage du système d'exploitation) plutôt que `time.time()` (qui donne l'heure de l'horloge système). Cela garantit que le cache ne buguera jamais, même si le serveur passe à l'heure d'hiver ou d'été pendant la mise en cache.

### 3. Nettoyage Passif (Lazy Expiration)
Le système n'a pas de tâche de fond qui tourne en permanence pour supprimer les données périmées. Il utilise une approche "paresseuse" : c'est uniquement lorsque quelqu'un demande une clé (`get_cached`) que le système vérifie si elle est expirée. Si c'est le cas, il la supprime à ce moment-là et retourne `None`.

---

## 📂 Fonctions Exposées

1. **`set_cached(key: str, value, ttl: int)`**
   - Stocke n'importe quel objet Python (`value`) sous un nom (`key`) avec une durée de vie (`ttl` en secondes).

2. **`get_cached(key: str)`**
   - Vérifie si la clé existe et est toujours en vie. Si oui, retourne l'objet. Si non (ou périmée), retourne `None`.

3. **`invalidate(key: str)`**
   - Force la suppression immédiate d'une clé.
   - *Cas d'usage massif :* Utilisée par `reference_provider.py` à chaque fois qu'un admin ajoute/supprime un projet ou un KPI, pour forcer toute l'entreprise à retélécharger le référentiel à jour.

4. **`clear_all()`**
   - Vide le dictionnaire `_store`. Utile pour les routes d'administration type "Purger tout le cache".

---

## 🛠️ Comment utiliser cet outil ?

Ce module est typiquement utilisé dans un Provider qui interroge la base de données.

Exemple typique (Pattern d'hydratation du cache) :

```python
from tools.cache import get_cached, set_cached

def get_liste_pays():
    cache_key = "referentiel:pays"
    
    # 1. On regarde si on l'a déjà en mémoire
    resultat = get_cached(cache_key)
    
    # 2. Si on l'a (Cache HIT), on le renvoie instantanément
    if resultat is not None:
        return resultat
        
    # 3. Si on ne l'a pas (Cache MISS), on va le chercher sur la BDD
    conn = ouvrir_connexion_bdd()
    resultat = conn.execute("SELECT nom FROM pays")
    
    # 4. On le stocke en mémoire pour les 3600 prochaines secondes (1 Heure)
    set_cached(cache_key, resultat, ttl=3600)
    
    return resultat
```
De cette façon, la première personne qui ouvre l'application déclenche le "SELECT", et pendant une heure, toutes les personnes suivantes auront la réponse en une milliseconde !
