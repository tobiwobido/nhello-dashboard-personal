# Changelog

## 2026-04-30 — Repeat Filters, Clear Animation, and Task Manager UX Polish

### Added
- Repeat filter tab with live repeating-task counts
- Editable category titles for Life, Work, and Projects with persisted labels
- Geometric six-dot SVG drag handle for task cards

### Changed
- Reworked Done/Clear/Repeat pill layout so Clear and divider participate in real flex spacing and Repeat shifts naturally
- Unified Clear enter/exit animation timing to a fixed duration for smoother, consistent behavior across filter transitions
- Refined task-card vertical alignment so drag handle, checkbox, text stack, and controls align more consistently

### Fixed
- Fixed Done clear behavior so repeat-active completed tasks are preserved during bulk clear
- Fixed Today progress snapshot reconciliation when due dates are edited, preventing stale progress calculations
- Fixed Clear exit overlap against the Done/Clear divider by syncing divider fade with exit start
- Fixed drag handle optical offset and oversized dot rendering after alignment updates
- Fixed uneven filter pill spacing between Done, Clear, divider, and Repeat states

---

## 2026-04-29 — Filter Enter Sequencing Polish

### Changed
- Smoothed filter enter sequencing so newly visible cards join the transition more naturally
- Delayed enter animations slightly to prevent overlap with shared task movement
- Improved Done to All transition smoothness for task and note cards

---

## 2026-04-29 — Filter Animation Consistency and Stability

### Added
- Filter transitions now preserve shared task movement consistently across All, Active, and Done views

### Changed
- Unified filter transition behavior so shared tasks use the same FLIP animation path across filter pairs
- Refined filter animation timing so rebuilt task and note card layouts settle before movement is measured

### Fixed
- Fixed inconsistent task filter transitions between All, Active, and Done
- Fixed shared completed tasks re-entering incorrectly during Done to All transitions
- Fixed choppy no-op animations when tasks did not meaningfully change position
- Fixed lower-column task and note card jitter during All to Active transitions
- Fixed nested note input and undo edge cases that could leave stale UI state behind

---

## 2026-04-28 — UI Polish, Nested Notes, and Stability Fixes

### Added
- Nested notes (notes can now have child notes)
- Add child note functionality with continuous input flow
- Due date icon in the Add a task composer
- Drag-and-drop between task columns (Life, Work, Projects)

### Changed
- Unified icon hover behavior across:
  - add note
  - change due date
  - add child note
- Improved delete animations so:
  - tasks, notes, and child notes exit together
  - open input rows animate with their parent group
- Improved add-note and add-child-note input behavior (auto-focus and chaining)
- Improved alignment of due date icon in add-task composer
- Refined progress card interaction and layout

### Removed
- Publish preview / revert preview functionality

### Fixed
- Prevented unintended Life column animation during unrelated updates
- Fixed multi-line notes collapsing after task completion in other columns
- Fixed duplicate note creation issues
- Fixed undo restoring stale child-note input UI
- Fixed undo edge cases with empty input rows
- Fixed delete animation timing inconsistencies (inputs exiting early)
- Fixed icon hover inconsistencies
- Fixed due date icon alignment (vertical + horizontal)
- Fixed child note animation and render ordering issues

---

## 2026-04-26 — Core Interaction Features

### Added
- Drag-and-drop system for moving tasks across columns
- Safe drag handling with dedicated drag handle (no interference with inputs)
- Drop-zone highlighting for task columns

### Changed
- Improved task rendering flow to support drag-and-drop
- Scoped rendering to prevent unnecessary re-renders across columns

### Fixed
- Prevented drag interactions from interfering with:
  - note editing
  - due date selection
  - task toggles

---

## 2026-04-25 — Progress & Input Enhancements

### Added
- Multi-view progress tracking:
  - Today
  - This Week
  - Total
- Date input support in Add a task composer

### Changed
- Updated progress card logic to reflect accurate task scope
- Improved task input workflow

### Fixed
- Various note strikethrough animation inconsistencies
- Note add duplication and refocus issues

---

## 2026-04-24 — Initial Dashboard Implementation

### Added
- Core task management system
- Task categories (Life, Work, Projects)
- Notes system for tasks
- Basic task editing, toggling, and deletion
- Initial UI layout and styling
- Dashboard structure and rendering system

### Changed
- Early UI refinements and layout adjustments

---

## 2026-04-20 — Initial Development Phase

### Added
- Initial concept and design of the productivity dashboard
- Early local development of task and note architecture
- Foundational layout experimentation
