export interface User {
  id: string;
  email: string;
  created_at?: string;
}

export interface UserProfile {
  user_id: string;
  progression_globale?: any;
  created_at?: string;
  updated_at?: string;
}

