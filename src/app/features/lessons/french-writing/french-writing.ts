import { Component, Input, Output, EventEmitter, OnInit, inject, ViewChildren, QueryList, ElementRef, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Word } from '../../../core/models/word.model';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { QuizDirection } from '../../../core/models/progress.model';
import { AudioService } from '../../../core/services/audio.service';

@Component({
  selector: 'app-french-writing',
  imports: [CommonModule],
  templateUrl: './french-writing.html',
  styleUrl: './french-writing.css',
})
export class FrenchWriting implements OnInit, AfterViewInit, OnChanges {
  private progressService = inject(ProgressService);
  private authService = inject(AuthService);
  audioService = inject(AudioService);

  @Input() words: Word[] = [];
  @Input() direction: QuizDirection = 'french_to_dutch';
  @Output() completed = new EventEmitter<{ correct: number; total: number }>();
  @Output() reverseRequested = new EventEmitter<void>();
  @Output() nextGameRequested = new EventEmitter<void>();

  @ViewChildren('letterInput') letterInputElements!: QueryList<ElementRef<HTMLInputElement>>;

  currentIndex = 0;
  currentWord: Word | null = null;
  letterInputs: string[] = [];
  correctAnswer: string = '';
  showResult = false;
  isCorrect = false;
  score = { correct: 0, total: 0 };
  expectedLength = 0;
  isCompleted = false;

  /**
   * Normalise une lettre en supprimant les accents pour la comparaison
   * Exemple: é -> e, à -> a, ç -> c
   */
  private normalizeLetter(letter: string): string {
    if (!letter) return '';
    return letter.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  ngAfterViewInit() {
    this.focusFirstInput();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Réinitialiser le composant quand la direction change
    if (changes['direction'] && !changes['direction'].firstChange) {
      this.currentIndex = 0;
      this.score = { correct: 0, total: 0 };
      this.showResult = false;
      this.isCorrect = false;
      this.isCompleted = false;
      if (this.words.length > 0) {
        this.loadQuestion();
      }
    }
    // Réinitialiser aussi si les mots changent
    if (changes['words'] && !changes['words'].firstChange) {
      this.currentIndex = 0;
      this.score = { correct: 0, total: 0 };
      this.showResult = false;
      this.isCorrect = false;
      this.isCompleted = false;
      if (this.words.length > 0) {
        this.loadQuestion();
      }
    }
  }

  focusFirstInput(): void {
    setTimeout(() => {
      const inputs = this.letterInputElements.toArray();
      if (inputs.length > 0 && inputs[0]) {
        inputs[0].nativeElement.focus();
      }
    }, 100);
  }

  ngOnInit() {
    if (this.words.length > 0) {
      this.loadQuestion();
    }
  }

  loadQuestion() {
    if (this.currentIndex >= this.words.length) {
      this.isCompleted = true;
      this.completed.emit(this.score);
      return;
    }
    
    this.isCompleted = false;

    this.currentWord = this.words[this.currentIndex];
    this.showResult = false;
    this.isCorrect = false;

    // Utiliser la direction pour déterminer quel texte afficher et quel texte demander
    if (this.direction === 'french_to_dutch') {
      // Afficher le français et demander d'écrire le néerlandais
      this.correctAnswer = this.currentWord.dutch_text;
    } else {
      // Afficher le néerlandais et demander d'écrire le français
      this.correctAnswer = this.currentWord.french_text;
    }
    this.expectedLength = this.correctAnswer.length;
    this.initializeLetterInputs();
    this.focusFirstInput();
  }

  initializeLetterInputs(): void {
    this.letterInputs = new Array(this.correctAnswer.length).fill('');
  }

  onLetterInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value;
    
    if (value.length > 1) {
      value = value.slice(-1);
    }
    
    const isCorrect = this.normalizeLetter(value) === this.normalizeLetter(this.correctAnswer[index] || '');
    const newLetterInputs = [...this.letterInputs];
    newLetterInputs[index] = value;
    this.letterInputs = newLetterInputs;
    input.value = value;
    
    if (!isCorrect && value) {
      for (let i = index + 1; i < this.letterInputs.length; i++) {
        newLetterInputs[i] = '';
      }
      this.letterInputs = newLetterInputs;
    }
    
    setTimeout(() => {
      const inputs = this.letterInputElements.toArray();
      inputs.forEach((inputRef, i) => {
        const expectedValue = this.letterInputs[i] || '';
        if (inputRef.nativeElement.value !== expectedValue && i !== index) {
          inputRef.nativeElement.value = expectedValue;
        }
      });
      
      const firstIncorrectIndex = this.getFirstIncorrectIndex();
      
      if (value && isCorrect && firstIncorrectIndex === -1 && index < this.letterInputs.length - 1) {
        const updatedInputs = [...this.letterInputs];
        updatedInputs[index + 1] = '';
        this.letterInputs = updatedInputs;
        
        if (inputs[index + 1]) {
          const nextInput = inputs[index + 1].nativeElement;
          nextInput.value = '';
          nextInput.focus();
        }
      } else {
        if (firstIncorrectIndex !== -1) {
          const incorrectInput = inputs[firstIncorrectIndex];
          if (incorrectInput) {
            incorrectInput.nativeElement.focus();
            incorrectInput.nativeElement.select();
          }
        } else if (!isCorrect && value) {
          input.focus();
          input.select();
        } else if (!value) {
          input.focus();
        }
      }
      
      if (this.isWordCompleteAndCorrect()) {
        setTimeout(() => {
          this.validateAnswer();
        }, 300);
      }
    }, 0);
  }

  isWordCompleteAndCorrect(): boolean {
    if (this.showResult) return false;
    
    if (this.letterInputs.length !== this.correctAnswer.length) return false;
    
    for (let i = 0; i < this.correctAnswer.length; i++) {
      const userLetter = this.letterInputs[i] || '';
      const correctLetter = this.correctAnswer[i] || '';
      if (!userLetter || this.normalizeLetter(userLetter) !== this.normalizeLetter(correctLetter)) {
        return false;
      }
    }
    
    return true;
  }

  onKeyDown(index: number, event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    
    if (event.key === 'Backspace' && !input.value && index > 0) {
      event.preventDefault();
      const inputs = this.letterInputElements.toArray();
      if (inputs[index - 1]) {
        const prevInput = inputs[index - 1].nativeElement;
        prevInput.focus();
        prevInput.select();
      }
    }
    
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      const inputs = this.letterInputElements.toArray();
      if (inputs[index - 1]) {
        inputs[index - 1].nativeElement.focus();
      }
    }
    
    if (event.key === 'ArrowRight' && index < this.letterInputs.length - 1) {
      event.preventDefault();
      const inputs = this.letterInputElements.toArray();
      if (inputs[index + 1]) {
        inputs[index + 1].nativeElement.focus();
      }
    }
    
    if (event.key === 'Enter') {
      event.preventDefault();
      this.validateAnswer();
    }
  }

  getLetterStatus(index: number): 'correct' | 'incorrect' | 'empty' {
    const userLetter = this.letterInputs[index] || '';
    const correctLetter = this.correctAnswer[index] || '';
    
    if (!userLetter) return 'empty';
    return this.normalizeLetter(userLetter) === this.normalizeLetter(correctLetter) ? 'correct' : 'incorrect';
  }

  getFirstIncorrectIndex(): number {
    for (let i = 0; i < this.correctAnswer.length; i++) {
      const userLetter = this.letterInputs[i] || '';
      const correctLetter = this.correctAnswer[i] || '';
      if (userLetter && this.normalizeLetter(userLetter) !== this.normalizeLetter(correctLetter)) {
        return i;
      }
    }
    return -1;
  }

  canEditInput(index: number): boolean {
    for (let i = 0; i < index; i++) {
      const userLetter = this.letterInputs[i] || '';
      const correctLetter = this.correctAnswer[i] || '';
      if (!userLetter || this.normalizeLetter(userLetter) !== this.normalizeLetter(correctLetter)) {
        return false;
      }
    }
    return true;
  }

  validateAnswer() {
    const userAnswer = this.letterInputs.join('').trim();
    if (!userAnswer) {
      return;
    }

    this.isCorrect = this.normalizeLetter(userAnswer) === this.normalizeLetter(this.correctAnswer);
    this.showResult = true;
    this.score.total++;

    if (this.isCorrect) {
      this.score.correct++;
    }

    const user = this.authService.getCurrentUser();
    if (user && this.currentWord) {
      this.progressService.recordQuizAttempt(
        user.id,
        this.currentWord.id,
        'typing',
        this.direction,
        userAnswer,
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

  getQuestionText(): string {
    if (!this.currentWord) return '';
    // Afficher le texte selon la direction
    if (this.direction === 'french_to_dutch') {
      return this.currentWord.french_text;
    } else {
      return this.currentWord.dutch_text;
    }
  }

  playAudio(): void {
    if (!this.currentWord) return;
    // Toujours lire le néerlandais (la langue à apprendre)
    // Peu importe la direction, on apprend toujours le néerlandais
    if (this.currentWord.dutch_text) {
      this.audioService.speak(this.currentWord.dutch_text, 'nl-NL');
    }
  }
}

