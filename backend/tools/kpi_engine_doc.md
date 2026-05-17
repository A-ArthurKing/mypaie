# ⚙️ Documentation : Moteur de KPIs Virtuels (`kpi_engine.py`)

## 📍 Rôle du fichier
Le fichier `kpi_engine.py` (situé dans le dossier `tools/`) est un composant stratégique : c'est un **interpréteur mathématique sécurisé**.

Il permet aux administrateurs (côté frontend) d'écrire des formules mathématiques impliquant plusieurs indicateurs bruts (ex: `[NB_VENTES] / [HEURE_TOTAL] * 100`) et de calculer le résultat dynamiquement pour chaque agent sans jamais écrire une seule ligne de code Python ou SQL.

---

## 🧠 Principes & Logique de conception

### 1. La syntaxe des Crochets `[TAG]`
La fonction `evaluate_formula` lit une chaîne de caractères (String) comme : `([CHIFFRE_AFFAIRE] - [REMBOURSEMENTS]) / [NB_APPELS]`.
Grâce aux expressions régulières (RegEx) `r'\[(.*?)\]'`, elle extrait tous les mots entre crochets. Elle va ensuite chercher la valeur correspondante dans un dictionnaire de données réelles (le `context`) pour remplacer le texte par le chiffre.

### 2. La Récursivité (L'effet "Poupées Russes")
L'intelligence de ce moteur réside dans sa récursivité. 
Imaginons que l'administrateur crée le KPI Virtuel `[TAUX_TRANSFO]` défini par `[NB_VENTES] / [NB_APPELS]`.
S'il crée ensuite un deuxième KPI Virtuel `[BONUS_TRANSFO]` défini par `[TAUX_TRANSFO] * 10`.

Quand le système calcule le `[BONUS_TRANSFO]`, l'outil voit que le tag `[TAUX_TRANSFO]` n'est pas une donnée brute, mais un autre KPI Virtuel. Il "pause" donc son calcul, s'appelle lui-même (`evaluate_formula`) pour résoudre `[TAUX_TRANSFO]`, puis reprend son calcul global.
*(Une sécurité `depth > 5` empêche le programme de tourner à l'infini si deux formules s'appellent l'une l'autre par erreur).*

### 3. La Sécurité Absolue de `eval()`
Le moteur utilise la fonction native Python `eval()` pour résoudre l'équation finale (ex: `eval("42 / 2 * 100")`).
Cette fonction est **extrêmement dangereuse** car si un pirate injecte `import os; os.system("rm -rf /")` dans la formule, `eval()` l'exécuterait. 
Pour se protéger de ça, ce fichier implémente **une double barrière blindée** :
1. **Filtre Regex :** `_SAFE_MATH_RE` vérifie que la chaîne finale ne contient **que** des chiffres, des espaces et les symboles `+ - * / ( )`. Aucune lettre de l'alphabet n'a le droit d'arriver jusqu'à `eval`.
2. **Contexte Vide :** Le système appelle `eval(..., {"__builtins__": {}}, {})`. Cela prive `eval` de toutes ses fonctions Python dangereuses. Il ne sait plus faire que des maths.

---

## 📂 Fonctions Exposées

1. **`evaluate_formula(formula, context, kpis_registry, depth)`**
   - *Rôle :* Le moteur de parsing et d'exécution sécurisée détaillé ci-dessus. Gère proprement les divisions par zéro (renvoie `0.0`).

2. **`get_kpi_registry()`**
   - *Rôle :* Va chercher tous les KPIs configurés (Natif ou Virtuel) dans la table MySQL `config_kpis`. C'est grâce à ça que l'outil connaît les "formules" associées à chaque TAG pour la récursivité.

---

## 🛠️ Comment l'utiliser ?

Généralement, c'est le **Cerveau Unifié** (`kpi_unified_resolver.py`) qui appelle cet outil une fois par mois lors du calcul des primes, en lui donnant le dictionnaire `context` contenant toutes les données de BigQuery de l'agent.

Exemple de fonctionnement interne :
```python
# 1. On charge le registre des formules configurées en base de données
registry = get_kpi_registry() 
# Contient: { "TAUX_CONV": {"type": "VIRTUAL", "formule": "([VENTES]/[APPELS])*100"} }

# 2. Le resolveur nous donne les chiffres réels de l'agent
context = { "VENTES": 50, "APPELS": 100 }

# 3. On appelle le moteur
resultat = evaluate_formula("[TAUX_CONV]", context, registry)
# > La RegEx trouve VENTES, remplace par 50
# > La RegEx trouve APPELS, remplace par 100
# > La chaîne devient "(50/100)*100"
# > Le filtre de sécurité dit OK
# > L'eval() renvoie 50.0

print(resultat) # Affiche 50.0
```
