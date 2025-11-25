import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Word } from '../../../core/models/word.model';
import { WordService } from '../../../core/services/word.service';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { QuizDirection } from '../../../core/models/progress.model';
import { AudioService } from '../../../core/services/audio.service';

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
  audioService = inject(AudioService);

  @Input() words: Word[] = [];
  @Input() direction: QuizDirection = 'french_to_dutch';
  @Output() completed = new EventEmitter<{ correct: number; total: number }>();
  @Output() reverseRequested = new EventEmitter<void>();
  @Output() nextGameRequested = new EventEmitter<void>();

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

  /**
   * Mélange un tableau de manière aléatoire (algorithme Fisher-Yates)
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async generateChoices(correct: string) {
    const excludeIds = this.words.map(w => w.id);
    
    // Sélectionner des mots similaires de la DB au lieu de mots complètement aléatoires
    const similarWords = await this.wordService.getSimilarWords(
      correct, 
      3, 
      excludeIds,
      this.direction
    );
    
    const wrongAnswers = similarWords.map(w => 
      this.direction === 'french_to_dutch' ? w.dutch_text : w.french_text
    );

    // Si on n'a pas assez de mots similaires dans la DB, compléter avec des mots aléatoires
    if (wrongAnswers.length < 3) {
      const randomWords = await this.wordService.getRandomWords(
        3 - wrongAnswers.length, 
        [...excludeIds, ...similarWords.map(w => w.id)]
      );
      const additionalAnswers = randomWords.map(w => 
        this.direction === 'french_to_dutch' ? w.dutch_text : w.french_text
      );
      wrongAnswers.push(...additionalAnswers);
    }

    // Mélanger les choix de manière aléatoire avec Fisher-Yates
    const allChoices = [correct, ...wrongAnswers.slice(0, 3)];
    this.choices = this.shuffleArray(allChoices);
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

  previousQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.loadQuestion();
    }
  }

  nextQuestion() {
    this.currentIndex++;
    this.loadQuestion();
  }

  skipQuestion() {
    if (this.currentIndex === this.words.length - 1) {
      // Si c'est la dernière question, afficher la section de résultat avec les options de fin
      this.showResult = true;
      this.isCorrect = false;
      // Ne pas incrémenter le score car on passe sans répondre
    } else {
      // Passer à la question suivante sans répondre
      this.currentIndex++;
      this.loadQuestion();
    }
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

  playAudio(): void {
    if (!this.currentWord) return;
    // Lire le texte selon la direction (le texte affiché dans la question)
    if (this.direction === 'french_to_dutch') {
      if (this.currentWord.french_text) {
        this.audioService.speak(this.currentWord.french_text, 'fr-FR');
      }
    } else {
      if (this.currentWord.dutch_text) {
        this.audioService.speak(this.currentWord.dutch_text, 'nl-NL');
      }
    }
  }
}
