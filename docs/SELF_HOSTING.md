# Self-hosting Beetlebot (Private Panel, Public Callbacks)

This guide is the practical setup for:

- keeping Beetlebot private (no public admin panel)
- exposing only callback/webhook URLs required by integrations
- avoiding custom domain setup complexity

It matches this architecture:

- Beetlebot app: `127.0.0.1:48653` (private)
- Edge proxy (allowlist only): `127.0.0.1:8787` (private)
- ngrok tunnel: public HTTPS URL -> edge proxy

## 1) Run Beetlebot privately

Run Beetlebot on loopback only:

```bash
NODE_ENV=production npm run start -- -H 127.0.0.1 -p 48653
```

If using systemd, make sure `ExecStart` includes `-H 127.0.0.1 -p 48653`.

## 2) Add an edge proxy with default-deny

Install Caddy:

```bash
sudo apt update
sudo apt install -y caddy
```

Set `/etc/caddy/Caddyfile`:

```caddy
:8787 {
  @allowed {
    path /api/webhooks/whatsapp
    path /api/integrations/google-calendar/callback
  }

  handle @allowed {
    reverse_proxy 127.0.0.1:48653
  }

  # Optional health route to confirm this is your edge.
  handle_path /__edge/health {
    respond "Beetlebot edge online" 200
  }

  # Block everything else (including admin panel paths).
  respond "Not found" 404
}
```

Enable/reload Caddy:

```bash
sudo systemctl enable --now caddy
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

`Not found` on `/` is expected and desired.

## 3) Configure ngrok on the server

Create an ngrok account and authtoken:

- https://dashboard.ngrok.com/signup
- https://dashboard.ngrok.com/get-started/your-authtoken

Install token into ngrok config.

If ngrok is installed via snap (`which ngrok` -> `/snap/bin/ngrok`), use:

```bash
ngrok config add-authtoken <YOUR_NGROK_AUTHTOKEN> --config /root/snap/ngrok/current/.config/ngrok/ngrok.yml
```

Then set tunnel config at `/root/snap/ngrok/current/.config/ngrok/ngrok.yml`:

```yaml
version: "2"
tunnels:
  beetlebot-edge:
    proto: http
    addr: 127.0.0.1:8787
```

If your plan supports reserved domains and you want URL stability, add:

```yaml
    domain: your-name.ngrok-free.app
```

## 4) Run ngrok as a systemd service

Why systemd: it keeps ngrok running in the background, survives SSH/terminal disconnects, restarts on crashes, and starts automatically on reboot.

Create `/etc/systemd/system/ngrok-beetlebot.service`:

```ini
[Unit]
Description=ngrok tunnel for Beetlebot callbacks
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStart=/snap/bin/ngrok start beetlebot-edge --config /root/snap/ngrok/current/.config/ngrok/ngrok.yml
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ngrok-beetlebot
sudo systemctl status ngrok-beetlebot --no-pager
```

View logs:

```bash
sudo journalctl -u ngrok-beetlebot -n 100 --no-pager
```

## 5) Get the public endpoint

Use ngrok inspector API on the server:

```bash
curl -s http://127.0.0.1:4040/api/tunnels
```

Use the `public_url` as base URL, for example:

- `https://<public_url_host>/api/webhooks/whatsapp`
- `https://<public_url_host>/api/integrations/google-calendar/callback`

## 6) Update Beetlebot base URLs

Set in `.env`:

```bash
NEXT_PUBLIC_APP_URL="https://<public_url_host>"
BEETLEBOT_BASE_URL="https://<public_url_host>"
```

Restart Beetlebot service after changes:

```bash
sudo systemctl restart beetlebot
```

## 7) Verify security posture

Expected behavior:

- `https://<public_url_host>/` -> `404` (blocked)
- `https://<public_url_host>/chat` -> `404` (blocked)
- `https://<public_url_host>/__edge/health` -> `200` (optional check)
- webhook/callback paths -> reachable

## Troubleshooting

### `ERR_NGROK_4018`

Auth missing. Install authtoken in the same config file used by systemd.

### `permission denied` reading ngrok config

Common with snap path confusion. Use the snap config path shown above.

### Tunnel up but webhook fails

Usually `127.0.0.1:8787` is not listening (Caddy misconfigured/down).

