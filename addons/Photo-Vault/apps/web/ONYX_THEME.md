 class# Onyx Theme Design System

## Overview
The Onyx theme is a sophisticated dark design system built for Booster Vault, featuring a modern black-and-cyan aesthetic with purple accents. It provides a premium, privacy-focused user experience that emphasizes security and elegance.

## Color Palette

### Primary Colors
- **Onyx Black**: `#0a0a0a` - Primary background
- **Onyx Darker**: `#121212` - Secondary background
- **Onyx Dark**: `#1a1a1a` - Tertiary background
- **Onyx Medium**: `#242424` - Elevated surfaces
- **Onyx Light**: `#2f2f2f` - Borders and subtle elements
- **Onyx Lighter**: `#3a3a3a` - Hover states

### Accent Colors
- **Primary Accent**: `#00d4ff` (Cyan) - Main interactive elements
- **Secondary Accent**: `#7c3aed` (Purple) - Gradient endpoints
- **Gradient**: Linear gradient from cyan to purple

### Semantic Colors
- **Success**: `#10b981` (Green) - Success states
- **Warning**: `#f59e0b` (Orange) - Warning states
- **Danger**: `#ef4444` (Red) - Error states
- **Info**: `#3b82f6` (Blue) - Information states

### Text Colors
- **Primary Text**: `#ffffff` - Headings and important text
- **Secondary Text**: `#a1a1a1` - Body text
- **Tertiary Text**: `#737373` - Subtle text
- **Disabled Text**: `#525252` - Disabled states

## Typography

### Font Stack
- **Sans-serif**: System fonts for optimal performance
  ```css
  -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 
  'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif
  ```

### Type Scale
- **H1**: `clamp(2.5rem, 5vw, 4rem)` - Hero titles
- **H2**: `clamp(2rem, 4vw, 3rem)` - Section headers
- **H3**: `clamp(1.5rem, 3vw, 2rem)` - Subsection headers
- **H4**: `1.25rem` - Card titles
- **Body**: `1rem` - Standard body text
- **Small**: `0.875rem` - Supporting text

## Spacing System

Uses a consistent 8px base unit system:
- **space-1**: `0.25rem` (4px)
- **space-2**: `0.5rem` (8px)
- **space-3**: `0.75rem` (12px)
- **space-4**: `1rem` (16px)
- **space-5**: `1.25rem` (20px)
- **space-6**: `1.5rem` (24px)
- **space-8**: `2rem` (32px)
- **space-10**: `2.5rem` (40px)
- **space-12**: `3rem` (48px)
- **space-16**: `4rem` (64px)
- **space-20**: `5rem` (80px)
- **space-24**: `6rem` (96px)

## Component Library

### Buttons

```html
<!-- Primary Button -->
<button class="btn btn-primary">Primary Action</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">Secondary Action</button>

<!-- Ghost Button -->
<button class="btn btn-ghost">Subtle Action</button>

<!-- Danger Button -->
<button class="btn btn-danger">Delete</button>

<!-- Size Variants -->
<button class="btn btn-primary btn-lg">Large</button>
<button class="btn btn-primary btn-sm">Small</button>
```

### Forms

```html
<div class="form-group">
  <label class="form-label">Email</label>
  <input type="email" class="form-input" placeholder="you@example.com">
</div>

<div class="form-group">
  <label class="form-label">Message</label>
  <textarea class="form-textarea" placeholder="Your message"></textarea>
</div>
```

### Cards

```html
<!-- Standard Card -->
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Card Title</h3>
    <p class="card-subtitle">Card subtitle</p>
  </div>
  <p>Card content goes here</p>
</div>

<!-- Elevated Card -->
<div class="card card-elevated">
  <p>Elevated card with enhanced shadow</p>
</div>
```

### Banners/Alerts

```html
<div class="banner banner-info">
  <span>ℹ️</span>
  <div>
    <div class="banner-title">Information</div>
    <div class="banner-message">This is an informational message</div>
  </div>
</div>

<!-- Variants: banner-success, banner-warning, banner-danger -->
```

### Navigation

```html
<!-- Top Navigation -->
<header class="top-nav">
  <div class="nav-logo">Booster Vault</div>
  <!-- Navigation items -->
</header>

<!-- Side Navigation -->
<nav class="side-nav">
  <ul class="nav-list">
    <li class="nav-item">
      <a href="#" class="nav-link active">
        <span class="nav-icon">📚</span>
        Library
      </a>
    </li>
  </ul>
</nav>
```

## Layout Patterns

### Marketing Pages

```html
<div class="marketing-page">
  <!-- Hero Section -->
  <div class="marketing-header container">
    <h1 class="marketing-hero-title">Your Title</h1>
    <p class="marketing-hero-subtitle">Subtitle text</p>
    <button class="btn btn-primary btn-lg">CTA Button</button>
  </div>

  <!-- Content Section -->
  <section class="marketing-section">
    <div class="marketing-content">
      <h2 class="text-gradient">Section Title</h2>
      <p>Section content</p>
    </div>
  </section>

  <!-- Feature Grid -->
  <section class="marketing-section">
    <div class="container">
      <div class="feature-grid">
        <div class="feature-card">
          <div class="feature-icon">📁</div>
          <h3>Feature Title</h3>
          <p>Feature description</p>
        </div>
        <!-- More cards -->
      </div>
    </div>
  </section>
</div>
```

### Authentication Pages

```html
<div class="auth-container">
  <div class="auth-card">
    <h1 class="auth-title text-gradient">Login</h1>
    <form>
      <!-- Form fields -->
    </form>
  </div>
</div>
```

### Pricing Grid

```html
<div class="pricing-grid">
  <div class="pricing-card">
    <h3>Plan Name</h3>
    <div class="pricing-price">$99</div>
    <p>Plan description</p>
    <button class="btn btn-secondary">Get Started</button>
  </div>
  
  <div class="pricing-card featured">
    <h3>Premium Plan</h3>
    <div class="pricing-price">$199</div>
    <p>Premium description</p>
    <button class="btn btn-primary">Get Started</button>
  </div>
</div>
```

## Utility Classes

### Text Alignment
- `.text-center` - Center align text

### Text Gradient
- `.text-gradient` - Apply cyan-to-purple gradient

### Spacing Utilities
- `.mt-4`, `.mt-6`, `.mt-8` - Margin top
- `.mb-4`, `.mb-6`, `.mb-8` - Margin bottom

### Flexbox Utilities
- `.flex` - Display flex
- `.flex-col` - Flex direction column
- `.items-center` - Align items center
- `.justify-center` - Justify content center
- `.justify-between` - Justify content space-between
- `.gap-4`, `.gap-6` - Gap spacing

### Animations
- `.animate-fade-in` - Fade in animation
- `.animate-slide-in` - Slide in from left
- `.animate-pulse` - Pulsing animation

## Responsive Design

The theme is fully responsive with breakpoints at:
- **Desktop**: Default (900px+)
- **Tablet**: Adjusted layouts
- **Mobile**: `max-width: 768px`
  - Font size reduces to 14px
  - Side navigation hidden
  - Single column grids
  - Adjusted padding

## Accessibility Features

1. **Focus States**: All interactive elements have visible focus indicators
2. **Color Contrast**: WCAG AA compliant text contrast ratios
3. **Screen Reader Support**: `.sr-only` class for screen reader only content
4. **Keyboard Navigation**: Full keyboard support for all interactions
5. **Focus Visible**: `:focus-visible` pseudo-class for keyboard-only focus

## Dark Theme Optimizations

1. **Reduced Eye Strain**: Pure black backgrounds (`#0a0a0a`) reduce screen glare
2. **Subtle Borders**: Dark borders prevent harsh contrasts
3. **Elevated Surfaces**: Layered backgrounds create depth
4. **Accent Colors**: High contrast cyan and purple stand out on dark backgrounds
5. **Custom Scrollbars**: Themed scrollbars match the design system

## CSS Variables

All theme values are accessible via CSS custom properties:

```css
/* Colors */
var(--onyx-black)
var(--accent-primary)
var(--text-primary)
var(--bg-secondary)

/* Spacing */
var(--space-4)
var(--space-6)

/* Borders */
var(--radius-md)
var(--radius-lg)

/* Transitions */
var(--transition-fast)
var(--transition-base)
```

## Best Practices

### DO:
✅ Use semantic HTML elements
✅ Apply theme classes consistently
✅ Use CSS variables for custom styling
✅ Test on multiple screen sizes
✅ Ensure proper contrast ratios
✅ Use appropriate button variants
✅ Maintain consistent spacing

### DON'T:
❌ Override theme colors with inline hex values
❌ Mix inline styles with theme classes unnecessarily
❌ Skip responsive testing
❌ Use non-semantic HTML
❌ Create custom colors outside the palette
❌ Forget to add loading states
❌ Ignore accessibility features

## Browser Support

The Onyx theme supports:
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile Safari (iOS 13+)
- Chrome Mobile (Android 8+)

## Performance Considerations

1. **CSS-only**: No JavaScript required for styling
2. **System Fonts**: Fast font loading
3. **Minimal Animations**: Smooth 60fps animations
4. **Optimized Selectors**: Efficient CSS selectors
5. **Single Stylesheet**: One CSS file for entire theme

## Future Enhancements

Planned improvements:
- [ ] Light theme variant (if requested)
- [ ] Additional color schemes
- [ ] More animation presets
- [ ] Extended component library
- [ ] Theme customization API
- [ ] CSS-in-JS support option

## Support

For questions or issues with the Onyx theme:
1. Check this documentation
2. Review `/apps/web/src/styles/theme.css`
3. Test in browser dev tools
4. Report bugs with reproduction steps

---

**Version**: 1.0.0  
**Last Updated**: February 6, 2026  
**Maintainer**: UI/UX Team
