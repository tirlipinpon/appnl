import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Word } from '../../../core/models/word.model';
import { AudioService } from '../../../core/services/audio.service';

@Component({
  selector: 'app-flashcard-view',
  imports: [CommonModule],
  templateUrl: './flashcard-view.html',
  styleUrl: './flashcard-view.css',
})
export class FlashcardView implements OnChanges {
  audioService = inject(AudioService);

  @Input() word!: Word;
  @Input() currentIndex: number = 0;
  @Input() totalWords: number = 0;
  @Input() direction: 'french_to_dutch' | 'dutch_to_french' = 'french_to_dutch';
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();
  @Output() finish = new EventEmitter<void>();
  @Output() reverseRequested = new EventEmitter<void>();
  @Output() nextGameRequested = new EventEmitter<void>();

  showDutch = false;
  showFrench = true;

  ngOnChanges(changes: SimpleChanges) {
    // Réinitialiser l'état de la carte quand la direction change
    if (changes['direction'] && !changes['direction'].firstChange) {
      this.showDutch = false;
      this.showFrench = true;
    }
  }

  flipCard() {
    if (this.showFrench) {
      this.showFrench = false;
      this.showDutch = true;
    } else {
      this.showDutch = false;
      this.showFrench = true;
    }
  }


  onNext() {
    this.showDutch = false;
    this.showFrench = true;
    this.next.emit();
  }

  onPrevious() {
    this.showDutch = false;
    this.showFrench = true;
    this.previous.emit();
  }

  onFinish() {
    this.finish.emit();
  }

  onReverseRequested() {
    this.reverseRequested.emit();
  }

  getFrontLanguage(): string {
    return this.direction === 'french_to_dutch' ? 'Français' : 'Néerlandais';
  }

  getBackLanguage(): string {
    return this.direction === 'french_to_dutch' ? 'Néerlandais' : 'Français';
  }

  getFrontText(): string {
    return this.direction === 'french_to_dutch' ? this.word.french_text : this.word.dutch_text;
  }

  getBackText(): string {
    return this.direction === 'french_to_dutch' ? this.word.dutch_text : this.word.french_text;
  }

  /**
   * Détermine si le bouton audio doit être sur le front ou le back
   * Le bouton doit être sur la face qui affiche le néerlandais (la langue à apprendre)
   */
  isAudioButtonOnFront(): boolean {
    // Si direction === 'dutch_to_french' : le néerlandais est sur le front → bouton sur front
    // Si direction === 'french_to_dutch' : le néerlandais est sur le back → bouton sur back
    return this.direction === 'dutch_to_french';
  }

  playAudio() {
    // Toujours lire le néerlandais (la langue à apprendre)
    // Peu importe la direction, on apprend toujours le néerlandais
    if (this.word.dutch_text) {
      this.audioService.speak(this.word.dutch_text, 'nl-NL');
    }
  }
}
