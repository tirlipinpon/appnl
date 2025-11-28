import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Word } from '../../../core/models/word.model';
import { AudioService } from '../../../core/services/audio.service';
import { DeepSeekService } from '../../../core/services/deepseek.service';

@Component({
  selector: 'app-flashcard-view',
  imports: [CommonModule],
  templateUrl: './flashcard-view.html',
  styleUrl: './flashcard-view.css',
})
export class FlashcardView implements OnChanges {
  audioService = inject(AudioService);
  private deepSeekService = inject(DeepSeekService);

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
  
  // Propriétés pour l'aide
  showHelpExplanation = false;
  helpExplanation = '';
  isLoadingHelp = false;
  helpError: string | null = null;

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

  /**
   * Demande une explication du mot en néerlandais
   */
  async requestWordHelp() {
    if (!this.word.dutch_text || this.isLoadingHelp) {
      return;
    }

    this.isLoadingHelp = true;
    this.helpError = null;
    this.showHelpExplanation = true;

    try {
      const explanation = await this.deepSeekService.getOrGenerateWordExplanation(
        this.word.id,
        this.word.dutch_text
      );
      this.helpExplanation = explanation;
    } catch (error) {
      console.error('Error getting word explanation:', error);
      this.helpError = 'Erreur lors du chargement de l\'explication. Veuillez réessayer.';
      this.helpExplanation = '';
    } finally {
      this.isLoadingHelp = false;
    }
  }

  /**
   * Ferme l'affichage de l'explication
   */
  closeHelpExplanation() {
    this.showHelpExplanation = false;
    this.helpExplanation = '';
    this.helpError = null;
  }

  /**
   * Vérifie si le bouton d'aide doit être affiché
   * (uniquement sur la face arrière quand le néerlandais est visible)
   */
  shouldShowHelpButton(): boolean {
    return this.showDutch && !!this.word.dutch_text;
  }

  /**
   * Formate l'explication pour l'affichage (paragraphes, listes, etc.)
   */
  formatExplanation(text: string): string {
    if (!text) return '';
    
    // Échapper les caractères HTML pour éviter les injections
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Diviser en paragraphes (double saut de ligne)
    const paragraphs = formatted.split(/\n\n+/);
    
    // Formater chaque paragraphe
    const formattedParagraphs = paragraphs.map(para => {
      para = para.trim();
      if (!para) return '';
      
      // Détecter les listes (lignes commençant par - ou *)
      const lines = para.split('\n');
      const isList = lines.some(line => /^[-*]\s+/.test(line.trim()));
      
      if (isList) {
        // Formater comme une liste
        const listItems = lines
          .filter(line => /^[-*]\s+/.test(line.trim()))
          .map(line => {
            const content = line.replace(/^[-*]\s+/, '').trim();
            return `<li>${content}</li>`;
          });
        return `<ul>${listItems.join('')}</ul>`;
      } else {
        // Formater comme un paragraphe normal
        para = para.replace(/\n/g, '<br>');
        return `<p>${para}</p>`;
      }
    });
    
    return formattedParagraphs.filter(p => p).join('');
  }
}
