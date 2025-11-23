import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface FillInTheBlankSentence {
  sentence: string;
  missingWord: string;
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
   * @returns Une phrase avec le mot manquant
   */
  async getOrGenerateFillInTheBlankSentence(
    wordId: string,
    word: string,
    direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french',
    existingSentences: string[] = []
  ): Promise<FillInTheBlankSentence> {
    // 1. Vérifier si une phrase existe déjà dans la DB
    const storedSentence = await this.getStoredSentence(wordId, direction);
    
    if (storedSentence) {
      // Utiliser la phrase de la DB
      return {
        sentence: storedSentence,
        missingWord: word
      };
    }
    
    // 2. Générer une nouvelle phrase avec DeepSeek
    const newSentence = await this.generateFillInTheBlankSentence(
      word,
      existingSentences,
      undefined,
      direction
    );
    
    // 3. Enregistrer la phrase dans la DB pour réutilisation future
    await this.saveSentenceToDatabase(wordId, newSentence.sentence, direction);
    
    return newSentence;
  }

  /**
   * Génère une phrase à trous avec le mot manquant
   * @param word Le mot à utiliser dans la phrase
   * @param existingSentences Phrases déjà utilisées pour ce mot (pour éviter les répétitions)
   * @param context Contexte optionnel pour la phrase
   * @param direction La direction de la traduction (détermine la langue de la phrase)
   * @returns Une phrase avec le mot manquant
   */
  async generateFillInTheBlankSentence(
    word: string,
    existingSentences: string[] = [],
    context?: string,
    direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french'
  ): Promise<FillInTheBlankSentence> {
    try {
      const prompt = this.buildPrompt(word, existingSentences, context, direction);
      
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
              content: 'Tu es un assistant qui crée des exercices de langue néerlandaise. Tu génères des phrases à trous où l\'utilisateur doit écrire le mot manquant.'
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
    direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french'
  ): string {
    const language = direction === 'dutch_to_french' ? 'néerlandais' : 'français';
    let prompt = `Crée une phrase SIMPLE et ÉVIDENTE en ${language} qui utilise le mot "${word}". `;
    
    if (context) {
      prompt += `Contexte: ${context}. `;
    }
    
    prompt += `La phrase doit être TRÈS SIMPLE et ÉVIDENTE pour un exercice de niveau moyen. `;
    prompt += `Le mot manquant doit être facile à deviner grâce au contexte de la phrase. `;
    
    if (existingSentences.length > 0) {
      prompt += `\n\nVoici des phrases déjà utilisées pour ce mot (NE PAS les répéter, créer quelque chose de différent) :\n`;
      existingSentences.forEach((sentence, index) => {
        prompt += `${index + 1}. ${sentence}\n`;
      });
      prompt += `\nCrée une phrase COMPLÈTEMENT DIFFÉRENTE de celles-ci. `;
    }
    
    prompt += `\nRéponds UNIQUEMENT au format JSON suivant (sans texte supplémentaire) :\n`;
    prompt += `{\n`;
    prompt += `  "sentence": "phrase avec [MOT] à la place du mot manquant",\n`;
    prompt += `  "missingWord": "${word}"\n`;
    prompt += `}\n`;
    prompt += `\nExemples de phrases simples et évidentes :\n`;
    prompt += `- Si le mot est "groen" (vert) : "De gras is [MOT] in de tuin." (L'herbe est [MOT] dans le jardin)\n`;
    prompt += `- Si le mot est "boek" (livre) : "Ik lees een [MOT]." (Je lis un [MOT])\n`;
    prompt += `- Si le mot est "water" (eau) : "Ik drink [MOT]." (Je bois [MOT])\n`;
    prompt += `\nLa phrase doit être courte (maximum 8-10 mots), simple et le contexte doit rendre le mot évident.`;
    
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
          missingWord: parsed.missingWord || correctWord
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
      `De gras is [MOT] in de tuin.`,
      `Ik zie een [MOT] auto.`,
      `Het boek is [MOT].`,
      `Ik heb een [MOT] pen.`
    ];
    
    const sentence = fallbackSentences[Math.floor(Math.random() * fallbackSentences.length)]
      .replace('[MOT]', '_____');
    
    return {
      sentence,
      missingWord: word
    };
  }

  /**
   * Récupère la phrase stockée dans la DB pour un mot selon la direction
   */
  private async getStoredSentence(
    wordId: string, 
    direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french'
  ): Promise<string | null> {
    try {
      if (direction === 'dutch_to_french') {
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
      } else {
        // Direction: french_to_dutch - phrase en français
        const { data, error } = await this.supabaseService.client
          .from('nlapp_words')
          .select('fill_in_blank_sentence_fr')
          .eq('id', wordId)
          .single();
        
        if (error) {
          console.error('Error fetching french sentence:', error);
          // Si la colonne n'existe pas, afficher un message d'aide
          if (error.code === '42703' || error.code === 'PGRST204') {
            console.error('⚠️ La colonne fill_in_blank_sentence_fr n\'existe pas dans la base de données.');
            console.error('💡 Solution: Exécutez le script SQL fix-french-sentence-column.sql dans Supabase.');
          }
          return null;
        }
        
        if (!data) {
          return null;
        }
        
        const sentence = data.fill_in_blank_sentence_fr;
        if (sentence && sentence.trim()) {
          console.log(`Phrase française récupérée depuis DB pour wordId: ${wordId}`);
          return sentence;
        }
        return null;
      }
    } catch (error) {
      console.error('Error fetching stored sentence:', error);
      return null;
    }
  }

  /**
   * Enregistre la phrase générée dans la DB pour réutilisation future
   */
  private async saveSentenceToDatabase(
    wordId: string, 
    sentence: string,
    direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french'
  ): Promise<void> {
    try {
      const updateData = direction === 'dutch_to_french'
        ? { fill_in_blank_sentence: sentence }
        : { fill_in_blank_sentence_fr: sentence };
      
      const columnName = direction === 'dutch_to_french' 
        ? 'fill_in_blank_sentence' 
        : 'fill_in_blank_sentence_fr';
      
      console.log(`Sauvegarde phrase ${direction === 'dutch_to_french' ? 'néerlandaise' : 'française'} dans ${columnName} pour wordId: ${wordId}`);
      
      const { data, error } = await this.supabaseService.client
        .from('nlapp_words')
        .update(updateData)
        .eq('id', wordId)
        .select();
      
      if (error) {
        console.error('Error saving sentence to database:', error);
        console.error('Update data:', updateData);
        console.error('WordId:', wordId);
        // Si la colonne n'existe pas, afficher un message d'aide
        if (error.code === '42703' || error.code === 'PGRST204') {
          console.error('⚠️ La colonne fill_in_blank_sentence_fr n\'existe pas dans la base de données.');
          console.error('💡 Solution: Exécutez le script SQL fix-french-sentence-column.sql dans Supabase.');
        }
      } else {
        console.log(`Phrase ${direction === 'dutch_to_french' ? 'néerlandaise' : 'française'} sauvegardée avec succès pour wordId: ${wordId}`);
      }
    } catch (error) {
      console.error('Error saving sentence:', error);
    }
  }
}

