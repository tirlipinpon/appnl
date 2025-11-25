/**
 * Script pour générer automatiquement les traductions manquantes
 * 
 * Ce script :
 * 1. Récupère toutes les phrases néerlandaises sans traduction
 * 2. Génère la traduction française pour chacune avec DeepSeek
 * 3. Sauvegarde les traductions dans la base de données
 * 
 * Usage :
 * 1. Installer les dépendances : npm install @supabase/supabase-js
 * 2. Configurer les variables d'environnement (SUPABASE_URL, SUPABASE_KEY, DEEPSEEK_API_KEY)
 * 3. Exécuter : npx ts-node generate-missing-translations-script.ts
 */

import { createClient } from '@supabase/supabase-js';

// Configuration - À remplacer par vos valeurs
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'YOUR_SUPABASE_ANON_KEY';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-db6617f690b04336b0469ffa1c6bf839';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface Word {
  id: string;
  dutch_text: string;
  french_text: string;
  fill_in_blank_sentence: string;
}

/**
 * Génère la traduction d'une phrase néerlandaise
 */
async function generateTranslation(sentence: string, dutchWord: string, frenchWord: string): Promise<string | null> {
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
  const { data: words, error } = await supabase
    .from('nlapp_words')
    .select('id, dutch_text, french_text, fill_in_blank_sentence')
    .not('fill_in_blank_sentence', 'is', null)
    .is('fill_in_blank_sentence_translation', null);

  if (error) {
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
    const word = words[i] as Word;
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
      const { error: updateError } = await supabase
        .from('nlapp_words')
        .update({ fill_in_blank_sentence_translation: translation })
        .eq('id', word.id);

      if (updateError) {
        console.error(`${progress} ❌ Erreur lors de la sauvegarde:`, updateError.message);
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
}

// Exécuter le script
if (require.main === module) {
  generateAllMissingTranslations()
    .then(() => {
      console.log('\n✨ Script terminé !');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erreur fatale:', error);
      process.exit(1);
    });
}

export { generateAllMissingTranslations };

