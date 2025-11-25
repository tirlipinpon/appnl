/**
 * Script pour générer les traductions manquantes par batch
 * Utilise MCP Supabase pour récupérer et mettre à jour les données
 * 
 * Usage: node generate-translations-batch.js
 */

const DEEPSEEK_API_KEY = 'sk-db6617f690b04336b0469ffa1c6bf839';

/**
 * Génère la traduction d'une phrase néerlandaise
 */
async function generateTranslation(sentence, dutchWord) {
  try {
    // Reconstruire la phrase complète en remplaçant "_____" par le mot
    const completeSentence = sentence.replace(/_____/g, dutchWord);
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Tu es un traducteur professionnel néerlandais-français. Traduis uniquement la phrase donnée en français, sans commentaire ni explication. Réponds uniquement avec la traduction.'
          },
          {
            role: 'user',
            content: `Traduis cette phrase néerlandaise en français : "${completeSentence}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const translation = data.choices[0]?.message?.content?.trim();
    
    // Nettoyer la traduction (enlever les guillemets si présents)
    return translation?.replace(/^["']|["']$/g, '') || null;
  } catch (error) {
    console.error(`Erreur lors de la génération de la traduction:`, error);
    return null;
  }
}

/**
 * Traite un batch de phrases (5 à la fois pour éviter de surcharger)
 */
async function processBatch(words) {
  const results = [];
  
  for (const word of words) {
    if (!word.fill_in_blank_sentence) continue;
    
    console.log(`  Traitement de "${word.dutch_text}" (${word.french_text})...`);
    
    const translation = await generateTranslation(
      word.fill_in_blank_sentence,
      word.dutch_text
    );
    
    if (translation) {
      results.push({
        id: word.id,
        translation: translation,
        success: true
      });
      console.log(`  ✅ Traduction: "${translation}"`);
    } else {
      results.push({
        id: word.id,
        translation: null,
        success: false
      });
      console.log(`  ❌ Impossible de générer la traduction`);
    }
    
    // Attendre 500ms entre chaque requête
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

// Instructions pour l'utilisateur
console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Script de génération des traductions manquantes            ║
╚══════════════════════════════════════════════════════════════╝

Ce script nécessite l'utilisation de MCP Supabase pour :
1. Récupérer les phrases sans traduction
2. Générer les traductions avec DeepSeek
3. Mettre à jour la base de données

Pour exécuter ce script, vous devez :
1. Installer @supabase/supabase-js : npm install @supabase/supabase-js
2. Utiliser le script generate-missing-translations.js qui utilise directement Supabase

OU utiliser MCP Supabase pour exécuter les requêtes SQL suivantes :

ÉTAPE 1: Récupérer les phrases sans traduction
ÉTAPE 2: Pour chaque phrase, générer la traduction avec l'API DeepSeek
ÉTAPE 3: Mettre à jour la base de données avec les traductions

Le script generate-missing-translations.js est prêt à être utilisé.
`);

