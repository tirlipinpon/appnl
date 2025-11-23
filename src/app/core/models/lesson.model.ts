export interface Lesson {
  id: string;
  title: string;
  description?: string;
  order_index: number;
  enable_fill_in_blank?: boolean;
  created_at?: string;
  updated_at?: string;
}

