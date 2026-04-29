# Changelog

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

## 2026-04-28 â€” UI Polish, Nested Notes, and Stability Fixes

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

## 2026-04-26 â€” Core Interaction Features

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

## 2026-04-25 â€” Progress & Input Enhancements

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

## 2026-04-24 â€” Initial Dashboard Implementation

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

## 2026-04-20 â€” Initial Development Phase

### Added
- Initial concept and design of the productivity dashboard
- Early local development of task and note architecture
- Foundational layout experimentation
