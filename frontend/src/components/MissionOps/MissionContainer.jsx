import React, { useState, useRef } from 'react';
import { 
  Target, 
  Calendar, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Pause, 
  X,
  Grip,
  MoreHorizontal,
  Eye,
  Share2
} from 'lucide-react';

const MissionContainer = ({ 
  mission, 
  isSelected, 
  onSelect, 
  onDragStart, 
  isDragging,
  theme = 'dark'
}) => {
  const [isDragStarted, setIsDragStarted] = useState(false);
  const dragRef = useRef(null);

  const getPriorityColor = (priority) => {
    const baseColors = {
      critical: theme === 'light' ? 'border-red-500 bg-red-50' : 'border-red-500 bg-red-500/10',
      high: theme === 'light' ? 'border-orange-500 bg-orange-50' : 'border-orange-500 bg-orange-500/10',
      medium: theme === 'light' ? 'border-yellow-500 bg-yellow-50' : 'border-yellow-500 bg-yellow-500/10',
      low: theme === 'light' ? 'border-green-500 bg-green-50' : 'border-green-500 bg-green-500/10',
      default: theme === 'light' ? 'border-neutral-300 bg-white' : 'border-neutral-600 bg-neutral-800/50'
    };
    return baseColors[priority] || baseColors.default;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'paused': return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'cancelled': return <X className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-pin-blue" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'paused': return 'text-yellow-500';
      case 'cancelled': return 'text-red-500';
      default: return 'text-pin-blue';
    }
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.target.closest('.mission-drag-handle')) {
      setIsDragStarted(true);
      onDragStart(mission);
    } else {
      onSelect();
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

  return (
    <div
      ref={dragRef}
      className={`
        relative group cursor-pointer transition-all duration-200 transform
        ${isDragging ? 'scale-105 rotate-1 z-50' : 'hover:scale-105'}
        ${isSelected ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}
      `}
      onMouseDown={handleMouseDown}
      style={{
        opacity: isDragging ? 0.8 : 1,
      }}
    >
      {/* Main Container */}
      <div 
        className={`
          relative min-w-80 max-w-96 rounded-xl border-2 backdrop-blur-sm
          ${getPriorityColor(mission.priority)}
          ${isSelected ? 'shadow-lg shadow-blue-400/25' : 'shadow-lg shadow-black/25'}
          transition-all duration-200
        `}
      >
        {/* Header */}
        <div className={`p-4 border-b ${theme === 'light' ? 'border-neutral-200/50' : 'border-neutral-700/50'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-pin-blue flex-shrink-0" />
                <h3 className={`font-semibold ${theme === 'light' ? 'text-neutral-900' : 'text-white'} truncate`}>{mission.title}</h3>
                {hasSharedUsers && (
                  <Share2 className="w-4 h-4 text-purple-500 flex-shrink-0" />
                )}
              </div>
              
              {mission.description && (
                <p className={`text-sm ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-300'} line-clamp-2 mb-2`}>
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

        {/* Stats */}
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
        {mission.tags && (
          <div className="absolute bottom-2 left-2 right-2">
            <div className="flex flex-wrap gap-1">
              {JSON.parse(mission.tags || '[]').slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-neutral-800/60 border border-neutral-700/50 rounded text-xs text-neutral-300"
                >
                  {tag}
                </span>
              ))}
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