/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Base colors
        'bg': {
          'extremeweak': 'var(--bg-extremeweak)',
          'ultraweak': 'var(--bg-ultraweak)',
          'weak': 'var(--bg-weak)',
          DEFAULT: 'var(--bg)',
          'medium': 'var(--bg-medium)',
          'dark-ultrastrong': 'var(--bg-dark-ultrastrong)',
          'hover-dark-ultrastrong': 'var(--bg-hover-dark-ultrastrong)',
        },
        'text': {
          'link': 'var(--text-link)',
          'link-hover': 'var(--text-link-hover)',
          DEFAULT: 'var(--text)',
          'light': 'var(--text-light)',
          'inverted-weak': 'var(--text-inverted-weak)',
          'inverted': 'var(--text-inverted)',
          'pri-green': 'var(--text-pri-green)',
          'pri-blue': 'var(--text-pri-blue)',
          'hover-blue': 'var(--text-hover-blue)',
          'ultraweak': 'var(--text-ultraweak)',
          'weak': 'var(--text-weak)',
          'medium': 'var(--text-medium)',
          'error': 'var(--text-error)',
        },
        'border': {
          'weak': 'var(--border-weak)',
          'inverted-op-ultraweak': 'var(--border-inverted-op-ultraweak)',
          'inverted-op-weak': 'var(--border-inverted-op-weak)',
          'inverted-op-mediumweak': 'var(--border-inverted-op-mediumweak)',
          DEFAULT: 'var(--border)',
          'light': 'var(--border-light)',
          'pri-green-weak': 'var(--border-pri-green-weak)',
          'pri-green-strong': 'var(--border-pri-green-strong)',
          'pri-blue': 'var(--border-pri-blue)',
          'hover-blue': 'var(--border-hover-blue)',
          'error': 'var(--border-error)',
          'input-hover': 'var(--border-input-hover)',
        },
        'stroke': {
          'dark-weak': 'var(--stroke-dark-weak)',
          'dark-medium': 'var(--stroke-dark-medium)',
          'dark': 'var(--stroke-dark)',
          'hover': 'var(--stroke-hover)',
          'light-extremestrong': 'var(--stroke-light-extremestrong)',
          'extremestrong': 'var(--stroke-extremestrong)',
          'op-dark-extremestrong': 'var(--stroke-op-dark-extremestrong)',
          'neg-medium': 'var(--stroke-neg-medium)',
        },
        // Background opacity variants
        'bg-op': {
          'dark-extremeweak': 'var(--bg-op-dark-extremeweak)',
          'dark-ultraweak': 'var(--bg-op-dark-ultraweak)',
          'dark-weak': 'var(--bg-op-dark-weak)',
          'dark-mediumweak': 'var(--bg-op-dark-mediumweak)',
          'dark-medium': 'var(--bg-op-dark-medium)',
          'dark-strong': 'var(--bg-op-dark-strong)',
          'dark-ultrastrong': 'var(--bg-op-dark-ultrastrong)',
          'dark-extremestrong': 'var(--bg-op-dark-extremestrong)',
        },
        // Background inverted opacity variants
        'bg-inverted-op': {
          'dark-ultraweak': 'var(--bg-inverted-op-dark-ultraweak)',
          'dark-mediumweak': 'var(--bg-inverted-op-dark-mediumweak)',
          'dark-extremestrong': 'var(--bg-inverted-op-dark-extremestrong)',
        },
        // Action colors
        'pri': {
          'green': 'var(--bg-pri-green)',
          'blue': 'var(--bg-pri-blue)',
        },
        'hover': {
          'green': 'var(--bg-hover-green)',
          'blue': 'var(--bg-hover-blue)',
        },
        'active': {
          'blue': 'var(--bg-active-blue)',
        },
        'cancel': {
          DEFAULT: 'var(--bg-cancel)',
          'hover': 'var(--bg-hover-cancel)',
        },
        'success': {
          DEFAULT: 'var(--bg-success)',
          'hover': 'var(--bg-hover-success)',
          'active': 'var(--bg-active-success)',
        },
        'error': {
          DEFAULT: 'var(--bg-error)',
          'hover': 'var(--bg-hover-error)',
        },
        'input': {
          DEFAULT: 'var(--bg-input)',
          'inverted': 'var(--bg-input-inverted)',
        },
        'select': {
          'weak': 'var(--bg-select-weak)',
          DEFAULT: 'var(--bg-select)',
          'hover': 'var(--bg-select-hover)',
        },
        'btn': {
          'hover': 'var(--bg-btn-hover)',
          'hover-strong': 'var(--bg-btn-hover-strong)',
        },
        'modal': {
          DEFAULT: 'var(--bg-modal)',
          'header': 'var(--bg-modal-header)',
        },
        'overlay': 'var(--bg-overlay)',
      },
      boxShadow: {
        'input': '0 0 0 2px var(--shadow-input)',
        'btn-cancel': '0 0 0 2px var(--shadow-btn-cancel)',
        'btn-confirm': '0 0 0 2px var(--shadow-btn-confirm)',
        'btn-hover': '0 0 0 2px var(--shadow-btn-hover)',
        'modal-light': '0 2px 6px var(--shadow-modal-light)',
        'modal': '0 2px 6px var(--shadow-modal)',
      },
      zIndex: {
        'toast': '1000',
        'overlay': '900',
        'modal': '1000',
        'sidebar': '2000',
      },
      spacing: {
        'page-h': '20px',
        'header': '45px',
        'sidebar': '300px',
        'config-sidebar': '450px',
      },
      transitionDuration: {
        'fast': '0.2s',
        'normal': '0.3s',
      },
      screens: {
        's': '768px',
        'm': '900px',
      },
      keyframes: {
        slideUpAndFade: {
          from: {
            opacity: '0',
            transform: 'translateY(2px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        slideRightAndFade: {
          from: {
            opacity: '0',
            transform: 'translateX(-2px)',
          },
          to: {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
        slideDownAndFade: {
          from: {
            opacity: '0',
            transform: 'translateY(-2px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        slideLeftAndFade: {
          from: {
            opacity: '0',
            transform: 'translateX(2px)',
          },
          to: {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
      },
      animation: {
        slideUpAndFade: 'slideUpAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        slideRightAndFade: 'slideRightAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        slideDownAndFade: 'slideDownAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        slideLeftAndFade: 'slideLeftAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/line-clamp'),
  ],
} 