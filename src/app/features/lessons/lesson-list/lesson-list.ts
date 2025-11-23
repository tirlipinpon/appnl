import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { LessonService } from '../../../core/services/lesson.service';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { Lesson } from '../../../core/models/lesson.model';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-lesson-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './lesson-list.html',
  styleUrl: './lesson-list.css',
})
export class LessonList implements OnInit, OnDestroy {
  private lessonService = inject(LessonService);
  private progressService = inject(ProgressService);
  private authService = inject(AuthService);
  private router = inject(Router);

  lessons: Lesson[] = [];
  userLessons: any[] = [];
  disabledLessons: Set<string> = new Set();
  lessonStats: Map<string, { totalWords: number; masteredWords: number; remainingWords: number; successRate: number }> = new Map();
  isLoading = true;
  private progressSubscription?: Subscription;
  private navigationSubscription?: Subscription;

  async ngOnInit() {
    await this.loadLessons();
    
    // Écouter les changements de progression pour recalculer les stats
    this.progressSubscription = this.progressService.onProgressUpdated$.subscribe(async (update) => {
      const user = this.authService.getCurrentUser();
      if (user && update.userId === user.id) {
        // Recalculer les statistiques pour toutes les leçons
        await this.loadLessonStats();
      }
    });

    // Écouter les événements de navigation pour recalculer les stats quand on revient sur cette page
    this.navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(async (event: any) => {
        if (event.url === '/lessons') {
          // Recalculer les statistiques quand on revient sur la page des leçons
          await this.loadLessonStats();
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

  async loadLessons() {
    try {
      this.isLoading = true;
      const user = this.authService.getCurrentUser();
      
      if (user) {
        this.userLessons = await this.progressService.getUserLessons(user.id);
        // Charger l'état disabled pour chaque leçon
        await this.loadDisabledLessons(user.id);
      }
      
      this.lessons = await this.lessonService.getLessons();
      
      // Charger les statistiques pour chaque leçon
      if (user) {
        await this.loadLessonStats();
      }
    } catch (error) {
      console.error('Error loading lessons:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadDisabledLessons(userId: string) {
    this.disabledLessons.clear();
    for (const userLesson of this.userLessons) {
      if (userLesson.disabled === true) {
        this.disabledLessons.add(userLesson.lesson_id);
      }
    }
  }

  isLessonDisabled(lessonId: string): boolean {
    return this.disabledLessons.has(lessonId);
  }

  async toggleLessonDisabled(lesson: Lesson, event: Event) {
    event.stopPropagation(); // Empêcher la navigation vers la leçon
    const user = this.authService.getCurrentUser();
    if (!user) return;

    try {
      const isCurrentlyDisabled = this.isLessonDisabled(lesson.id);
      
      if (isCurrentlyDisabled) {
        await this.progressService.enableLesson(user.id, lesson.id);
        this.disabledLessons.delete(lesson.id);
      } else {
        await this.progressService.disableLesson(user.id, lesson.id);
        this.disabledLessons.add(lesson.id);
      }
      
      // Recharger les userLessons pour avoir les données à jour
      this.userLessons = await this.progressService.getUserLessons(user.id);
    } catch (error) {
      console.error('Error toggling lesson disabled state:', error);
      alert('Erreur lors de la modification de l\'état de la leçon');
    }
  }

  getVisibleLessons(): Lesson[] {
    // Filtrer les leçons désactivées
    return this.lessons.filter(lesson => !this.isLessonDisabled(lesson.id));
  }

  getDisabledLessons(): Lesson[] {
    // Retourner les leçons désactivées
    return this.lessons.filter(lesson => this.isLessonDisabled(lesson.id));
  }

  hasDisabledLessons(): boolean {
    // Vérifier s'il y a des leçons désactivées
    return this.getDisabledLessons().length > 0;
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
}
