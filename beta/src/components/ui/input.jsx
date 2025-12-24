import React from "react";
import { clsx } from "clsx"; import { twMerge } from "tailwind-merge"; function cn(...inputs) { return twMerge(clsx(inputs)); }

const Input = React.forwardRef(({ className, type = "text", ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "w-full px-4 py-2 rounded-md input-themed",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = "Input";

export { Input };