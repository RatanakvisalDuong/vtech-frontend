import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface TodoCreateBody {
  todo: string
  isCompleted?: boolean
}

interface TodoResponse {
  id: string
  todo: string
  isCompleted: boolean
  createdAt: string
}

interface SupabaseTodo {
  id: string
  todo: string
  is_completed: boolean
  created_at: string
}

// GET /api/todo - Fetch all todos
export async function GET() {
  try {
    console.log('GET /api/todo called') // Debug log
    
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }
    
    console.log('Fetched todos:', data?.length || 0) // Debug log
    
    // Transform data to match frontend interface
    const transformedData: TodoResponse[] = (data as SupabaseTodo[]).map(todo => ({
      id: todo.id,
      todo: todo.todo,
      isCompleted: todo.is_completed,
      createdAt: todo.created_at
    }))

    return NextResponse.json(transformedData)
  } catch (error) {
    console.error('Error fetching todos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch todos' }, 
      { status: 500 }
    )
  }
}

// POST /api/todo - Create new todo
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/todo called') // Debug log
    
    const body: TodoCreateBody = await request.json()
    const { todo, isCompleted = false } = body

    console.log('Creating todo:', body) // Debug log

    if (!todo || typeof todo !== 'string' || todo.trim() === '') {
      return NextResponse.json(
        { error: 'Todo text is required' }, 
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('todos')
      .insert([{ 
        todo: todo.trim(),
        is_completed: isCompleted
      }])
      .select()

    if (error) {
      console.error('Supabase error:', error)
      // Check for unique constraint violation (duplicate)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Duplicate todo item' }, 
          { status: 409 }
        )
      }
      throw error
    }

    const newTodo = data[0] as SupabaseTodo
    console.log('Created todo:', newTodo) // Debug log

    const response = {
      success: true,
      todo: {
        id: newTodo.id,
        todo: newTodo.todo,
        isCompleted: newTodo.is_completed,
        createdAt: newTodo.created_at
      }
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating todo:', error)
    return NextResponse.json(
      { error: 'Failed to create todo' }, 
      { status: 500 }
    )
  }
}