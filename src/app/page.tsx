'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Todo {
  id: string
  todo: string
  isCompleted: boolean
  createdAt: string
}

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [inputValue, setInputValue] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch todos from API
  const fetchTodos = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/todo')
      if (response.ok) {
        const data: Todo[] = await response.json()
        setTodos(data)
      }
    } catch (err) {
      console.error('Error fetching todos:', err)
      setError('Failed to fetch todos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('todos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, (payload) => {
        console.log('Real-time update from other client:', payload)
        fetchTodos()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchTodos])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  // Create todo
  const createTodo = async (todoText: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/todo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todo: todoText }),
      })

      if (response.status === 409) {
        const data = await response.json()
        setError(data.error)
        setTimeout(() => setError(null), 3000)
        return false
      }

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.todo) {
          setTodos(prevTodos => [data.todo, ...prevTodos])
        }
        return true
      }
    } catch (err) {
      console.error('Error creating todo:', err)
      setError('Failed to create todo')
    }
    return false
  }

  // Update todo
  const updateTodo = async (id: string, updates: Partial<Todo>): Promise<boolean> => {
    console.log('🔄 Updating todo:', id, updates)
    try {
      const response = await fetch(`/api/todo/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      console.log('📡 Update response status:', response.status)

      if (response.status === 409) {
        const data = await response.json()
        console.log('❌ Conflict error:', data)
        setError(data.error)
        setTimeout(() => setError(null), 3000)
        return false
      }

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Update response data:', data) 
        if (data.success && data.todo) {
          setTodos(prevTodos => 
            prevTodos.map(todo => 
              todo.id === id ? data.todo : todo
            )
          )
          console.log('✅ Todo updated in state') 
        } else {
          console.warn('⚠️ Update response missing success/todo') 
        }
        return true
      } else {
        const errorData = await response.text()
        console.error('❌ Update failed:', response.status, errorData) 
        setError(`Update failed: ${response.status}`)
        setTimeout(() => setError(null), 3000)
      }
    } catch (err) {
      console.error('❌ Error updating todo:', err)
      setError('Failed to update todo')
    }
    return false
  }

  // Delete todo
  const deleteTodo = async (id: string): Promise<void> => {
    console.log('🗑️ Deleting todo:', id)
    try {
      const response = await fetch(`/api/todo/${id}`, { method: 'DELETE' })
      console.log('📡 Delete response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.text()
        console.error('❌ Delete failed:', response.status, errorData)
        throw new Error(`Delete failed: ${response.status}`)
      }
      
      setTodos(prevTodos => {
        const newTodos = prevTodos.filter(todo => todo.id !== id)
        console.log('✅ Todo removed from state. Before:', prevTodos.length, 'After:', newTodos.length)
        return newTodos
      })
      console.log('✅ Todo deleted successfully')
    } catch (err) {
      console.error('❌ Error deleting todo:', err)
      setError('Failed to delete todo')
      fetchTodos()
    }
  }

  // Handle input submission
  const handleSubmit = async (): Promise<void> => {
    const trimmedValue = inputValue.trim()
    
    if (!trimmedValue) {
      setError('Todo cannot be empty')
      setTimeout(() => setError(null), 3000)
      return
    }

    if (editingId) {
      const success = await updateTodo(editingId, { todo: trimmedValue })
      if (success) {
        setEditingId(null)
        setInputValue('')
        setFilterText('')
      }
    } else {
      const success = await createTodo(trimmedValue)
      if (success) {
        setInputValue('')
        setFilterText('')
      }
    }
  }

  // Handle Add Todo button click
  const handleAddTodo = async (): Promise<void> => {
    const trimmedValue = inputValue.trim()
    
    if (!trimmedValue) {
      setError('Todo cannot be empty')
      setTimeout(() => setError(null), 3000)
      return
    }

    const success = await createTodo(trimmedValue)
    if (success) {
      setInputValue('')
      setFilterText('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') handleSubmit()
  }

  const startEditing = (todo: Todo): void => {
    setEditingId(todo.id)
    setInputValue(todo.todo)
    setFilterText('')
  }

  const cancelEditing = (): void => {
    setEditingId(null)
    setInputValue('')
    setFilterText('')
  }

  const toggleCompletion = (id: string, isCompleted: boolean): void => {
    console.log('🔄 Toggling completion:', id, 'from', isCompleted, 'to', !isCompleted)
    updateTodo(id, { isCompleted: !isCompleted })
  }

  const filteredTodos = todos.filter(todo =>
    todo.todo.toLowerCase().includes(filterText.toLowerCase())
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value
    setInputValue(value)
    if (!editingId) setFilterText(value)
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <head>
        <title>VTech Todo Challenge - Next.js + Supabase</title>
        <meta name="description" content="Real-time Todo App with Next.js and Supabase" />
      </head>

      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        padding: '2rem 1rem',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <header style={{ 
          textAlign: 'center', 
          marginBottom: '3rem',
          color: 'white'
        }}>
          <h1 style={{ 
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: '800',
            margin: '0 0 1rem 0',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.02em'
          }}>
            ✨ Todo
          </h1>
          <p style={{ 
            fontSize: '1.125rem',
            opacity: 0.9,
            fontWeight: '400',
            margin: 0
          }}>
            Built with Next.js + Supabase • Real-time sync
          </p>
        </header>

        {/* Main Container */}
        <main style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          flex: 1,
          padding: '2.5rem',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Decorative Elements */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            right: '-50%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }} />
          
          {error && (
            <div style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#dc2626',
              padding: '1rem 1.25rem',
              borderRadius: '16px',
              marginBottom: '2rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>⚠️</span>
              {error}
            </div>
          )}

          {/* Input Section */}
          <div style={{ marginBottom: '2.5rem', position: 'relative', zIndex: 1 }}>
            <div style={{ 
              display: 'flex', 
              gap: '1rem',
              marginBottom: editingId ? '1rem' : '0'
            }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder={editingId ? "✏️ Edit your todo..." : "✨ What needs to be done?"}
                  style={{
                    width: '100%',
                    padding: '1.25rem 1.5rem',
                    fontSize: '1.125rem',
                    border: '2px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '16px',
                    outline: 'none',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    fontWeight: '400',
                    boxSizing: 'border-box',
                    color: 'black'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                    e.target.style.backgroundColor = 'rgba(255, 255, 255, 1)'
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)'
                    e.target.style.transform = 'translateY(-2px)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(148, 163, 184, 0.2)'
                    e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.8)'
                    e.target.style.boxShadow = 'none'
                    e.target.style.transform = 'translateY(0)'
                  }}
                />
              </div>
              
              {!editingId && (
                <button
                  onClick={handleAddTodo}
                  style={{
                    padding: '1.25rem 2rem',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)'
                    e.currentTarget.style.boxShadow = '0 15px 35px rgba(16, 185, 129, 0.4)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 10px 25px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>+</span>
                  Add
                </button>
              )}
            </div>
            
            {editingId && (
              <div style={{ 
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-start'
              }}>
                <button 
                  onClick={handleSubmit} 
                  style={{ 
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  💾 Save
                </button>
                <button 
                  onClick={cancelEditing}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    backgroundColor: 'rgba(148, 163, 184, 0.1)',
                    color: '#64748b',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  ✕ Cancel
                </button>
              </div>
            )}
          </div>

          {loading && (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem',
              color: '#64748b'
            }}>
              <div style={{ 
                width: '40px',
                height: '40px',
                border: '3px solid rgba(102, 126, 234, 0.2)',
                borderTop: '3px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem'
              }} />
              <div style={{ fontSize: '1rem', fontWeight: '500' }}>Loading todos...</div>
            </div>
          )}

          {/* Todos List */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {filteredTodos.length === 0 && !loading ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '4rem 2rem',
                backgroundColor: 'rgba(248, 250, 252, 0.8)',
                borderRadius: '20px',
                border: '2px dashed rgba(148, 163, 184, 0.3)'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.6 }}>
                  {filterText ? "🔍" : "📝"}
                </div>
                <h3 style={{ 
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: '#374151',
                  margin: '0 0 0.5rem 0'
                }}>
                  {filterText ? "No matches found" : "Ready to be productive?"}
                </h3>
                <p style={{ 
                  color: '#6b7280',
                  fontSize: '1rem',
                  margin: 0
                }}>
                  {filterText ? "Try a different search term" : "Add your first todo above"}
                </p>
              </div>
            ) : (
              <div style={{ 
                display: 'grid',
                gap: '0.75rem'
              }}>
                {filteredTodos.map((todo) => (
                  <div
                    key={todo.id}
                    onMouseEnter={() => setHoveredId(todo.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '1.5rem',
                      backgroundColor: todo.isCompleted 
                        ? 'rgba(34, 197, 94, 0.05)' 
                        : 'rgba(255, 255, 255, 0.9)',
                      borderRadius: '16px',
                      border: `1px solid ${todo.isCompleted 
                        ? 'rgba(34, 197, 94, 0.2)' 
                        : 'rgba(148, 163, 184, 0.2)'}`,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      backdropFilter: 'blur(10px)',
                      transform: hoveredId === todo.id ? 'translateY(-2px)' : 'translateY(0)',
                      boxShadow: hoveredId === todo.id 
                        ? '0 20px 40px rgba(0, 0, 0, 0.1)' 
                        : '0 4px 6px rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleCompletion(todo.id, todo.isCompleted)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: `2px solid ${todo.isCompleted ? '#22c55e' : '#d1d5db'}`,
                        backgroundColor: todo.isCompleted ? '#22c55e' : 'transparent',
                        marginRight: '1rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        color: 'white'
                      }}
                    >
                      {todo.isCompleted && '✓'}
                    </button>
                    
                    {/* Todo Text */}
                    <span style={{
                      flex: 1,
                      fontSize: '1.125rem',
                      fontWeight: '500',
                      textDecoration: todo.isCompleted ? 'line-through' : 'none',
                      color: todo.isCompleted ? '#6b7280' : '#1f2937',
                      opacity: todo.isCompleted ? 0.7 : 1,
                      transition: 'all 0.2s ease'
                    }}>
                      {todo.todo}
                    </span>
                    
                    {/* Action Buttons */}
                    {hoveredId === todo.id && (
                      <div style={{ 
                        display: 'flex', 
                        gap: '0.5rem',
                        marginLeft: '1rem'
                      }}>
                        <button
                          onClick={() => startEditing(todo)}
                          style={{ 
                            padding: '0.5rem 0.875rem',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            color: '#3b82f6',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => deleteTodo(todo.id)}
                          style={{ 
                            padding: '0.5rem 0.875rem',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats Footer */}
          {todos.length > 0 && (
            <div style={{ 
              marginTop: '3rem',
              padding: '1.5rem',
              backgroundColor: 'rgba(248, 250, 252, 0.8)',
              borderRadius: '16px',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem',
                textAlign: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#374151' }}>
                    {todos.length}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>
                    Total Tasks
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#059669' }}>
                    {todos.filter(t => t.isCompleted).length}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>
                    Completed
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
                    {todos.filter(t => !t.isCompleted).length}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>
                    Remaining
                  </div>
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  fontWeight: '500'
                }}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    backgroundColor: '#22c55e', 
                    borderRadius: '50%',
                    animation: 'pulse 2s infinite'
                  }} />
                  Real-time sync
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}