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
  letterInputs: string[] = [];
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
            'dutch_to_french',
            []
          );
          this.sentences.push(sentence);
        } else {
          // Phrase en français avec mot français manquant
          const sentence = await this.deepSeekService.getOrGenerateFillInTheBlankSentence(
            word.id,
            word.french_text,
            'french_to_dutch',
            []
          );
          this.sentences.push(sentence);
        }
      }
      
      if (this.sentences.length > 0) {
        this.currentSentence = this.sentences[0];
        this.initializeLetterInputs();
      }
    } catch (error) {
      console.error('Error loading sentences:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async checkAnswer() {
    if (this.showResult) return;
    
    const userAnswer = this.letterInputs.join('').trim();
    if (!userAnswer) return;
    
    const currentWord = this.words[this.currentIndex];
    const correctAnswer = this.getCorrectAnswer();
    
    this.isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
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
        userAnswer,
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
      this.initializeLetterInputs();
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

  getCorrectAnswer(): string {
    const currentWord = this.words[this.currentIndex];
    if (!currentWord) return '';
    return this.direction === 'dutch_to_french' 
      ? currentWord.dutch_text 
      : currentWord.french_text;
  }

  initializeLetterInputs(): void {
    const correctAnswer = this.getCorrectAnswer();
    this.letterInputs = new Array(correctAnswer.length).fill('');
  }

  getLetterStatus(index: number): 'correct' | 'incorrect' | 'empty' {
    if (this.showResult) {
      const correctAnswer = this.getCorrectAnswer();
      const userLetter = this.letterInputs[index]?.toLowerCase() || '';
      const correctLetter = correctAnswer[index]?.toLowerCase() || '';
      
      if (!userLetter) return 'empty';
      return userLetter === correctLetter ? 'correct' : 'incorrect';
    }
    
    // En temps réel pendant la saisie
    const correctAnswer = this.getCorrectAnswer();
    const userLetter = this.letterInputs[index]?.toLowerCase() || '';
    const correctLetter = correctAnswer[index]?.toLowerCase() || '';
    
    if (!userLetter) return 'empty';
    return userLetter === correctLetter ? 'correct' : 'incorrect';
  }

  getCorrectLettersCount(): number {
    const correctAnswer = this.getCorrectAnswer();
    let count = 0;
    for (let i = 0; i < correctAnswer.length; i++) {
      const userLetter = this.letterInputs[i]?.toLowerCase() || '';
      const correctLetter = correctAnswer[i]?.toLowerCase() || '';
      if (userLetter === correctLetter) {
        count++;
      }
    }
    return count;
  }

  onLetterInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value;
    
    // Ne garder que la dernière lettre si plusieurs caractères sont entrés
    if (value.length > 1) {
      value = value.slice(-1);
      this.letterInputs[index] = value;
      input.value = value;
    } else {
      this.letterInputs[index] = value;
    }
    
    // Passer automatiquement à l'input suivant si une lettre est saisie
    if (value && index < this.letterInputs.length - 1) {
      const nextInput = document.querySelector(`input[data-letter-index="${index + 1}"]`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
      }
    }
    
    // Vérifier si tous les inputs sont remplis pour activer le bouton vérifier
    this.userInput = this.letterInputs.join('');
  }

  onKeyDown(index: number, event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    
    // Gérer Backspace
    if (event.key === 'Backspace' && !input.value && index > 0) {
      const prevInput = document.querySelector(`input[data-letter-index="${index - 1}"]`) as HTMLInputElement;
      if (prevInput) {
        prevInput.focus();
        prevInput.select();
      }
    }
    
    // Gérer les flèches
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      const prevInput = document.querySelector(`input[data-letter-index="${index - 1}"]`) as HTMLInputElement;
      if (prevInput) {
        prevInput.focus();
      }
    }
    
    if (event.key === 'ArrowRight' && index < this.letterInputs.length - 1) {
      event.preventDefault();
      const nextInput = document.querySelector(`input[data-letter-index="${index + 1}"]`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
      }
    }
    
    // Gérer Enter pour vérifier
    if (event.key === 'Enter') {
      event.preventDefault();
      this.checkAnswer();
    }
  }
}

