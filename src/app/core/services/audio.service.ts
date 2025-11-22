import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private synth: SpeechSynthesis;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  speak(text: string, lang: string = 'nl-NL'): void {
    if (!this.synth) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Annuler toute prononciation en cours
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    this.synth.speak(utterance);
  }

  stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  isSupported(): boolean {
    return 'speechSynthesis' in window;
  }
}

