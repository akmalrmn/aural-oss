---
name: Skilio Hiring
description: A calm, evidence-led hiring workspace connecting jobs, candidate proof, Drawmetrics, and optional interviews.
colors:
  evidence-green: "#2f7d4f"
  evidence-green-strong: "#276640"
  signal-leaf: "#7bc957"
  hiring-canvas: "#f4f9f2"
  panel: "#fbfdf9"
  evidence-white: "#ffffff"
  control: "#f0f6ed"
  control-strong: "#e6f0e1"
  decision-ink: "#10233f"
  ink-soft: "#43526a"
  ink-muted: "#6d7a8d"
  quiet-border: "rgba(16, 35, 63, 0.1)"
  strong-border: "rgba(16, 35, 63, 0.16)"
  danger: "#c91f1f"
  danger-soft: "#fff6f5"
typography:
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.6rem)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.12em"
rounded:
  control: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
spacing:
  unit: "4px"
  micro: "8px"
  compact: "12px"
  component: "16px"
  section: "24px"
  major: "32px"
components:
  button-primary:
    backgroundColor: "{colors.evidence-green}"
    textColor: "{colors.evidence-white}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.evidence-green-strong}"
    textColor: "{colors.evidence-white}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.evidence-white}"
    textColor: "{colors.decision-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.control}"
    textColor: "{colors.decision-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "40px"
  panel:
    backgroundColor: "{colors.evidence-white}"
    textColor: "{colors.decision-ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  navigation-item:
    backgroundColor: "{colors.hiring-canvas}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "40px"
  navigation-item-active:
    backgroundColor: "{colors.evidence-white}"
    textColor: "{colors.decision-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "40px"
  status-chip:
    backgroundColor: "{colors.control-strong}"
    textColor: "{colors.evidence-green-strong}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "4px 8px"
---

# Design System: Skilio Hiring

## Overview

**Creative North Star: "The Evidence Desk"**

The Evidence Desk treats hiring as careful review rather than spectacle. It should feel like a well-prepared workspace where an employer can see the role, the candidate, and the proof behind a decision without visual noise or product friction.

The system is calm, credible, and evidence-led. Pale green working surfaces reduce glare, Decision Ink anchors hierarchy, and Evidence Green appears where an action, status, or verified signal matters. Information density is moderate: controls stay compact, while application evidence and decision context receive enough room to scan.

Expression is intentionally narrow and disciplined. Skilio identity comes from the green-and-navy relationship, the leaf mark, compact evidence states, and precise operational language. The visual system rejects the legacy Aural chocolate palette, decorative gradients, structural color rails, and generic AI-dashboard styling.

**Key Characteristics:**

- Evidence leads; decoration recedes.
- Green communicates action, status, or verified signal.
- Decision Ink provides hierarchy without turning the product into a dark interface.
- Panels are quietly layered with soft borders and ambient lift.
- Employer and candidate views share one Skilio vocabulary while keeping task-specific layouts.

## Colors

The palette combines botanical greens with deep navy text and near-white green surfaces, producing a calm workspace with clear decision signals.

### Primary

- **Evidence Green** (`#2f7d4f`): Primary actions, selected progress, positive status, and evidence icons.
- **Evidence Green Strong** (`#276640`): Hover and active states that need more contrast than the primary green.

### Secondary

- **Signal Leaf** (`#7bc957`): The Skilio leaf accent and small high-salience indicators. It is not a second button color or a structural border.

### Neutral

- **Hiring Canvas** (`#f4f9f2`): The continuous page and sidebar background.
- **Panel** (`#fbfdf9`): Quiet grouped surfaces that should remain visually close to the canvas.
- **Evidence White** (`#ffffff`): Elevated panels, active navigation, menus, and high-clarity reading surfaces.
- **Control** (`#f0f6ed`): Inset fields, subdued rows, and low-emphasis containers.
- **Control Strong** (`#e6f0e1`): Selected soft states, status chips, and emphasized inset surfaces.
- **Decision Ink** (`#10233f`): Headings, decisive values, and primary navigation text.
- **Ink Soft** (`#43526a`): Body copy and supporting information.
- **Ink Muted** (`#6d7a8d`): Metadata, helper text, inactive steps, and subdued labels.
- **Quiet Border** (`rgba(16, 35, 63, 0.1)`): Default panel and navigation separation.
- **Strong Border** (`rgba(16, 35, 63, 0.16)`): Controls and boundaries needing clearer affordance.
- **Decision Red** (`#c91f1f`): Destructive actions and rejection states only.
- **Decision Red Soft** (`#fff6f5`): Background support for destructive or error states.

### Named Rules

**The Signal, Not Decoration Rule.** Evidence Green and Signal Leaf must communicate action, status, selection, or verified evidence. Never use them as ambient decoration, and never replace their meaning with a gradient.

## Typography

**Display Font:** Space Grotesk (with `system-ui, sans-serif` fallback)
**Body Font:** Inter (with `system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif` fallback)

**Character:** Space Grotesk gives role names, decisions, and metrics a precise human geometry. Inter keeps forms, tables, evidence, and navigation neutral and highly legible.

### Hierarchy

- **Display** (600, `clamp(1.75rem, 3vw, 2.6rem)`, `1.04`): Page focal titles and role names; use once per primary view.
- **Headline** (600, `1.5rem`, `1.2`): Major form steps, applicant review sections, and completion states.
- **Title** (600, `1.25rem`, `1.25`): Panel headings and prominent subsection titles.
- **Body** (400, `0.875rem`, `1.5`): Forms, tables, descriptions, and evidence. Long reading blocks use a comfortable `1.5rem` line height and constrained measure.
- **Label** (600, `0.6875rem`, `0.12em`, uppercase): Metrics, metadata groups, and compact status context. Use sparingly.
- **Data Value** (600, `1.875rem`, tabular numerals): Totals, match scores, and other decision metrics.

### Named Rules

**The Evidence Hierarchy Rule.** Role names, applicant names, decisions, and key values lead through weight and contrast; labels and metadata recede through size and color. Do not make every line compete at the same weight.

## Layout

The employer workspace uses a fixed `256px` sidebar and a sticky `64px` top bar. The sidebar and canvas share Hiring Canvas so navigation supports the work instead of becoming a separate color block. Main content uses responsive padding of `16px`, `24px`, and `32px`, with `16px` panel gaps and `24px` between major groups.

Employer pages lead with one focal panel or decisive heading, followed by evidence grouped by task. Dashboards may use responsive metric grids, but applicant tables and review records use the full available width. Nested cards are avoided; page sections stay unframed until a real data object, tool, or grouped record needs a panel.

Candidate applications use a centered `896px` single column. The role appears first as unframed page context, followed by a segmented progress indicator and one bordered application work surface. On mobile, the progress indicator shows the current and next step without horizontal scrolling; on wider screens, all seven labels share one fixed grid.

The spacing base is `4px`. Use `8px` for icon and label gaps, `12px` for compact control clusters, `16px` inside standard panels, `24px` for sections and roomy panels, and `32px` only between major page regions. Standard responsive breakpoints follow Tailwind: `640px`, `768px`, `1024px`, `1280px`, and `1536px`.

## Elevation & Depth

Depth is a quiet layered lift: tonal surfaces establish most hierarchy, soft navy borders locate edges, and ambient shadows separate only elevated panels, menus, focal controls, and overlays. The shadow hue stays tied to Decision Ink so the interface never looks dusty or gray.

### Shadow Vocabulary

- **Evidence Lift** (`0 0 0 1px rgba(16, 35, 63, 0.05), 0 8px 24px rgba(16, 35, 63, 0.05)`): Standard panels, active navigation, compact menus, and persistent controls.
- **Decision Lift** (`0 0 0 1px rgba(16, 35, 63, 0.06), 0 18px 44px rgba(16, 35, 63, 0.08)`): Dialogs, completion markers, and surfaces that temporarily command attention.

### Named Rules

**The Quiet Lift Rule.** A surface may use a tonal shift, a border, and one documented ambient shadow. Do not stack dramatic drop shadows or invent new elevation levels for ordinary content.

## Shapes

The form language is softly rectangular and work-focused. Inputs use `6px` corners, compact chips and small controls use `8px`, primary controls and navigation use `12px`, and grouped panels use `16px`. Circular shapes are reserved for avatars, status indicators, and genuinely round icon actions.

Borders are thin and low-contrast. Brand color does not become a structural side rail or decorative edge. Nested elements use concentric radii: inner radius stays smaller than the container radius by at least the surrounding padding.

## Components

Components are quietly tactile and decisive: compact enough for repeated work, clear enough to understand without instruction, and visibly responsive to hover, focus, active, disabled, loading, empty, and error states.

### Buttons

- **Shape:** Soft rectangle (`12px`) with a `40px` standard height and `44px` where a larger candidate-facing target is appropriate.
- **Primary:** Evidence Green background, Evidence White text, `10px 16px` padding, medium-weight Inter label, and optional `16px` Lucide icon.
- **Hover / Focus:** Hover moves to Evidence Green Strong; active presses to `0.98` scale; keyboard focus uses a visible green ring with offset.
- **Outline:** Evidence White or Panel background with Strong Border and Decision Ink text; hover moves to Control.
- **Ghost:** Transparent at rest; hover uses Control and never introduces a new accent color.
- **Destructive:** Decision Red is reserved for irreversible actions and rejection, with explicit confirmation where needed.

### Chips

- **Style:** Compact `6px` or `8px` corners, pale Control Strong background, Evidence Green Strong text, and concise labels.
- **State:** Selected or positive chips may use green; neutral metadata stays on Control with Ink Soft. Chips do not become decorative pill clouds.

### Cards / Containers

- **Corner Style:** Grouped panels use `16px`; nested inset controls use `12px` or less.
- **Background:** Evidence White for elevation, Panel for quiet grouping, and Control for inset content.
- **Shadow Strategy:** Evidence Lift is the default; Decision Lift is reserved for temporary emphasis.
- **Border:** Quiet Border for panels, Strong Border for interactive boundaries.
- **Internal Padding:** `16px` standard, `20px` to `24px` for forms, hero panels, and evidence review.

### Inputs / Fields

- **Style:** `40px` height, `6px` radius, Control fill, Strong Border, Decision Ink value, and Ink Muted placeholder.
- **Focus:** Evidence Green border with a `3px rgba(47, 125, 79, 0.16)` focus halo.
- **Error / Disabled:** Errors use Decision Red with direct corrective copy; disabled controls reduce opacity but retain readable text.

### Navigation

- **Style:** The employer sidebar is `256px` wide on desktop and becomes a `288px` drawer on mobile. Primary rows are `40px` high with `12px` corners, `16px` icons, and Inter labels.
- **Default / Hover / Active:** Default uses Ink Soft on Hiring Canvas; hover uses Control; active uses Evidence White, Decision Ink, and Evidence Lift.
- **Nested Interviews:** Child rows are indented behind a quiet vertical rule, use `32px` height, and appear only while the Interviews section is active.

### Tables and Applicant Lists

- **Style:** Full-width, scan-first layouts with quiet row separation, tabular numbers, status chips, and a clear review affordance.
- **Behavior:** Row hover uses Control. Decision actions live in the dedicated applicant review view rather than competing inside the table.
- **Responsive:** Preserve the applicant identity and status first; allow horizontal scrolling for genuinely tabular data instead of collapsing evidence into ambiguous cards.

### Evidence Context Header

The signature context pattern is unframed: a small semantic icon and category, one dominant Space Grotesk title, concise metadata, and an optional disclosure for supporting detail. Use it for the page's primary role, job, applicant, or decision context, then let one bordered work surface hold the task.

### Motion

Initial panel reveals move from `10px` below to rest over `280ms` with a restrained ease-out and `35ms` stagger. Pressed controls scale no lower than `0.98`. Scroll-linked motion is limited to low-amplitude opacity and scale changes on non-essential surfaces. Respect `prefers-reduced-motion` by removing spatial movement while preserving immediate state changes.

## Do's and Don'ts

### Do:

- **Do** make the role, applicant, decision, or current task the single visual focal point.
- **Do** use Evidence Green only for actions, status, selection, or verified evidence.
- **Do** keep sidebar, canvas, fields, and panels within the documented green-neutral surface family.
- **Do** use Space Grotesk for hierarchy and Inter for operational reading.
- **Do** preserve complete keyboard, responsive, loading, empty, error, and disabled states.
- **Do** keep candidate job context unframed and place the application task in one bordered work surface.

### Don't:

- **Don't** reintroduce the legacy Aural chocolate, terracotta, cream, or dark-brown interface palette into Skilio Hiring surfaces.
- **Don't** use decorative gradients, glow blobs, gradient text, or generic AI-dashboard ornament.
- **Don't** create a separate dark or saturated sidebar world; navigation shares the Hiring Canvas.
- **Don't** nest cards inside cards or turn every page section into a floating panel.
- **Don't** use green as decoration or create additional accent hues without a semantic need.
- **Don't** use colored side rails, oversized summary sidebars, or horizontally scrolling step indicators in candidate applications.
- **Don't** replace full applicant tables with repetitive card grids when comparison is the task.
- **Don't** use oversized marketing typography inside operational dashboards, settings, forms, or review surfaces.
