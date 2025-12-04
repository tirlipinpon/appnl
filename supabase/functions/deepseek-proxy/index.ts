// Supabase Edge Function pour proxy DeepSeek API
// Cette fonction évite les problèmes CORS en faisant les appels depuis le serveur
// DeepSeek a changé sa politique CORS - les appels directs depuis le navigateur sont maintenant bloqués
// Cette fonction Edge fait le proxy côté serveur pour contourner cette restriction

/// <reference path="./deno.d.ts" />

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || 'sk-db6617f690b04336b0469ffa1c6bf839'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400', // 24 heures
  'Access-Control-Allow-Credentials': 'true'
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders,
      status: 204 
    })
  }

  try {
    // Récupérer le body de la requête
    const requestBody = await req.json()

    // Faire l'appel à l'API DeepSeek
    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!deepseekResponse.ok) {
      // Récupérer le message d'erreur de DeepSeek si disponible
      let errorData: any = {}
      try {
        errorData = await deepseekResponse.json()
      } catch {
        // Si on ne peut pas parser le JSON, utiliser le texte brut
        errorData = { error: await deepseekResponse.text() }
      }
      
      // Retourner l'erreur avec les headers CORS pour que le navigateur puisse la lire
      return new Response(
        JSON.stringify({ 
          error: `DeepSeek API Error: ${deepseekResponse.status} ${deepseekResponse.statusText}`,
          details: errorData 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: deepseekResponse.status,
        },
      )
    }

    const data = await deepseekResponse.json()

    // Retourner la réponse avec les headers CORS
    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in deepseek-proxy:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

