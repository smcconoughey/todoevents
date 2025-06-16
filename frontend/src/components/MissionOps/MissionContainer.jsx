import React, { useState, useRef } from 'react';
import { 
  Target, 
  Calendar, 
  Users, 
  AlertTriangle, 
  FileText, 
  Clock, 
  Grip, 
  MoreHorizontal, 
  Share2, 
  Eye, 
  ChevronDown, 
  ChevronRight, 
  Plus,
  CheckCircle2,
  Circle,
  AlertCircle,
  MessageSquare,
  Settings
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useMissionOps } from './MissionOpsContext';

const MissionContainer = ({ 
  mission, 
  isSelected, 
  onSelect, 
  onDragStart, 
  isDragging,
  theme = 'dark'
}) => {
  const dragRef = useRef(null);
  const [isDragStarted, setIsDragStarted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks'); // tasks, risks, decisions
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  
  const { createTask, getTasks, getRisks, getDecisions } = useMissionOps();

  // Helper function to safely parse tags
  const parseTags = (tagsString) => {
    if (!tagsString || tagsString.trim() === '') return [];
    
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(tagsString);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      // If JSON parsing fails, treat as comma-separated plain text
      return tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: theme === 'light' ? 'border-red-400 bg-red-50/80' : 'border-red-500/60 bg-red-900/20',
      high: theme === 'light' ? 'border-orange-400 bg-orange-50/80' : 'border-orange-500/60 bg-orange-900/20',
      medium: theme === 'light' ? 'border-yellow-400 bg-yellow-50/80' : 'border-yellow-500/60 bg-yellow-900/20',
      low: theme === 'light' ? 'border-green-400 bg-green-50/80' : 'border-green-500/60 bg-green-900/20'
    };
    return colors[priority] || colors.medium;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-3 h-3 text-green-500" />;
      case 'active': return <Circle className="w-3 h-3 text-blue-500" />;
      case 'paused': return <Clock className="w-3 h-3 text-yellow-500" />;
      case 'cancelled': return <AlertCircle className="w-3 h-3 text-red-500" />;
      default: return <Circle className="w-3 h-3 text-neutral-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'active': return 'text-blue-500';
      case 'paused': return 'text-yellow-500';
      case 'cancelled': return 'text-red-500';
      default: return theme === 'light' ? 'text-neutral-600' : 'text-neutral-400';
    }
  };

  const handleMouseDown = (e) => {
    // Only start drag if clicking on the drag handle or header area
    if (e.target.closest('.mission-drag-handle') || e.target.closest('.mission-header')) {
      setIsDragStarted(true);
      onDragStart(mission);
    } else {
      onSelect();
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    try {
      await createTask({
        mission_id: mission.id,
        title: newTaskTitle,
        description: '',
        priority: 'medium',
        status: 'todo'
      });
      setNewTaskTitle('');
      setShowAddTask(false);
      // Refresh mission data would happen via context
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const isOverdue = mission.end_date && new Date(mission.end_date) < new Date();
  const hasSharedUsers = mission.shared_with && mission.shared_with.length > 0;
  const tags = parseTags(mission.tags);

  return (
    <div
      ref={dragRef}
      className={`
        relative group cursor-pointer transition-all duration-200 transform
        ${isDragging ? 'scale-105 rotate-1 z-50' : 'hover:scale-105'}
        ${isSelected ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}
        ${isExpanded ? 'z-40' : ''}
      `}
      onMouseDown={handleMouseDown}
      style={{
        opacity: isDragging ? 0.8 : 1,
      }}
    >
      {/* Main Container */}
      <div 
        className={`
          relative rounded-xl border-2 backdrop-blur-sm transition-all duration-200
          ${getPriorityColor(mission.priority)}
          ${isSelected ? 'shadow-lg shadow-blue-400/25' : 'shadow-lg shadow-black/25'}
          ${isExpanded ? 'min-w-96 max-w-2xl' : 'min-w-80 max-w-96'}
        `}
      >
        {/* Header */}
        <div className={`mission-header p-4 border-b ${theme === 'light' ? 'border-neutral-200/50' : 'border-neutral-700/50'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  className={`p-1 rounded ${theme === 'light' ? 'hover:bg-neutral-100' : 'hover:bg-neutral-700/50'} transition-colors`}
                >
                  {isExpanded ? 
                    <ChevronDown className="w-4 h-4 text-pin-blue" /> : 
                    <ChevronRight className="w-4 h-4 text-pin-blue" />
                  }
                </button>
                <Target className="w-5 h-5 text-pin-blue flex-shrink-0" />
                <h3 className={`font-semibold ${theme === 'light' ? 'text-neutral-900' : 'text-white'} truncate`}>
                  {mission.title}
                </h3>
                {hasSharedUsers && (
                  <Share2 className="w-4 h-4 text-purple-500 flex-shrink-0" />
                )}
              </div>
              
              {mission.description && (
                <p className={`text-sm ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-300'} ${isExpanded ? '' : 'line-clamp-2'} mb-2`}>
                  {mission.description}
                </p>
              )}

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  {getStatusIcon(mission.status)}
                  <span className={getStatusColor(mission.status)}>
                    {mission.status.charAt(0).toUpperCase() + mission.status.slice(1)}
                  </span>
                </div>
                
                {mission.start_date && (
                  <div className={`flex items-center gap-1 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(mission.start_date)}</span>
                    {mission.end_date && (
                      <>
                        <span>→</span>
                        <span className={isOverdue ? 'text-red-500' : ''}>
                          {formatDate(mission.end_date)}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 ml-2">
              <button className={`mission-drag-handle p-1 ${theme === 'light' ? 'hover:bg-neutral-100' : 'hover:bg-neutral-700/50'} rounded opacity-0 group-hover:opacity-100 transition-opacity`}>
                <Grip className={`w-4 h-4 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`} />
              </button>
              <button className={`p-1 ${theme === 'light' ? 'hover:bg-neutral-100' : 'hover:bg-neutral-700/50'} rounded opacity-0 group-hover:opacity-100 transition-opacity`}>
                <MoreHorizontal className={`w-4 h-4 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="p-4">
            {/* Tab Navigation */}
            <div className="flex gap-1 mb-4">
              {[
                { id: 'tasks', label: 'Tasks', icon: CheckCircle2, count: mission.tasks_count },
                { id: 'risks', label: 'Risks', icon: AlertTriangle, count: mission.risks_count },
                { id: 'decisions', label: 'Decisions', icon: MessageSquare, count: 0 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${activeTab === tab.id 
                      ? 'bg-pin-blue text-white' 
                      : theme === 'light' 
                        ? 'text-neutral-600 hover:bg-neutral-100' 
                        : 'text-neutral-400 hover:bg-neutral-700/50'
                    }
                  `}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`
                      px-1.5 py-0.5 rounded-full text-xs
                      ${activeTab === tab.id ? 'bg-white/20' : 'bg-neutral-500/20'}
                    `}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-32">
              {activeTab === 'tasks' && (
                <div className="space-y-2">
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
                    <div className={`p-3 border rounded-lg ${theme === 'light' ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-700 bg-neutral-800/50'}`}>
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Task title..."
                        className={`
                          w-full p-2 rounded border text-sm
                          ${theme === 'light' 
                            ? 'border-neutral-300 bg-white text-neutral-900' 
                            : 'border-neutral-600 bg-neutral-700 text-white'
                          }
                        `}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddTask();
                          if (e.key === 'Escape') {
                            setShowAddTask(false);
                            setNewTaskTitle('');
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={handleAddTask}
                          className="px-3 py-1 bg-pin-blue text-white rounded text-sm hover:bg-pin-blue-600 transition-colors"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setShowAddTask(false);
                            setNewTaskTitle('');
                          }}
                          className={`px-3 py-1 rounded text-sm transition-colors ${theme === 'light' ? 'text-neutral-600 hover:bg-neutral-200' : 'text-neutral-400 hover:bg-neutral-600'}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Task List Placeholder */}
                  <div className={`text-center py-8 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tasks yet. Add one to get started!</p>
                  </div>
                </div>
              )}

              {activeTab === 'risks' && (
                <div className={`text-center py-8 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Risk management coming soon</p>
                </div>
              )}

              {activeTab === 'decisions' && (
                <div className={`text-center py-8 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Decision logs coming soon</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collapsed Stats */}
        {!isExpanded && (
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className={`text-lg font-semibold ${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>
                  {mission.tasks_count || 0}
                </div>
                <div className={`text-xs ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>Tasks</div>
              </div>
              
              <div className="space-y-1">
                <div className="text-lg font-semibold text-orange-500">
                  {mission.risks_count || 0}
                </div>
                <div className={`text-xs ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>Risks</div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-center">
                  {hasSharedUsers ? (
                    <div className="flex -space-x-1">
                      {mission.shared_with.slice(0, 3).map((user, i) => (
                        <div
                          key={i}
                          className={`w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pin-blue ${theme === 'light' ? 'border-2 border-white' : 'border-2 border-neutral-800'} flex items-center justify-center text-xs font-medium text-white`}
                          title={user.email}
                        >
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {mission.shared_with.length > 3 && (
                        <div className={`w-6 h-6 rounded-full ${theme === 'light' ? 'bg-neutral-300 border-2 border-white text-neutral-700' : 'bg-neutral-600 border-2 border-neutral-800 text-neutral-300'} flex items-center justify-center text-xs`}>
                          +{mission.shared_with.length - 3}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`w-6 h-6 rounded-full ${theme === 'light' ? 'bg-neutral-200 border border-neutral-300' : 'bg-neutral-700 border border-neutral-600'} flex items-center justify-center`}>
                      <Eye className={`w-3 h-3 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`} />
                    </div>
                  )}
                </div>
                <div className={`text-xs ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  {hasSharedUsers ? 'Shared' : 'Private'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Priority Indicator */}
        <div className="absolute top-2 right-2">
          <div 
            className={`w-3 h-3 rounded-full ${
              mission.priority === 'critical' ? 'bg-red-500' :
              mission.priority === 'high' ? 'bg-orange-500' :
              mission.priority === 'medium' ? 'bg-yellow-500' :
              'bg-green-500'
            }`}
            title={`${mission.priority} priority`}
          />
        </div>

        {/* Overdue Indicator */}
        {isOverdue && (
          <div className="absolute top-2 left-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span className="text-xs text-red-400 font-medium">Overdue</span>
            </div>
          </div>
        )}

        {/* Selection Indicator */}
        {isSelected && (
          <div className="absolute inset-0 border-2 border-blue-400 rounded-xl pointer-events-none animate-pulse" />
        )}

        {/* Tags */}
        {tags.length > 0 && !isExpanded && (
          <div className="absolute bottom-2 left-2 right-2">
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className={`px-2 py-1 rounded text-xs ${theme === 'light' ? 'bg-neutral-200 text-neutral-700' : 'bg-neutral-800/60 border border-neutral-700/50 text-neutral-300'}`}
                >
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className={`px-2 py-1 rounded text-xs ${theme === 'light' ? 'bg-neutral-200 text-neutral-600' : 'bg-neutral-800/60 border border-neutral-700/50 text-neutral-400'}`}>
                  +{tags.length - 3}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Shadow for dragging */}
      {isDragging && (
        <div className="absolute inset-0 bg-neutral-800/20 rounded-xl border-2 border-dashed border-neutral-600 -z-10 transform translate-x-1 translate-y-1" />
      )}
    </div>
  );
};

export default MissionContainer;