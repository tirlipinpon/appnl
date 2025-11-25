import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface FillInTheBlankSentence {
  sentence: string;
  missingWord: string;
  translation?: string; // Traduction complète de la phrase
}

@Injectable({
  providedIn: 'root'
})
export class DeepSeekService {
  private supabaseService = inject(SupabaseService);
  private readonly apiKey = 'sk-db6617f690b04336b0469ffa1c6bf839';
  private readonly apiUrl = 'https://api.deepseek.com/v1/chat/completions';

  /**
   * Récupère ou génère une phrase à trous pour un mot
   * Vérifie d'abord dans la DB, sinon génère avec DeepSeek et enregistre
   * @param wordId L'ID du mot dans la DB
   * @param word Le mot (néerlandais ou français selon la direction)
   * @param direction La direction de la traduction
   * @param existingSentences Phrases déjà utilisées (pour varier si génération nécessaire)
   * @param frenchTranslation La traduction française du mot (pour clarifier le contexte quand on génère une phrase en néerlandais)
   * @returns Une phrase avec le mot manquant
   */
  async getOrGenerateFillInTheBlankSentence(
    wordId: string,
    word: string,
    direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french',
    existingSentences: string[] = [],
    frenchTranslation?: string,
    context?: string
  ): Promise<FillInTheBlankSentence> {
    // 1. Toujours récupérer la phrase néerlandaise depuis la DB
    const storedDutchSentence = await this.getStoredSentence(wordId, 'dutch_to_french');
    
    if (storedDutchSentence) {
      // Phrase néerlandaise existe
      let sentenceToUse = storedDutchSentence;
      let translationToUse: string | undefined = undefined;
      
      // Récupérer la traduction si elle existe
      const storedTranslation = await this.getStoredTranslation(wordId, 'dutch_to_french');
      
      if (storedTranslation) {
        translationToUse = storedTranslation;
      } else {
        // Générer automatiquement la traduction si elle n'existe pas
        console.log(`[DeepSeek] Génération automatique de la traduction pour wordId: ${wordId}`);
        const generatedTranslation = await this.generateTranslationForExistingSentence(
          storedDutchSentence,
          'dutch_to_french'
        );
        
        if (generatedTranslation) {
          translationToUse = generatedTranslation;
          // Sauvegarder la traduction générée
          await this.saveTranslationToDatabase(wordId, generatedTranslation, 'dutch_to_french');
        }
      }
      
      // Pour french_to_dutch, utiliser la traduction française comme phrase
      if (direction === 'french_to_dutch') {
        if (translationToUse) {
          sentenceToUse = translationToUse;
          // Pour french_to_dutch, la traduction est la phrase néerlandaise originale
          translationToUse = storedDutchSentence;
        } else {
          // Si pas de traduction, générer une nouvelle phrase (ne devrait pas arriver)
          const newSentence = await this.generateFillInTheBlankSentence(
            word,
            existingSentences,
            context,
            direction,
            frenchTranslation
          );
          await this.saveSentenceToDatabase(wordId, newSentence.sentence, 'dutch_to_french');
          if (newSentence.translation) {
            await this.saveTranslationToDatabase(wordId, newSentence.translation, 'dutch_to_french');
          }
          return newSentence;
        }
      }
      
      return {
        sentence: sentenceToUse,
        missingWord: word,
        translation: translationToUse
      };
    }
    
    // 2. Générer une nouvelle phrase néerlandaise avec DeepSeek
    const newSentence = await this.generateFillInTheBlankSentence(
      word,
      existingSentences,
      context,
      'dutch_to_french', // Toujours générer en néerlandais
      frenchTranslation
    );
    
    // 3. Enregistrer la phrase dans la DB pour réutilisation future
    await this.saveSentenceToDatabase(wordId, newSentence.sentence, 'dutch_to_french');
    if (newSentence.translation) {
      await this.saveTranslationToDatabase(wordId, newSentence.translation, 'dutch_to_french');
    }
    
    // Pour french_to_dutch, retourner la traduction comme phrase
    if (direction === 'french_to_dutch' && newSentence.translation) {
      return {
        sentence: newSentence.translation,
        missingWord: word,
        translation: newSentence.sentence // La phrase néerlandaise devient la traduction
      };
    }
    
    return newSentence;
  }

  /**
   * Génère une phrase à trous avec le mot manquant
   * @param word Le mot à utiliser dans la phrase
   * @param existingSentences Phrases déjà utilisées pour ce mot (pour éviter les répétitions)
   * @param context Contexte optionnel pour la phrase
   * @param direction La direction de la traduction (détermine la langue de la phrase)
   * @param frenchTranslation La traduction française du mot (pour clarifier le contexte quand on génère une phrase en néerlandais)
   * @returns Une phrase avec le mot manquant
   */
  async generateFillInTheBlankSentence(
    word: string,
    existingSentences: string[] = [],
    context?: string,
    direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french',
    frenchTranslation?: string
  ): Promise<FillInTheBlankSentence> {
    try {
      const prompt = this.buildPrompt(word, existingSentences, context, direction, frenchTranslation);
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'Tu es un assistant qui crée des exercices de langue de niveau B1 (intermédiaire). Tu génères des phrases complexes et grammaticalement correctes avec des structures avancées (subordonnées, temps composés, voix passive, etc.) où l\'utilisateur doit écrire le mot manquant.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.9,
          max_tokens: 200
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content received from API');
      }

      return this.parseResponse(content, word);
    } catch (error) {
      console.error('Error generating sentence:', error);
      // Fallback: créer une phrase simple si l'API échoue
      return this.createFallbackSentence(word);
    }
  }

  private buildPrompt(
    word: string, 
    existingSentences: string[] = [], 
    context?: string,
    direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french',
    frenchTranslation?: string
  ): string {
    const language = direction === 'dutch_to_french' ? 'néerlandais' : 'français';
    let prompt = `Crée une phrase CORRECTE et COMPLEXE de niveau B1 en ${language} qui utilise le mot "${word}". `;
    
    // Ajouter la traduction française pour clarifier le contexte quand on génère une phrase en néerlandais
    if (direction === 'dutch_to_french' && frenchTranslation) {
      prompt += `Le mot néerlandais "${word}" signifie "${frenchTranslation}" en français. Utilise ce sens précis du mot dans la phrase en néerlandais. `;
    }
    
    if (context) {
      prompt += `Contexte: ${context}. `;
    }
    
    prompt += `La phrase doit être de NIVEAU B1 (intermédiaire), donc PLUS COMPLEXE qu'une phrase simple. `;
    prompt += `Utilise des structures grammaticales avancées : subordonnées (parce que, bien que, quand, si), temps composés, voix passive, pronoms relatifs, etc. `;
    prompt += `La phrase doit être grammaticalement CORRECTE et naturelle. `;
    prompt += `Le mot manquant doit être logique dans le contexte de la phrase complexe. `;
    
    if (existingSentences.length > 0) {
      prompt += `\n\nVoici des phrases déjà utilisées pour ce mot (NE PAS les répéter, créer quelque chose de différent) :\n`;
      existingSentences.forEach((sentence, index) => {
        prompt += `${index + 1}. ${sentence}\n`;
      });
      prompt += `\nCrée une phrase COMPLÈTEMENT DIFFÉRENTE et PLUS COMPLEXE que celles-ci. `;
    }
    
    prompt += `\nRéponds UNIQUEMENT au format JSON suivant (sans texte supplémentaire) :\n`;
    prompt += `{\n`;
    prompt += `  "sentence": "phrase avec [MOT] à la place du mot manquant",\n`;
    prompt += `  "missingWord": "${word}",\n`;
    prompt += `  "translation": "traduction complète de la phrase en ${direction === 'dutch_to_french' ? 'français' : 'néerlandais'}"\n`;
    prompt += `}\n`;
    prompt += `\nExemples de phrases complexes niveau B1 :\n`;
    if (direction === 'dutch_to_french') {
      prompt += `- Si le mot est "groen" (vert) : "Hoewel het regent, blijft het gras [MOT] omdat het veel zon heeft gehad." (Bien qu'il pleuve, l'herbe reste [MOT] car elle a eu beaucoup de soleil)\n`;
      prompt += `- Si le mot est "boek" (livre) : "Het [MOT] dat ik gisteren heb gekocht, is interessanter dan ik had verwacht." (Le [MOT] que j'ai acheté hier est plus intéressant que je ne l'avais prévu)\n`;
      prompt += `- Si le mot est "water" (eau) : "Als je dorst hebt, kun je beter [MOT] drinken dan frisdrank." (Si tu as soif, tu ferais mieux de boire [MOT] plutôt que des sodas)\n`;
    } else {
      prompt += `- Si le mot est "vert" : "Bien que la pluie tombe, l'herbe reste [MOT] car elle a reçu beaucoup de soleil." (Hoewel het regent, blijft het gras [MOT] omdat het veel zon heeft gehad)\n`;
      prompt += `- Si le mot est "livre" : "Le [MOT] que j'ai acheté hier est plus intéressant que je ne l'avais prévu." (Het [MOT] dat ik gisteren heb gekocht, is interessanter dan ik had verwacht)\n`;
      prompt += `- Si le mot est "eau" : "Si tu as soif, tu ferais mieux de boire [MOT] plutôt que des sodas." (Als je dorst hebt, kun je beter [MOT] drinken dan frisdrank)\n`;
    }
    prompt += `\nLa phrase doit être de longueur moyenne (10-15 mots), complexe niveau B1, grammaticalement correcte et le contexte doit rendre le mot logique.`;
    
    return prompt;
  }

  private parseResponse(content: string, correctWord: string): FillInTheBlankSentence {
    try {
      // Nettoyer le contenu (enlever les markdown code blocks si présents)
      let cleanedContent = content.trim();
      cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Essayer d'extraire le JSON de la réponse
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Valider et nettoyer les données
        let sentence = parsed.sentence || '';
        // Remplacer [MOT] par _____ si présent
        sentence = sentence.replace(/\[MOT\]/g, '_____');
        
        return {
          sentence,
          missingWord: parsed.missingWord || correctWord,
          translation: parsed.translation || undefined
        };
      }
      
      // Si pas de JSON, essayer de parser manuellement
      throw new Error('No JSON found in response');
    } catch (error) {
      console.error('Error parsing response:', error);
      return this.createFallbackSentence(correctWord);
    }
  }

  private createFallbackSentence(word: string): FillInTheBlankSentence {
    // Phrases simples de fallback
    const fallbackSentences = [
      { sentence: `De gras is [MOT] in de tuin.`, translation: `L'herbe est [MOT] dans le jardin.` },
      { sentence: `Ik zie een [MOT] auto.`, translation: `Je vois une voiture [MOT].` },
      { sentence: `Het boek is [MOT].`, translation: `Le livre est [MOT].` },
      { sentence: `Ik heb een [MOT] pen.`, translation: `J'ai un stylo [MOT].` }
    ];
    
    const fallback = fallbackSentences[Math.floor(Math.random() * fallbackSentences.length)];
    const sentence = fallback.sentence.replace('[MOT]', '_____');
    
    return {
      sentence,
      missingWord: word,
      translation: fallback.translation.replace('[MOT]', word)
    };
  }

  /**
   * Récupère la phrase néerlandaise stockée dans la DB
   * Toujours retourne fill_in_blank_sentence (phrase néerlandaise)
   */
  private async getStoredSentence(
    wordId: string, 
    direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french'
  ): Promise<string | null> {
    try {
      // Toujours récupérer la phrase néerlandaise
      const { data, error } = await this.supabaseService.client
        .from('nlapp_words')
        .select('fill_in_blank_sentence')
        .eq('id', wordId)
        .single();
      
      if (error) {
        console.error('Error fetching dutch sentence:', error);
        return null;
      }
      
      if (!data) {
        return null;
      }
      
      const sentence = data.fill_in_blank_sentence;
      if (sentence && sentence.trim()) {
        console.log(`Phrase néerlandaise récupérée depuis DB pour wordId: ${wordId}`);
        return sentence;
      }
      return null;
    } catch (error) {
      console.error('Error fetching stored sentence:', error);
      return null;
    }
  }

  /**
   * Enregistre la phrase néerlandaise générée dans la DB
   * Toujours sauvegarde dans fill_in_blank_sentence
   */
  private async saveSentenceToDatabase(
    wordId: string, 
    sentence: string,
    direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french'
  ): Promise<void> {
    try {
      console.log(`Sauvegarde phrase néerlandaise dans fill_in_blank_sentence pour wordId: ${wordId}`);
      
      const { data, error } = await this.supabaseService.client
        .from('nlapp_words')
        .update({ fill_in_blank_sentence: sentence })
        .eq('id', wordId)
        .select();
      
      if (error) {
        console.error('Error saving sentence to database:', error);
        console.error('WordId:', wordId);
      } else {
        console.log(`Phrase néerlandaise sauvegardée avec succès pour wordId: ${wordId}`);
      }
    } catch (error) {
      console.error('Error saving sentence:', error);
    }
  }

  /**
   * Récupère la traduction française stockée dans la DB
   * Toujours utilise fill_in_blank_sentence_translation
   */
  private async getStoredTranslation(
    wordId: string, 
    direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french'
  ): Promise<string | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('nlapp_words')
        .select('fill_in_blank_sentence_translation')
        .eq('id', wordId)
        .single();
      
      if (error) {
        // Si la colonne n'existe pas encore, retourner null (pas d'erreur)
        if (error.code === '42703' || error.code === 'PGRST204') {
          return null;
        }
        console.error('Error fetching translation:', error);
        return null;
      }
      
      if (!data) {
        return null;
      }
      
      const translation = data.fill_in_blank_sentence_translation;
      if (translation && translation.trim()) {
        return translation;
      }
      return null;
    } catch (error) {
      console.error('Error fetching stored translation:', error);
      return null;
    }
  }

  /**
   * Génère uniquement la traduction d'une phrase existante
   * Utile pour compléter les phrases anciennes qui n'ont pas de traduction
   */
  async generateTranslationForExistingSentence(
    sentence: string,
    direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french'
  ): Promise<string | null> {
    try {
      const targetLanguage = direction === 'dutch_to_french' ? 'français' : 'néerlandais';
      const sourceLanguage = direction === 'dutch_to_french' ? 'néerlandais' : 'français';
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `Tu es un traducteur professionnel ${sourceLanguage}-${targetLanguage}. Traduis uniquement la phrase donnée en ${targetLanguage}, sans commentaire ni explication. Réponds uniquement avec la traduction.`
            },
            {
              role: 'user',
              content: `Traduis cette phrase ${sourceLanguage} en ${targetLanguage} : "${sentence}"`
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
      console.error('Error generating translation:', error);
      return null;
    }
  }

  /**
   * Enregistre la traduction française dans la DB
   * Toujours sauvegarde dans fill_in_blank_sentence_translation
   */
  private async saveTranslationToDatabase(
    wordId: string, 
    translation: string,
    direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french'
  ): Promise<void> {
    try {
      console.log(`Sauvegarde traduction française dans fill_in_blank_sentence_translation pour wordId: ${wordId}`);
      
      const { data, error } = await this.supabaseService.client
        .from('nlapp_words')
        .update({ fill_in_blank_sentence_translation: translation })
        .eq('id', wordId)
        .select();
      
      if (error) {
        // Si la colonne n'existe pas encore, juste logger (ne pas bloquer)
        if (error.code === '42703' || error.code === 'PGRST204') {
          console.warn(`⚠️ La colonne fill_in_blank_sentence_translation n'existe pas encore dans la base de données. La traduction ne sera pas sauvegardée.`);
          return;
        }
        console.error('Error saving translation to database:', error);
      } else {
        console.log(`Traduction sauvegardée avec succès pour wordId: ${wordId}`);
      }
    } catch (error) {
      console.error('Error saving translation:', error);
    }
  }

  /**
   * Génère une phrase avec erreur grammaticale et sa correction
   * @param word Le mot clé à utiliser dans la phrase
   * @param direction La direction de traduction (détermine la langue de la phrase)
   * @param errorType Type d'erreur souhaité (ex: 'word_order', 'conjugation', 'article', 'preposition')
   * @param frenchTranslation La traduction française du mot (pour clarifier le contexte)
   * @returns Une phrase avec erreur, sa correction et une explication
   */
  async generateErrorSentence(
    word: string,
    direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french',
    errorType?: string,
    frenchTranslation?: string
  ): Promise<{
    sentence_with_error: string;
    sentence_correct: string;
    explanation: string;
    error_type?: string;
  }> {
    try {
      const language = direction === 'dutch_to_french' ? 'néerlandais' : 'français';
      let prompt = `Crée DEUX phrases en ${language} : une phrase CORRECTE et une phrase AVEC ERREUR. `;
      
      prompt += `Le mot clé à utiliser est : "${word}". `;
      
      if (direction === 'dutch_to_french' && frenchTranslation) {
        prompt += `Le mot néerlandais "${word}" signifie "${frenchTranslation}" en français. `;
      }
      
      prompt += `\nIMPORTANT : Les deux phrases doivent avoir EXACTEMENT LE MÊME NOMBRE DE MOTS. `;
      prompt += `L'erreur doit être uniquement un mélange/inversion de l'ordre des mots, pas d'ajout ou de suppression de mots. `;
      
      if (errorType) {
        prompt += `Type d'erreur souhaité : ${errorType}. `;
      } else {
        prompt += `Choisis un type d'erreur courant (ordre des mots, conjugaison, article, préposition, etc.). `;
      }
      
      prompt += `La phrase doit être courte (maximum 8-10 mots) et l'erreur doit être évidente pour un apprenant. `;
      prompt += `L'erreur doit être une erreur grammaticale réelle et courante, pas une faute d'orthographe. `;
      prompt += `La phrase CORRECTE doit être grammaticalement parfaite et contenir le mot "${word}". `;
      prompt += `La phrase AVEC ERREUR doit avoir les mêmes mots mais dans un ordre incorrect ou avec une erreur grammaticale (conjugaison, article, etc.). `;
      
      prompt += `\nRéponds UNIQUEMENT au format JSON suivant (sans texte supplémentaire) :\n`;
      prompt += `{\n`;
      prompt += `  "sentence_with_error": "phrase avec erreur grammaticale",\n`;
      prompt += `  "sentence_correct": "phrase corrigée",\n`;
      prompt += `  "explanation": "explication courte de l'erreur (1-2 phrases)",\n`;
      prompt += `  "error_type": "type d'erreur (ex: word_order, conjugation, article, preposition)"\n`;
      prompt += `}\n`;
      
      prompt += `\nExemples (les deux phrases ont le même nombre de mots) :\n`;
      if (direction === 'dutch_to_french') {
        prompt += `- Erreur d'ordre :\n`;
        prompt += `  Phrase correcte : "Ik ga morgen naar de winkel" (5 mots)\n`;
        prompt += `  Phrase avec erreur : "Ik ga naar de winkel morgen" (5 mots, même nombre)\n`;
        prompt += `  Explication : "L'adverbe de temps 'morgen' doit être placé avant le complément de lieu 'naar de winkel'"\n\n`;
        prompt += `- Erreur de conjugaison :\n`;
        prompt += `  Phrase correcte : "Hij werkt in de tuin" (5 mots)\n`;
        prompt += `  Phrase avec erreur : "Hij werk in de tuin" (5 mots, même nombre)\n`;
        prompt += `  Explication : "Le verbe 'werken' doit être conjugué à la 3e personne du singulier : 'werkt'"\n`;
      } else {
        prompt += `- Erreur d'ordre :\n`;
        prompt += `  Phrase correcte : "Je vais demain au cinéma" (5 mots)\n`;
        prompt += `  Phrase avec erreur : "Je vais au cinéma demain" (5 mots, même nombre)\n`;
        prompt += `  Explication : "L'adverbe de temps 'demain' doit être placé avant le complément de lieu 'au cinéma'"\n`;
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'Tu es un assistant qui crée des exercices de grammaire pour apprendre les langues. Tu génères des phrases avec des erreurs grammaticales courantes et leurs corrections.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.9,
          max_tokens: 300
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content received from API');
      }

      return this.parseErrorSentenceResponse(content);
    } catch (error) {
      console.error('Error generating error sentence:', error);
      // Fallback : créer une phrase simple avec erreur
      return this.createFallbackErrorSentence(word, direction, errorType);
    }
  }

  /**
   * Parse la réponse JSON de DeepSeek pour une phrase avec erreur
   */
  private parseErrorSentenceResponse(content: string): {
    sentence_with_error: string;
    sentence_correct: string;
    explanation: string;
    error_type?: string;
  } {
    try {
      // Nettoyer le contenu (enlever les markdown code blocks si présents)
      let cleanedContent = content.trim();
      cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Essayer d'extraire le JSON de la réponse
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          sentence_with_error: parsed.sentence_with_error || '',
          sentence_correct: parsed.sentence_correct || '',
          explanation: parsed.explanation || '',
          error_type: parsed.error_type
        };
      }
      
      throw new Error('No JSON found in response');
    } catch (error) {
      console.error('Error parsing error sentence response:', error);
      throw error;
    }
  }

  /**
   * Crée une phrase de fallback avec erreur simple
   */
  private createFallbackErrorSentence(
    word: string,
    direction: 'french_to_dutch' | 'dutch_to_french',
    errorType?: string
  ): {
    sentence_with_error: string;
    sentence_correct: string;
    explanation: string;
    error_type?: string;
  } {
    if (direction === 'dutch_to_french') {
      // Exemple en néerlandais avec erreur d'ordre
      return {
        sentence_with_error: `Ik ga naar de winkel morgen.`,
        sentence_correct: `Ik ga morgen naar de winkel.`,
        explanation: `L'adverbe de temps "morgen" doit être placé avant le complément de lieu "naar de winkel".`,
        error_type: errorType || 'word_order'
      };
    } else {
      // Exemple en français avec erreur d'ordre
      return {
        sentence_with_error: `Je vais au cinéma demain.`,
        sentence_correct: `Je vais demain au cinéma.`,
        explanation: `L'adverbe de temps "demain" doit être placé avant le complément de lieu "au cinéma".`,
        error_type: errorType || 'word_order'
      };
    }
  }
}

