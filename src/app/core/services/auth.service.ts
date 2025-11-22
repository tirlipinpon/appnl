import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { User } from '../models/user.model';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.checkUser();
    this.supabaseService.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        this.currentUserSubject.next(session.user as User);
      } else if (event === 'SIGNED_OUT') {
        this.currentUserSubject.next(null);
      }
    });
  }

  async checkUser(): Promise<void> {
    const { data: { user } } = await this.supabaseService.client.auth.getUser();
    this.currentUserSubject.next(user as User | null);
  }

  async signUp(email: string, password: string): Promise<{ error: any }> {
    const { error } = await this.supabaseService.client.auth.signUp({
      email,
      password
    });
    return { error };
  }

  async signIn(email: string, password: string): Promise<{ error: any }> {
    const { error } = await this.supabaseService.client.auth.signInWithPassword({
      email,
      password
    });
    if (!error) {
      await this.checkUser();
    }
    return { error };
  }

  async signOut(): Promise<void> {
    await this.supabaseService.client.auth.signOut();
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  async resetPassword(email: string): Promise<{ error: any }> {
    const { error } = await this.supabaseService.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    return { error };
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }
}

