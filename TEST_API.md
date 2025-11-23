# Test de l'API REST Supabase

## Problème persistant

Même après le redémarrage du projet Supabase, PostgREST retourne toujours l'erreur `"relation \"public.nlapp_lessons\" does not exist"`.

## Vérifications effectuées

✅ Les 6 tables `nlapp_*` existent dans la base de données  
✅ Les tables sont dans le schéma `public`  
✅ Les permissions sont correctes (anon et authenticated peuvent SELECT)  
✅ Les tables sont dans la vue `_postgrest_tables`  
✅ Les foreign keys sont correctement définies  
✅ Les données sont présentes (3 leçons, 26 mots)

## Solution : Tester l'application Angular

L'application Angular utilise le client Supabase JavaScript qui peut fonctionner même si l'API REST directe échoue. **Testez l'application** :

```bash
cd nlapp
ng serve
```

Puis allez sur http://localhost:4200 et testez :
1. Créer un compte
2. Se connecter
3. Voir le dashboard avec les leçons

## Si l'application Angular fonctionne

Si l'application fonctionne, cela signifie que le client Supabase JavaScript contourne le problème PostgREST. Vous pouvez continuer à utiliser l'application normalement.

## Si l'application Angular ne fonctionne pas

Si l'application ne fonctionne pas non plus, le problème est plus profond. Solutions possibles :

1. **Contacter le support Supabase** - C'est un problème connu avec PostgREST qui nécessite parfois une intervention manuelle
2. **Recréer les tables** - Supprimer et recréer les tables (perte de données)
3. **Vérifier la configuration PostgREST** - Il peut y avoir une configuration spécifique dans Settings → API

## Test direct de l'API REST

Testez avec curl pour voir l'erreur exacte :

```bash
curl -X GET \
  'https://zmgfaiprgbawcernymqa.supabase.co/rest/v1/nlapp_lessons?select=*' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZ2ZhaXByZ2Jhd2Nlcm55bXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ2NTc0MjEsImV4cCI6MjA0MDIzMzQyMX0.sBq7sR7JhRZCg36xvt13yt_f398oWbHUfdUwa9yoox0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZ2ZhaXByZ2Jhd2Nlcm55bXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ2NTc0MjEsImV4cCI6MjA0MDIzMzQyMX0.sBq7sR7JhRZCg36xvt13yt_f398oWbHUfdUwa9yoox0"
```

## Note importante

Le message "Security definer view" sur `_postgrest_tables` est juste un avertissement de sécurité, pas la cause du problème. Vous pouvez l'ignorer ou utiliser "Autofix" dans le dashboard Supabase pour sécuriser la vue.

