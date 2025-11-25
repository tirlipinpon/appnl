/**
 * Script JavaScript pour générer automatiquement les traductions manquantes
 * 
 * Usage :
 * 1. Installer : npm install @supabase/supabase-js
 * 2. Configurer les variables ci-dessous
 * 3. Exécuter : node generate-missing-translations.js
 */

// Configuration - Utilise les valeurs de l'environnement ou les valeurs par défaut
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://piaahwlfyvezdfnzoxeb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpYWFod2xmeXZlemRmbnpveGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MDI0ODQsImV4cCI6MjA3ODI3ODQ4NH0.gJN6bc3hPQfKX5STwqQOaV_BzZ_CNKBEf9zpxO4pIqc';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-db6617f690b04336b0469ffa1c6bf839';

// Fonction pour récupérer les données depuis Supabase
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

// Fonction pour mettre à jour une traduction
async function updateTranslation(wordId, translation) {
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
}

/**
 * Génère la traduction d'une phrase néerlandaise
 */
async function generateTranslation(sentence, dutchWord, frenchWord) {
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
    console.error(`Erreur lors de la génération de la traduction pour "${sentence}":`, error);
    return null;
  }
}

/**
 * Traite toutes les phrases sans traduction
 */
async function generateAllMissingTranslations() {
  console.log('🔍 Recherche des phrases sans traduction...\n');

  // Récupérer toutes les phrases sans traduction
  let words;
  try {
    words = await fetchWordsWithoutTranslation();
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des phrases:', error);
    return;
  }

  if (!words || words.length === 0) {
    console.log('✅ Aucune phrase sans traduction trouvée !');
    return;
  }

  console.log(`📊 Trouvé ${words.length} phrases sans traduction\n`);
  console.log('🚀 Génération des traductions...\n');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const progress = `[${i + 1}/${words.length}]`;

    console.log(`${progress} Traitement de "${word.dutch_text}" (${word.french_text})...`);

    if (!word.fill_in_blank_sentence) {
      console.log(`${progress} ⚠️  Phrase vide, ignorée\n`);
      continue;
    }

    // Générer la traduction
    const translation = await generateTranslation(
      word.fill_in_blank_sentence,
      word.dutch_text,
      word.french_text
    );

    if (translation) {
      // Sauvegarder la traduction
      const updated = await updateTranslation(word.id, translation);

      if (!updated) {
        console.error(`${progress} ❌ Erreur lors de la sauvegarde`);
        errorCount++;
      } else {
        console.log(`${progress} ✅ Traduction ajoutée: "${translation}"\n`);
        successCount++;
      }
    } else {
      console.log(`${progress} ❌ Impossible de générer la traduction\n`);
      errorCount++;
    }

    // Attendre un peu pour ne pas surcharger l'API (500ms entre chaque requête)
    if (i < words.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(50));
  console.log(`✅ Traductions générées avec succès : ${successCount}`);
  console.log(`❌ Erreurs : ${errorCount}`);
  console.log(`📝 Total traité : ${words.length}`);
  console.log('='.repeat(50));
  
  // Générer un script SQL avec toutes les traductions pour exécution via MCP Supabase
  console.log('\n💡 Pour sauvegarder les traductions, utilisez MCP Supabase pour exécuter');
  console.log('   les requêtes UPDATE SQL directement, ou utilisez le script SQL généré.');
}

// Exécuter le script
generateAllMissingTranslations()
  .then(() => {
    console.log('\n✨ Script terminé !');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });

