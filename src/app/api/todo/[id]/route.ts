// src/app/api/todo/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface TodoUpdateBody {
  todo?: string
  isCompleted?: boolean
}

interface TodoUpdateData {
  todo?: string
  is_completed?: boolean
}

interface SupabaseTodo {
  id: string
  todo: string
  is_completed: boolean
  created_at: string
}

// PUT /api/todo/[id] - Update todo
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    console.log(`PUT /api/todo/${id} called`) // Debug log

    if (!id) {
      return NextResponse.json(
        { error: 'Todo ID is required' }, 
        { status: 400 }
      )
    }

    const body: TodoUpdateBody = await request.json()
    const { todo, isCompleted } = body
    
    console.log('Updating todo:', id, body) // Debug log

    const updates: TodoUpdateData = {}

    if (todo !== undefined) {
      if (typeof todo !== 'string' || todo.trim() === '') {
        return NextResponse.json(
          { error: 'Todo text cannot be empty' }, 
          { status: 400 }
        )
      }

      // Check for duplicates (excluding current item)
      const { data: existingTodos, error: checkError } = await supabase
        .from('todos')
        .select('todo')
        .ilike('todo', todo.trim())
        .neq('id', id)

      if (checkError) {
        console.error('Error checking duplicates:', checkError)
        throw checkError
      }

      if (existingTodos && existingTodos.length > 0) {
        return NextResponse.json(
          { error: 'Duplicate todo item' }, 
          { status: 409 }
        )
      }

      updates.todo = todo.trim()
    }

    if (isCompleted !== undefined) {
      updates.is_completed = isCompleted
    }

    console.log('Supabase update data:', updates) // Debug log

    const { data, error } = await supabase
      .from('todos')
      .update(updates)
      .eq('id', id)
      .select()

    if (error) {
      console.error('Supabase update error:', error)
      throw error
    }

    if (!data || data.length === 0) {
      console.log('No todo found with id:', id)
      return NextResponse.json(
        { error: 'Todo not found' }, 
        { status: 404 }
      )
    }

    const updatedTodo = data[0] as SupabaseTodo
    console.log('Updated todo:', updatedTodo) // Debug log

    const response = {
      success: true,
      todo: {
        id: updatedTodo.id,
        todo: updatedTodo.todo,
        isCompleted: updatedTodo.is_completed,
        createdAt: updatedTodo.created_at
      }
    }

    console.log('Sending response:', response) // Debug log
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error updating todo:', error)
    return NextResponse.json(
      { error: 'Failed to update todo' }, 
      { status: 500 }
    )
  }
}

// DELETE /api/todo/[id] - Delete todo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    console.log(`DELETE /api/todo/${id} called`) // Debug log

    if (!id) {
      return NextResponse.json(
        { error: 'Todo ID is required' }, 
        { status: 400 }
      )
    }

    console.log('Deleting todo from Supabase:', id) // Debug log

    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Supabase delete error:', error)
      throw error
    }

    console.log('Todo deleted successfully:', id) // Debug log
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting todo:', error)
    return NextResponse.json(
      { error: 'Failed to delete todo' }, 
      { status: 500 }
    )
  }
}