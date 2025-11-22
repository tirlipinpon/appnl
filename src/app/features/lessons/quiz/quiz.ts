import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Word } from '../../../core/models/word.model';
import { WordService } from '../../../core/services/word.service';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { QuizDirection } from '../../../core/models/progress.model';

@Component({
  selector: 'app-quiz',
  imports: [CommonModule],
  templateUrl: './quiz.html',
  styleUrl: './quiz.css',
})
export class Quiz implements OnInit {
  private wordService = inject(WordService);
  private progressService = inject(ProgressService);
  private authService = inject(AuthService);

  @Input() words: Word[] = [];
  @Input() direction: QuizDirection = 'french_to_dutch';
  @Output() completed = new EventEmitter<{ correct: number; total: number }>();

  currentIndex = 0;
  currentWord: Word | null = null;
  choices: string[] = [];
  correctAnswer: string = '';
  selectedAnswer: string = '';
  showResult = false;
  isCorrect = false;
  score = { correct: 0, total: 0 };

  async ngOnInit() {
    if (this.words.length > 0) {
      await this.loadQuestion();
    }
  }

  async loadQuestion() {
    if (this.currentIndex >= this.words.length) {
      this.completed.emit(this.score);
      return;
    }

    this.currentWord = this.words[this.currentIndex];
    this.showResult = false;
    this.selectedAnswer = '';

    if (this.direction === 'french_to_dutch') {
      this.correctAnswer = this.currentWord.dutch_text;
      await this.generateChoices(this.currentWord.dutch_text);
    } else {
      this.correctAnswer = this.currentWord.french_text;
      await this.generateChoices(this.currentWord.french_text);
    }
  }

  async generateChoices(correct: string) {
    const excludeIds = this.words.map(w => w.id);
    const randomWords = await this.wordService.getRandomWords(3, excludeIds);
    
    const wrongAnswers = randomWords.map(w => 
      this.direction === 'french_to_dutch' ? w.dutch_text : w.french_text
    );

    this.choices = [correct, ...wrongAnswers].sort(() => Math.random() - 0.5);
  }

  selectAnswer(answer: string) {
    if (this.showResult) return;

    this.selectedAnswer = answer;
    this.isCorrect = answer === this.correctAnswer;
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
        'multiple_choice',
        this.direction,
        answer,
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
      ? 'Traduisez en néerlandais :' 
      : 'Traduisez en français :';
  }
}
