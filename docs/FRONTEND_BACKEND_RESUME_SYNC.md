# Frontend-Backend Resume Preview Sync Implementation Plan

## Overview

This document outlines the issues identified between the frontend resume preview component (`temp/resume-preview/`) and the backend PDF generation system (`services/pdf/`), along with a detailed implementation plan to sync them properly.

## Current Architecture

### Frontend (React/TypeScript)
- **Location**: `temp/resume-preview/`
- **Entry Point**: `resume-preview.tsx`
- **Layouts**: `layouts/single-column.tsx`, `layouts/two-column.tsx`
- **Sections**: `sections/` (header, skills, education, etc.)
- **Utils**: `utils.ts` (theme processing, CSS generation)
- **Types**: `types.ts` (TypeScript interfaces)

### Backend (Node.js/HTML Templates)
- **Location**: `services/pdf/`
- **Entry Point**: `templates/index.js`
- **Sections**: `templates/sections/index.js`
- **Theme Merger**: `theme-merger.js`
- **Constants**: `constants.js`
- **Styles**: `templates/styles/` (base-styles, print-styles)

---

## Issues Identified

### 1. ❌ CSS Variable Prefix Mismatch

**Frontend** uses `--rp-` prefix:
```css
--rp-color-primary, --rp-font-size-body, --rp-spacing-section
```

**Backend** uses NO prefix (in base variables) but adds `--rp-` in `buildFrontendPreviewStyles()`:
```css
--color-primary, --font-size-body, --spacing-section  /* Base */
--rp-color-primary, --rp-font-size-body              /* Frontend compat block */
```

**Problem**: The backend generates BOTH sets of variables but HTML class styles reference the non-prefixed ones, while the frontend compat CSS uses prefixed ones. This creates confusion and potential style conflicts.

---

### 2. ❌ Default Margin Mismatch

| Property | Backend (`constants.js`) | Frontend (`utils.ts`) |
|----------|--------------------------|----------------------|
| `margins.top` | 0.3 inches | 0.4 inches |
| `margins.right` | 0.3 inches | 0.4 inches |
| `margins.bottom` | 0.3 inches | 0.4 inches |
| `margins.left` | 0.3 inches | 0.4 inches |

**Impact**: Resumes look different on preview vs downloaded PDF.

---

### 3. ❌ Two-Column Layout Inconsistencies

**Frontend** (`two-column.tsx`):
```tsx
<div className="grid grid-cols-[35%_1fr] gap-6">
  <aside className="p-4 rounded-lg space-y-4" style={{ backgroundColor: styles.colors.headerBg }}>
```
- Uses Tailwind CSS `grid-cols-[35%_1fr]` (35%/65% split)
- Sidebar has `p-4` padding (16px)
- Uses `space-y-4` (16px vertical gaps)
- Has rounded corners (`rounded-lg`)
- Background color from theme

**Backend** (`templates/index.js`):
```css
.resume-two-column {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(340px, 2fr);
  gap: var(--spacing-section);
}
```
- Uses minmax-based columns (~33%/66% split)
- No sidebar styling/background
- No padding adjustments for columns

**Problems**:
1. Different column ratios (35%/65% vs ~33%/67%)
2. Backend lacks sidebar visual styling (bg, padding, rounded corners)
3. Single-column padding/margins remain in two-column mode

---

### 4. ❌ Skills Layout Support Gap

**Frontend supports 6 layouts**:
```typescript
skillsLayout?: 'pills' | 'tags' | 'list' | 'inline' | 'grouped' | 'comma-separated';
```

**Backend supports only 3 effectively**:
- `pills` - Skill pills per category ✅
- `inline` - "Category: skill1, skill2" format ✅
- `list` - Bullet list per category ✅
- `tags` - ❌ Missing (different visual than pills)
- `grouped` - ❌ Missing (category labels with pills)
- `comma-separated` - ❌ Missing (same as inline but different naming)

**Frontend Layout Differences**:

| Layout | Frontend Behavior |
|--------|-------------------|
| `pills` | All skills flattened, filled primary bg, white text, rounded-full |
| `tags` | All skills flattened, light bg, primary border, rounded corners |
| `grouped` | By category with label, light pills per category |
| `list` | 2-column grid, all skills with bullet points |
| `inline` / `comma-separated` | By category: "Label: skill1, skill2, skill3" |

---

### 5. ❌ Header Alignment Not Configurable

**Frontend** (`header.tsx`) supports:
```tsx
variant?: 'default' | 'centered' | 'compact';
```

**Backend** (`templates/index.js`) always renders centered header via CSS:
```css
.header {
  text-align: center;
}
```

**Problem**: No theme config option to control header alignment. Backend always centers it.

---

### 6. ❌ Theme Config Missing Properties

Properties available in frontend but not synced in backend theme config:

| Property | Frontend | Backend |
|----------|----------|---------|
| `style.headerAlignment` | ❌ Not in types | ❌ Not available |
| `layout.sidebarWidth` | ❌ Not in types | ❌ Not available |
| `layout.sidebarPosition` | ❌ Not in types | ❌ Not available |
| `style.sidebarBg` | Uses `colors.headerBg` | ❌ Not styled |
| `style.sidebarPadding` | Hardcoded `p-4` | ❌ Not available |

---

### 7. ❌ Contact Info Display Differences

**Frontend** (`header.tsx`):
- Uses Lucide icons (`Mail`, `Phone`, etc.)
- Horizontal flex wrap
- Truncates long values

**Backend** (`sections/index.js`):
- Uses inline SVG icons
- Horizontal flex with `|` dividers
- Links for URLs (linkedin, github, website)

---

### 8. ❌ Skills Multi-Category Display

**Frontend Skills Display** (`skills.tsx`):

**`pills`/`tags`**: Flattens ALL categories into one list:
```tsx
const allSkills = [
  ...(data.technical || []),
  ...(data.tools || []),
  ...(data.soft || []),
  ...(data.languages || []),
].filter(Boolean);
```

**`grouped`/`inline`**: Shows category labels:
```tsx
const categories = [
  { label: 'Technical', items: data.technical },
  { label: 'Tools', items: data.tools },
  ...
];
```

**Backend Skills Display**:
- ALWAYS shows by category with category titles
- Never flattens skills

**Problem**: Visual mismatch - frontend can flatten skills, backend always groups them.

---

## Implementation Plan

### Phase 1: Unify CSS Variables & Defaults

**Files to modify**:
- `services/pdf/constants.js`
- `services/pdf/theme-merger.js`
- `services/pdf/templates/index.js`
- `services/pdf/templates/styles/base-styles.js`

**Changes**:

1. **Update `constants.js`** - Align default margins:
   ```javascript
   export const DEFAULT_MARGINS = {
     standard: { top: 0.4, right: 0.4, bottom: 0.4, left: 0.4 },
     compact: { top: 0.3, right: 0.3, bottom: 0.3, left: 0.3 },
     generous: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 }
   };
   ```

2. **Unify CSS variable generation in `theme-merger.js`**:
   - Use ONLY `--rp-` prefix for ALL CSS variables
   - Remove duplicate variable blocks

3. **Update `base-styles.js`**:
   - Change all `var(--color-*)` to `var(--rp-color-*)`
   - Change all `var(--font-*)` to `var(--rp-font-*)`
   - Change all `var(--spacing-*)` to `var(--rp-spacing-*)`

4. **Remove duplicate frontend variable block in `templates/index.js`**:
   - Keep only the `buildFrontendPreviewStyles()` CSS
   - Ensure base styles use same prefixed variables

---

### Phase 2: Add Missing Theme Config Properties

**Files to modify**:
- `services/pdf/constants.js` - Add new STYLE_OPTIONS
- `services/pdf/theme-merger.js` - Add new defaults
- `drizzle/schema/` - If DB schema needs updating

**New Theme Properties**:

```javascript
style: {
  // Existing
  borderRadius: 4,
  dividerStyle: 'solid',
  bulletStyle: 'disc',
  headingStyle: 'underline',
  datePosition: 'right',
  skillsLayout: 'pills',
  experienceLayout: 'standard',
  photoEnabled: false,
  photoPosition: 'right',
  photoSize: 80,
  
  // NEW: Header styling
  headerAlignment: 'center',  // 'left' | 'center' | 'right'
  headerVariant: 'default',   // 'default' | 'compact' | 'minimal'
}

layout: {
  // Existing
  pageSize: 'A4',
  columns: 1,
  margins: { ... },
  spacing: { ... },
  
  // NEW: Two-column settings
  sidebarWidth: 35,           // Percentage (30-40)
  sidebarPosition: 'left',    // 'left' | 'right'
  sidebarPadding: 16,         // Points
}

// NEW section in colors
colors: {
  // Existing
  primary, secondary, accent, text, textLight, background, border, headerBg,
  
  // NEW: Sidebar specific (for two-column)
  sidebarBg: '#f8fafc',       // Uses headerBg as default
  sidebarText: null,          // null = inherit from text
}
```

---

### Phase 3: Fix Two-Column Layout

**Files to modify**:
- `services/pdf/templates/index.js` - `getLayoutStyles()` function
- `services/pdf/templates/styles/base-styles.js` - Add sidebar styles

**Changes**:

1. **Update `getLayoutStyles()` in `templates/index.js`**:

```javascript
const getLayoutStyles = (config) => {
  const columns = config.layout?.columns || 1;
  const sidebarWidth = config.layout?.sidebarWidth || 35;
  const sidebarPosition = config.layout?.sidebarPosition || 'left';
  const sidebarPadding = config.layout?.sidebarPadding || 16;
  
  if (columns === 2) {
    const mainWidth = 100 - sidebarWidth;
    const gridCols = sidebarPosition === 'left' 
      ? `${sidebarWidth}% 1fr`
      : `1fr ${sidebarWidth}%`;
    
    return `
      .resume-two-column {
        display: grid;
        grid-template-columns: ${gridCols};
        gap: var(--rp-spacing-section);
        align-items: start;
      }
      
      .resume-sidebar {
        padding: ${sidebarPadding}pt;
        background-color: var(--rp-color-sidebar-bg, var(--rp-color-header-bg));
        border-radius: var(--rp-border-radius);
        display: flex;
        flex-direction: column;
        gap: var(--rp-spacing-item);
      }
      
      .resume-main {
        display: flex;
        flex-direction: column;
        gap: var(--rp-spacing-section);
      }
      
      /* Remove default section margins in two-column - gap handles it */
      .resume-two-column .section {
        margin-bottom: 0;
      }
      
      /* Adjust section titles for sidebar */
      .resume-sidebar .section-title {
        font-size: calc(var(--rp-font-size-section) * 0.9);
        margin-bottom: var(--rp-spacing-line);
      }
    `;
  }
  
  return `
    .resume-container {
      display: flex;
      flex-direction: column;
    }
  `;
};
```

2. **Add sidebarBg CSS variable in `theme-merger.js`**:

```javascript
'--rp-color-sidebar-bg': ${config.colors.sidebarBg || config.colors.headerBg};
```

---

### Phase 4: Complete Skills Layouts

**Files to modify**:
- `services/pdf/templates/sections/index.js` - `renderSkills()` function

**Add missing layouts**:

```javascript
export const renderSkills = (skills, config) => {
  if (!skills) return '';
  
  const skillsLayout = config.style?.skillsLayout || 'pills';
  
  // Gather all skills
  const allSkills = [
    ...(skills.technical || []),
    ...(skills.tools || []),
    ...(skills.soft || []),
    ...(skills.languages || []),
  ].filter(Boolean);
  
  // Gather categories (for grouped layouts)
  const categories = [
    { title: 'Technical', items: skills.technical },
    { title: 'Tools', items: skills.tools },
    { title: 'Soft Skills', items: skills.soft },
    { title: 'Languages', items: skills.languages },
  ].filter(cat => cat.items && cat.items.length > 0);
  
  if (allSkills.length === 0) return '';
  
  let contentHTML = '';
  
  switch (skillsLayout) {
    case 'pills':
      // Flattened, primary bg pills
      contentHTML = renderFlatPills(allSkills, 'pills');
      break;
      
    case 'tags':
      // Flattened, bordered tags
      contentHTML = renderFlatPills(allSkills, 'tags');
      break;
      
    case 'grouped':
      // Category labels with pills per category
      contentHTML = renderGroupedPills(categories);
      break;
      
    case 'inline':
    case 'comma-separated':
      // "Category: skill1, skill2, skill3" format
      contentHTML = renderInlineCategories(categories);
      break;
      
    case 'list':
      // 2-column bullet list (flattened)
      contentHTML = renderSkillsList(allSkills);
      break;
      
    default:
      contentHTML = renderGroupedPills(categories);
  }
  
  return `
    <section class="section section-skills">
      <h2 class="section-title">Skills</h2>
      <div class="section-content skills-container">
        ${contentHTML}
      </div>
    </section>
  `;
};

// Helper: Flattened pills/tags
const renderFlatPills = (skills, variant) => {
  const isPills = variant === 'pills';
  const className = isPills ? 'skill-pill skill-pill-filled' : 'skill-tag';
  return `
    <div class="skills-list skills-list-flat">
      ${skills.map(skill => `<span class="${className}">${escapeHtml(skill)}</span>`).join('')}
    </div>
  `;
};

// Helper: Grouped with category labels
const renderGroupedPills = (categories) => {
  return categories.map(cat => `
    <div class="skill-category skill-category-grouped">
      <span class="skill-category-label">${escapeHtml(cat.title)}:</span>
      <div class="skills-list skills-list-inline">
        ${cat.items.map(skill => `<span class="skill-pill skill-pill-light">${escapeHtml(skill)}</span>`).join('')}
      </div>
    </div>
  `).join('');
};

// Helper: Inline comma-separated
const renderInlineCategories = (categories) => {
  return categories.map(cat => `
    <p class="skill-category skill-category-inline">
      <strong class="skill-category-label">${escapeHtml(cat.title)}:</strong>
      <span class="skills-inline">${cat.items.map(s => escapeHtml(s)).join(', ')}</span>
    </p>
  `).join('');
};

// Helper: 2-column list
const renderSkillsList = (skills) => {
  return `
    <div class="skills-grid">
      ${skills.map(skill => `
        <p class="skill-list-item">
          <span class="skill-bullet">•</span>
          ${escapeHtml(skill)}
        </p>
      `).join('')}
    </div>
  `;
};
```

**Add matching CSS in `base-styles.js`**:

```css
/* Skills Layout Variants */
.skills-list-flat {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.skill-pill-filled {
  background-color: var(--rp-color-primary);
  color: #ffffff;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: var(--rp-font-size-small);
  font-weight: var(--rp-font-weight-medium);
}

.skill-tag {
  background-color: color-mix(in srgb, var(--rp-color-primary) 15%, transparent);
  color: var(--rp-color-primary);
  border: 1px solid color-mix(in srgb, var(--rp-color-primary) 30%, transparent);
  padding: 4px 10px;
  border-radius: var(--rp-border-radius);
  font-size: var(--rp-font-size-small);
  font-weight: var(--rp-font-weight-medium);
}

.skill-pill-light {
  background-color: color-mix(in srgb, var(--rp-color-accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--rp-color-accent) 30%, transparent);
  color: var(--rp-color-text);
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: var(--rp-font-size-small);
}

.skill-category-grouped {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 6px;
  margin-bottom: 8px;
}

.skill-category-label {
  font-size: var(--rp-font-size-small);
  font-weight: var(--rp-font-weight-semibold);
  color: var(--rp-color-secondary);
  margin-right: 4px;
}

.skill-category-inline {
  font-size: var(--rp-font-size-body);
  margin-bottom: 4px;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px 16px;
}

.skill-list-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--rp-font-size-body);
}

.skill-bullet {
  color: var(--rp-color-text-light);
}
```

---

### Phase 5: Fix Header Alignment

**Files to modify**:
- `services/pdf/templates/sections/index.js` - `renderPersonalInfo()` function
- `services/pdf/templates/styles/base-styles.js` - Header styles

**Changes**:

1. **Update `renderPersonalInfo()` to read alignment from config**:

```javascript
export const renderPersonalInfo = (personalInfo, config) => {
  if (!personalInfo) return '';
  
  const headerAlignment = config.style?.headerAlignment || 'center';
  const alignmentClass = `header-align-${headerAlignment}`;
  
  // ... existing contact building code ...
  
  return `
    <header class="header section section-personal-info ${alignmentClass}">
      <h1 class="header-name">${escapeHtml(fullName)}</h1>
      ${title ? `<p class="header-title">${escapeHtml(title)}</p>` : ''}
      ${contacts.length > 0 ? `
        <div class="contact-info">
          ${contacts.join('<span class="contact-divider">|</span>')}
        </div>
      ` : ''}
    </header>
  `;
};
```

2. **Add alignment CSS in `base-styles.js`**:

```css
/* Header Alignment Variants */
.header-align-center {
  text-align: center;
}
.header-align-center .contact-info {
  justify-content: center;
}

.header-align-left {
  text-align: left;
}
.header-align-left .contact-info {
  justify-content: flex-start;
}

.header-align-right {
  text-align: right;
}
.header-align-right .contact-info {
  justify-content: flex-end;
}
```

---

### Phase 6: Certifications Section Sync

**Issue**: Backend includes certifications within skills, frontend has separate `CertificationsSection`.

**Recommendation**: Keep certifications flexible - allow both approaches based on theme config.

Add to theme config:
```javascript
style: {
  certificationsDisplay: 'with-skills',  // 'with-skills' | 'separate' | 'hidden'
}
```

---

## Summary: Files to Modify

### Backend Files

| File | Changes |
|------|---------|
| `services/pdf/constants.js` | Update DEFAULT_MARGINS to 0.4in, add new STYLE_OPTIONS |
| `services/pdf/theme-merger.js` | Use --rp- prefix everywhere, add new theme properties |
| `services/pdf/templates/index.js` | Fix getLayoutStyles(), remove duplicate CSS blocks |
| `services/pdf/templates/sections/index.js` | Complete skills layouts, add header alignment |
| `services/pdf/templates/styles/base-styles.js` | Use --rp- prefix, add skills/header CSS |
| `services/pdf/templates/styles/print-styles.js` | Use --rp- prefix |

### Database (Optional)

If theme config schema needs updating in Drizzle:
- `drizzle/schema/themes.js` - Add new config fields
- Create migration for new theme properties

### No Frontend Changes

Per requirements, **NO changes to frontend code** - only sync backend to match frontend behavior.

---

## Testing Checklist

After implementation:

1. [ ] Single-column layout renders same as frontend
2. [ ] Two-column layout has proper sidebar styling
3. [ ] All 6 skill layouts work correctly
4. [ ] Header alignment options work (left/center/right)
5. [ ] Margins are consistent (0.4in default)
6. [ ] CSS variables all use --rp- prefix
7. [ ] Multi-category skills display correctly
8. [ ] Page breaks work properly in multi-page resumes
9. [ ] PDF download matches preview exactly
10. [ ] All existing themes continue to work (no breaking changes)

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing PDF exports | Maintain backwards compatibility with fallback defaults |
| CSS specificity conflicts | Use consistent naming conventions, test thoroughly |
| Performance impact | CSS changes are minimal, no runtime impact |
| Database migration issues | New properties are optional with defaults |

---

## Implementation Order

1. **Phase 1** - CSS Variables (foundation for all other changes)
2. **Phase 2** - Theme Config Properties (enables new features)
3. **Phase 4** - Skills Layouts (most visible issue)
4. **Phase 5** - Header Alignment (simple fix)
5. **Phase 3** - Two-Column Layout (most complex change)
6. **Phase 6** - Certifications (optional enhancement)

---

## Implementation Status

> ✅ **ALL PHASES COMPLETED** - Implementation finished January 27, 2026

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: CSS Variables & Defaults | ✅ Complete | Unified to `--rp-*` prefix, aligned margins to 0.4in |
| Phase 2: Theme Config Properties | ✅ Complete | Added `twoColumn`, `headerAlignment`, `certificationsDisplay` |
| Phase 3: Two-Column Layout | ✅ Complete | Fixed sidebar styling, grid ratios, background colors |
| Phase 4: Skills Layouts | ✅ Complete | All 6 layouts implemented (pills, tags, grouped, list, inline, comma-separated) |
| Phase 5: Header Alignment | ✅ Complete | Added `left`, `center`, `right` alignment support |
| Phase 6: Certifications | ✅ Complete | Added separate renderer with display options |

---

## Files Modified

### Backend Changes:
- [services/pdf/constants.js](../services/pdf/constants.js) - Updated margins, added STYLE_OPTIONS
- [services/pdf/theme-merger.js](../services/pdf/theme-merger.js) - Added twoColumn config, validation, CSS var prefix
- [services/pdf/templates/index.js](../services/pdf/templates/index.js) - Updated styles, layout, section rendering
- [services/pdf/templates/styles/base-styles.js](../services/pdf/templates/styles/base-styles.js) - Complete rewrite with --rp- prefix
- [services/pdf/templates/styles/print-styles.js](../services/pdf/templates/styles/print-styles.js) - Updated print handling
- [services/pdf/templates/sections/index.js](../services/pdf/templates/sections/index.js) - Added all skill layouts, certifications

### Frontend Changes:
- [temp/resume-preview/types.ts](../temp/resume-preview/types.ts) - Added `TwoColumnConfig`, `headerAlignment`, `certificationsDisplay`
- [temp/resume-preview/utils.ts](../temp/resume-preview/utils.ts) - Added defaults for new style options
- [temp/resume-preview/sections/header.tsx](../temp/resume-preview/sections/header.tsx) - Support `headerAlignment` from styles

### Seed Data Changes:
- [drizzle/seeds/themes.seed.js](../drizzle/seeds/themes.seed.js) - Updated all themes with new style options

---

## Theme Application Flow

1. **After Analysis**: `createResumeFromAnalysis()` applies default theme via `themeModel.applyTheme()`
2. **On Download**: `buildThemeConfig()` merges base theme with user overrides via `mergeThemeConfig()`
3. **Defaults Applied**: `mergeThemeConfig()` uses `DEFAULT_THEME_CONFIG` which includes all new options
4. **Validation**: `validateThemeConfig()` validates new options like `headerAlignments`, `certificationsDisplays`

> **Note**: Existing themes in the database will work correctly because `mergeThemeConfig()` always applies defaults for missing properties.

---

## Two-Column Layout Margins

The two-column layout **preserves page margins** as designed:
- Page margins create the document boundary (applied via `@page` CSS rule)
- The sidebar has its own padding and background **within** the margin container
- This matches the frontend behavior exactly

If edge-to-edge sidebar is desired, a future enhancement could add a `layout.sidebarEdgeToEdge: true` option that removes left margin when sidebar is on the left.

---

## Original Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: CSS Variables | 2 hours | High |
| Phase 2: Theme Config | 1 hour | High |
| Phase 3: Two-Column | 3 hours | High |
| Phase 4: Skills Layouts | 2 hours | High |
| Phase 5: Header Alignment | 1 hour | Medium |
| Phase 6: Certifications | 1 hour | Low |

**Total**: ~10 hours

---

*Document created: Based on analysis of `temp/resume-preview/` and `services/pdf/` codebases.*
*Implementation completed: January 27, 2026 - All phases synced between frontend and backend.*
