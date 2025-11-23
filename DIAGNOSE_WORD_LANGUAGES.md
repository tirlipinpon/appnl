# Diagnostic des langues inversées dans les mots

## Problème

Pour certaines leçons, les mots affichent les langues inversées (français à la place du néerlandais et vice versa).

## Causes possibles

1. **Données inversées dans la base de données** : Les valeurs dans les colonnes `french_text` et `dutch_text` sont inversées lors de l'insertion
2. **Problème lors de la création** : Les valeurs ont été saisies dans les mauvais champs du formulaire

## Solution

### Étape 1 : Diagnostiquer le problème

1. Ouvrez Supabase Dashboard → SQL Editor
2. Exécutez le script `diagnose-word-languages.sql`
3. Comparez les résultats entre la leçon qui fonctionne (`00000000-0000-0000-0000-000000000001`) et celle qui a un problème

### Étape 2 : Vérifier les données

Regardez les résultats de la requête. Si vous voyez que :
- Les mots de la leçon problématique ont des valeurs qui semblent être dans la mauvaise colonne
- Par exemple : un mot français dans `dutch_text` et un mot néerlandais dans `french_text`

Alors les données sont inversées dans la base de données.

### Étape 3 : Corriger les données

**Option A : Corriger un mot spécifique**

```sql
UPDATE nlapp_words
SET 
  french_text = dutch_text,
  dutch_text = french_text
WHERE id = 'WORD_ID_ICI';
```

**Option B : Corriger tous les mots d'une leçon**

⚠️ **ATTENTION** : Utilisez cette requête uniquement si vous êtes sûr que TOUS les mots de la leçon sont inversés !

```sql
UPDATE nlapp_words
SET 
  french_text = dutch_text,
  dutch_text = french_text
WHERE lesson_id = 'efeb5d2c-3e15-4055-8de2-a3d746b3412b';
```

### Étape 4 : Vérifier la correction

Après avoir corrigé les données, rechargez votre application et vérifiez que les mots s'affichent correctement.

## Prévention

Pour éviter ce problème à l'avenir :

1. **Vérifiez toujours les données** après avoir créé des mots via l'interface d'administration
2. **Testez une leçon** immédiatement après avoir ajouté des mots
3. **Utilisez des exemples clairs** : Par exemple, "Bonjour" (français) et "Hallo" (néerlandais) pour vérifier que les langues sont correctes

## Vérification dans l'interface

Dans l'interface d'administration (`/admin/words`), vérifiez que :
- La colonne "Français" affiche bien des mots français
- La colonne "Néerlandais" affiche bien des mots néerlandais

Si vous voyez que c'est inversé dans l'interface d'administration, alors les données dans la base de données sont inversées.

