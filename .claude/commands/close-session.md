Close out the current working session by updating all project documentation to reflect what was actually done. Follow these steps in order.

## 1. Gather facts — read before writing anything

- Read `docs/TRACKER.md` (current state baseline)
- Read `docs/PLANNING.md` (phase checklists)
- Determine the session scope: if the user specified a number of commits (e.g. "last 3 commits"), use that. Otherwise default to 1.
- Run `git log --oneline -N` (where N is the commit count) to confirm the scope looks right
- Run `git diff HEAD~N --stat` to see which files changed across those commits
- Run `git status` to catch any uncommitted changes or untracked new files

## 2. Update `docs/TRACKER.md`

- Set **Current status** → phase name, brief description of where things stand, today's date
- Set **Active work** → "Nothing in progress — session closed cleanly."
- Move anything completed this session into the correct "Completed" section with `[x]`
- Rewrite **Next up** to reflect the actual remaining work, in priority order, with a numbered list a new session can follow without re-deriving anything
- Update the **Upcoming phases** table — mark phases as "Done", "Partial", or "Not started"
- Add any new architectural decisions made this session to the **Decision log** with a reason

## 3. Document touched code

For every source file changed this session (from the `git diff --stat` output), review it and ensure non-trivial functions and modules meet the project's documentation standard (defined in `CLAUDE.md`):

- **The what** — behaviour, edge cases, contract. Clear enough that a new developer understands what the code is responsible for without reading the implementation.
- **The why** — unconventional choices, hidden constraints, intentional trade-offs.

Rules:
- Do NOT write comments that restate the function name (e.g. `// Adds item to cart` above `addItemToCart()` adds nothing).
- Do NOT add comments to trivial or self-evident code.
- Only add or update comments where the why or the non-obvious what is genuinely missing.
- Keep comments short — one line where possible, never multi-paragraph blocks.

## 4. Update `docs/PLANNING.md`

- Check off (`[x]`) any tasks completed this session
- If a task was partially done, add a sub-note explaining what remains

## 5. Update memory

- Read `C:\Users\aonisor\.claude\projects\C--coffee-shop\memory\MEMORY.md` and relevant memory files
- `project_coffeeshop.md` must stay lean — it is a thin pointer layer, not a state summary. Do NOT copy current phase, file lists, or "what's next" into it — that lives in `docs/TRACKER.md`. Only update it if a genuinely non-obvious architectural fact emerged this session that isn't captured in any project doc.
- If the user expressed a new preference, gave feedback on your approach, or corrected something, save that as a `feedback` or `user` memory entry.
- Do not duplicate information already in memory — update in place

## 6. Report back

Give a short summary (5–8 bullet points) of:
- What was completed
- What's blocked or missing
- What the next session should start with
