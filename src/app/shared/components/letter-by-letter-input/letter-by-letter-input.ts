import { Component, Input, Output, EventEmitter, OnInit, ViewChildren, QueryList, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-letter-by-letter-input',
  imports: [CommonModule],
  templateUrl: './letter-by-letter-input.html',
  styleUrl: './letter-by-letter-input.css',
})
export class LetterByLetterInput implements OnInit, AfterViewInit {
  @Input() correctAnswer: string = '';
  @Input() disabled: boolean = false;
  @Input() showValidation: boolean = true; // Afficher la validation en temps réel
  
  @Output() valueChange = new EventEmitter<string>();
  @Output() correctLettersCountChange = new EventEmitter<number>();

  @ViewChildren('letterInput') letterInputElements!: QueryList<ElementRef<HTMLInputElement>>;

  letterInputs: string[] = [];

  ngOnInit() {
    this.initializeLetterInputs();
  }

  ngAfterViewInit() {
    // S'assurer que les inputs sont bien initialisés
  }

  initializeLetterInputs(): void {
    this.letterInputs = new Array(this.correctAnswer.length).fill('');
  }

  getLetterStatus(index: number): 'correct' | 'incorrect' | 'empty' {
    if (!this.showValidation) return 'empty';
    
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

  getCurrentValue(): string {
    return this.letterInputs.join('');
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
    }, 0);
    
    // Émettre les événements
    const currentValue = this.letterInputs.join('');
    this.valueChange.emit(currentValue);
    this.correctLettersCountChange.emit(this.getCorrectLettersCount());
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

  onBlur(index: number, event: Event): void {
    // S'assurer que la valeur de l'input correspond au tableau
    const input = event.target as HTMLInputElement;
    const currentValue = input.value;
    if (this.letterInputs[index] !== currentValue) {
      const updatedInputs = [...this.letterInputs];
      updatedInputs[index] = currentValue;
      this.letterInputs = updatedInputs;
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
          const updatedInputs = [...this.letterInputs];
          // Distribuer les caractères dans les inputs
          for (let i = 0; i < text.length && (index + i) < this.letterInputs.length; i++) {
            const char = text[i].toUpperCase();
            updatedInputs[index + i] = char;
            if (inputs[index + i]) {
              inputs[index + i].nativeElement.value = char;
            }
          }
          this.letterInputs = updatedInputs;
          const currentValue = this.letterInputs.join('');
          this.valueChange.emit(currentValue);
          this.correctLettersCountChange.emit(this.getCorrectLettersCount());
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
  }

  reset(): void {
    this.initializeLetterInputs();
    // Réinitialiser tous les inputs
    requestAnimationFrame(() => {
      const inputs = this.letterInputElements.toArray();
      inputs.forEach(input => {
        input.nativeElement.value = '';
      });
    });
  }
}

