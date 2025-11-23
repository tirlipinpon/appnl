# Correction de la colonne fill_in_blank_sentence_fr

## Problème identifié

Les erreurs suivantes apparaissent dans la console :
- `column nlapp_words.fill_in_blank_sentence_fr does not exist` (code: 42703)
- `Could not find the 'fill_in_blank_sentence_fr' column of 'nlapp_words' in the schema cache` (code: PGRST204)

Cela indique que la colonne `fill_in_blank_sentence_fr` n'existe pas dans la base de données ou que PostgREST n'a pas rechargé son cache après l'ajout de la colonne.

## Solution

### Étape 1 : Exécuter le script SQL

1. Ouvrez votre projet Supabase dans le tableau de bord
2. Allez dans l'éditeur SQL (SQL Editor)
3. Ouvrez ou créez une nouvelle requête
4. Copiez-collez le contenu du fichier `fix-french-sentence-column.sql`
5. Exécutez le script (bouton "Run" ou Ctrl+Enter)

### Étape 2 : Vérifier que les colonnes existent

Après l'exécution du script, vous devriez voir un résultat avec deux lignes :
- `fill_in_blank_sentence` (TEXT, nullable)
- `fill_in_blank_sentence_fr` (TEXT, nullable)

### Étape 3 : Attendre le rechargement de PostgREST

**IMPORTANT** : Après l'exécution du script, attendez **5-10 secondes** pour permettre à PostgREST de recharger son cache de schéma.

### Étape 4 : Tester l'application

1. Rechargez votre application Angular
2. Testez un exercice "fill-in-the-blank" en direction "français → néerlandais"
3. Vérifiez dans la console du navigateur qu'il n'y a plus d'erreurs 400 ou 42703
4. Vérifiez que les phrases françaises sont maintenant sauvegardées et récupérées depuis la base de données

## Vérification manuelle dans Supabase

Si vous voulez vérifier manuellement que les colonnes existent :

```sql
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'nlapp_words'
  AND column_name IN ('fill_in_blank_sentence', 'fill_in_blank_sentence_fr')
ORDER BY column_name;
```

## Si le problème persiste

Si après avoir exécuté le script le problème persiste :

1. **Vérifiez les permissions RLS** : Assurez-vous que les politiques RLS (Row Level Security) permettent la lecture et l'écriture sur la colonne `fill_in_blank_sentence_fr`

2. **Redémarrez PostgREST** : Dans Supabase Dashboard → Settings → API → Restart PostgREST (si disponible)

3. **Vérifiez le schéma** : Assurez-vous que la table `nlapp_words` est bien dans le schéma `public` et non dans un autre schéma

4. **Contactez le support Supabase** : Si le problème persiste, il peut s'agir d'un problème de cache PostgREST qui nécessite une intervention manuelle

## Notes

- La colonne `fill_in_blank_sentence` est utilisée pour les phrases en néerlandais (direction: néerlandais → français)
- La colonne `fill_in_blank_sentence_fr` est utilisée pour les phrases en français (direction: français → néerlandais)
- Les deux colonnes sont optionnelles (nullable) car les phrases sont générées à la demande

