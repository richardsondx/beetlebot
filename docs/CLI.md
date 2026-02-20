# CLI

CLI entrypoint: `beetlebot`

## Commands

- `beetlebot tui`
- `beetlebot dev`
- `beetlebot autopilot list`
- `beetlebot autopilot preview <id>`
- `beetlebot autopilot run <id>`
- `beetlebot pack list`
- `beetlebot pack install <slug>`
- `beetlebot approvals list`
- `beetlebot audit tail`
- `beetlebot memory list --bucket <name>`
- `beetlebot memory forget <memoryId>`
- `beetlebot runs list`
- `beetlebot runs retry <runId>`
- `beetlebot scheduler status`
- `beetlebot integrations list`
- `beetlebot integrations status <provider>`
- `beetlebot integrations connect <provider> [provider flags]`
- `beetlebot integrations disconnect <provider>`
- `beetlebot integrations test <provider>`

The current implementation is API-coupled and designed for local-first operations.

## TUI

`beetlebot tui` launches an interactive terminal interface with:

- session-first transcript pane
- on-demand context overlay (`/context show|hide`)
- persistent conversation threads (auto-resume latest thread)
- bottom prompt for natural-language chat and slash commands

### TUI Commands

- `/help`
- `/status`
- `/context [show|hide]`
- `/model`
- `/model set <provider/model>`
- `/model reset`
- `/new` (start a new conversation thread)
- `/thread [id]` (show or switch active thread)
- `/threads` (list recent threads)
- `/autopilots`
- `/packs`
- `/runs`
- `/approvals`
- `/integrations`
- `/connect <provider> [key=value...]`
- `/disconnect <provider>`
- `/test <provider>`
- `/memory [bucket]`
- `/preview <autopilotId>`
- `/run <autopilotId>`
- `/install <packSlug>`
- `/retry <runId>`
- `/clear`
- `/exit`

### TUI Keys

- `Enter`: submit prompt
- `Ctrl+C`, `q`, or `Esc`: quit
- `Ctrl+L`: clear transcript
- `Ctrl+K`: toggle context overlay

## Integration Setup Notes

### Telegram
- Use `beetlebot integrations connect telegram --bot-token <token>`
- In TUI: `/connect telegram botToken=<token>`

### WhatsApp (Meta Cloud API)
- Use `beetlebot integrations connect whatsapp --access-token <token> --phone-number-id <id> [--business-account-id <id>]`
- In TUI: `/connect whatsapp accessToken=<token> phoneNumberId=<id> businessAccountId=<id>`

### Google Calendar OAuth
- Web UI uses OAuth callback flow automatically:
  - Click **Connect** for Google Calendar in Settings.
  - Sign in to Google and approve access.
  - You are redirected back to Settings with success/error feedback.
- CLI/TUI fallback remains available for headless flows:
  - Run `beetlebot integrations connect google_calendar` to get `authorizeUrl`.
  - Open `authorizeUrl`, approve access, then run:
    - `beetlebot integrations connect google_calendar --code <oauth_code>`
- Optional overrides: `--redirect-uri`, `--client-id`, `--client-secret`, `--calendar-id`

Environment defaults for Google can be set with:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

For web callback flow, register this redirect URI in your Google OAuth app:
- `<your-beetlebot-base-url>/api/integrations/google-calendar/callback`

### Explicitly Not Supported
- WhatsApp Web QR automation is excluded.
- BSP-specific providers (Twilio/360dialog) are not implemented in this pass.

