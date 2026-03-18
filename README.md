## AI Travel Agent

An AI travel booking agent that can:

- Search flights
- Book a chosen flight **only after explicit user confirmation**
- Log confirmed bookings to Trello

### Project phases

- **Phase 0 (Foundation, no code)**: define tools + schemas + agent flow + stack choices
- **Phase 1**: project skeleton + environment setup + basic runner scaffold
- **Phase 2+**: tool implementations (mock → real APIs), hardening, tests, and UX

### Docs

- `docs/phase-0.md` — Phase 0 specification (tools, schemas, flow, rules, checkpoint)

### Security (important)

- **Never commit secrets**. Put real keys/tokens only in `.env` (local).
- Use `.env.example` as a safe template.

