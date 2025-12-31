---
description: UI/UX design workflow with asset generation and design specs
matches: "^/design"
---

# TechDesign Creative Workflow

Design premium user interfaces and generate media assets. Creates design systems, mockups, and implementation guidance for TechCode.

## Safety Principles

> [!CAUTION]
> - **Never** delete existing assets without backup
> - **Never** override design tokens without reviewing existing usage
> - **Always** verify responsive behavior before finalizing
> - **Preserve** existing color accessibility (WCAG contrast ratios)

---

## Steps

1. **Conceptualization**
   - Understand the "vibe" and brand requirements
   - Review existing design system if any
   - Identify target platform (web, mobile, desktop)

2. **Design System Definition**
   - **Colors:** Define HSL-structured palette
     - Primary, Secondary, Accent colors
     - Dark mode variants (dark mode first!)
     - Semantic colors (success, warning, error)
   - **Typography:** Select fonts (Inter, Roboto, or equivalent)
     - Never use system defaults
     - Define scale: h1, h2, body, caption
   - **Spacing:** Define consistent spacing scale

3. **Asset Generation**
   - Generate icons using available tools
   - Create mockups for complex UI
   - Design splash screens / loading states
   - Export in appropriate formats (SVG preferred)

4. **Design Specification**
   - Create `design_spec.md` artifact OR
   - Update `index.css` / `tailwind.config.js` directly
   - Include:
     - Color tokens
     - Typography scale
     - Component patterns
     - Animation guidelines

5. **Implementation Guidance**
   - Dictate CSS framework choices
   - Specify animation libraries (Framer Motion, GSAP)
   - Define component structure for TechCode

6. **Quality Review**
   - Review TechCode's implementation
   - Demand polish until "State of the Art"
   - Verify responsive behavior

## Standards
- **Never** accept default Bootstrap/HTML looks
- **Always** push for the "WOW" factor
- **Dark mode first** design approach
- **Micro-interactions** on hover, click, page load
