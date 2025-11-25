/**
 * Script pour générer un fichier SQL avec toutes les traductions
 * Ce script génère les traductions puis crée un fichier SQL pour les appliquer
 */

const fs = require('fs');
const SUPABASE_URL = 'https://piaahwlfyvezdfnzoxeb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpYWFod2xmeXZlemRmbnpveGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MDI0ODQsImV4cCI6MjA3ODI3ODQ4NH0.gJN6bc3hPQfKX5STwqQOaV_BzZ_CNKBEf9zpxO4pIqc';
const DEEPSEEK_API_KEY = 'sk-db6617f690b04336b0469ffa1c6bf839';

async function fetchWordsWithoutTranslation() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/nlapp_words?select=id,dutch_text,french_text,fill_in_blank_sentence&fill_in_blank_sentence=not.is.null&fill_in_blank_sentence_translation=is.null`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Erreur HTTP: ${response.status}`);
  }
  
  return await response.json();
}

async function generateTranslation(sentence, dutchWord) {
  try {
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
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, '') || null;
  } catch (error) {
    console.error(`Erreur:`, error.message);
    return null;
  }
}

async function generateSQLScript() {
  console.log('🔍 Récupération des phrases sans traduction...\n');
  
  const words = await fetchWordsWithoutTranslation();
  console.log(`📊 Trouvé ${words.length} phrases sans traduction\n`);
  
  console.log('🚀 Génération des traductions...\n');
  
  const updates = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const progress = `[${i + 1}/${words.length}]`;
    
    console.log(`${progress} "${word.dutch_text}"...`);

    const translation = await generateTranslation(
      word.fill_in_blank_sentence,
      word.dutch_text
    );

    if (translation) {
      // Échapper les apostrophes pour SQL
      const escapedTranslation = translation.replace(/'/g, "''");
      updates.push(`UPDATE nlapp_words\nSET fill_in_blank_sentence_translation = '${escapedTranslation}'\nWHERE id = '${word.id}' AND fill_in_blank_sentence_translation IS NULL;`);
      successCount++;
    } else {
      errorCount++;
    }

    // Attendre 500ms entre chaque requête
    if (i < words.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Générer le fichier SQL
  const sqlContent = `-- Script SQL pour mettre à jour toutes les traductions générées
-- Généré automatiquement le ${new Date().toISOString()}
-- Total: ${successCount} traductions générées avec succès

${updates.join('\n\n')}

-- Vérification
SELECT COUNT(*) as phrases_sans_traduction_restantes
FROM nlapp_words
WHERE fill_in_blank_sentence IS NOT NULL 
  AND fill_in_blank_sentence_translation IS NULL;
`;

  fs.writeFileSync('update-all-translations-complete.sql', sqlContent, 'utf8');
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(50));
  console.log(`✅ Traductions générées : ${successCount}`);
  console.log(`❌ Erreurs : ${errorCount}`);
  console.log(`📝 Fichier SQL créé : update-all-translations-complete.sql`);
  console.log('='.repeat(50));
  console.log('\n💡 Exécutez le fichier SQL via MCP Supabase ou dans l\'éditeur SQL de Supabase');
}

generateSQLScript().catch(console.error);

