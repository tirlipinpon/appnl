/**
 * Script pour générer les traductions manquantes
 * Utilise fetch pour appeler DeepSeek et MCP Supabase pour mettre à jour
 */

const DEEPSEEK_API_KEY = 'sk-db6617f690b04336b0469ffa1c6bf839';
const SUPABASE_URL = 'https://piaahwlfyvezdfnzoxeb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpYWFod2xmeXZlemRmbnpveGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MDI0ODQsImV4cCI6MjA3ODI3ODQ4NH0.gJN6bc3hPQfKX5STwqQOaV_BzZ_CNKBEf9zpxO4pIqc';

// Phrases à traiter (récupérées via MCP Supabase)
const wordsToProcess = [
  {
    id: "b6d28945-1f29-4239-9cb7-ded496db893f",
    dutch_text: "omgeving",
    french_text: "Environnement",
    fill_in_blank_sentence: "We moeten de _____ schoon houden."
  },
  {
    id: "e6d65296-099f-4dc1-a0d5-ffae2c8bf8dd",
    dutch_text: "beveiliging",
    french_text: "Sécurité",
    fill_in_blank_sentence: "Dit gebouw heeft goede _____."
  },
  {
    id: "6c8adfa7-3878-48cb-809d-5dd3a3f0528c",
    dutch_text: "oplossing",
    french_text: "Correction",
    fill_in_blank_sentence: "De leraar geeft de _____ voor het probleem."
  },
  {
    id: "de9901c8-0776-4d88-abda-964a707f9691",
    dutch_text: "fout",
    french_text: "Erreur",
    fill_in_blank_sentence: "Dit is een _____ in de tekst."
  },
  {
    id: "6c1b6e1d-d889-4c01-9da7-91dc70eb240d",
    dutch_text: "gegeven",
    french_text: "Donnée",
    fill_in_blank_sentence: "Deze _____ is belangrijk voor het onderzoek."
  }
];

/**
 * Génère la traduction d'une phrase
 */
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

/**
 * Met à jour la traduction dans Supabase
 */
async function updateTranslation(wordId, translation) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/nlapp_words?id=eq.${wordId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          fill_in_blank_sentence_translation: translation
        })
      }
    );

    return response.ok;
  } catch (error) {
    console.error(`Erreur mise à jour:`, error.message);
    return false;
  }
}

/**
 * Traite toutes les phrases
 */
async function processAll() {
  console.log('🚀 Génération des traductions pour 5 phrases...\n');
  
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < wordsToProcess.length; i++) {
    const word = wordsToProcess[i];
    const progress = `[${i + 1}/${wordsToProcess.length}]`;
    
    console.log(`${progress} "${word.dutch_text}" (${word.french_text})`);
    console.log(`  Phrase: ${word.fill_in_blank_sentence}`);

    const translation = await generateTranslation(
      word.fill_in_blank_sentence,
      word.dutch_text
    );

    if (translation) {
      const updated = await updateTranslation(word.id, translation);
      if (updated) {
        console.log(`  ✅ Traduction: "${translation}"\n`);
        successCount++;
      } else {
        console.log(`  ❌ Erreur lors de la sauvegarde\n`);
        errorCount++;
      }
    } else {
      console.log(`  ❌ Impossible de générer la traduction\n`);
      errorCount++;
    }

    // Attendre 500ms entre chaque requête
    if (i < wordsToProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('='.repeat(50));
  console.log(`✅ Succès: ${successCount}`);
  console.log(`❌ Erreurs: ${errorCount}`);
  console.log('='.repeat(50));
}

// Exécuter
processAll().then(() => {
  console.log('\n✨ Terminé !');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
});

