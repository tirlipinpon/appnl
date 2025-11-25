import { Directive, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { TranslationService, Language } from '../../core/services/translation.service';

@Directive({
  selector: '[appTextSelection]',
  standalone: true
})
export class TextSelectionDirective implements OnInit, OnDestroy {
  private elementRef = inject(ElementRef<HTMLElement>);
  private translationService = inject(TranslationService);

  @Input() textSelectionEnabled: boolean = true;
  @Input() translationDirection: Language = 'fr'; // Langue cible de la traduction
  @Input() sourceLanguage: Language = 'nl'; // Langue source

  private tooltipElement: HTMLElement | null = null;
  private mouseUpListener: ((e: MouseEvent) => void) | null = null;
  private clickListener: (() => void) | null = null;
  private hideTimeout: number | null = null;
  private debounceTimeout: number | null = null;
  private readonly MIN_SELECTION_LENGTH = 2;
  private readonly MAX_SELECTION_LENGTH = 100; // Limite pour éviter les textes trop longs
  private readonly TOOLTIP_TIMEOUT = 4000; // 4 secondes
  private readonly DEBOUNCE_DELAY = 300; // 300ms de debounce

  ngOnInit(): void {
    if (this.textSelectionEnabled) {
      this.attachListeners();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Attache les listeners d'événements
   */
  private attachListeners(): void {
    // Listener pour détecter la sélection de texte
    this.mouseUpListener = (e: MouseEvent) => {
      // Ne pas interférer avec le drag & drop
      if ((e.target as HTMLElement)?.draggable === true) {
        return;
      }

      // Debounce pour éviter trop d'appels
      if (this.debounceTimeout !== null) {
        clearTimeout(this.debounceTimeout);
      }

      this.debounceTimeout = window.setTimeout(() => {
        this.handleTextSelection(e);
      }, this.DEBOUNCE_DELAY);
    };

    this.elementRef.nativeElement.addEventListener('mouseup', this.mouseUpListener);

    // Listener global pour masquer le tooltip au clic ailleurs
    this.clickListener = () => {
      this.hideTooltip();
    };
    document.addEventListener('click', this.clickListener);
  }

  /**
   * Gère la sélection de texte
   */
  private async handleTextSelection(event: MouseEvent): Promise<void> {
    const selection = window.getSelection();
    
    if (!selection || selection.toString().trim().length < this.MIN_SELECTION_LENGTH) {
      this.hideTooltip();
      return;
    }

    let selectedText = selection.toString().trim();
    
    // Vérifier que la sélection est bien dans notre élément
    if (!this.elementRef.nativeElement.contains(selection.anchorNode as Node)) {
      return;
    }

    // Limiter la longueur de la sélection
    if (selectedText.length > this.MAX_SELECTION_LENGTH) {
      // Prendre seulement les premiers mots qui rentrent dans la limite
      const words = selectedText.split(/\s+/);
      let truncatedText = '';
      
      for (const word of words) {
        if ((truncatedText + ' ' + word).length <= this.MAX_SELECTION_LENGTH) {
          truncatedText += (truncatedText ? ' ' : '') + word;
        } else {
          break;
        }
      }
      
      selectedText = truncatedText || selectedText.substring(0, this.MAX_SELECTION_LENGTH);
      
      // Afficher un avertissement si le texte a été tronqué
      console.warn(`[TextSelectionDirective] Sélection tronquée de ${selection.toString().trim().length} à ${selectedText.length} caractères`);
    }

    try {
      // Traduire le texte sélectionné
      const translation = await this.translationService.translate(
        selectedText,
        this.sourceLanguage,
        this.translationDirection
      );

      // Afficher le tooltip avec la traduction
      this.showTooltip(translation, event);
    } catch (error: any) {
      console.error('[TextSelectionDirective] Erreur lors de la traduction:', error);
      // Afficher le message d'erreur spécifique si disponible
      const errorMessage = error?.message || 'Erreur de traduction';
      // Limiter la longueur du message d'erreur pour le tooltip
      const displayMessage = errorMessage.length > 80 
        ? errorMessage.substring(0, 77) + '...' 
        : errorMessage;
      this.showTooltip(displayMessage, event, true);
    }
  }

  /**
   * Affiche le tooltip avec la traduction
   */
  private showTooltip(translation: string, event: MouseEvent, isError: boolean = false): void {
    // Masquer l'ancien tooltip s'il existe
    this.hideTooltip();

    // Créer le nouvel élément tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'translation-tooltip';
    if (isError) {
      tooltip.classList.add('translation-tooltip-error');
    }
    tooltip.textContent = translation;
    
    // Styles inline pour le positionnement
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY - 40}px`;
    tooltip.style.zIndex = '10000';
    tooltip.style.pointerEvents = 'none';

    document.body.appendChild(tooltip);
    this.tooltipElement = tooltip;

    // Ajuster la position si le tooltip dépasse de l'écran
    this.adjustTooltipPosition(tooltip, event);

    // Masquer automatiquement après le timeout
    this.hideTimeout = window.setTimeout(() => {
      this.hideTooltip();
    }, this.TOOLTIP_TIMEOUT);
  }

  /**
   * Ajuste la position du tooltip pour qu'il reste visible
   */
  private adjustTooltipPosition(tooltip: HTMLElement, event: MouseEvent): void {
    const rect = tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Ajuster horizontalement si dépasse à droite
    if (rect.right > windowWidth) {
      tooltip.style.left = `${event.clientX - rect.width - 10}px`;
    }

    // Ajuster horizontalement si dépasse à gauche
    if (rect.left < 0) {
      tooltip.style.left = '10px';
    }

    // Ajuster verticalement si dépasse en haut
    if (rect.top < 0) {
      tooltip.style.top = `${event.clientY + 20}px`;
    }

    // Ajuster verticalement si dépasse en bas
    if (rect.bottom > windowHeight) {
      tooltip.style.top = `${windowHeight - rect.height - 10}px`;
    }
  }

  /**
   * Masque le tooltip
   */
  private hideTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }

    if (this.hideTimeout !== null) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  /**
   * Nettoie tous les listeners et le tooltip
   */
  private cleanup(): void {
    this.hideTooltip();

    if (this.debounceTimeout !== null) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }

    if (this.mouseUpListener) {
      this.elementRef.nativeElement.removeEventListener('mouseup', this.mouseUpListener);
      this.mouseUpListener = null;
    }

    if (this.clickListener) {
      document.removeEventListener('click', this.clickListener);
      this.clickListener = null;
    }
  }
}

