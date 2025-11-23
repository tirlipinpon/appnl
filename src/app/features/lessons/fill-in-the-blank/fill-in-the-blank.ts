import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Word } from '../../../core/models/word.model';
import { DeepSeekService, FillInTheBlankSentence } from '../../../core/services/deepseek.service';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-fill-in-the-blank',
  imports: [CommonModule, FormsModule],
  templateUrl: './fill-in-the-blank.html',
  styleUrl: './fill-in-the-blank.css',
})
export class FillInTheBlank implements OnInit {
  private deepSeekService = inject(DeepSeekService);
  private progressService = inject(ProgressService);
  private authService = inject(AuthService);
  private supabaseService = inject(SupabaseService);

  @Input() words: Word[] = [];
  @Input() direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french';
  @Output() completed = new EventEmitter<{ correct: number; total: number }>();
  @Output() reverseRequested = new EventEmitter<void>();

  currentIndex = 0;
  currentSentence: FillInTheBlankSentence | null = null;
  userInput: string = '';
  showResult = false;
  isCorrect = false;
  score = { correct: 0, total: 0 };
  isLoading = false;
  sentences: FillInTheBlankSentence[] = [];

  async ngOnInit() {
    await this.loadSentences();
  }

  async loadSentences() {
    this.isLoading = true;
    try {
      // Générer une phrase pour chaque mot
      this.sentences = [];
      
      for (const word of this.words) {
        // Selon la direction, générer une phrase dans la langue appropriée
        if (this.direction === 'dutch_to_french') {
          // Phrase en néerlandais avec mot néerlandais manquant
          const sentence = await this.deepSeekService.getOrGenerateFillInTheBlankSentence(
            word.id,
            word.dutch_text,
            []
          );
          this.sentences.push(sentence);
        } else {
          // Phrase en français avec mot français manquant
          // Pour l'instant, on génère une phrase simple en français
          // Note: On pourrait créer une méthode séparée pour générer des phrases françaises
          const sentence = await this.deepSeekService.getOrGenerateFillInTheBlankSentence(
            word.id,
            word.french_text,
            []
          );
          // Modifier la phrase pour qu'elle soit en français (pour l'instant, on utilise la même logique)
          this.sentences.push({
            sentence: sentence.sentence.replace(word.dutch_text, word.french_text),
            missingWord: word.french_text
          });
        }
      }
      
      if (this.sentences.length > 0) {
        this.currentSentence = this.sentences[0];
      }
    } catch (error) {
      console.error('Error loading sentences:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async checkAnswer() {
    if (this.showResult || !this.userInput.trim()) return;
    
    const currentWord = this.words[this.currentIndex];
    // Comparaison insensible à la casse selon la direction
    const correctAnswer = this.direction === 'dutch_to_french' 
      ? currentWord.dutch_text 
      : currentWord.french_text;
    
    this.isCorrect = this.userInput.trim().toLowerCase() === correctAnswer.toLowerCase();
    this.showResult = true;
    this.score.total++;
    
    if (this.isCorrect) {
      this.score.correct++;
    }

    // Enregistrer la tentative dans Supabase pour la répétition espacée
    const user = this.authService.getCurrentUser();
    if (user && currentWord) {
      await this.progressService.recordQuizAttempt(
        user.id,
        currentWord.id,
        'fill_in_blank',
        this.direction,
        this.userInput.trim(),
        correctAnswer,
        this.isCorrect
      );
    }
  }

  nextQuestion() {
    if (this.currentIndex < this.words.length - 1) {
      this.currentIndex++;
      this.currentSentence = this.sentences[this.currentIndex];
      this.userInput = '';
      this.showResult = false;
      this.isCorrect = false;
    } else {
      this.completed.emit(this.score);
    }
  }

  getCurrentWord(): Word | null {
    return this.words[this.currentIndex] || null;
  }

  getSentenceWithBlank(): string {
    if (!this.currentSentence) return '';
    let sentence = this.currentSentence.sentence;
    // Remplacer [MOT] ou toute autre variante par _____
    sentence = sentence.replace(/\[MOT\]/gi, '_____');
    sentence = sentence.replace(/\{MOT\}/gi, '_____');
    // Si la phrase ne contient pas déjà de blank, ajouter _____ à la fin
    if (!sentence.includes('_____') && !sentence.includes('___')) {
      sentence += ' _____';
    }
    return sentence;
  }
}

