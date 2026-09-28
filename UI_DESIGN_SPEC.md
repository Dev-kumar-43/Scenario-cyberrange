# CyberRange Platform UI/UX Design Specification

## 1. Executive Summary & Design Philosophy
This document establishes the official visual design system and interaction specifications for the CyberRange educational platform. The platform has transitioned from a legacy dark/cyberpunk SOC-console aesthetic to a **White + Light Blue Technical Learning Platform** (inspired by modern developer training environments such as TryHackMe Academy, Coursera, Educative, and KodeKloud).

The visual language emphasizes:
- **Clean Readability**: Pure white card surfaces (`#ffffff`) on soft off-white canvas (`#f8fafc`) with deep slate typography (`#0f172a`, `#334155`).
- **Academic & Professional Authority**: Fresh sky/brand blue (`#0284c7`, `#2563eb`) accents, subtle border outlines (`#e2e8f0`, `#bae6fd`), and refined micro-interactions.
- **Student-Centric Hierarchy**: Immediate clarity on "What Should I Do Next?", active sandbox status, structured curriculum progress, and hands-on lab access.

---

## 2. Design Tokens & Color Palette

### 2.1 Core Palette
| Token Name | Hex Value | Role / Usage |
| :--- | :--- | :--- |
| `--bg-page` | `#f8fafc` | Main application background (Slate-50) |
| `--bg-card` | `#ffffff` | Primary surface for cards, modals, sidebars |
| `--bg-card-subtle` | `#f1f5f9` | Secondary background, table headers, code blocks |
| `--border-card` | `#e2e8f0` | Standard card and container borders |
| `--border-subtle` | `#cbd5e1` | Dividing lines and input borders |
| `--border-accent` | `#bae6fd` | Focused and active state borders (Sky-200) |
| `--brand-primary` | `#0284c7` | Primary brand sky blue (Sky-600) |
| `--brand-primary-hover` | `#0369a1` | Primary hover state (Sky-700) |
| `--brand-secondary` | `#2563eb` | Royal blue accent for primary gradients (Blue-600) |
| `--brand-light` | `#e0f2fe` | Soft ice blue background tint for badges & pills |
| `--text-main` | `#0f172a` | High-contrast headings and active labels (Slate-900) |
| `--text-body` | `#334155` | Primary body and narrative copy (Slate-700) |
| `--text-muted` | `#64748b` | Secondary descriptions and metadata (Slate-500) |
| `--text-dim` | `#94a3b8` | Subtle placeholders and disabled text (Slate-400) |

### 2.2 Functional Status & Difficulty Tokens
| Status / Level | Background Tint | Border | Text Color | Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **Beginner / Success** | `#f0fdf4` | `#bbf7d0` | `#15803d` | Easy scenarios, verified flags, running labs |
| **Intermediate / Brand** | `#f0f9ff` | `#bae6fd` | `#0284c7` | Standard curriculum, active path cards |
| **Advanced / Royal** | `#eef2ff` | `#c7d2fe` | `#4338ca` | Multi-step exploits, senior student modules |
| **Expert / Danger** | `#fff1f2` | `#fecdd3` | `#be123c` | Red-team capstones, destructive terminate actions |
| **Hints / Amber** | `#fffbeb` | `#fed7aa` | `#b45309` | Honor badges, hints used indicator |

---

## 3. Typography & Spacing Scale

### 3.1 Font Family
- **Primary Interface**: `Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Code & Telemetry**: `JetBrains Mono, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace`

### 3.2 Type Scale
- **Display 1 (H1)**: `2.2rem` (35.2px), Weight: `800`, Line-height: `1.2`, Letter-spacing: `-0.03em`
- **Heading 2 (H2)**: `1.5rem` (24px), Weight: `800`, Line-height: `1.3`, Letter-spacing: `-0.02em`
- **Heading 3 (H3)**: `1.2rem` (19.2px), Weight: `700`, Line-height: `1.35`
- **Subheading / Lead**: `1.0rem` (16px), Weight: `500`, Line-height: `1.6`, Color: `#334155`
- **Body Text**: `0.88rem` (14px), Weight: `400 / 500`, Line-height: `1.55`
- **Caption / Meta**: `0.75rem` (12px), Weight: `600 / 700`, Letter-spacing: `0.04em`

### 3.3 Elevation & Shadows
- **Card Default (`--shadow-sm`)**: `0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03)`
- **Card Hover / Elevation (`--shadow-md`)**: `0 10px 25px -5px rgba(2, 132, 199, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.03)`
- **Modal / Floating (`--shadow-lg`)**: `0 20px 40px -10px rgba(15, 23, 42, 0.15), 0 8px 16px -4px rgba(15, 23, 42, 0.06)`

---

## 4. Key Page Layouts & Component Architecture

### 4.1 Global Application Shell
- **Sidebar**: Pure white `#ffffff`, fixed 260px desktop width, 1px right border `#e2e8f0`.
  - Brand header: Icon badge (`#0284c7`) with platform title and "LEARNING PLATFORM" subtitle.
  - Navigation links: Clean pills with hover `#f8fafc`, active link with `#f0f9ff` background, `#0284c7` border and text.
  - System status widget at bottom: Green pulsing indicator with "K8s Sandbox Active".
- **Topbar Header**:
  - Breadcrumbs navigation root ("Dashboard / ...").
  - Gamification HUD: Operator Level Pill (`Lv. X`), Streak Badge (`🔥 Xd`), XP Meter (`⚡ X XP`).
  - Auth Pill: Shows username and role with quick Sign Out, or high-visibility Sign In button.

### 4.2 Student Dashboard (`/`)
1. **Welcome Hero Banner**: Light blue gradient (`linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 45%, #ffffff 100%)`) with student name, rank, streak, and quick CTA.
2. **Active Sandbox Live Alert**: When a pod is running, renders an emerald/sky alert banner with pulse dot, status, port, and instant "Connect to Desktop GUI / Shell" button.
3. **Continue Learning & Quick Stats**:
   - Left: "Continue Learning" card showing user's in-progress curriculum, progress bar, estimated time remaining, and "Resume Path" CTA.
   - Right: 2x2 grid of educational stats (Cloud Scenarios, Learning Paths, Tasks Solved, Dual Protocol).
4. **Curated Learning Paths**: Top recommended paths with difficulty tags, duration, and progress.
5. **Practice Labs Catalog**:
   - Filter bar with search input (supports `/` keyboard shortcut) and category pills.
   - 3-column scenario cards with CPU/RAM/Port specs and primary "Launch Kali Linux GUI" buttons.

### 4.3 Tactical Cyber Academy (`/academy`)
- **Track Selector**: Left column listing all published learning paths with completion percentages.
- **Active Path Journey**:
  - Path overview header with difficulty badge, total hours, and captured flags counter (`X / Y`).
  - Sequenced Module Timeline: Numbered modules (1, 2, 3...) detailing objectives, estimated minutes, and direct "Launch Lab →" buttons.

### 4.4 Active Sessions (`/sessions`)
- **State Feedback**: Live polling every 4s to reflect pod transitions (`CREATING` -> `RUNNING`).
- **Session Cards**: Running status pill with live green dot, protocol indicator ("🖥️ VNC Desktop" or "💻 Shell TTY"), namespace and Traefik URL copy button.
- **Action Buttons**: Primary blue "Fullscreen GUI" button and safe confirmation modal for destructive "Terminate Sandbox" actions.
- **Empty State**: Clean illustration, helpful message, and "Explore Scenarios" button.

### 4.5 Operator Profile & Dossier (`/profile`)
- **Dossier Header**: Avatar insignia with user initials, rank title, streak, and XP level progression bar.
- **Dynamic Skill Radar Matrix**: Clean SVG radar visualization with grey web rings and light sky-blue active area polygon across 5 cybersecurity domains.
- **Badges & Honors**: Amber-tinted cards displaying unlocked trophies with award dates.
- **MITRE ATT&CK Enterprise Matrix**: Enterprise tactic columns displaying Mastered (green) vs Untested (slate) techniques with direct links to the official MITRE ATT&CK knowledge base.
- **Combat Log**: Timeline of recent flag captures with XP awards.

---

## 5. Usability & Accessibility Rules
1. **Contrast Compliance**: All text elements adhere to WCAG AA contrast standards (> 4.5:1 for body copy, > 3:1 for large headings).
2. **Keyboard Accessibility**: Global shortcut `/` opens scenario search; all interactive cards and buttons are keyboard-focusable with visible focus rings.
3. **Destructive Guardrails**: All lab termination actions trigger a confirmation dialog to prevent accidental environment loss.
4. **Responsive Adaptability**: Full responsive breakpoint grid adapting gracefully from 320px mobile screens to 2560px ultra-wide monitors.
