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
  Settings,
  Edit,
  Trash2,
  Brain,
  Network,
  BookOpen
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useMissionOps } from './MissionOpsContext';
import TaskList from './TaskList';
import AIInsightsList from './AIInsightsList';
import MissionRelationships from './MissionRelationships';
import DecisionWorkflows from './DecisionWorkflows';

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
  const [activeTab, setActiveTab] = useState('tasks'); // tasks, risks, decisions, insights, relationships
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  
  const { createTask, getTasks, getRisks, getDecisions, deleteMission } = useMissionOps();

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

  const handleDragStart = (e) => {
    // Only start drag if clicking on the drag handle
    if (e.target.closest('.mission-drag-handle')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragStarted(true);
      onDragStart(mission, { x: e.clientX, y: e.clientY });
    }
  };

  const handleContainerClick = (e) => {
    // Don't select if clicking on interactive elements
    if (e.target.closest('.mission-drag-handle') || 
        e.target.closest('.mission-options-menu') ||
        e.target.closest('button') ||
        e.target.closest('input') ||
        e.target.closest('textarea')) {
      return;
    }
    
    onSelect();
  };

  const handleOptionsClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowOptionsMenu(!showOptionsMenu);
  };

  const handleDeleteMission = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this mission?')) {
      try {
        await deleteMission(mission.id);
        setShowOptionsMenu(false);
      } catch (error) {
        console.error('Failed to delete mission:', error);
      }
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
      onClick={handleContainerClick}
      onMouseDown={handleDragStart}
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
              <button 
                className={`mission-drag-handle p-1 ${theme === 'light' ? 'hover:bg-neutral-100' : 'hover:bg-neutral-700/50'} rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing`}
                title="Drag to move mission"
              >
                <Grip className={`w-4 h-4 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`} />
              </button>
              
              <div className="relative">
                <button 
                  className={`mission-options-menu p-1 ${theme === 'light' ? 'hover:bg-neutral-100' : 'hover:bg-neutral-700/50'} rounded opacity-0 group-hover:opacity-100 transition-opacity`}
                  onClick={handleOptionsClick}
                  title="Mission options"
                >
                  <MoreHorizontal className={`w-4 h-4 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`} />
                </button>
                
                {/* Options Menu */}
                {showOptionsMenu && (
                  <div className={`absolute right-0 top-8 z-50 ${theme === 'light' ? 'bg-white border-neutral-200' : 'bg-neutral-800 border-neutral-700'} border rounded-lg shadow-lg py-1 min-w-32`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowOptionsMenu(false);
                        // TODO: Implement edit functionality
                      }}
                      className={`w-full px-3 py-2 text-left text-sm ${theme === 'light' ? 'hover:bg-neutral-100 text-neutral-700' : 'hover:bg-neutral-700 text-neutral-300'} flex items-center gap-2`}
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowOptionsMenu(false);
                        // TODO: Implement share functionality
                      }}
                      className={`w-full px-3 py-2 text-left text-sm ${theme === 'light' ? 'hover:bg-neutral-100 text-neutral-700' : 'hover:bg-neutral-700 text-neutral-300'} flex items-center gap-2`}
                    >
                      <Share2 className="w-3 h-3" />
                      Share
                    </button>
                    <hr className={`my-1 ${theme === 'light' ? 'border-neutral-200' : 'border-neutral-700'}`} />
                    <button
                      onClick={handleDeleteMission}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-red-500/10 text-red-500 flex items-center gap-2`}
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className={`px-4 py-2 border-b ${theme === 'light' ? 'border-neutral-200/50' : 'border-neutral-700/50'}`}>
            <div className="flex flex-wrap gap-1">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className={`px-2 py-1 text-xs rounded-full ${
                    theme === 'light' 
                      ? 'bg-neutral-100 text-neutral-700' 
                      : 'bg-neutral-700/50 text-neutral-300'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <div className={`border-t ${theme === 'light' ? 'border-neutral-200/50' : 'border-neutral-700/50'}`}>
            {/* Tab Navigation */}
            <div className={`flex border-b ${theme === 'light' ? 'border-neutral-200/50' : 'border-neutral-700/50'}`}>
              {[
                { id: 'tasks', label: 'Tasks', icon: CheckCircle2, count: mission.tasks_count || 0 },
                { id: 'insights', label: 'AI Insights', icon: Brain, count: mission.insights_count || 0 },
                { id: 'relationships', label: 'Relationships', icon: Network, count: mission.relationships_count || 0 },
                { id: 'risks', label: 'Risks', icon: AlertTriangle, count: mission.risks_count || 0 },
                { id: 'decisions', label: 'Decisions', icon: BookOpen, count: mission.decisions_count || 0 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab(tab.id);
                  }}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    activeTab === tab.id
                      ? theme === 'light' 
                        ? 'text-pin-blue border-b-2 border-pin-blue bg-pin-blue/5' 
                        : 'text-pin-blue border-b-2 border-pin-blue bg-pin-blue/10'
                      : theme === 'light'
                        ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/30'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                      activeTab === tab.id
                        ? 'bg-pin-blue text-white'
                        : theme === 'light'
                          ? 'bg-neutral-200 text-neutral-600'
                          : 'bg-neutral-700 text-neutral-300'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-4 max-h-96 overflow-y-auto">
              {activeTab === 'tasks' && (
                <TaskList missionId={mission.id} theme={theme} />
              )}
              {activeTab === 'insights' && (
                <AIInsightsList missionId={mission.id} theme={theme} />
              )}
              {activeTab === 'relationships' && (
                <MissionRelationships missionId={mission.id} theme={theme} />
              )}
              {activeTab === 'risks' && (
                <div className={`text-center py-8 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Enhanced risk management coming soon</p>
                </div>
              )}
              {activeTab === 'decisions' && (
                <DecisionWorkflows missionId={mission.id} theme={theme} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close options menu */}
      {showOptionsMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowOptionsMenu(false)}
        />
      )}
    </div>
  );
};

export default MissionContainer;