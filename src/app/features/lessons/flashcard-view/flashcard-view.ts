import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Word } from '../../../core/models/word.model';
import { AudioService } from '../../../core/services/audio.service';

@Component({
  selector: 'app-flashcard-view',
  imports: [CommonModule],
  templateUrl: './flashcard-view.html',
  styleUrl: './flashcard-view.css',
})
export class FlashcardView {
  private audioService = inject(AudioService);

  @Input() word!: Word;
  @Input() currentIndex: number = 0;
  @Input() totalWords: number = 0;
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();
  @Output() finish = new EventEmitter<void>();

  showDutch = false;
  showFrench = true;

  flipCard() {
    if (this.showFrench) {
      this.showFrench = false;
      this.showDutch = true;
    } else {
      this.showDutch = false;
      this.showFrench = true;
    }
  }

  playAudio() {
    if (this.word.dutch_text) {
      this.audioService.speak(this.word.dutch_text, 'nl-NL');
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
}
