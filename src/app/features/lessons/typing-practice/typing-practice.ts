import { Component, Input, Output, EventEmitter, OnInit, inject, ViewChildren, QueryList, ElementRef, AfterViewInit } from '@angular/core';
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
export class TypingPractice implements OnInit, AfterViewInit {
  private progressService = inject(ProgressService);
  private authService = inject(AuthService);

  @Input() words: Word[] = [];
  @Input() direction: QuizDirection = 'french_to_dutch';
  @Output() completed = new EventEmitter<{ correct: number; total: number }>();
  @Output() reverseRequested = new EventEmitter<void>();

  @ViewChildren('letterInput') letterInputElements!: QueryList<ElementRef<HTMLInputElement>>;

  currentIndex = 0;
  currentWord: Word | null = null;
  userInput: string = '';
  letterInputs: string[] = [];
  correctAnswer: string = '';
  showResult = false;
  isCorrect = false;
  score = { correct: 0, total: 0 };
  letterCount = 0;
  expectedLength = 0;

  ngAfterViewInit() {
    // S'assurer que les inputs sont bien initialisés
    this.focusFirstInput();
  }

  focusFirstInput(): void {
    // Mettre le focus sur le premier input après un court délai pour s'assurer que la vue est rendue
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
    this.initializeLetterInputs();
    // Mettre le focus sur le premier input du nouveau mot
    this.focusFirstInput();
  }

  initializeLetterInputs(): void {
    this.letterInputs = new Array(this.correctAnswer.length).fill('');
  }

  onLetterInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value;
    
    // Ne garder que la dernière lettre si plusieurs caractères sont entrés
    if (value.length > 1) {
      value = value.slice(-1);
    }
    
    // Vérifier si la lettre est correcte AVANT de mettre à jour le tableau
    const isCorrect = value.toLowerCase() === this.correctAnswer[index]?.toLowerCase();
    
    // Mettre à jour uniquement cet index dans le tableau
    const newLetterInputs = [...this.letterInputs];
    newLetterInputs[index] = value;
    this.letterInputs = newLetterInputs;
    
    // Forcer la mise à jour de la valeur de l'input actuel immédiatement
    input.value = value;
    
    // Vider tous les inputs suivants si la lettre actuelle est incorrecte
    if (!isCorrect && value) {
      for (let i = index + 1; i < this.letterInputs.length; i++) {
        newLetterInputs[i] = '';
      }
      this.letterInputs = newLetterInputs;
    }
    
    // S'assurer que les autres inputs ne sont PAS affectés par le binding
    setTimeout(() => {
      const inputs = this.letterInputElements.toArray();
      // Vérifier et corriger chaque input pour s'assurer qu'il correspond au tableau
      inputs.forEach((inputRef, i) => {
        const expectedValue = this.letterInputs[i] || '';
        if (inputRef.nativeElement.value !== expectedValue && i !== index) {
          // Si la valeur de l'input ne correspond pas au tableau, la corriger
          inputRef.nativeElement.value = expectedValue;
        }
      });
      
      // Trouver le premier input incorrect
      const firstIncorrectIndex = this.getFirstIncorrectIndex();
      
      // IMPORTANT: Ne passer au suivant QUE si la lettre est correcte ET qu'il n'y a pas d'erreur avant
      if (value && isCorrect && firstIncorrectIndex === -1 && index < this.letterInputs.length - 1) {
        // Vider explicitement l'input suivant dans le tableau
        const updatedInputs = [...this.letterInputs];
        updatedInputs[index + 1] = '';
        this.letterInputs = updatedInputs;
        
        if (inputs[index + 1]) {
          const nextInput = inputs[index + 1].nativeElement;
          // S'assurer que l'input suivant est vide
          nextInput.value = '';
          nextInput.focus();
        }
      } else {
        // Si la lettre est incorrecte, forcer le focus sur le premier input incorrect
        if (firstIncorrectIndex !== -1) {
          const incorrectInput = inputs[firstIncorrectIndex];
          if (incorrectInput) {
            incorrectInput.nativeElement.focus();
            incorrectInput.nativeElement.select();
          }
        } else if (!isCorrect && value) {
          // Si cette lettre est incorrecte, garder le focus dessus
          input.focus();
          input.select();
        } else if (!value) {
          // Si l'input est vide, garder le focus
          input.focus();
        }
      }
      
      // Vérifier si tous les inputs sont remplis ET corrects pour valider automatiquement
      if (this.isWordCompleteAndCorrect()) {
        // Attendre un peu pour que l'utilisateur voie la dernière lettre correcte
        setTimeout(() => {
          this.validateAnswer();
        }, 300);
      }
    }, 0);
    
    this.userInput = this.letterInputs.join('');
    this.letterCount = this.userInput.length;
  }

  /**
   * Vérifie si le mot est complètement rempli et correct
   */
  isWordCompleteAndCorrect(): boolean {
    if (this.showResult) return false; // Ne pas valider si déjà validé
    
    if (this.letterInputs.length !== this.correctAnswer.length) return false;
    
    // Vérifier que tous les inputs sont remplis et corrects
    for (let i = 0; i < this.correctAnswer.length; i++) {
      const userLetter = this.letterInputs[i]?.toLowerCase() || '';
      const correctLetter = this.correctAnswer[i]?.toLowerCase() || '';
      if (!userLetter || userLetter !== correctLetter) {
        return false;
      }
    }
    
    return true;
  }

  onInputFocus(index: number, event: Event): void {
    // Empêcher le focus sur un input qui ne peut pas être modifié
    if (!this.canEditInput(index)) {
      event.preventDefault();
      const firstIncorrectIndex = this.getFirstIncorrectIndex();
      if (firstIncorrectIndex !== -1) {
        setTimeout(() => {
          const inputs = this.letterInputElements.toArray();
          if (inputs[firstIncorrectIndex]) {
            inputs[firstIncorrectIndex].nativeElement.focus();
            inputs[firstIncorrectIndex].nativeElement.select();
          }
        }, 0);
      }
    }
  }

  onKeyDown(index: number, event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    
    // Empêcher le collage (Ctrl+V)
    if (event.ctrlKey && event.key === 'v') {
      event.preventDefault();
      navigator.clipboard.readText().then(text => {
        if (text && text.length > 0) {
          const inputs = this.letterInputElements.toArray();
          // Distribuer les caractères dans les inputs
          for (let i = 0; i < text.length && (index + i) < this.letterInputs.length; i++) {
            const char = text[i].toUpperCase();
            this.letterInputs[index + i] = char;
            if (inputs[index + i]) {
              inputs[index + i].nativeElement.value = char;
            }
          }
        }
      });
      return;
    }
    
    // Gérer Backspace
    if (event.key === 'Backspace' && !input.value && index > 0) {
      event.preventDefault();
      const inputs = this.letterInputElements.toArray();
      if (inputs[index - 1]) {
        const prevInput = inputs[index - 1].nativeElement;
        prevInput.focus();
        prevInput.select();
      }
    }
    
    // Gérer les flèches
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
    
    // Gérer Enter pour valider
    if (event.key === 'Enter') {
      event.preventDefault();
      this.validateAnswer();
    }
  }

  getLetterStatus(index: number): 'correct' | 'incorrect' | 'empty' {
    const userLetter = this.letterInputs[index]?.toLowerCase() || '';
    const correctLetter = this.correctAnswer[index]?.toLowerCase() || '';
    
    if (!userLetter) return 'empty';
    return userLetter === correctLetter ? 'correct' : 'incorrect';
  }

  getCorrectLettersCount(): number {
    let count = 0;
    for (let i = 0; i < this.correctAnswer.length; i++) {
      const userLetter = this.letterInputs[i]?.toLowerCase() || '';
      const correctLetter = this.correctAnswer[i]?.toLowerCase() || '';
      if (userLetter === correctLetter) {
        count++;
      }
    }
    return count;
  }

  /**
   * Trouve le premier index avec une lettre incorrecte
   * Retourne -1 si toutes les lettres sont correctes ou vides
   */
  getFirstIncorrectIndex(): number {
    for (let i = 0; i < this.correctAnswer.length; i++) {
      const userLetter = this.letterInputs[i]?.toLowerCase() || '';
      const correctLetter = this.correctAnswer[i]?.toLowerCase() || '';
      if (userLetter && userLetter !== correctLetter) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Vérifie si un input à un index donné peut être modifié
   * Un input ne peut être modifié que si tous les inputs précédents sont corrects
   */
  canEditInput(index: number): boolean {
    // Vérifier que tous les inputs précédents sont corrects
    for (let i = 0; i < index; i++) {
      const userLetter = this.letterInputs[i]?.toLowerCase() || '';
      const correctLetter = this.correctAnswer[i]?.toLowerCase() || '';
      if (!userLetter || userLetter !== correctLetter) {
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

    this.isCorrect = userAnswer.toLowerCase() === this.correctAnswer.toLowerCase();
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
        userAnswer,
        this.correctAnswer,
        this.isCorrect
      );
    }
  }

  skipQuestion(): void {
    // Si c'est le dernier mot, afficher les options de fin d'exercice
    if (this.currentIndex === this.words.length - 1) {
      // Afficher la section de résultat avec les options de fin
      this.showResult = true;
      this.isCorrect = false;
      // Ne pas incrémenter le score car on passe sans valider
    } else {
      // Passer au mot suivant sans valider
      this.nextQuestion();
    }
  }

  nextQuestion() {
    if (this.currentIndex < this.words.length - 1) {
      this.currentIndex++;
      this.loadQuestion();
      // Le focus sera mis dans loadQuestion()
    } else {
      // Si on est déjà au dernier mot, afficher les options de fin
      this.showResult = true;
      this.isCorrect = false;
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
      ? 'Écrivez en néerlandais :' 
      : 'Écrivez en français :';
  }

}
