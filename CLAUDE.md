# Smart Newsletter - Development Guidelines

## Commit and Push Strategy

### When to Commit and Push:

**1. Immediately after significant features or improvements:**
- New feature implementation
- UI/UX enhancements
- Performance optimizations
- Security improvements
- Major bug fixes

**2. After completing a logical set of related changes:**
- Hebrew language support (fonts, RTL, styling)
- API integrations
- Database schema changes
- Configuration updates

**3. Before switching to different work areas:**
- Before working on unrelated features
- End of development session
- Before major refactoring

### Commit Message Format:
```
<type>: <description>

> Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Types:
- `feat`: New feature
- `fix`: Bug fix
- `perf`: Performance improvement
- `style`: UI/styling changes
- `refactor`: Code refactoring
- `docs`: Documentation
- `config`: Configuration changes

## Pre-Commit Checklist:
- [ ] Run `npm run check-secrets`
- [ ] Run `npm run build` to ensure no errors
- [ ] Test key functionality
- [ ] Commit with descriptive message
- [ ] Push to backup changes

## Build Process:
1. Always run `npm run build` after changes
2. Fix any TypeScript/linting errors
3. Only commit after successful build
4. Push immediately after commit for backup

## Notes:
- Commit frequently for meaningful changes
- Don't wait until end of session for significant features
- Each commit should represent a complete, working state
- Use descriptive commit messages explaining the "why" not just "what"