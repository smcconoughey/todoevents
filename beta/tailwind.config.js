/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // Brand Typography
      fontFamily: {
        'display': ['Poppins', 'system-ui', 'sans-serif'],
        'body': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['Space Grotesk', 'SF Mono', 'Monaco', 'monospace'],
        'data': ['Space Grotesk', 'SF Mono', 'Monaco', 'monospace'],
      },
      
      // Brand Colors
      colors: {
        // Brand palette
        'spark-yellow': {
          DEFAULT: '#FFEC3A',
          dark: '#FFD82E',
          50: '#FFFEF7',
          100: '#FFFCE8',
          200: '#FFF8C5',
          300: '#FFF3A2',
          400: '#FFEE5C',
          500: '#FFEC3A',
          600: '#FFE916',
          700: '#F5D700',
          800: '#C7B000',
          900: '#998800',
        },
        'pin-blue': {
          DEFAULT: '#2684FF',
          light: '#3C92FF',
          50: '#F0F7FF',
          100: '#E0EFFF',
          200: '#B8DDFF',
          300: '#8FC9FF',
          400: '#5BA5FF',
          500: '#2684FF',
          600: '#0066FF',
          700: '#0052CC',
          800: '#003D99',
          900: '#002966',
        },
        'vibrant-magenta': {
          DEFAULT: '#FF5A87',
          dark: '#E04A73',
          50: '#FFF1F5',
          100: '#FFE4EB',
          200: '#FFCDD8',
          300: '#FFB1C5',
          400: '#FF8BA6',
          500: '#FF5A87',
          600: '#FF2968',
          700: '#F70049',
          800: '#C4003A',
          900: '#91002B',
        },
        'fresh-teal': {
          DEFAULT: '#38D6C0',
          dark: '#2FB8A6',
          50: '#F0FDFC',
          100: '#E0FBF8',
          200: '#C2F7F1',
          300: '#A3F3EA',
          400: '#66EBDC',
          500: '#38D6C0',
          600: '#1BC2A4',
          700: '#159F87',
          800: '#0F7C6A',
          900: '#0A594D',
        },
        
        // Shadcn/ui compatibility
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      
      // Brand animations and transitions
      transitionTimingFunction: {
        'bounce-brand': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "slide-in-from-top": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-in-from-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-in-from-bottom": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-in-from-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-out-to-top": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-100%)" },
        },
        "slide-out-to-right": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
        "slide-out-to-bottom": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(100%)" },
        },
        "slide-out-to-left": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-100%)" },
        },
        "fade-in": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        "fade-out": {
          "0%": { opacity: 1 },
          "100%": { opacity: 0 },
        },
        // Brand-specific animations
        "bounce-in": {
          "0%": { 
            transform: "scale(0.3) translateY(20px)",
            opacity: 0 
          },
          "50%": { 
            transform: "scale(1.05) translateY(-5px)" 
          },
          "70%": { 
            transform: "scale(0.9) translateY(2px)" 
          },
          "100%": { 
            transform: "scale(1) translateY(0)",
            opacity: 1 
          },
        },
        "pulse-yellow": {
          "0%, 100%": { 
            boxShadow: "0 0 0 0 rgba(255, 236, 58, 0.7)" 
          },
          "50%": { 
            boxShadow: "0 0 0 10px rgba(255, 236, 58, 0)" 
          },
        },
        "glow-yellow": {
          "0%, 100%": { 
            boxShadow: "0 0 5px rgba(255, 236, 58, 0.5)" 
          },
          "50%": { 
            boxShadow: "0 0 20px rgba(255, 236, 58, 0.8)" 
          },
        },
      },
      
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in-from-top": "slide-in-from-top 0.3s ease-out",
        "slide-in-from-right": "slide-in-from-right 0.3s ease-out",
        "slide-in-from-bottom": "slide-in-from-bottom 0.3s ease-out",
        "slide-in-from-left": "slide-in-from-left 0.3s ease-out",
        "slide-out-to-top": "slide-out-to-top 0.3s ease-in",
        "slide-out-to-right": "slide-out-to-right 0.3s ease-in",
        "slide-out-to-bottom": "slide-out-to-bottom 0.3s ease-in",
        "slide-out-to-left": "slide-out-to-left 0.3s ease-in",
        "fade-in": "fade-in 0.3s ease-in",
        "fade-out": "fade-out 0.3s ease-out",
        // Brand animations
        "bounce-in": "bounce-in 0.25s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "pulse-yellow": "pulse-yellow 2s infinite",
        "glow-yellow": "glow-yellow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [
    // Use a try-catch block to make the plugin dependency more resilient
    function() {
      try {
        return require("tailwindcss-animate");
      } catch (error) {
        console.warn("Warning: tailwindcss-animate plugin not found, animations may not work correctly.");
        return {};
      }
    }()
  ],
}