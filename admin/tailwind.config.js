/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          portal: {
            background: '#f4f4f5', // Light gray background
            primary: '#0077cc',    // Bright blue
            secondary: '#ff6600',  // Orange
            accent: '#00ffff',     // Cyan
            text: {
              dark: '#333333',
              light: '#ffffff'
            }
          }
        },
        backgroundColor: {
          'portal-light': '#f4f4f5',
          'portal-dark': '#1e1e1e'
        }
      },
    },
    plugins: [],
  }