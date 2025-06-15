import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Target, Calendar, Users, AlertTriangle, FileText, Clock, Grip, Settings } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import MissionContainer from './MissionContainer';
import CreateMissionModal from './CreateMissionModal';
import { useMissionOps } from './MissionOpsContext';

const MissionOpsGrid = () => {
  const { theme } = useTheme();
  const {
    missions,
    isLoading,
    createMission,
    updateMissionPosition,
    selectedMissionId,
    setSelectedMissionId
  } = useMissionOps();

  const [viewportCenter, setViewportCenter] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isCreating, setIsCreating] = useState(false);
  const [draggedMission, setDraggedMission] = useState(null);
  const [hoveredPosition, setHoveredPosition] = useState(null);

  const gridRef = useRef(null);
  const timelineNowY = 0; // Y=0 represents "now"
  const gridSize = 50; // Grid cell size in pixels

  // Time scale: 1 day = 100 pixels
  const timeScale = 100;

  // Convert date to Y position (past = positive Y, future = negative Y)
  const dateToY = useCallback((dateStr) => {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    const now = new Date();
    const diffInDays = (now - date) / (1000 * 60 * 60 * 24);
    return diffInDays * timeScale;
  }, [timeScale]);

  // Convert Y position to date
  const yToDate = useCallback((y) => {
    const now = new Date();
    const daysOffset = y / timeScale;
    const date = new Date(now.getTime() - daysOffset * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }, [timeScale]);

  // Get grid coordinates from screen position
  const screenToGrid = useCallback((screenX, screenY) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    const x = (screenX - rect.left - rect.width / 2) / zoom + viewportCenter.x;
    const y = (screenY - rect.top - rect.height / 2) / zoom + viewportCenter.y;

    return { x, y };
  }, [viewportCenter, zoom]);

  // Snap to grid
  const snapToGrid = useCallback((x, y) => {
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize
    };
  }, [gridSize]);

  // Handle mouse/touch events
  const handlePointerDown = useCallback((e) => {
    if (e.target === gridRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - viewportCenter.x, y: e.clientY - viewportCenter.y });
    }
  }, [viewportCenter]);

  const handlePointerMove = useCallback((e) => {
    if (isDragging) {
      setViewportCenter({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (draggedMission) {
      const gridPos = screenToGrid(e.clientX, e.clientY);
      const snappedPos = snapToGrid(gridPos.x, gridPos.y);
      setHoveredPosition(snappedPos);
    }
  }, [isDragging, dragStart, draggedMission, screenToGrid, snapToGrid]);

  const handlePointerUp = useCallback((e) => {
    if (isDragging) {
      setIsDragging(false);
    } else if (draggedMission && hoveredPosition) {
      // Update mission position
      updateMissionPosition(draggedMission.id, hoveredPosition);
      setDraggedMission(null);
      setHoveredPosition(null);
    }
  }, [isDragging, draggedMission, hoveredPosition, updateMissionPosition]);

  // Handle zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * zoomFactor, 0.2), 3));
  }, []);

  // Setup event listeners
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    grid.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      grid?.removeEventListener('wheel', handleWheel);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handleWheel, handlePointerMove, handlePointerUp]);

  // Generate time markers
  const generateTimeMarkers = useCallback(() => {
    const markers = [];
    const now = new Date();
    
    // Generate markers for ±365 days
    for (let days = -365; days <= 365; days += 7) {
      const date = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const y = -days * timeScale;
      const isNow = days === 0;
      const isPast = days > 0;
      
      markers.push({
        y,
        date: date.toISOString().split('T')[0],
        label: days === 0 ? 'NOW' : 
               Math.abs(days) % 28 === 0 ? 
               date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
        isNow,
        isPast,
        isWeek: Math.abs(days) % 7 === 0,
        isMonth: Math.abs(days) % 28 === 0
      });
    }
    
    return markers;
  }, [timeScale]);

  const timeMarkers = generateTimeMarkers();

  // Handle mission drag start
  const handleMissionDragStart = useCallback((mission) => {
    setDraggedMission(mission);
  }, []);

  const handleCreateMission = useCallback(async (missionData) => {
    const gridPos = hoveredPosition || { x: 0, y: 0 };
    const startDate = yToDate(gridPos.y);
    
    await createMission({
      ...missionData,
      grid_x: gridPos.x,
      grid_y: gridPos.y,
      start_date: startDate
    });
    
    setIsCreating(false);
  }, [hoveredPosition, yToDate, createMission]);

  if (isLoading) {
    return (
      <div className={`h-screen ${theme === 'light' ? 'bg-white' : theme === 'frost' ? 'bg-frost-bg' : 'bg-neutral-950'} flex items-center justify-center`}>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-pin-blue border-t-transparent rounded-full animate-spin"></div>
          <p className={`${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>Loading MissionOps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen ${theme === 'light' ? 'bg-white text-neutral-900' : theme === 'frost' ? 'bg-frost-bg text-neutral-900' : 'bg-neutral-950 text-white'} relative overflow-hidden`}>
      {/* Header */}
      <div className={`absolute top-0 left-0 right-0 z-50 ${theme === 'light' ? 'bg-white/80 border-neutral-200' : theme === 'frost' ? 'bg-white/20 border-white/20' : 'bg-neutral-900/80 border-neutral-700'} backdrop-blur-sm border-b`}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Target className="w-6 h-6 text-pin-blue" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-pin-blue to-purple-400 bg-clip-text text-transparent">
                MissionOps
              </h1>
            </div>
            <div className={`text-sm ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
              {missions.length} active missions
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`text-xs ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
              Zoom: {Math.round(zoom * 100)}%
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-pin-blue hover:bg-pin-blue-600 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Mission
            </button>
            <button className={`p-2 ${theme === 'light' ? 'hover:bg-neutral-100' : theme === 'frost' ? 'hover:bg-white/10' : 'hover:bg-neutral-700'} rounded-lg transition-colors`}>
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div
        ref={gridRef}
        className="absolute inset-0 pt-16 cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        style={{
          transform: `translate(${viewportCenter.x}px, ${viewportCenter.y}px) scale(${zoom})`,
          transformOrigin: '50% 50%'
        }}
      >
        {/* Grid Pattern */}
        <div className="absolute inset-0" style={{ 
          backgroundImage: `
            radial-gradient(circle at 1px 1px, ${theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} 1px, transparent 0)
          `,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: '0 0'
        }} />

        {/* Time Markers */}
        {timeMarkers.map((marker, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 flex items-center"
            style={{ top: marker.y - 1 }}
          >
            {/* Timeline line */}
            <div 
              className={`w-full h-px ${
                marker.isNow 
                  ? 'bg-yellow-400 shadow-yellow-400/50 shadow-sm' 
                  : marker.isMonth
                  ? 'bg-pin-blue/40'
                  : marker.isWeek
                  ? theme === 'light' ? 'bg-neutral-400/60' : 'bg-neutral-600/60'
                  : theme === 'light' ? 'bg-neutral-300/40' : 'bg-neutral-700/40'
              }`}
            />
            
            {/* Time label */}
            {marker.label && (
              <div 
                className={`absolute left-4 px-2 py-1 rounded text-xs whitespace-nowrap ${
                  marker.isNow 
                    ? 'bg-yellow-400 text-black font-bold'
                    : marker.isPast
                    ? theme === 'light' ? 'bg-neutral-200 text-neutral-600' : 'bg-neutral-800 text-neutral-400'
                    : theme === 'light' ? 'bg-neutral-100 text-neutral-700' : 'bg-neutral-700 text-neutral-300'
                }`}
                style={{ 
                  opacity: marker.isPast ? 0.6 : 1,
                  transform: 'translateY(-50%)'
                }}
              >
                {marker.label}
                {marker.isNow && (
                  <div className="absolute -right-1 top-1/2 w-2 h-2 bg-yellow-400 rotate-45 transform -translate-y-1/2" />
                )}
              </div>
            )}
          </div>
        ))}

        {/* Mission Containers */}
        {missions.map((mission) => {
          const x = mission.grid_x || 0;
          const y = mission.grid_y || dateToY(mission.start_date);
          
          return (
            <div
              key={mission.id}
              className="absolute"
              style={{
                left: x,
                top: y,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <MissionContainer
                mission={mission}
                isSelected={selectedMissionId === mission.id}
                onSelect={() => setSelectedMissionId(mission.id)}
                onDragStart={handleMissionDragStart}
                isDragging={draggedMission?.id === mission.id}
                theme={theme}
              />
            </div>
          );
        })}

        {/* Hover Position Indicator */}
        {hoveredPosition && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: hoveredPosition.x,
              top: hoveredPosition.y,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="w-4 h-4 border-2 border-pin-blue bg-pin-blue/20 rounded-full animate-pulse" />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className={`absolute bottom-4 left-4 ${theme === 'light' ? 'bg-white/90 border border-neutral-200' : theme === 'frost' ? 'bg-white/20 border border-white/20' : 'bg-neutral-900/90'} backdrop-blur-sm rounded-lg p-4 text-sm`}>
        <h3 className="font-semibold mb-2">Timeline Legend</h3>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-px bg-yellow-400"></div>
            <span>NOW</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-px bg-pin-blue/40"></div>
            <span>Months</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-px ${theme === 'light' ? 'bg-neutral-400/60' : 'bg-neutral-600/60'}`}></div>
            <span>Weeks</span>
          </div>
        </div>
        <div className={`mt-2 pt-2 border-t ${theme === 'light' ? 'border-neutral-200' : 'border-neutral-700'}`}>
          <div className={`${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>Scroll to zoom • Drag to pan</div>
        </div>
      </div>

      {/* Mission Creation Modal */}
      {isCreating && (
        <CreateMissionModal
          onClose={() => setIsCreating(false)}
          onSubmit={handleCreateMission}
          defaultPosition={hoveredPosition}
          yToDate={yToDate}
        />
      )}
    </div>
  );
};

export default MissionOpsGrid;