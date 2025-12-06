# Correctif CORS pour DeepSeek API - Guide Complet

## 🔴 Problème

L'API DeepSeek (`https://api.deepseek.com/v1/chat/completions`) ne renvoie plus les headers CORS nécessaires pour les appels depuis le navigateur. Les appels directs depuis le frontend sont bloqués par le navigateur avec une erreur CORS.

**Erreur typique :**

```
Access to fetch at 'https://api.deepseek.com/v1/chat/completions' from origin 'https://votre-site.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## ✅ Solution : Proxy via Supabase Edge Function

La solution consiste à créer un proxy côté serveur qui :

1. Reçoit les requêtes depuis le frontend (sans problème CORS car même domaine)
2. Fait l'appel à l'API DeepSeek depuis le serveur (pas de CORS côté serveur)
3. Retourne la réponse avec les headers CORS appropriés

## 📋 Étapes de mise en place

### 1. Créer la fonction Edge Supabase

**Structure des fichiers :**

```
supabase/
  functions/
    deepseek-proxy/
      index.ts          # Code de la fonction
      deno.json         # Configuration Deno
      tsconfig.json     # Configuration TypeScript
      deno.d.ts         # Types Deno
```

**Fichier `supabase/functions/deepseek-proxy/index.ts` :**

```typescript
// Supabase Edge Function pour proxy DeepSeek API
// Cette fonction évite les problèmes CORS en faisant les appels depuis le serveur
// DeepSeek a changé sa politique CORS - les appels directs depuis le navigateur sont maintenant bloqués
// Cette fonction Edge fait le proxy côté serveur pour contourner cette restriction

/// <reference path="./deno.d.ts" />

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "VOTRE_CLE_API_DEEPSEEK";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Max-Age": "86400", // 24 heures
  "Access-Control-Allow-Credentials": "true",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    // Récupérer le body de la requête
    const requestBody = await req.json();

    // Faire l'appel à l'API DeepSeek
    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!deepseekResponse.ok) {
      // Récupérer le message d'erreur de DeepSeek si disponible
      let errorData: any = {};
      try {
        errorData = await deepseekResponse.json();
      } catch {
        // Si on ne peut pas parser le JSON, utiliser le texte brut
        errorData = { error: await deepseekResponse.text() };
      }

      // Retourner l'erreur avec les headers CORS pour que le navigateur puisse la lire
      return new Response(
        JSON.stringify({
          error: `DeepSeek API Error: ${deepseekResponse.status} ${deepseekResponse.statusText}`,
          details: errorData,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: deepseekResponse.status,
        }
      );
    }

    const data = await deepseekResponse.json();

    // Retourner la réponse avec les headers CORS
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in deepseek-proxy:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
```

**Fichier `supabase/functions/deepseek-proxy/deno.json` :**

```json
{
  "compilerOptions": {
    "lib": ["deno.window"],
    "strict": true
  },
  "imports": {
    "supabase": "jsr:@supabase/supabase-js@2"
  }
}
```

**Fichier `supabase/functions/deepseek-proxy/tsconfig.json` :**

```json
{
  "compilerOptions": {
    "lib": ["esnext", "dom"],
    "strict": true
  }
}
```

**Fichier `supabase/functions/deepseek-proxy/deno.d.ts` :**

```typescript
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
```

### 2. Déployer la fonction Edge

**Prérequis :**

- Avoir Supabase CLI installé : `npm install -g supabase`
- Être connecté : `supabase login`
- Avoir le project-ref de votre projet Supabase

**Commandes de déploiement :**

```bash
# Depuis la racine du projet
supabase functions deploy deepseek-proxy --project-ref VOTRE_PROJECT_REF

# Configurer la clé API DeepSeek comme secret
supabase secrets set DEEPSEEK_API_KEY=VOTRE_CLE_API_DEEPSEEK --project-ref VOTRE_PROJECT_REF
```

**URL de la fonction déployée :**

```
https://VOTRE_PROJECT_REF.supabase.co/functions/v1/deepseek-proxy
```

### 3. Modifier le code frontend

**Avant (ne fonctionne plus) :**

```typescript
// ❌ Appel direct à l'API DeepSeek - bloqué par CORS
const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer VOTRE_CLE_API_DEEPSEEK", // ⚠️ Clé exposée dans le frontend
  },
  body: JSON.stringify({
    model: "deepseek-chat",
    messages: [{ role: "user", content: "test" }],
  }),
});
```

**Après (fonctionne) :**

```typescript
// ✅ Appel via le proxy Supabase Edge Function
const SUPABASE_URL = "https://VOTRE_PROJECT_REF.supabase.co";
const SUPABASE_ANON_KEY = "VOTRE_CLE_ANON_SUPABASE";

// Obtenir les headers d'authentification Supabase
const headers: HeadersInit = {
  "Content-Type": "application/json",
  apikey: SUPABASE_ANON_KEY,
};

// Ajouter le token d'authentification si l'utilisateur est connecté
const {
  data: { session },
} = await supabaseClient.auth.getSession();
if (session?.access_token) {
  headers["Authorization"] = `Bearer ${session.access_token}`;
}

// Appel via le proxy
const response = await fetch(`${SUPABASE_URL}/functions/v1/deepseek-proxy`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: "deepseek-chat",
    messages: [{ role: "user", content: "test" }],
  }),
});

const data = await response.json();
```

**Exemple complet dans un service Angular :**

```typescript
import { Injectable, inject } from "@angular/core";
import { SupabaseService } from "./supabase.service";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class DeepSeekService {
  private supabaseService = inject(SupabaseService);
  // Utiliser le proxy Supabase Edge Function au lieu d'appeler directement l'API DeepSeek
  private readonly apiUrl = `${environment.supabase.url}/functions/v1/deepseek-proxy`;

  private async getAuthHeaders(): Promise<HeadersInit> {
    const {
      data: { session },
    } = await this.supabaseService.client.auth.getSession();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      apikey: environment.supabase.anonKey,
    };

    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    return headers;
  }

  async callDeepSeek(messages: any[]): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}
```

## 🔑 Points importants

### Sécurité

- ✅ La clé API DeepSeek est stockée comme secret dans Supabase (jamais exposée dans le frontend)
- ✅ Seule la clé anon Supabase est utilisée dans le frontend (sécurisée)
- ✅ Les headers CORS sont correctement configurés

### Headers CORS

La fonction Edge renvoie les headers suivants :

- `Access-Control-Allow-Origin: *` - Autorise tous les domaines
- `Access-Control-Allow-Methods: POST, OPTIONS, GET` - Méthodes autorisées
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type` - Headers autorisés
- `Access-Control-Max-Age: 86400` - Cache du preflight pendant 24h

### Gestion des erreurs

- Les erreurs de l'API DeepSeek sont capturées et renvoyées avec les headers CORS
- Les erreurs de la fonction Edge sont également gérées proprement

## 🧪 Test

**Test avec curl :**

```bash
curl -X POST "https://VOTRE_PROJECT_REF.supabase.co/functions/v1/deepseek-proxy" \
  -H "Content-Type: application/json" \
  -H "apikey: VOTRE_CLE_ANON_SUPABASE" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "test"}]
  }'
```

**Test depuis le navigateur (console) :**

```javascript
fetch("https://VOTRE_PROJECT_REF.supabase.co/functions/v1/deepseek-proxy", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: "VOTRE_CLE_ANON_SUPABASE",
  },
  body: JSON.stringify({
    model: "deepseek-chat",
    messages: [{ role: "user", content: "test" }],
  }),
})
  .then((r) => r.json())
  .then(console.log)
  .catch(console.error);
```

## 📝 Résumé

1. **Problème** : DeepSeek API bloque les appels CORS depuis le navigateur
2. **Solution** : Créer un proxy Supabase Edge Function
3. **Avantages** :
   - Clé API sécurisée (côté serveur uniquement)
   - Headers CORS correctement configurés
   - Fonctionne depuis n'importe quel domaine
   - Gratuit avec Supabase
4. **Déploiement** : Simple avec Supabase CLI
5. **Frontend** : Modifier les appels pour utiliser le proxy au lieu de l'API directe

## 🔗 Ressources

- Documentation Supabase Edge Functions : https://supabase.com/docs/guides/functions
- Dashboard Supabase : https://supabase.com/dashboard
- API DeepSeek : https://api.deepseek.com
