import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Word } from '../../../core/models/word.model';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { QuizDirection } from '../../../core/models/progress.model';

@Component({
  selector: 'app-typing-practice',
  imports: [CommonModule],
  templateUrl: './typing-practice.html',
  styleUrl: './typing-practice.css',
})
export class TypingPractice implements OnInit {
  private progressService = inject(ProgressService);
  private authService = inject(AuthService);

  @Input() words: Word[] = [];
  @Input() direction: QuizDirection = 'french_to_dutch';
  @Output() completed = new EventEmitter<{ correct: number; total: number }>();
  @Output() reverseRequested = new EventEmitter<void>();

  currentIndex = 0;
  currentWord: Word | null = null;
  userInput: string = '';
  correctAnswer: string = '';
  showResult = false;
  isCorrect = false;
  score = { correct: 0, total: 0 };
  letterCount = 0;
  expectedLength = 0;

  ngOnInit() {
    if (this.words.length > 0) {
      this.loadQuestion();
    }
  }

  loadQuestion() {
    if (this.currentIndex >= this.words.length) {
      this.completed.emit(this.score);
      return;
    }

    this.currentWord = this.words[this.currentIndex];
    this.userInput = '';
    this.showResult = false;
    this.isCorrect = false;
    this.letterCount = 0;

    if (this.direction === 'french_to_dutch') {
      this.correctAnswer = this.currentWord.dutch_text;
    } else {
      this.correctAnswer = this.currentWord.french_text;
    }

    this.expectedLength = this.correctAnswer.length;
  }

  onInputChange(event: Event) {
    const input = (event.target as HTMLInputElement).value;
    this.userInput = input;
    this.letterCount = input.length;

    // Validation caractère par caractère
    if (this.letterCount <= this.expectedLength) {
      const expectedChar = this.correctAnswer[this.letterCount - 1];
      const inputChar = input[this.letterCount - 1];
      
      if (expectedChar && inputChar && expectedChar.toLowerCase() !== inputChar.toLowerCase()) {
        // Caractère incorrect, mais on laisse l'utilisateur continuer
      }
    }
  }

  validateAnswer() {
    if (!this.userInput.trim()) {
      return;
    }

    this.isCorrect = this.userInput.trim().toLowerCase() === this.correctAnswer.toLowerCase();
    this.showResult = true;
    this.score.total++;

    if (this.isCorrect) {
      this.score.correct++;
    }

    // Enregistrer la tentative
    const user = this.authService.getCurrentUser();
    if (user && this.currentWord) {
      this.progressService.recordQuizAttempt(
        user.id,
        this.currentWord.id,
        'typing',
        this.direction,
        this.userInput.trim(),
        this.correctAnswer,
        this.isCorrect
      );
    }
  }

  nextQuestion() {
    this.currentIndex++;
    this.loadQuestion();
  }

  getQuestionText(): string {
    if (!this.currentWord) return '';
    return this.direction === 'french_to_dutch' 
      ? this.currentWord.french_text 
      : this.currentWord.dutch_text;
  }

  getQuestionLabel(): string {
    return this.direction === 'french_to_dutch' 
      ? 'Écrivez en néerlandais :' 
      : 'Écrivez en français :';
  }

  getInputClass(): string {
    if (!this.showResult) {
      return '';
    }
    return this.isCorrect ? 'correct' : 'incorrect';
  }
}
