// src/components/EventMap/CalendarFilter.jsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { X, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const CalendarFilter = ({ selectedDate, onDateSelect, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Helper function to create a consistent date at start of day in local timezone
  const normalizeToLocalDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const formatDateRange = (range) => {
    if (!range || (!range.from && !range.to)) return 'Select dates...';
    
    const formatDate = (date) => {
      if (!date) return '';
      const d = normalizeToLocalDate(date);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    };

    if (!range.to) return formatDate(range.from);
    return `${formatDate(range.from)} - ${formatDate(range.to)}`;
  };

  const handleDateSelect = (range) => {
    if (!range) {
      onDateSelect({ from: null, to: null });
      return;
    }

    // Create new range with normalized dates
    const normalizedRange = {
      from: range.from ? normalizeToLocalDate(range.from) : null,
      to: range.to ? normalizeToLocalDate(range.to) : null
    };

    onDateSelect(normalizedRange);

    // Close popover when a complete range is selected
    if (normalizedRange.from && normalizedRange.to) {
      setIsOpen(false);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onClear();
    setIsOpen(false);
  };

  // Ensure the displayed selection matches the actual dates
  const displayRange = {
    from: selectedDate?.from ? normalizeToLocalDate(selectedDate.from) : null,
    to: selectedDate?.to ? normalizeToLocalDate(selectedDate.to) : null
  };

  return (
    <div className="w-full">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger>
          <Button 
            type="button"
            variant="outline" 
            className="w-full flex items-center justify-between text-left bg-white/5 hover:bg-white/10 border-white/10"
          >
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-white/50" />
              <span className="text-white/70">
                {formatDateRange(displayRange)}
              </span>
            </div>
            {displayRange.from && (
              <X 
                className="h-4 w-4 text-white/50 hover:text-white/70"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3 bg-neutral-900/95 backdrop-blur-sm border-white/10">
          <Calendar
            mode="range"
            selected={displayRange}
            onSelect={handleDateSelect}
            className="text-white"
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
              month: "space-y-4",
              caption: "flex justify-center pt-1 relative items-center",
              caption_label: "text-sm font-medium text-white",
              nav: "space-x-1 flex items-center",
              nav_button: "h-7 w-7 bg-transparent p-0 text-white opacity-50 hover:opacity-100",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse space-y-1",
              head_row: "flex",
              head_cell: "text-white/50 rounded-md w-9 font-normal text-[0.8rem]",
              row: "flex w-full mt-2",
              cell: "text-center text-sm relative p-0 [&:has([aria-selected])]:bg-white/5 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: "h-9 w-9 p-0 font-normal text-white/70 hover:bg-white/10 rounded-md",
              day_selected: "bg-white/20 text-white hover:bg-white/30 hover:text-white focus:bg-white/30 focus:text-white",
              day_today: "bg-white/5 text-white",
              day_outside: "text-white/30 opacity-50",
              day_disabled: "text-white/20",
              day_range_middle: "aria-selected:bg-white/10 aria-selected:text-white",
              day_hidden: "invisible",
            }}
            components={{
              IconLeft: () => <ChevronLeft className="h-4 w-4" />,
              IconRight: () => <ChevronRight className="h-4 w-4" />,
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default CalendarFilter;