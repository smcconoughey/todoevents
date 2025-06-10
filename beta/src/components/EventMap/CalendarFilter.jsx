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
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

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
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal bg-themed-surface border-themed hover:bg-themed-surface-hover",
              !displayRange.from && "text-themed-tertiary"
            )}
          >
            <CalendarIcon className="h-4 w-4 text-themed-tertiary" />
            <span className="text-themed-secondary">
              {displayRange.from 
                ? formatDateRange(displayRange) 
                : "Select date..."
              }
            </span>
            {displayRange.from && (
              <X 
                className="h-4 w-4 text-themed-tertiary hover:text-themed-secondary ml-auto"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 calendar-themed" align="start">
          <Calendar
            mode="range"
            selected={displayRange}
            onSelect={handleDateSelect}
            disabled={(date) => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return date < today;
            }}
            initialFocus
            className="text-themed-primary"
            classNames={{
              caption_label: "text-sm font-medium text-themed-primary",
              nav: "space-x-1 flex items-center",
              nav_button: "h-7 w-7 bg-transparent p-0 text-themed-primary opacity-50 hover:opacity-100",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse space-y-1",
              head_row: "flex",
              head_cell: "text-themed-tertiary rounded-md w-9 font-normal text-[0.8rem]",
              row: "flex w-full mt-2",
              cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: "h-9 w-9 p-0 font-normal text-themed-secondary hover:bg-themed-surface-hover rounded-md",
              day_selected: "bg-pin-blue text-white hover:bg-pin-blue-600 hover:text-white focus:bg-pin-blue-600 focus:text-white",
              day_today: "bg-themed-surface-active text-themed-primary",
              day_outside: "text-themed-muted opacity-50",
              day_disabled: "text-themed-muted",
              day_range_middle: "aria-selected:bg-themed-surface-hover aria-selected:text-themed-primary",
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