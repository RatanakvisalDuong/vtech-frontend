import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions for consistency
export interface DatabaseTodo {
  id: string
  todo: string
  is_completed: boolean
  created_at: string
}

export interface FrontendTodo {
  id: string
  todo: string
  isCompleted: boolean
  createdAt: string
}