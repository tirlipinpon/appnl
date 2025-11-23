import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { LessonService } from '../../core/services/lesson.service';
import { ProgressService } from '../../core/services/progress.service';
import { AuthService } from '../../core/services/auth.service';
import { Lesson } from '../../core/models/lesson.model';
import { Word } from '../../core/models/word.model';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  private lessonService = inject(LessonService);
  private progressService = inject(ProgressService);
  authService = inject(AuthService);
  private router = inject(Router);

  lessons: Lesson[] = [];
  wordsToReview: Word[] = [];
  stats = {
    totalWordsSeen: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    wordsToReview: 0,
    completedLessons: 0
  };
  isLoading = true;
  userLessons: any[] = [];
  disabledLessons: Set<string> = new Set();
  lessonStats: Map<string, { totalWords: number; masteredWords: number; remainingWords: number; successRate: number }> = new Map();
  private progressSubscription?: Subscription;
  private navigationSubscription?: Subscription;

  async ngOnInit() {
    await this.loadData();
    
    // Écouter les changements de progression pour recalculer les stats
    this.progressSubscription = this.progressService.onProgressUpdated$.subscribe(async (update) => {
      const user = this.authService.getCurrentUser();
      if (user && update.userId === user.id) {
        // Recalculer les statistiques pour toutes les leçons
        await this.loadLessonStats();
        // Recalculer aussi les stats globales
        if (user) {
          this.stats = await this.progressService.getProgressStats(user.id);
        }
      }
    });

    // Écouter les événements de navigation pour recalculer les stats quand on revient sur le dashboard
    this.navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(async (event: any) => {
        if (event.url === '/dashboard') {
          // Recalculer les statistiques quand on revient sur le dashboard
          await this.loadLessonStats();
          const user = this.authService.getCurrentUser();
          if (user) {
            this.stats = await this.progressService.getProgressStats(user.id);
          }
        }
      });
  }

  ngOnDestroy() {
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
    }
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
    }
  }

  async loadData() {
    try {
      this.isLoading = true;
      const user = this.authService.getCurrentUser();
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }

      const [lessons, wordsToReview, stats, userLessons] = await Promise.all([
        this.lessonService.getLessons(),
        this.progressService.getWordsToReview(user.id),
        this.progressService.getProgressStats(user.id),
        this.progressService.getUserLessons(user.id)
      ]);

      this.lessons = lessons;
      this.wordsToReview = wordsToReview;
      this.stats = stats;
      this.userLessons = userLessons;

      // Charger l'état disabled pour chaque leçon
      this.disabledLessons.clear();
      for (const userLesson of userLessons) {
        if (userLesson.disabled === true) {
          this.disabledLessons.add(userLesson.lesson_id);
        }
      }

      // Charger les statistiques pour chaque leçon
      await this.loadLessonStats();
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadLessonStats() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    for (const lesson of this.lessons) {
      try {
        const stats = await this.progressService.getLessonStats(user.id, lesson.id);
        this.lessonStats.set(lesson.id, stats);
      } catch (error) {
        console.error(`Error loading stats for lesson ${lesson.id}:`, error);
      }
    }
  }

  getLessonStats(lessonId: string) {
    return this.lessonStats.get(lessonId) || { totalWords: 0, masteredWords: 0, remainingWords: 0, successRate: 0 };
  }

  isLessonCompleted(lessonId: string): boolean {
    return this.userLessons.some(ul => ul.lesson_id === lessonId && ul.completed);
  }

  getSuccessRate(): number {
    const total = this.stats.totalCorrect + this.stats.totalIncorrect;
    return total > 0 ? Math.round((this.stats.totalCorrect / total) * 100) : 0;
  }

  isLessonDisabled(lessonId: string): boolean {
    return this.disabledLessons.has(lessonId);
  }

  getVisibleLessons(): Lesson[] {
    // Filtrer les leçons désactivées
    return this.lessons.filter(lesson => !this.isLessonDisabled(lesson.id));
  }

  navigateToLessons() {
    console.log('navigateToLessons called');
    this.router.navigate(['/lessons']).then(
      (success) => console.log('Navigation successful:', success),
      (error) => console.error('Navigation error:', error)
    );
  }
}
