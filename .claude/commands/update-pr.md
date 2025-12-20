---
allowed-tools: Bash(gh pr view:*), Bash(gh pr edit:*), Bash(git log:*), Bash(git diff:*)
description: Update PR title and description based on changes
---

Analyze the current PR and update its title and description.

Current PR info:
!`gh pr view --json title,body,headRefName,baseRefName 2>/dev/null || echo "No PR found"`

Commits in this PR:
!`git log origin/main..HEAD --oneline`

Diff summary:
!`git diff origin/main..HEAD --stat`

## Instructions

Update the PR title and description using `gh pr edit`.

**Title format**: Use semantic commit style:
- `feat:` for new features
- `fix:` for bug fixes
- `refactor:` for code refactoring
- `chore:` for maintenance tasks
- `docs:` for documentation changes
- `style:` for formatting changes
- `test:` for test changes

**Description format**:
```
## Summary
1-2 sentence summary of what this PR does.

## Commentary
Any additional context, implementation notes, or things reviewers should know. Keep it brief.
```

Use `gh pr edit --title "..." --body "..."` to update the PR.
