## 2025-05-18 - Accessible Collapsible Section Headers in Custom UI Components
**Learning:** Custom toggle buttons for collapsible panels (like `IntroCard`) often render plain text or icons without exposing collapse/expand states (`aria-expanded`) or target content linkage (`aria-controls`) to screen readers, leaving non-visual users unaware of collapsible section states.
**Action:** When creating or editing custom collapsible header components, always pair the toggle `<button>` with `aria-expanded={isOpen}`, `aria-controls={contentId}`, dynamic `aria-label`, and `focus-visible` ring styling.
