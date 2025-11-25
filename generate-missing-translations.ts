// Script pour générer les traductions manquantes pour les phrases existantes
// À exécuter dans la console du navigateur ou via un script Node.js

/**
 * Génère les traductions manquantes pour toutes les phrases qui n'ont pas de traduction
 * 
 * Usage dans la console du navigateur :
 * 1. Ouvrir la console (F12)
 * 2. Copier-coller ce script
 * 3. Appeler: generateMissingTranslations()
 */

async function generateMissingTranslations() {
  const supabaseUrl = 'YOUR_SUPABASE_URL'; // À remplacer
  const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'; // À remplacer
  const deepseekApiKey = 'sk-db6617f690b04336b0469ffa1c6bf839';
  
  // Récupérer toutes les phrases sans traduction
  const { data: wordsWithoutTranslation, error } = await fetch(
    `${supabaseUrl}/rest/v1/nlapp_words?select=id,fill_in_blank_sentence,dutch_text,french_text&fill_in_blank_sentence_translation=is.null&fill_in_blank_sentence=not.is.null`,
    {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    }
  ).then(r => r.json());

  if (error) {
    console.error('Erreur:', error);
    return;
  }

  console.log(`Trouvé ${wordsWithoutTranslation.length} phrases sans traduction`);

  for (const word of wordsWithoutTranslation) {
    if (!word.fill_in_blank_sentence) continue;

    // Reconstruire la phrase complète
    const completeSentence = word.fill_in_blank_sentence.replace(/_____/g, word.dutch_text);
    
    // Générer la traduction avec DeepSeek
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Tu es un traducteur professionnel néerlandais-français. Traduis uniquement la phrase donnée sans commentaire.'
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

    const data = await response.json();
    const translation = data.choices[0]?.message?.content?.trim();

    if (translation) {
      // Sauvegarder la traduction
      await fetch(
        `${supabaseUrl}/rest/v1/nlapp_words?id=eq.${word.id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            fill_in_blank_sentence_translation: translation
          })
        }
      );

      console.log(`✓ Traduction ajoutée pour ${word.dutch_text}: ${translation}`);
    } else {
      console.warn(`✗ Impossible de générer la traduction pour ${word.dutch_text}`);
    }

    // Attendre un peu pour ne pas surcharger l'API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('Terminé !');
}

