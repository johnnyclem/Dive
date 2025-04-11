# Tailwind CSS Migration Guide

This document provides guidance on how to continue the migration from traditional CSS/SCSS to Tailwind CSS in the Dive application.

## What Has Been Done

- Installed Tailwind CSS and its dependencies
- Created Tailwind configuration files (tailwind.config.js and postcss.config.js)
- Updated the main CSS file (src/index.css) to include Tailwind directives
- Converted the following components to use Tailwind:
  - Chat container (src/views/Chat/index.tsx)
  - Chat messages (src/views/Chat/ChatMessages.tsx)
  - Chat input (src/views/Chat/ChatInput.tsx)
  - Message component (src/views/Chat/Message.tsx)

## Migration Strategy

### 1. Component-by-Component Approach

Continue converting components one at a time:

1. Identify a component with its related CSS
2. Convert CSS classes to equivalent Tailwind classes
3. Test the component to ensure it looks and functions correctly
4. Move on to the next component

### 2. CSS Variable Integration

The project uses CSS variables for theming. Continue to use these variables with Tailwind using the arbitrary value syntax:

```jsx
// Example
<div className="bg-[var(--bg)] text-[var(--text)]">
```

This preserves the theming system while moving to Tailwind.

### 3. SCSS File Removal

As components are migrated, you can gradually remove the corresponding SCSS files:

1. When a component is fully migrated to Tailwind, identify its SCSS file
2. Remove imports of that SCSS file from other files
3. Delete the SCSS file if it's no longer needed

### 4. Custom Utilities

For recurring patterns that Tailwind doesn't cover, create custom utilities in the tailwind.config.js file:

```js
// Example for adding custom utilities
theme: {
  extend: {
    // ...
  }
},
plugins: [
  function({ addUtilities }) {
    const newUtilities = {
      '.custom-class': {
        // CSS properties
      },
    }
    addUtilities(newUtilities)
  }
]
```

## Best Practices

1. **CSS Variables**: Continue using CSS variables for theming with the arbitrary value syntax `[var(--variable-name)]`
2. **Group Related Classes**: Use Tailwind's group modifier for hover/focus states
3. **Extract Components**: For complex UI patterns, extract them into reusable components
4. **Responsive Design**: Use Tailwind's responsive prefixes (sm:, md:, lg:, etc.) for responsive designs

## Troubleshooting

If styles aren't appearing correctly:

1. Check if the content array in tailwind.config.js includes the file you're working on
2. Make sure Tailwind directives (@tailwind base, components, utilities) are in the main CSS file
3. Check for CSS specificity issues (you may need to use the !important modifier in Tailwind with the ! prefix)
4. Verify that the build process includes PostCSS with Tailwind

## Components To Migrate

Continue migrating these components in order of priority:

1. Navigation and layout components
2. Form elements 
3. Modal and overlay components
4. Utility UI components
5. Page-specific components

## Testing

After migrating each component, test thoroughly:
- Visual appearance
- Responsive behavior
- Interactions
- Theme switching

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind CSS Migration Guide](https://tailwindcss.com/docs/migration-guide)
- [Tailwind CSS Arbitrary Values](https://tailwindcss.com/docs/adding-custom-styles#using-arbitrary-values) 