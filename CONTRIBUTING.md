# Contributing to Beetlebot

Thanks for wanting to contribute to The Colony. Every PR, issue, and pack makes Beetlebot better for everyone.

## Getting started

```bash
git clone https://github.com/richardsondx/beetlebot.git
cd beetlebot
npm install
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to verify everything works.

## Development workflow

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Run `npm run lint && npm run typecheck && npm run test` to verify.
4. Open a PR with a clear description of what changed and why.

## What to work on

- **Packs** — build planning skills for your city. See [docs/PACK_SPEC.md](docs/PACK_SPEC.md).
- **Integrations** — add new channels or improve existing adapters.
- **Bug fixes** — check [GitHub Issues](https://github.com/richardsondx/beetlebot/issues).
- **Docs** — improve guides, fix typos, add examples.
- **Tests** — more coverage is always welcome.

## Code style

- TypeScript throughout, strict mode.
- Tailwind for styling.
- Prisma for database access.
- Zod for validation.
- No unnecessary comments — code should be self-documenting.

## Pack contributions

Want to build a pack for your city? Follow the [Pack Spec](docs/PACK_SPEC.md) and submit a PR. Every city deserves a local expert.

## Community

- Be kind. Be helpful. Be constructive.
- AI/vibe-coded PRs are welcome — just make sure they work.
- If you're unsure about a direction, open an issue first.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
