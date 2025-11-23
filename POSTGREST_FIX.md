# Solution au problème PostgREST "relation does not exist"

## Problème

PostgREST retourne l'erreur `"relation \"public.nlapp_lessons\" does not exist"` même si les tables existent dans la base de données.

## Cause

PostgREST (l'API REST de Supabase) n'a pas rechargé son cache de schéma après la création des tables. C'est un problème temporaire.

## Solution : Redémarrer le projet Supabase

**C'est la seule solution fiable pour forcer PostgREST à recharger son cache.**

### Étapes :

1. **Allez sur le dashboard Supabase** : https://supabase.com/dashboard
2. **Sélectionnez votre projet** : `zmgfaiprgbawcernymqa`
3. **Allez dans Settings** (⚙️ en bas à gauche)
4. **Cliquez sur "General"** dans le menu de gauche
5. **Faites défiler jusqu'à "Danger Zone"**
6. **Cliquez sur "Restart project"** ou **"Pause project" puis "Resume project"**
7. **Attendez 1-2 minutes** que le projet redémarre

### Alternative : Pause/Resume

Si vous ne trouvez pas "Restart", vous pouvez :

1. **Pause project** (mettre en pause)
2. Attendre 10 secondes
3. **Resume project** (reprendre)

Cela forcera PostgREST à recharger son cache.

## Vérification

Après le redémarrage, testez l'API REST :

```bash
curl -X GET \
  'https://zmgfaiprgbawcernymqa.supabase.co/rest/v1/nlapp_lessons?select=*' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZ2ZhaXByZ2Jhd2Nlcm55bXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ2NTc0MjEsImV4cCI6MjA0MDIzMzQyMX0.sBq7sR7JhRZCg36xvt13yt_f398oWbHUfdUwa9yoox0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZ2ZhaXByZ2Jhd2Nlcm55bXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ2NTc0MjEsImV4cCI6MjA0MDIzMzQyMX0.sBq7sR7JhRZCg36xvt13yt_f398oWbHUfdUwa9yoox0"
```

Vous devriez recevoir les 3 leçons au lieu d'une erreur.

## Note importante

- ✅ Les tables existent bien dans la base de données (vérifié)
- ✅ Les permissions sont correctes (vérifié)
- ✅ Les tables sont dans la vue `_postgrest_tables` (vérifié)
- ❌ PostgREST n'a simplement pas rechargé son cache

**Le redémarrage du projet est la seule solution pour forcer PostgREST à recharger.**

## L'application Angular fonctionne-t-elle ?

L'application Angular utilise le client Supabase JavaScript qui peut parfois contourner ce problème. Testez l'application même sans redémarrer :

```bash
cd nlapp
ng serve
```

Si l'application fonctionne, vous pouvez continuer à l'utiliser. Le redémarrage résoudra définitivement le problème pour l'API REST directe.
