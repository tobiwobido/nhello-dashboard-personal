# AI SYSTEM RULES (MANDATORY)

This file defines how AI tools behave.
Use ENGINEERING_PATTERNS.md for implementation details.

---

# CORE RULE

AI delivers complete UX, not partial code.

---

# COMMAND SYSTEM

apply system → apply all rules in this file
mode: ui-fast → light validation, UI only
mode: logic-safe → strict validation + snapshot
scope: [area] → limit file access

---

# AUTO MODE

Auto-select based on prompt — never require user to specify.

ui-fast:
- styling, spacing, alignment, visual tweaks, minor animation
- skip deep lifecycle analysis and full project scan

logic-safe:
- logic, state, event handlers, data flow, calculations
- undo/redo, revert/restore, snapshot system
- preview/production, demo, storage keys, cross-tab behavior

if unsure → default to logic-safe

---

# AUTO SCOPE

Auto-select based on prompt — never require user to specify.

Tasks → task cards, notes, filters, categories, add/clear, priorities, due dates
Costs → calculator, discount, tax, COGS, saved products, value cards, breakdown
Sidebar → navigation, version selector, publish/revert, settings
System → preview/production, demo, snapshots, revert/restore, storage, undo/redo

if prompt touches multiple areas → use multiple scopes
if unsure → start narrow, expand only if needed
never scan full project unless required

---

# LIVE / DEMO

live = default target

demo:
- never auto-modify
- dummy data only
- reset on load
- no persistence

---

# PREVIEW / PRODUCTION

preview = editable
production = locked until publish

switch animation:
exit → fade + slide down
enter → slide + fade up
do not render new version before exit animation completes

---

# SNAPSHOT RULE

Before ANY code change:

1. identify all affected files, functions, CSS rules, event handlers, state/config, and tabs (Tasks AND Costs)
2. snapshot BEFORE edit — never after, never use production as source
3. check ENGINEERING_PATTERNS.md for existing pattern before writing new logic
4. check edge cases: rapid interaction, empty data, animation conflicts, state mismatch during transitions
5. then edit

snapshot includes: logic, styles, animations, state, event handlers, all affected files

revert → restore exact pre-edit snapshot
restore → reapply update

never:
- partial revert
- visual-only revert
- ignore Costs tab changes
- begin editing before snapshot is complete

this process must run for every prompt that results in code changes
only one active snapshot exists per update batch
new update replaces previous snapshot

---

# UX RULES

- match existing patterns
- reuse components
- no redesign unless asked

---

# ANIMATION RULES

- smooth only, no jitter, no layout shift
- resize → always animated, never instant
- enter/exit → must be paired

default:
enter → slide + fade up
exit → slide + fade down

---

# INTERACTION RULES

all inputs:
- blur save, enter save, escape cancel
- no stuck states

---

# CONSTRAINTS

- no unrelated edits
- no removed functionality
- no broken logic
- no broken preview/production logic
- no demo modification unless explicitly asked
- no stuck states
- no flicker, no layout shift
- no console errors

---

# COMPLETENESS

always include full behavior + full UX
no partial work

---

# MINIMAL FIX

add shortcut rule

when I say "apply minimal fix":

* use the most recent Minimal Fix Steps
* apply them to live code only
* only implement what is explicitly listed
* do not modify unrelated code
* do not refactor or redesign
* do not touch demo files
* show exact file paths changed
* keep changes minimal
* always treat "apply minimal fix" as a strict command, not a suggestion
