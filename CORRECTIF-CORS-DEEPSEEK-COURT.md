# Correctif CORS DeepSeek - Version Courte

## Problème
L'API DeepSeek (`https://api.deepseek.com/v1/chat/completions`) bloque les appels CORS depuis le navigateur. Erreur : "No 'Access-Control-Allow-Origin' header".

## Solution : Proxy Supabase Edge Function

### 1. Créer `supabase/functions/deepseek-proxy/index.ts` :
```typescript
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  try {
    const requestBody = await req.json()
    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!deepseekResponse.ok) {
      let errorData = {}
      try {
        errorData = await deepseekResponse.json()
      } catch {
        errorData = { error: await deepseekResponse.text() }
      }
      return new Response(
        JSON.stringify({ 
          error: `DeepSeek API Error: ${deepseekResponse.status} ${deepseekResponse.statusText}`,
          details: errorData 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: deepseekResponse.status }
      )
    }

    const data = await deepseekResponse.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
```

### 2. Déployer :
```bash
supabase functions deploy deepseek-proxy --project-ref VOTRE_PROJECT_REF
supabase secrets set DEEPSEEK_API_KEY=VOTRE_CLE_API --project-ref VOTRE_PROJECT_REF
```

### 3. Modifier le frontend :
**Remplacer :**
```typescript
fetch('https://api.deepseek.com/v1/chat/completions', { ... })
```

**Par :**
```typescript
fetch(`${SUPABASE_URL}/functions/v1/deepseek-proxy`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    // Optionnel si utilisateur connecté :
    // 'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [...]
  })
})
```

**Résultat :** Plus d'erreur CORS, clé API sécurisée côté serveur.

