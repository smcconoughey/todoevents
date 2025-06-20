import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import MissionContainer from './MissionContainer';

const DraggableMission = ({ mission, isSelected, onSelect, theme }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `mission-${mission.id}`,
    data: {
      type: 'mission',
      mission: mission
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <MissionContainer
        mission={mission}
        isSelected={isSelected}
        onSelect={onSelect}
        isDragging={isDragging}
        theme={theme}
      />
    </div>
  );
};

export default DraggableMission;