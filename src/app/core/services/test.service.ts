import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class TestService {
  private supabaseService = inject(SupabaseService);

  // Test avec table SANS préfixe
  async testTableWithoutPrefix() {
    try {
      const { data, error } = await this.supabaseService.client
        .from('test_lessons_simple')
        .select('*');

      if (error) {
        console.error('❌ Erreur avec test_lessons_simple:', error);
        return { success: false, error };
      }
      console.log('✅ test_lessons_simple fonctionne!', data);
      return { success: true, data };
    } catch (err) {
      console.error('❌ Exception avec test_lessons_simple:', err);
      return { success: false, error: err };
    }
  }

  // Test avec table AVEC préfixe nlapp_
  async testTableWithPrefix() {
    try {
      const { data, error } = await this.supabaseService.client
        .from('nlapp_lessons')
        .select('*');

      if (error) {
        console.error('❌ Erreur avec nlapp_lessons:', error);
        return { success: false, error };
      }
      console.log('✅ nlapp_lessons fonctionne!', data);
      return { success: true, data };
    } catch (err) {
      console.error('❌ Exception avec nlapp_lessons:', err);
      return { success: false, error: err };
    }
  }

  // Test avec table profiles (qui fonctionne dans appv2)
  async testProfilesTable() {
    try {
      const { data, error } = await this.supabaseService.client
        .from('profiles')
        .select('*')
        .limit(1);

      if (error) {
        console.error('❌ Erreur avec profiles:', error);
        return { success: false, error };
      }
      console.log('✅ profiles fonctionne!', data);
      return { success: true, data };
    } catch (err) {
      console.error('❌ Exception avec profiles:', err);
      return { success: false, error: err };
    }
  }

  // Exécuter tous les tests
  async runAllTests() {
    console.log('🧪 Démarrage des tests...');
    
    const results = {
      test_lessons_simple: await this.testTableWithoutPrefix(),
      nlapp_lessons: await this.testTableWithPrefix(),
      profiles: await this.testProfilesTable()
    };

    console.log('📊 Résultats des tests:', results);
    return results;
  }
}

