# DeepSeek Proxy Function

Cette fonction Supabase Edge Function sert de proxy pour les appels à l'API DeepSeek, évitant ainsi les problèmes CORS lors des appels depuis le navigateur.

## Déploiement

### Prérequis

1. Installer Supabase CLI :
```bash
npm install -g supabase
```

2. Se connecter à votre projet Supabase :
```bash
supabase login
```

3. Lier votre projet local à votre projet Supabase :
```bash
supabase link --project-ref piaahwlfyvezdfnzoxeb
```

### Configuration de la clé API DeepSeek

Avant de déployer, vous devez configurer la variable d'environnement `DEEPSEEK_API_KEY` dans votre projet Supabase :

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **Settings → Edge Functions → Secrets**
4. Ajoutez la variable secrète :
   - Nom : `DEEPSEEK_API_KEY`
   - Valeur : `sk-db6617f690b04336b0469ffa1c6bf839` (ou votre clé API DeepSeek)

### Déploiement

```bash
supabase functions deploy deepseek-proxy
```

### Test local (optionnel)

Pour tester la fonction localement avant de la déployer :

```bash
supabase functions serve deepseek-proxy
```

Puis testez avec :
```bash
curl -X POST http://localhost:54321/functions/v1/deepseek-proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"Hello"}]}'
```

## Utilisation

Une fois déployée, la fonction sera accessible à l'URL :
```
https://piaahwlfyvezdfnzoxeb.supabase.co/functions/v1/deepseek-proxy
```

Le service Angular `DeepSeekService` utilise automatiquement cette fonction au lieu d'appeler directement l'API DeepSeek.

