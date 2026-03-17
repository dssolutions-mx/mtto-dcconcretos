# Dashboard UI Design Principles

> Premium corporate feeling. Clean, steady, intuitive. Software worth millions.  
> Sidebar: **always collapsed by default**. Generous space—least clogged, best psychological response.

---

## 1. Design Mandate

**Premium corporate.** The interface should feel like enterprise software a company paid millions for—not a startup MVP. Calm authority, not playful. Trustworthy.

**Clean, steady, intuitive.** Every element earns its place. No decoration. No clutter. The best UIs look the least clogged. Too much info or the feeling there's no space triggers a negative psychological response—cognitive overload, stress, resistance.

**Consistency is non-negotiable.** Same spacing scale, same surface treatment, same typography hierarchy, same interaction patterns across all role dashboards.

---

## 2. Space and Density

### The Breathing-Room Rule

**Negative space is a feature.** The interface must feel like it has room to breathe. Users should never feel hemmed in or that information is competing for attention.

- **Generous padding** — Section padding 32–48px; card internal padding 24–32px. Never cram content to the edges.
- **Section separation** — Clear gaps between major areas (action strip, shortcuts, stats, secondary). No visual merging.
- **Limit above-the-fold density** — Max 2–3 primary elements before scroll. Prefer vertical flow over horizontal cramming.
- **Progressive disclosure** — Show what matters now; "ver más" / expand for secondary. Don't dump everything at once.

### What to avoid

- Cards touching each other with no gap
- Dense metric grids (4 equal cards in one row) that feel like a spreadsheet
- Multiple competing hero areas
- Sidebars or headers that feel heavy or dominate the canvas

---

## 3. Sidebar: Always Collapsed

- **Default state:** `isSidebarCollapsed = true`
- **Width collapsed:** ~64px (icons only)
- **Width expanded:** ~256px (icons + labels)
- Same background as main canvas; subtle border separation. The sidebar does not compete with content—it recedes until needed.

---

## 4. Visual Consistency

### Surface elevation

One approach: **borders-only**, subtle. No dramatic shadows.

- Base canvas: background
- Cards: one elevation level up (subtle border, same or barely lighter background)
- Dropdowns / modals: one level above their parent
- Inputs: inset (slightly darker than surroundings)

All surfaces use the same hue family—no random color shifts. Whisper-quiet layering.

### Typography scale

- **Headline:** Weight + tracking for presence. One per view.
- **Primary:** Default reading text.
- **Secondary:** Supporting copy.
- **Tertiary:** Metadata, timestamps.
- **Muted:** Disabled, placeholder.

Use the scale consistently. Don't mix weights arbitrarily.

### Spacing scale

Base unit: **8px**. Stick to multiples.

| Token | Value | Use |
|-------|-------|-----|
| xs | 4px | Icon gaps, micro |
| sm | 8px | Inline spacing |
| md | 16px | Component internal |
| lg | 24px | Section internal |
| xl | 32px | Between sections |
| 2xl | 48px | Major separation |

### Border treatment

- Low-opacity rgba; never harsh hex
- Progression: standard → softer → emphasis → focus ring
- Squint test: hierarchy visible, nothing jumps out

### Color usage

- **Gray:** Structure, hierarchy. Same hue, shift lightness only.
- **Accent:** One primary accent for "requires action" (e.g. amber). Use sparingly.
- **Semantic:** Green (success, completed), red (critical, overdue), blue (informational). Slight desaturation where needed.
- **No** multiple accent colors. No decorative gradients.

---

## 5. Action Strip Pattern (Role Dashboards)

Each role dashboard uses the **action strip** as the hero element—one horizontal band with:

- Icon + count + label + primary CTA
- Example: `[ClipboardList] 5 órdenes esperan tu validación técnica [Validar ahora →]`

**Spacing around the action strip:** Generous. It is the focal point. Nothing crowds it.

**When count is zero:** Soft message "No hay pendientes" + secondary CTA. No empty red box.

---

## 6. Role Shortcuts (Below Action Strip)

2–4 compact links or buttons—not full cards. Enough padding that they don't feel tight. Same treatment across roles.

---

## 7. Premium Corporate Checklist

Before shipping any dashboard component:

- [ ] **Space:** Does it breathe? Can you point to generous padding and section gaps?
- [ ] **Density:** Above the fold—2–3 primary elements max?
- [ ] **Consistency:** Same surface, spacing, and type treatment as the rest of the system?
- [ ] **Clutter:** Could anything be removed or moved to "ver más" without losing value?
- [ ] **Sidebar:** Confirmed collapsed by default?
- [ ] **Premium feel:** Does it feel like enterprise software, not a template?

---

## 8. Anti-Patterns (Avoid)

- Dense metric grids with 4+ equal cards
- Multiple hero areas competing for attention
- Thick borders or dramatic shadows
- Decorative gradients or unmotivated color
- Inconsistent spacing or surface treatment
- Sidebar expanded by default
- Information crammed to edges
- Feeling of "no space"

---

## 9. Summary

| Principle | Application |
|-----------|-------------|
| **Premium corporate** | Calm authority, trustworthy, enterprise-grade |
| **Clean, steady, intuitive** | Every element earns its place; no decoration |
| **Generous space** | Breathing room; avoid cognitive overload |
| **Sidebar collapsed** | Always; 64px when collapsed |
| **Consistency** | Same spacing, surfaces, type, patterns across roles |
| **Action strip** | One hero per role; not a grid |
| **Progressive disclosure** | Primary first; secondary on demand |
