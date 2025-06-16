import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Circle, Clock, AlertCircle, ChevronRight, ChevronDown,
  Plus, MoreHorizontal, Calendar, User, Flag, Trash2, Edit3
} from 'lucide-react';
import { useMissionOps } from './MissionOpsContext';

const TaskList = ({ missionId, theme = 'dark' }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [editingTask, setEditingTask] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(null);

  const { getTasks, createTask, updateTask, deleteTask } = useMissionOps();

  useEffect(() => {
    loadTasks();
  }, [missionId]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const taskData = await getTasks(missionId);
      setTasks(taskData || []);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (taskData, parentTaskId = null) => {
    try {
      await createTask({
        mission_id: missionId,
        parent_task_id: parentTaskId,
        ...taskData
      });
      await loadTasks(); // Refresh the task list
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      await updateTask(taskId, updates);
      await loadTasks(); // Refresh the task list
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(taskId);
      await loadTasks(); // Refresh the task list
    } catch (error) {
      console.error('Failed to delete task:', error);
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
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
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
                onClick={() => toggleTaskExpansion(task.id)}
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
              onClick={() => {
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
                    <div className="flex items-center gap-1">
                      {getPriorityIcon(task.priority)}
                      <span className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </span>
                    </div>

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
                    onClick={() => setAddingSubtask(task.id)}
                    className={`p-1 rounded ${theme === 'light' ? 'hover:bg-neutral-100' : 'hover:bg-neutral-600/50'} transition-colors`}
                    title="Add subtask"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setEditingTask(task.id)}
                    className={`p-1 rounded ${theme === 'light' ? 'hover:bg-neutral-100' : 'hover:bg-neutral-600/50'} transition-colors`}
                    title="Edit task"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className={`p-1 rounded ${theme === 'light' ? 'hover:bg-neutral-100' : 'hover:bg-neutral-600/50'} text-red-500 transition-colors`}
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
                onSubmit={(taskData) => {
                  handleCreateTask(taskData, task.id);
                  setAddingSubtask(null);
                }}
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
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [dueDate, setDueDate] = useState('');

    const handleSubmit = () => {
      if (!title.trim()) return;
      
      onSubmit({
        title: title.trim(),
        description: description.trim(),
        priority,
        due_date: dueDate || null,
        status: 'todo'
      });
      
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
    };

    return (
      <div className={`p-3 border rounded-lg ${theme === 'light' ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-700 bg-neutral-800/50'}`}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholder}
          className={`
            w-full p-2 rounded border text-sm mb-2
            ${theme === 'light' 
              ? 'border-neutral-300 bg-white text-neutral-900' 
              : 'border-neutral-600 bg-neutral-700 text-white'
            }
          `}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
            if (e.key === 'Escape') onCancel();
          }}
          autoFocus
        />
        
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)..."
          rows={2}
          className={`
            w-full p-2 rounded border text-sm mb-2 resize-none
            ${theme === 'light' 
              ? 'border-neutral-300 bg-white text-neutral-900' 
              : 'border-neutral-600 bg-neutral-700 text-white'
            }
          `}
        />

        <div className="flex gap-2 mb-3">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={`
              px-2 py-1 rounded border text-sm
              ${theme === 'light' 
                ? 'border-neutral-300 bg-white text-neutral-900' 
                : 'border-neutral-600 bg-neutral-700 text-white'
              }
            `}
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
            <option value="critical">Critical Priority</option>
          </select>

          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={`
              px-2 py-1 rounded border text-sm
              ${theme === 'light' 
                ? 'border-neutral-300 bg-white text-neutral-900' 
                : 'border-neutral-600 bg-neutral-700 text-white'
              }
            `}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="px-3 py-1 bg-pin-blue text-white rounded text-sm hover:bg-pin-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Task
          </button>
          <button
            onClick={onCancel}
            className={`px-3 py-1 rounded text-sm transition-colors ${theme === 'light' ? 'text-neutral-600 hover:bg-neutral-200' : 'text-neutral-400 hover:bg-neutral-600'}`}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`text-center py-8 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
        <Clock className="w-6 h-6 mx-auto mb-2 animate-spin" />
        <p className="text-sm">Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Add Task Button */}
      {!showAddTask ? (
        <button
          onClick={() => setShowAddTask(true)}
          className={`
            w-full p-3 border-2 border-dashed rounded-lg text-sm
            ${theme === 'light' 
              ? 'border-neutral-300 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50' 
              : 'border-neutral-600 text-neutral-400 hover:border-neutral-500 hover:bg-neutral-800/50'
            }
            transition-colors flex items-center justify-center gap-2
          `}
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      ) : (
        <AddTaskForm
          onSubmit={(taskData) => {
            handleCreateTask(taskData);
            setShowAddTask(false);
          }}
          onCancel={() => setShowAddTask(false)}
          theme={theme}
        />
      )}

      {/* Task List */}
      {tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.filter(task => !task.parent_task_id).map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      ) : !showAddTask && (
        <div className={`text-center py-8 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No tasks yet. Add one to get started!</p>
        </div>
      )}
    </div>
  );
};

export default TaskList; 