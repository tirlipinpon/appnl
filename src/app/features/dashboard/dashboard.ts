import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LessonService } from '../../core/services/lesson.service';
import { ProgressService } from '../../core/services/progress.service';
import { AuthService } from '../../core/services/auth.service';
import { Lesson } from '../../core/models/lesson.model';
import { Word } from '../../core/models/word.model';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
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

  async ngOnInit() {
    await this.loadData();
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
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      this.isLoading = false;
    }
  }

  isLessonCompleted(lessonId: string): boolean {
    return this.userLessons.some(ul => ul.lesson_id === lessonId && ul.completed);
  }

  getSuccessRate(): number {
    const total = this.stats.totalCorrect + this.stats.totalIncorrect;
    return total > 0 ? Math.round((this.stats.totalCorrect / total) * 100) : 0;
  }
}
