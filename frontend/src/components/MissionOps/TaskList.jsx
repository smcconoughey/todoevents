import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Circle, Clock, AlertCircle, ChevronRight, ChevronDown,
  Plus, MoreHorizontal, Calendar, User, Flag, Trash2, Edit3
} from 'lucide-react';
import { useMissionOps } from './MissionOpsContext';

const TaskList = ({ missionId, theme = 'dark' }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [editingTask, setEditingTask] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(null);

  const { getTasks, createTask, updateTask, deleteTask } = useMissionOps();

  useEffect(() => {
    if (missionId) {
      loadTasks();
    }
  }, [missionId]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading tasks for mission:', missionId);
      
      const taskData = await getTasks(missionId);
      console.log('Received task data:', taskData);
      
      setTasks(Array.isArray(taskData) ? taskData : []);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setError(error.message || 'Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (taskData, parentTaskId = null) => {
    try {
      console.log('Creating task:', { ...taskData, mission_id: missionId, parent_task_id: parentTaskId });
      
      await createTask({
        mission_id: missionId,
        parent_task_id: parentTaskId,
        ...taskData
      });
      
      await loadTasks(); // Refresh the task list
      setShowAddTask(false);
      setAddingSubtask(null);
      setNewTaskTitle('');
    } catch (error) {
      console.error('Failed to create task:', error);
      setError(error.message || 'Failed to create task');
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      console.log('Updating task:', taskId, updates);
      await updateTask(taskId, updates);
      await loadTasks(); // Refresh the task list
    } catch (error) {
      console.error('Failed to update task:', error);
      setError(error.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task and all its subtasks?')) {
      return;
    }
    
    try {
      console.log('Deleting task:', taskId);
      await deleteTask(taskId);
      await loadTasks(); // Refresh the task list
    } catch (error) {
      console.error('Failed to delete task:', error);
      setError(error.message || 'Failed to delete task');
    }
  };

  const toggleTaskExpansion = (taskId) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'blocked': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Circle className="w-4 h-4 text-neutral-500" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return theme === 'light' ? 'text-neutral-500' : 'text-neutral-400';
    }
  };

  const getPriorityIcon = (priority) => {
    return <Flag className={`w-3 h-3 ${getPriorityColor(priority)}`} />;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', dateStr, error);
      return '';
    }
  };

  const TaskItem = ({ task, level = 0, parentId = null }) => {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const isExpanded = expandedTasks.has(task.id);
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

    return (
      <div className={`${level > 0 ? 'ml-6 border-l border-neutral-600/30 pl-4' : ''}`}>
        <div 
          className={`
            group p-3 rounded-lg border transition-all duration-200
            ${theme === 'light' 
              ? 'border-neutral-200 bg-white hover:bg-neutral-50' 
              : 'border-neutral-700/50 bg-neutral-800/30 hover:bg-neutral-700/30'
            }
            ${task.status === 'completed' ? 'opacity-75' : ''}
            ${isOverdue ? 'border-red-500/30 bg-red-500/5' : ''}
          `}
        >
          <div className="flex items-start gap-3">
            {/* Expand/Collapse Button */}
            {hasSubtasks && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTaskExpansion(task.id);
                }}
                className={`mt-0.5 p-1 rounded ${theme === 'light' ? 'hover:bg-neutral-100' : 'hover:bg-neutral-600/50'} transition-colors`}
              >
                {isExpanded ? 
                  <ChevronDown className="w-3 h-3" /> : 
                  <ChevronRight className="w-3 h-3" />
                }
              </button>
            )}

            {/* Status Icon */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newStatus = task.status === 'completed' ? 'todo' : 'completed';
                handleUpdateTask(task.id, { status: newStatus });
              }}
              className="mt-0.5 hover:scale-110 transition-transform"
            >
              {getStatusIcon(task.status)}
            </button>

            {/* Task Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className={`
                    font-medium ${theme === 'light' ? 'text-neutral-900' : 'text-white'}
                    ${task.status === 'completed' ? 'line-through opacity-75' : ''}
                  `}>
                    {task.title}
                  </h4>
                  
                  {task.description && (
                    <p className={`text-sm mt-1 ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
                      {task.description}
                    </p>
                  )}

                  {/* Task Meta */}
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    {/* Priority */}
                    {task.priority && (
                      <div className="flex items-center gap-1">
                        {getPriorityIcon(task.priority)}
                        <span className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </span>
                      </div>
                    )}

                    {/* Due Date */}
                    {task.due_date && (
                      <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(task.due_date)}</span>
                        {isOverdue && <span className="font-medium">OVERDUE</span>}
                      </div>
                    )}

                    {/* Assigned To */}
                    {task.assigned_to && (
                      <div className={`flex items-center gap-1 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        <User className="w-3 h-3" />
                        <span>Assigned</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddingSubtask(task.id);
                    }}
                    className={`p-1 rounded ${theme === 'light' ? 'hover:bg-neutral-100' : 'hover:bg-neutral-600/50'} transition-colors`}
                    title="Add subtask"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTask(task.id);
                    }}
                    className={`p-1 rounded hover:bg-red-500/10 text-red-500 transition-colors`}
                    title="Delete task"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Add Subtask Form */}
          {addingSubtask === task.id && (
            <div className="mt-3 ml-6">
              <AddTaskForm
                onSubmit={(taskData) => handleCreateTask(taskData, task.id)}
                onCancel={() => setAddingSubtask(null)}
                placeholder="Subtask title..."
                theme={theme}
              />
            </div>
          )}
        </div>

        {/* Subtasks */}
        {hasSubtasks && isExpanded && (
          <div className="mt-2 space-y-2">
            {task.subtasks.map((subtask) => (
              <TaskItem
                key={subtask.id}
                task={subtask}
                level={level + 1}
                parentId={task.id}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const AddTaskForm = ({ onSubmit, onCancel, placeholder = "Task title...", theme }) => {
    const [title, setTitle] = useState('');
    const [priority, setPriority] = useState('medium');

    const handleSubmit = (e) => {
      e.preventDefault();
      if (title.trim()) {
        onSubmit({
          title: title.trim(),
          priority,
          status: 'todo'
        });
        setTitle('');
        setPriority('medium');
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      } else if (e.key === 'Escape') {
        onCancel();
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`flex-1 px-3 py-2 rounded-lg border ${
              theme === 'light'
                ? 'border-neutral-200 bg-white text-neutral-900 placeholder-neutral-500'
                : 'border-neutral-700 bg-neutral-800 text-white placeholder-neutral-400'
            } focus:outline-none focus:ring-2 focus:ring-pin-blue focus:border-transparent`}
            autoFocus
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={`px-3 py-2 rounded-lg border ${
              theme === 'light'
                ? 'border-neutral-200 bg-white text-neutral-900'
                : 'border-neutral-700 bg-neutral-800 text-white'
            } focus:outline-none focus:ring-2 focus:ring-pin-blue focus:border-transparent`}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            type="submit"
            className="px-3 py-1 bg-pin-blue text-white rounded hover:bg-pin-blue-600 transition-colors"
          >
            Add Task
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={`px-3 py-1 rounded transition-colors ${
              theme === 'light'
                ? 'text-neutral-600 hover:bg-neutral-100'
                : 'text-neutral-400 hover:bg-neutral-700'
            }`}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-pin-blue border-t-transparent rounded-full animate-spin"></div>
        <span className={`ml-2 text-sm ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
          Loading tasks...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
        <p className="text-red-500 text-sm mb-2">{error}</p>
        <button
          onClick={loadTasks}
          className="px-3 py-1 text-sm bg-pin-blue text-white rounded hover:bg-pin-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Task Button */}
      {!showAddTask && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAddTask(true);
          }}
          className={`w-full p-3 border-2 border-dashed rounded-lg transition-colors ${
            theme === 'light'
              ? 'border-neutral-300 hover:border-pin-blue hover:bg-pin-blue/5 text-neutral-600 hover:text-pin-blue'
              : 'border-neutral-600 hover:border-pin-blue hover:bg-pin-blue/10 text-neutral-400 hover:text-pin-blue'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </div>
        </button>
      )}

      {/* Add Task Form */}
      {showAddTask && (
        <div className="p-3 border rounded-lg border-neutral-700/50">
          <AddTaskForm
            onSubmit={handleCreateTask}
            onCancel={() => {
              setShowAddTask(false);
              setNewTaskTitle('');
            }}
            theme={theme}
          />
        </div>
      )}

      {/* Task List */}
      {tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <div className={`text-center py-8 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No tasks yet</p>
          <p className="text-sm">Add your first task to get started</p>
        </div>
      )}
    </div>
  );
};

export default TaskList; 