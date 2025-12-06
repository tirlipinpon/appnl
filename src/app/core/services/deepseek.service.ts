import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { environment } from '../../../environments/environment';

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
  // Utiliser le proxy Supabase Edge Function au lieu d'appeler directement l'API DeepSeek
  // Cela évite les problèmes CORS
  private readonly apiUrl = `${environment.supabase.url}/functions/v1/deepseek-proxy`;

  /**
   * Obtient les headers d'authentification pour les appels à la fonction Supabase
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await this.supabaseService.client.auth.getSession();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'apikey': environment.supabase.anonKey
    };
    
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    return headers;
  }

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
      
      const headers = await this.getAuthHeaders();
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
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
      
      const headers = await this.getAuthHeaders();
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
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

      const headers = await this.getAuthHeaders();
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
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

  /**
   * Extrait les mots de vocabulaire importants d'un texte néerlandais
   * Exclut les stopwords et retourne les mots avec leurs traductions françaises
   */
  async extractVocabularyWords(text: string): Promise<{ dutch: string; french: string }[]> {
    try {
      const prompt = `Analyse ce texte néerlandais et extrais uniquement les mots de vocabulaire importants (noms, verbes, adjectifs, adverbes).
Exclus les articles (de, het, een), prépositions (van, in, op, te, voor, met), pronoms (ik, jij, hij, zij, wij, jullie, zij), 
conjonctions (en, maar, of, want), et mots grammaticaux courants (is, zijn, heeft, wordt, etc.).

Pour chaque mot extrait, fournis sa traduction française principale.

Retourne un JSON avec ce format :
{
  "words": [
    {"dutch": "woord", "french": "mot"},
    ...
  ]
}

Texte à analyser :
${text}`;

      // Créer un AbortController pour le timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // Timeout de 30 secondes

      try {
        const headers = await this.getAuthHeaders();
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: 'Tu es un assistant qui extrait le vocabulaire important de textes néerlandais pour l\'apprentissage. Tu retournes uniquement du JSON valide, sans texte supplémentaire.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.3,
            max_tokens: 2000
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;
        
        if (!content) {
          throw new Error('No content received from API');
        }

        return this.parseVocabularyExtractionResponse(content);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error: any) {
      console.error('Error extracting vocabulary:', error);
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new Error('Le délai d\'attente a été dépassé. Veuillez réessayer.');
      }
      throw new Error(error.message || 'Erreur lors de l\'extraction des mots');
    }
  }

  /**
   * Parse la réponse JSON de DeepSeek pour l'extraction de vocabulaire
   */
  private parseVocabularyExtractionResponse(content: string): { dutch: string; french: string }[] {
    try {
      // Nettoyer le contenu étape par étape
      let cleanedContent = content.trim();
      
      // 1. Enlever les markdown code blocks complets
      cleanedContent = cleanedContent.replace(/```json\s*/gi, '');
      cleanedContent = cleanedContent.replace(/```\s*/g, '');
      
      // 2. Enlever les espaces et sauts de ligne en début/fin
      cleanedContent = cleanedContent.trim();
      
      // 3. Chercher le JSON (peut être au milieu du texte)
      let jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      
      // Si pas trouvé, essayer de trouver juste le tableau words
      if (!jsonMatch) {
        const wordsMatch = cleanedContent.match(/\[[\s\S]*\]/);
        if (wordsMatch) {
          // Créer un objet JSON avec le tableau words
          cleanedContent = `{"words": ${wordsMatch[0]}}`;
          jsonMatch = [cleanedContent];
        }
      }
      
      if (!jsonMatch || !jsonMatch[0]) {
        throw new Error('Aucun JSON trouvé dans la réponse');
      }
      
      let jsonString = jsonMatch[0];
      
      // 4. Essayer de réparer les chaînes JSON tronquées
      // Si le JSON se termine par une chaîne incomplète, on essaie de la fermer
      if (jsonString.match(/"[^"]*$/)) {
        // Chaîne non fermée à la fin, on la ferme
        jsonString = jsonString.replace(/("[^"]*)$/, '$1"');
      }
      
      // 6. Nettoyer les virgules en fin de ligne avant les fermetures
      jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
      
      // 7. Si le JSON se termine par une virgule suivie d'espaces, l'enlever
      jsonString = jsonString.replace(/,\s*$/, '');
      
      // 8. Essayer de fermer les structures JSON incomplètes
      const openBraces = (jsonString.match(/\{/g) || []).length;
      const closeBraces = (jsonString.match(/\}/g) || []).length;
      const openBrackets = (jsonString.match(/\[/g) || []).length;
      const closeBrackets = (jsonString.match(/\]/g) || []).length;
      
      // Si le JSON se termine par un objet incomplet (ex: "dutch": "mot"), fermer l'objet
      if (jsonString.match(/"dutch"\s*:\s*"[^"]*"\s*$/)) {
        jsonString += '}';
      }
      
      // Ajouter les accolades/brackets manquants
      for (let i = 0; i < openBraces - closeBraces; i++) {
        jsonString += '}';
      }
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        jsonString += ']';
      }
      
      // 7. Parser le JSON
      let parsed: any;
      try {
        parsed = JSON.parse(jsonString);
      } catch (parseError: any) {
        // Si le parsing échoue, essayer d'extraire les mots directement avec regex
        console.warn('JSON parsing failed, trying regex extraction:', parseError.message);
        return this.extractWordsWithRegex(cleanedContent);
      }
      
      // 8. Extraire les mots du JSON parsé
      if (parsed.words && Array.isArray(parsed.words)) {
        const words = parsed.words
          .filter((w: any) => w && w.dutch && w.french)
          .map((w: any) => ({
            dutch: String(w.dutch).trim(),
            french: String(w.french).trim()
          }))
          .filter((w: { dutch: string; french: string }) => w.dutch && w.french);
        
        if (words.length > 0) {
          return words;
        }
      }
      
      // Si pas de words dans le JSON, essayer regex
      return this.extractWordsWithRegex(cleanedContent);
      
    } catch (error: any) {
      console.error('Error parsing vocabulary extraction response:', error);
      console.error('Original content:', content);
      
      // Dernière tentative : extraction avec regex
      try {
        return this.extractWordsWithRegex(content);
      } catch (regexError) {
        throw new Error('Impossible de parser la réponse de l\'IA. Veuillez réessayer.');
      }
    }
  }

  /**
   * Extrait les mots avec des expressions régulières en cas d'échec du parsing JSON
   */
  private extractWordsWithRegex(content: string): { dutch: string; french: string }[] {
    const words: { dutch: string; french: string }[] = [];
    const seen = new Set<string>(); // Pour éviter les doublons
    
    // Pattern 1 : {"dutch": "...", "french": "..."} (objet complet)
    const pattern1 = /\{\s*"dutch"\s*:\s*"([^"]+)"\s*,\s*"french"\s*:\s*"([^"]+)"\s*\}/g;
    let match;
    
    while ((match = pattern1.exec(content)) !== null) {
      const dutch = match[1].trim();
      const french = match[2].trim();
      const key = `${dutch.toLowerCase()}_${french.toLowerCase()}`;
      if (dutch && french && !seen.has(key)) {
        words.push({ dutch, french });
        seen.add(key);
      }
    }
    
    // Pattern 2 : "dutch": "..." suivi de "french": "..." (peut être sur plusieurs lignes)
    if (words.length === 0) {
      const pattern2 = /"dutch"\s*:\s*"([^"]+)"[\s\S]{0,500}?"french"\s*:\s*"([^"]+)"/g;
      while ((match = pattern2.exec(content)) !== null) {
        const dutch = match[1].trim();
        const french = match[2].trim();
        const key = `${dutch.toLowerCase()}_${french.toLowerCase()}`;
        if (dutch && french && !seen.has(key)) {
          words.push({ dutch, french });
          seen.add(key);
        }
      }
    }
    
    // Pattern 3 : Extraire tous les couples dutch/french même si mal formatés
    // Chercher toutes les occurrences de "dutch" et "french" proches
    if (words.length === 0) {
      const dutchMatches: Array<{ value: string; index: number }> = [];
      const frenchMatches: Array<{ value: string; index: number }> = [];
      
      // Trouver tous les "dutch": "..."
      const dutchPattern = /"dutch"\s*:\s*"([^"]+)"/g;
      while ((match = dutchPattern.exec(content)) !== null) {
        dutchMatches.push({ value: match[1].trim(), index: match.index });
      }
      
      // Trouver tous les "french": "..."
      const frenchPattern = /"french"\s*:\s*"([^"]+)"/g;
      while ((match = frenchPattern.exec(content)) !== null) {
        frenchMatches.push({ value: match[1].trim(), index: match.index });
      }
      
      // Associer chaque dutch avec le french suivant le plus proche
      for (let i = 0; i < dutchMatches.length; i++) {
        const dutch = dutchMatches[i];
        // Chercher le french suivant (dans les 2000 caractères suivants)
        const nextFrench = frenchMatches.find(f => 
          f.index > dutch.index && f.index < dutch.index + 2000
        );
        
        if (nextFrench) {
          const key = `${dutch.value.toLowerCase()}_${nextFrench.value.toLowerCase()}`;
          if (!seen.has(key)) {
            words.push({ dutch: dutch.value, french: nextFrench.value });
            seen.add(key);
          }
        }
      }
    }
    
    return words;
  }

  /**
   * Récupère ou génère une explication détaillée d'un mot en néerlandais
   * L'explication est uniquement en néerlandais, sans traduction
   * @param wordId L'ID du mot dans la DB
   * @param dutchWord Le mot en néerlandais à expliquer
   * @returns L'explication du mot en néerlandais
   */
  async getOrGenerateWordExplanation(wordId: string, dutchWord: string): Promise<string> {
    // 1. Vérifier si l'explication existe déjà dans la DB
    const storedExplanation = await this.getStoredExplanation(wordId);
    
    if (storedExplanation) {
      console.log(`Explication récupérée depuis DB pour wordId: ${wordId}`);
      return storedExplanation;
    }
    
    // 2. Générer une nouvelle explication avec DeepSeek
    console.log(`Génération d'une nouvelle explication pour wordId: ${wordId}, mot: ${dutchWord}`);
    const explanation = await this.generateWordExplanation(dutchWord);
    
    // 3. Sauvegarder l'explication dans la DB
    if (explanation) {
      await this.saveExplanationToDatabase(wordId, explanation);
    }
    
    return explanation || 'Désolé, je n\'ai pas pu générer d\'explication pour ce mot.';
  }

  /**
   * Récupère l'explication stockée dans la DB
   */
  private async getStoredExplanation(wordId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('nlapp_word_explanations')
        .select('explanation_text')
        .eq('word_id', wordId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // Aucun résultat trouvé, c'est normal
          return null;
        }
        console.error('Error fetching stored explanation:', error);
        return null;
      }
      
      if (!data || !data.explanation_text) {
        return null;
      }
      
      return data.explanation_text;
    } catch (error) {
      console.error('Error fetching stored explanation:', error);
      return null;
    }
  }

  /**
   * Sauvegarde l'explication dans la DB
   */
  private async saveExplanationToDatabase(wordId: string, explanation: string): Promise<void> {
    try {
      const { error } = await this.supabaseService.client
        .from('nlapp_word_explanations')
        .upsert({
          word_id: wordId,
          explanation_text: explanation,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'word_id'
        });
      
      if (error) {
        console.error('Error saving explanation to database:', error);
      } else {
        console.log(`Explication sauvegardée avec succès pour wordId: ${wordId}`);
      }
    } catch (error) {
      console.error('Error saving explanation:', error);
    }
  }

  /**
   * Génère une explication détaillée d'un mot en néerlandais avec DeepSeek
   * L'explication est uniquement en néerlandais, sans traduction
   */
  private async generateWordExplanation(dutchWord: string): Promise<string> {
    try {
      const prompt = this.buildExplanationPrompt(dutchWord);
      
      const headers = await this.getAuthHeaders();
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'Je t\'envoie un mot en néerlandais. Ton rôle est de donner une explication STRUCTURÉE et PRÉCISE en français (2-3 phrases maximum). IMPORTANT : Réponds l\'explication en français, mais garde TOUS les termes néerlandais (parties du mot décomposé, racines, préfixes, suffixes) en néerlandais pour rester cohérent avec l\'apprentissage. Pour chaque mot : 1) Décompose-le en ses parties constitutives (racine, préfixe, suffixe) en gardant les termes néerlandais. 2) Explique la signification de chaque partie de façon simple et précise en français : racine = sens de base, préfixe = modification/orientation du sens, suffixe = transformation grammaticale. 3) Pour les noms, adjectifs, adverbes ou verbes, indique la catégorie grammaticale et la formation du mot. 4) Donne uniquement les informations nécessaires pour comprendre la formation et le sens originel. Ne reformule pas simplement la définition, ne mets pas de bla-bla, ne parle pas de fréquence ou d\'usage à moins que ce soit essentiel. Format : "Mot" → formé de "partie1_néerlandais" (sens en français) + "partie2_néerlandais" (sens en français), signifie "sens originel en français".'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 250
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

      return content.trim();
    } catch (error) {
      console.error('Error generating word explanation:', error);
      return 'Erreur lors de la génération de l\'explication. Veuillez réessayer.';
    }
  }

  /**
   * Construit le prompt pour demander une explication du mot
   */
  private buildExplanationPrompt(dutchWord: string): string {
    return `Explique-moi le mot néerlandais "${dutchWord}" en 2-3 phrases maximum, en français.

Écoute attentivement, voici comment tu dois traiter ce mot :

1. Décompose le mot en ses parties constitutives : racine, préfixe, suffixe. GARDE les termes néerlandais pour les parties du mot.

2. Explique la signification de chaque partie de façon simple et précise en français :
   - racine = sens de base du mot
   - préfixe = modification ou orientation du sens
   - suffixe = transformation grammaticale ou création d'une propriété

3. Pour les noms, adjectifs, adverbes ou verbes, indique la catégorie grammaticale et la formation du mot.

4. Donne uniquement les informations nécessaires pour comprendre la formation et le sens originel du mot.

IMPORTANT : 
- Réponds l'explication EN FRANÇAIS
- GARDE tous les termes néerlandais (parties du mot décomposé, racines, préfixes, suffixes) EN NÉERLANDAIS
- Ne reformule pas simplement la définition
- Ne mets pas de bla-bla
- Ne parle pas de fréquence ou d'usage à moins que ce soit essentiel à la compréhension de la formation

Format de réponse souhaité (explication en français, termes néerlandais conservés) :
- Pour un adjectif : "volledig" → formé de "vol" (plein) + "-edig" (suffixe formant un adjectif), signifie "complet".
- Pour un nom : "inhoud" → formé de "houden" (tenir) + "in-" (dans), signifie "ce qui se trouve à l'intérieur".
- Pour un verbe : "inhouden" → "houden" (tenir) + "in-" (dans), signifie "contenir".`;
  }
}

