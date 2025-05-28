import React, { useContext } from "react";
import { ThemeContext } from "../ThemeContext";
import { getCategory } from "./categoryConfig";

// Helper to format date/time
function formatDate(dateStr, timeStr) {
  try {
    const date = new Date(`${dateStr}T${timeStr}`);
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return `${dateStr} ${timeStr}`;
  }
}

const ShareCard = ({ event }) => {
  const { theme } = useContext(ThemeContext);
  const category = getCategory(event.category);

  return (
    <div
      className={`w-[400px] h-[500px] rounded-2xl shadow-xl flex flex-col items-center justify-between p-6 relative overflow-hidden border-2 ${
        theme === "dark"
          ? "bg-neutral-900 text-white border-white/10"
          : "bg-white text-neutral-900 border-neutral-200"
      }`}
      style={{ fontFamily: 'Inter, sans-serif' }}
      id="share-card-root"
    >
      {/* Branding/logo */}
      <img
        src="/images/pin-logo.png"
        alt="Site Logo"
        className="absolute top-4 right-4 w-12 h-12 opacity-80"
        style={{ filter: theme === "dark" ? "invert(1)" : "none" }}
      />
      {/* Map Pin */}
      <div className="flex flex-col items-center mt-4">
        <div className="w-16 h-16 mb-2">
          {/* You can use an SVG or image for the pin, or render your custom marker here */}
          <img
            src="/images/pin-logo.png"
            alt="Event Pin"
            className="w-full h-full object-contain"
            style={{ filter: theme === "dark" ? "invert(1)" : "none" }}
          />
        </div>
        <div className="text-lg font-bold tracking-tight mb-1 text-center">
          {event.title}
        </div>
        <div className="text-base font-medium mb-2 text-center">
          {formatDate(event.date, event.time)}
        </div>
        <div className="text-sm mb-2 text-center">
          {event.address}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-block w-4 h-4 rounded-full"
            style={{ background: category?.color || "#FFEC3A" }}
          ></span>
          <span className="text-xs font-semibold uppercase tracking-wider">
            {category?.label || event.category}
          </span>
        </div>
      </div>
      {/* Footer with site info */}
      <div className="absolute bottom-4 left-0 w-full flex flex-col items-center">
        <div className="text-xs opacity-70 mb-1">Find more events at</div>
        <div className="font-bold text-spark-yellow text-lg tracking-tight">
          todo-events.com
        </div>
      </div>
    </div>
  );
};

export default ShareCard; 