# APEDGE Design System

This document provides guidelines for using the APEDGE Design System to ensure consistent UI/UX across the application.

## Color Palette

The design system uses a consistent color palette based on CSS variables:

### Primary Colors
- `--primary-50` to `--primary-900`: Blue-based primary color scheme
- Used for primary actions, links, and key UI elements

### Secondary Colors
- `--secondary-50` to `--secondary-900`: Cyan-based secondary color scheme
- Used for secondary actions and supporting UI elements

### Status Colors
- `--success-50` to `--success-900`: Green-based success states
- `--warning-50` to `--warning-900`: Amber-based warning states
- `--danger-50` to `--danger-900`: Red-based error/danger states

### Neutral Colors
- `--gray-50` to `--gray-900`: Grayscale for text, backgrounds, and borders

## Spacing System

Consistent spacing using a 8-point grid system:
- `--spacing-xs`: 4px
- `--spacing-sm`: 8px
- `--spacing-md`: 16px
- `--spacing-lg`: 24px
- `--spacing-xl`: 32px
- `--spacing-2xl`: 48px
- `--spacing-3xl`: 64px

## Typography

Font family: `--font-family-base` (Poppins by default)

Font sizes:
- `--font-size-xs`: 12px
- `--font-size-sm`: 14px
- `--font-size-base`: 16px
- `--font-size-lg`: 18px
- `--font-size-xl`: 20px
- `--font-size-2xl`: 24px
- `--font-size-3xl`: 30px
- `--font-size-4xl`: 36px
- `--font-size-5xl`: 48px

Font weights:
- `--font-weight-light`: 300
- `--font-weight-normal`: 400
- `--font-weight-medium`: 500
- `--font-weight-semibold`: 600
- `--font-weight-bold`: 700
- `--font-weight-extrabold`: 800

## Border Radius

- `--radius-xs`: 2px
- `--radius-sm`: 4px
- `--radius-md`: 8px
- `--radius-lg`: 12px
- `--radius-xl`: 16px
- `--radius-2xl`: 24px
- `--radius-full`: 9999px

## Shadows

- `--shadow-xs`: Subtle shadow for small elements
- `--shadow-sm`: Small shadow for cards and buttons
- `--shadow-md`: Medium shadow for elevated elements
- `--shadow-lg`: Large shadow for modals and dropdowns
- `--shadow-xl`: Extra large shadow for special cases
- `--shadow-2xl`: Maximum shadow for emphasis

## Animations & Transitions

- `--transition-fast`: 150ms
- `--transition-medium`: 300ms
- `--transition-slow`: 500ms

Easing functions:
- `--ease-in-out`: cubic-bezier(0.4, 0, 0.2, 1)
- `--ease-out`: cubic-bezier(0, 0, 0.2, 1)
- `--ease-in`: cubic-bezier(0.4, 0, 1, 1)

## Component Classes

### Buttons
- `.btn`: Base button class
- `.btn-primary`: Primary action button
- `.btn-secondary`: Secondary action button
- `.btn-success`: Success action button
- `.btn-danger`: Danger/error action button
- `.btn-outline`: Outlined button variant
- `.btn-ghost`: Minimal button variant
- `.btn-sm`: Small button size
- `.btn-lg`: Large button size

### Form Elements
- `.input-field`: Standard input field
- `.textarea-field`: Textarea element
- `.select-field`: Select dropdown

### Badges
- `.badge`: Base badge class
- `.badge-primary`: Primary badge
- `.badge-secondary`: Secondary badge
- `.badge-success`: Success badge
- `.badge-warning`: Warning badge
- `.badge-danger`: Danger badge
- `.badge-neutral`: Neutral badge

### Alerts
- `.alert`: Base alert class
- `.alert-primary`: Primary alert
- `.alert-success`: Success alert
- `.alert-warning`: Warning alert
- `.alert-danger`: Danger alert
- `.alert-info`: Info alert

### Cards
- `.card`: Base card component
- `.card-compact`: Compact card variant

### Utilities
- `.rounded-borders`: Consistent border radius
- `.shadow-soft`: Soft shadow
- `.shadow-soft-hover`: Soft shadow on hover
- `.transition-all`: Smooth transitions
- `.transform-hover`: Subtle transform on hover
- `.text-gradient`: Gradient text effect

## Usage Examples

### Buttons
```html
<button class="btn btn-primary">Primary Button</button>
<button class="btn btn-secondary btn-sm">Small Secondary</button>
<button class="btn btn-outline">Outline Button</button>
```

### Cards
```html
<div class="card p-6">
  <h3 class="text-xl font-semibold mb-2">Card Title</h3>
  <p class="text-gray-600 mb-4">Card content...</p>
  <button class="btn btn-primary">Action</button>
</div>
```

### Alerts
```html
<div class="alert alert-success">
  <strong>Success!</strong> Operation completed successfully.
</div>
```

## Best Practices

1. **Consistency**: Always use the design system variables and classes rather than hardcoded values
2. **Accessibility**: Ensure sufficient color contrast and use semantic HTML
3. **Responsive Design**: Use responsive utility classes for different screen sizes
4. **Performance**: Limit custom styles and leverage existing components
5. **Maintainability**: Update the design system variables rather than individual component styles

## Customization

To customize the design system:
1. Modify variables in `src/styles/variables.css`
2. Update component styles in `src/styles/global.css`
3. Ensure all changes maintain consistency with the overall design language

For any major design changes, update this documentation to reflect the new standards.