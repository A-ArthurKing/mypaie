# Logique de calcul de l'Assiduité (Calendrier)

Ce document détaille les sources de données, les requêtes SQL et la logique métier utilisées pour générer le calendrier d'assiduité d'un agent.

## 1. Sources de Données

Les données proviennent de la base **GestionPaie** (MySQL externe) via deux tables principales :

*   **`heures_corrigees`** : Contient le planning (`heure_hp`), les heures travaillées validées (`heure_ht`), le type de congé et les commentaires (ex: FERIE, DO).
*   **`heures_ecart`** : Contient les anomalies et événements spécifiques via des codes écaert.

| Code Écart | Signification |
| :--- | :--- |
| **1** | Retard |
| **2** | Absence (Justifiée) |

---

## 2. Requêtes SQL Principales

### A. Récupération du Planning et Pointage
```sql
SELECT  `date`,
        COALESCE(heure_hp,   '00:00:00') AS heure_hp,
        COALESCE(heure_ht,   '00:00:00') AS heure_ht,
        COALESCE(TYPE_CONGE,  'NONE')    AS type_conge,
        COALESCE(Commentaire, 'NONE')    AS commentaire
FROM    heures_corrigees
WHERE   matricule  = :matricule
  AND   `date`    >= :date_debut
  AND   `date`    <= :date_fin
  AND   deleted_at IS NULL;
```

### B. Récupération des Écarts (Retards/Absences)
```sql
SELECT  `date`, code_ecart
FROM    heures_ecart
WHERE   matricule  = :matricule
  AND   `date`    >= :date_debut
  AND   `date`    <= :date_fin
  AND   deleted_at IS NULL;
```

---

## 3. Logique de Classification (par jour)

Pour chaque jour du mois, le système applique la priorité suivante pour déterminer le **Statut** :

| Priorité | Condition SQL / Logique | Statut Résultant |
| :--- | :--- | :--- |
| 1 | `commentaire == 'FERIE'` | **FERIE** |
| 2 | `commentaire == 'DO'` ou `heure_hp == '00:00:00'` | **DO** (Repos) |
| 3 | `type_conge` dans `[CP, CSS, C.MAT, ...]` | **CONGE** |
| 4 | `heure_ht > '00:00:00'` | **TRAVAILLE** |
| 5 | `code_ecart == 2` | **ABS_JUST** |
| 6 | Par défaut (si planning présent mais pas de travail) | **ABS_INJUST** |

---

## 4. Détail des Absences et Retards

### A. Les Absences
Le système distingue deux types d'absences selon leur origine dans GestionPaie :

*   **Absence Justifiée (`ABS_JUST`)** : 
    - **Source** : Table `heures_ecart`.
    - **Détection** : Présence du code `2` pour la date donnée. 
    - **Affichage** : Apparaît en bleu dans le calendrier.

*   **Absence Injustifiée (`ABS_INJUST`)** : 
    - **Source** : Table `heures_corrigees` (manque de pointage).
    - **Détection** : L'agent a un planning (`heure_hp > 0`) mais n'a aucune heure travaillée (`heure_ht = 0`) et aucun code d'absence ou de congé n'est présent.
    - **Affichage** : Apparaît en rouge dans le calendrier.

### B. Les Retards
*   **Source** : Table `heures_ecart`.
*   **Détection** : Présence du code `1`.
*   **Particularité** : Contrairement aux absences, le retard ne change pas le statut de la journée (elle reste `TRAVAILLE`). Il ajoute simplement un indicateur visuel (badge "R").

---

## 5. Formules des Statistiques (Stats Chips)

| Statistique | Formule de calcul |
| :--- | :--- |
| **Jours Ouvrés** | Nombre de jours où `statut` n'est pas `DO`, `FERIE` ou `HORS_PLANNING`. |
| **Jours Travaillés** | Nombre de jours avec `statut == 'TRAVAILLE'`. |
| **Retards** | Nombre de jours avec `code_ecart == 1`. |
| **Absences Injust.** | Nombre de jours avec `statut == 'ABS_INJUST'`. |
| **Absences Just.** | Nombre de jours avec `statut == 'ABS_JUST'`. |
| **Congés (CP/CSS)** | Nombre de jours avec `statut == 'CONGE'`. |

---

## 5. Fallback Local (Mode Hors-Connexion)

Si **GestionPaie** est inaccessible, le système bascule sur la table locale `assiduite_mensuelle` :

```sql
SELECT jours_ouvres, jours_travailles, cp_css, retard, abs_justifie, abs_injustifie
FROM   assiduite_mensuelle
WHERE  matricule = :matricule AND mois = :mois;
```
*Dans ce mode, le détail jour par jour n'est pas disponible, seules les stats globales sont affichées.*
