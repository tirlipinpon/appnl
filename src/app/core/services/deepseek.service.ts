import { Injectable } from '@angular/core';

export interface FillInTheBlankSentence {
  sentence: string;
  missingWord: string;
}

@Injectable({
  providedIn: 'root'
})
export class DeepSeekService {
  private readonly apiKey = 'sk-db6617f690b04336b0469ffa1c6bf839';
  private readonly apiUrl = 'https://api.deepseek.com/v1/chat/completions';

  /**
   * Génère une phrase à trous en néerlandais avec le mot manquant
   * @param word Le mot à utiliser dans la phrase (en néerlandais)
   * @param existingSentences Phrases déjà utilisées pour ce mot (pour éviter les répétitions)
   * @param context Contexte optionnel pour la phrase
   * @returns Une phrase avec le mot manquant
   */
  async generateFillInTheBlankSentence(
    word: string,
    existingSentences: string[] = [],
    context?: string
  ): Promise<FillInTheBlankSentence> {
    try {
      const prompt = this.buildPrompt(word, existingSentences, context);
      
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

  private buildPrompt(word: string, existingSentences: string[] = [], context?: string): string {
    let prompt = `Crée une phrase SIMPLE et ÉVIDENTE en néerlandais qui utilise le mot "${word}". `;
    
    if (context) {
      prompt += `Contexte: ${context}. `;
    }
    
    prompt += `La phrase doit être TRÈS SIMPLE et ÉVIDENTE pour un exercice de niveau débutant. `;
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
}

