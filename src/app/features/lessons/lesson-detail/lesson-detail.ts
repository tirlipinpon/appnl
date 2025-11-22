import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LessonService } from '../../../core/services/lesson.service';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { Lesson } from '../../../core/models/lesson.model';
import { Word } from '../../../core/models/word.model';
import { FlashcardView } from '../flashcard-view/flashcard-view';
import { Quiz } from '../quiz/quiz';
import { TypingPractice } from '../typing-practice/typing-practice';

type LessonStep = 'flashcards' | 'quiz' | 'typing' | 'completed';

@Component({
  selector: 'app-lesson-detail',
  imports: [CommonModule, RouterLink, FlashcardView, Quiz, TypingPractice],
  templateUrl: './lesson-detail.html',
  styleUrl: './lesson-detail.css',
})
export class LessonDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lessonService = inject(LessonService);
  private progressService = inject(ProgressService);
  private authService = inject(AuthService);

  lesson: Lesson | null = null;
  words: Word[] = [];
  currentStep: LessonStep = 'flashcards';
  currentFlashcardIndex = 0;
  quizScore: { correct: number; total: number } | null = null;
  typingScore: { correct: number; total: number } | null = null;
  isLoading = true;

  async ngOnInit() {
    const lessonId = this.route.snapshot.paramMap.get('id');
    if (lessonId) {
      await this.loadLesson(lessonId);
    }
  }

  async loadLesson(lessonId: string) {
    try {
      this.isLoading = true;
      const [lesson, words] = await Promise.all([
        this.lessonService.getLessonById(lessonId),
        this.lessonService.getWordsByLesson(lessonId)
      ]);

      this.lesson = lesson;
      this.words = words;
    } catch (error) {
      console.error('Error loading lesson:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onFlashcardNext() {
    if (this.currentFlashcardIndex < this.words.length - 1) {
      this.currentFlashcardIndex++;
    }
  }

  onFlashcardPrevious() {
    if (this.currentFlashcardIndex > 0) {
      this.currentFlashcardIndex--;
    }
  }

  onFlashcardsFinish() {
    this.currentStep = 'quiz';
    this.currentFlashcardIndex = 0;
  }

  onQuizCompleted(score: { correct: number; total: number }) {
    this.quizScore = score;
    this.currentStep = 'typing';
  }

  async onTypingCompleted(score: { correct: number; total: number }) {
    this.typingScore = score;
    
    // Marquer la leçon comme complétée si le quiz est réussi (par exemple, > 70%)
    const totalScore = (this.quizScore?.correct || 0) + score.correct;
    const totalQuestions = (this.quizScore?.total || 0) + score.total;
    const successRate = totalQuestions > 0 ? (totalScore / totalQuestions) * 100 : 0;

    if (successRate >= 70) {
      const user = this.authService.getCurrentUser();
      if (user && this.lesson) {
        await this.progressService.completeLesson(user.id, this.lesson.id);
      }
      this.currentStep = 'completed';
    } else {
      // Recommencer si le score est trop bas
      alert(`Score insuffisant (${Math.round(successRate)}%). Veuillez réessayer.`);
      this.currentStep = 'flashcards';
      this.currentFlashcardIndex = 0;
    }
  }

  restartLesson() {
    this.currentStep = 'flashcards';
    this.currentFlashcardIndex = 0;
    this.quizScore = null;
    this.typingScore = null;
  }
}
