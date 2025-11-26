import { Injectable, inject } from '@angular/core';
import { DeepSeekService } from './deepseek.service';
import { WordService } from './word.service';
import { LessonService } from './lesson.service';
import { ExtractedWord } from '../models/extracted-word.model';

@Injectable({
  providedIn: 'root'
})
export class TextExtractionService {
  private deepSeekService = inject(DeepSeekService);
  private wordService = inject(WordService);
  private lessonService = inject(LessonService);

  /**
   * Liste des stopwords néerlandais à exclure
   */
  private readonly stopwords = new Set([
    // Articles
    'de', 'het', 'een',
    // Prépositions
    'van', 'in', 'op', 'te', 'voor', 'met', 'aan', 'bij', 'door', 'over', 'onder', 
    'tussen', 'naast', 'tegen', 'zonder', 'tijdens', 'volgens',
    // Pronoms
    'ik', 'jij', 'je', 'hij', 'zij', 'ze', 'wij', 'we', 'jullie', 'u',
    // Verbes auxiliaires
    'is', 'zijn', 'heeft', 'hebben', 'wordt', 'worden', 'kan', 'kunnen', 
    'moet', 'moeten', 'zal', 'zullen',
    // Conjonctions
    'en', 'maar', 'of', 'want', 'omdat', 'zodat', 'terwijl', 'wanneer', 'als',
    // Autres
    'er', 'dat', 'die', 'dit', 'deze', 'wat', 'wie', 'waar'
  ]);

  /**
   * Extrait les mots importants d'un texte néerlandais et les traduit
   */
  async extractWordsFromText(text: string): Promise<ExtractedWord[]> {
    // Appeler DeepSeek pour extraire les mots
    const extractedWords = await this.deepSeekService.extractVocabularyWords(text);
    
    // Filtrer les stopwords côté client aussi (double sécurité)
    const filteredWords = extractedWords.filter(word => 
      !this.stopwords.has(word.dutch.toLowerCase().trim())
    );

    // Compter les fréquences et dédupliquer
    const wordMap = new Map<string, ExtractedWord>();
    
    filteredWords.forEach(word => {
      const dutchLower = word.dutch.toLowerCase().trim();
      if (wordMap.has(dutchLower)) {
        const existing = wordMap.get(dutchLower)!;
        existing.frequency = (existing.frequency || 1) + 1;
      } else {
        wordMap.set(dutchLower, {
          dutch_text: word.dutch.trim(),
          french_text: word.french.trim(),
          frequency: 1,
          selected: true
        });
      }
    });

    return Array.from(wordMap.values());
  }

  /**
   * Vérifie les doublons dans toutes les leçons
   */
  async checkDuplicates(words: ExtractedWord[]): Promise<ExtractedWord[]> {
    const dutchWords = words.map(w => w.dutch_text);
    const existingWords = await this.wordService.checkWordsExist(dutchWords);
    const lessons = await this.lessonService.getLessons();
    
    // Créer une map pour accéder rapidement aux leçons
    const lessonMap = new Map<string, string>();
    lessons.forEach(lesson => {
      lessonMap.set(lesson.id, lesson.title);
    });

    // Marquer les doublons
    return words.map(word => {
      const existing = existingWords.find(ew => 
        ew.dutch_text.toLowerCase().trim() === word.dutch_text.toLowerCase().trim()
      );
      
      if (existing) {
        return {
          ...word,
          isDuplicate: true,
          existingLessonId: existing.lesson_id,
          existingLessonTitle: lessonMap.get(existing.lesson_id) || 'Leçon inconnue'
        };
      }
      
      return word;
    });
  }
}

