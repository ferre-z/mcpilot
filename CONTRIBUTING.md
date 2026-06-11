# Contributing

Thanks for your interest in MCPilot! 🎉

## Development setup

```bash
git clone https://github.com/ferre-z/mcpilot
cd mcpilot
npm install
npm run build --workspace=@mcpilot/core
```

## Project structure

```
mcpilot/
├── packages/
│   ├── core/        # scanner, tokenizer, registry, proxy (no runtime deps on cli/dashboard)
│   ├── cli/         # commander-based CLI
│   └── dashboard/   # Next.js 14 web UI
```

- **`packages/core` is the source of truth.** All shared types live in `packages/core/src/types.ts`.
- The CLI and dashboard import from `@mcpilot/core` only — never from each other.
- After changing `core`, run `npm run build --workspace=@mcpilot/core` so the dashboard picks up the change.

## Coding style

- TypeScript strict mode (already configured in `tsconfig.base.json`).
- ESM only (`"type": "module"` in every package).
- No `any` unless wrapping a foreign type. Prefer `unknown` + a type guard.
- All filesystem reads must be defensive: try/catch, graceful fallback.
- Use `chalk` (CLI) or Tailwind classes (dashboard) for color — never ANSI escapes directly.
- Keep CLI command files under 200 lines; move helpers to `utils/`.

## Testing (planned, not yet required for MVP)

- `packages/core` — unit tests for `scanner.ts` and `tokenizer.ts` (use Vitest)
- `packages/cli` — snapshot tests for the table output
- `packages/dashboard` — Playwright E2E

We accept PRs without tests in the v0.1 cycle. Please open an issue first for new features so we can discuss the design.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) in the form `<type>(<scope>): <subject>`. Examples:

- `feat(cli): add --top flag to stats command`
- `fix(scanner): handle missing mcpServers key gracefully`
- `docs: clarify token-count caveat for Claude`
- `chore(deps): bump @modelcontextprotocol/sdk to 1.0.5`

## Pull request checklist

- [ ] `npm run typecheck` passes in every workspace
- [ ] `npm run build` succeeds
- [ ] `mcpilot scan` still works on a system with at least one MCP config
- [ ] `mcpilot dashboard` still loads on `localhost:3000`
- [ ] The PR description explains the why, not just the what

## Reporting bugs

Please open a GitHub issue with:
- Your `mcpilot scan` output (`--json` is fine)
- Your OS and Node version (`node -v`)
- A minimal repro if possible
