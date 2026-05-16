<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Operating Rules

- Always deploy to production at the end of every completed task in this repo, then verify the public production endpoint. If production deployment is blocked by missing credentials, tooling, or environment access, state the blocker explicitly in the final handoff.
- Always push completed changes to GitHub at the end of every completed task in this repo. If pushing is blocked by missing credentials, remote configuration, branch protection, or unresolved local changes, state the blocker explicitly in the final handoff.
- Before pushing completed work, run the strongest practical repo quality gate, including CodeRabbit code-quality review and Codex Security review for the completed diff. If either tool is unavailable or blocked, record the exact blocker and do not replace it with an invented manual result.
- End each completed chat on `main`: fetch/pull the latest `origin/main`, reconcile conflicts without discarding either side's work, rerun the required checks after conflict resolution, then push the completed result to `origin/main`. Preserve both local and remote changes when resolving conflicts; never solve a conflict by dropping the other side unless the user explicitly requests it.
