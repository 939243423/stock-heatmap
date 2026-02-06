/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
        colors: {
            'up': '#ef4444', // Red for UP (Chinese convention)
            'down': '#22c55e', // Green for DOWN
            'dark-bg': '#0f172a', // Slate 900
            'card-bg': '#1e293b', // Slate 800
        }
    },
  },
  plugins: [],
}
