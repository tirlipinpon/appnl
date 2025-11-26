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
  private touchEndListener: ((e: TouchEvent) => void) | null = null;
  private clickListener: (() => void) | null = null;
  private hideTimeout: number | null = null;
  private debounceTimeout: number | null = null;
  private readonly MIN_SELECTION_LENGTH = 2;
  private readonly MAX_SELECTION_LENGTH = 100; // Limite pour éviter les textes trop longs
  private readonly TOOLTIP_TIMEOUT = 5000; // 5 secondes (plus long sur mobile)
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
    // Listener pour détecter la sélection de texte (desktop)
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
        this.handleTextSelection(e.clientX, e.clientY);
      }, this.DEBOUNCE_DELAY);
    };

    // Listener pour détecter la sélection de texte (mobile/touch)
    this.touchEndListener = (e: TouchEvent) => {
      // Ne pas interférer avec le drag & drop
      if ((e.target as HTMLElement)?.draggable === true) {
        return;
      }

      // Debounce pour éviter trop d'appels
      if (this.debounceTimeout !== null) {
        clearTimeout(this.debounceTimeout);
      }

      // Utiliser les coordonnées du dernier touch
      const lastTouch = e.changedTouches[e.changedTouches.length - 1];
      this.debounceTimeout = window.setTimeout(() => {
        this.handleTextSelection(lastTouch.clientX, lastTouch.clientY);
      }, this.DEBOUNCE_DELAY);
    };

    this.elementRef.nativeElement.addEventListener('mouseup', this.mouseUpListener);
    this.elementRef.nativeElement.addEventListener('touchend', this.touchEndListener, { passive: true });

    // Listener global pour masquer le tooltip au clic/touch ailleurs
    this.clickListener = () => {
      this.hideTooltip();
    };
    document.addEventListener('click', this.clickListener);
    document.addEventListener('touchend', this.clickListener, { passive: true });
  }

  /**
   * Gère la sélection de texte
   */
  private async handleTextSelection(clientX: number, clientY: number): Promise<void> {
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
      this.showTooltip(translation, clientX, clientY);
    } catch (error: any) {
      console.error('[TextSelectionDirective] Erreur lors de la traduction:', error);
      // Afficher le message d'erreur spécifique si disponible
      const errorMessage = error?.message || 'Erreur de traduction';
      // Limiter la longueur du message d'erreur pour le tooltip
      const displayMessage = errorMessage.length > 80 
        ? errorMessage.substring(0, 77) + '...' 
        : errorMessage;
      this.showTooltip(displayMessage, clientX, clientY, true);
    }
  }

  /**
   * Affiche le tooltip avec la traduction
   */
  private showTooltip(translation: string, clientX: number, clientY: number, isError: boolean = false): void {
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
    tooltip.style.zIndex = '10000';
    tooltip.style.pointerEvents = 'none';

    document.body.appendChild(tooltip);
    this.tooltipElement = tooltip;

    // Ajuster la position si le tooltip dépasse de l'écran
    this.adjustTooltipPosition(tooltip, clientX, clientY);

    // Masquer automatiquement après le timeout
    this.hideTimeout = window.setTimeout(() => {
      this.hideTooltip();
    }, this.TOOLTIP_TIMEOUT);
  }

  /**
   * Ajuste la position du tooltip pour qu'il reste visible
   */
  private adjustTooltipPosition(tooltip: HTMLElement, clientX: number, clientY: number): void {
    const rect = tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const isMobile = windowWidth <= 768;

    if (isMobile) {
      // Sur mobile, centrer le tooltip horizontalement et le placer au-dessus de la sélection
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translateX(-50%)';
      tooltip.style.right = 'auto';
      
      // Placer le tooltip au-dessus de la sélection avec un peu de marge
      const tooltipHeight = rect.height || 50; // Estimation si pas encore rendu
      const topPosition = Math.max(10, clientY - tooltipHeight - 20);
      tooltip.style.top = `${topPosition}px`;
      
      // Si le tooltip dépasse en haut, le placer en bas
      if (topPosition < 10) {
        tooltip.style.top = `${Math.min(clientY + 30, windowHeight - tooltipHeight - 10)}px`;
      }
    } else {
      // Sur desktop, positionner près du curseur
      tooltip.style.left = `${clientX + 10}px`;
      tooltip.style.top = `${clientY - 40}px`;
      tooltip.style.transform = 'none';
      
      // Ajuster horizontalement si dépasse à droite
      if (rect.right > windowWidth) {
        tooltip.style.left = `${clientX - rect.width - 10}px`;
      }

      // Ajuster horizontalement si dépasse à gauche
      if (rect.left < 0) {
        tooltip.style.left = '10px';
      }

      // Ajuster verticalement si dépasse en haut
      if (rect.top < 0) {
        tooltip.style.top = `${clientY + 20}px`;
      }

      // Ajuster verticalement si dépasse en bas
      if (rect.bottom > windowHeight) {
        tooltip.style.top = `${windowHeight - rect.height - 10}px`;
      }
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

    if (this.touchEndListener) {
      this.elementRef.nativeElement.removeEventListener('touchend', this.touchEndListener);
      this.touchEndListener = null;
    }

    if (this.clickListener) {
      document.removeEventListener('click', this.clickListener);
      document.removeEventListener('touchend', this.clickListener);
      this.clickListener = null;
    }
  }
}

