# Test de l'API REST Supabase

## Problème : "relation does not exist"

Si vous obtenez cette erreur, voici comment tester et résoudre :

## 1. Test avec curl (depuis le terminal)

```bash
# Test de l'API REST avec les bons headers
curl -X GET \
  'https://zmgfaiprgbawcernymqa.supabase.co/rest/v1/nlapp_lessons?select=*&order=order_index.asc' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZ2ZhaXByZ2Jhd2Nlcm55bXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ2NTc0MjEsImV4cCI6MjA0MDIzMzQyMX0.sBq7sR7JhRZCg36xvt13yt_f398oWbHUfdUwa9yoox0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZ2ZhaXByZ2Jhd2Nlcm55bXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ2NTc0MjEsImV4cCI6MjA0MDIzMzQyMX0.sBq7sR7JhRZCg36xvt13yt_f398oWbHUfdUwa9yoox0"
```

## 2. Vérification dans le dashboard Supabase

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **Table Editor**
4. Vérifiez que les tables `nlapp_*` sont visibles
5. Allez dans **API** → **REST**
6. Testez une requête depuis l'interface

## 3. Si le problème persiste

Le problème peut venir de :
- PostgREST qui doit être rechargé (attendre 1-2 minutes)
- Les tables ne sont pas dans le schéma `public` (vérifié - elles y sont)
- Les permissions ne sont pas correctes (vérifié - elles sont correctes)

## 4. Solution alternative : Utiliser directement le client Supabase

L'application Angular utilise déjà le client Supabase JavaScript qui fonctionne correctement. Le problème pourrait être uniquement lors de l'accès direct à l'API REST.

## 5. Vérifier les logs Supabase

1. Allez dans **Logs** → **API Logs**
2. Vérifiez les erreurs récentes
3. Cherchez les erreurs liées à `nlapp_lessons`

