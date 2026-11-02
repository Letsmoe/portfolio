# Server setup

The site is plain files. GitHub Actions (`.github/workflows/main.yml`) builds it and rsyncs `build/`
to the server, where Caddy serves it and handles HTTPS. The server needs no Node or bun.

## Once, on the server (Debian/Ubuntu)

1. Install Caddy: <https://caddyserver.com/docs/install#debian-ubuntu-raspbian>.
2. Point the A/AAAA records of `letsmoe.com`, `moritz-utcke.com` and their `www.` subdomains at the server, and open ports 80 and 443.
   Caddy requests the certificates on its first start.
3. Create a deploy user that owns the site folders:

   ```sh
   sudo adduser --disabled-password --gecos "" deploy
   sudo mkdir -p /var/www/letsmoe.com /var/www/letsmoe.com-journey/journey
   sudo chown -R deploy:deploy /var/www/letsmoe.com /var/www/letsmoe.com-journey
   ```

4. Give CI a key of its own: run `ssh-keygen -t ed25519 -f letsmoe-deploy -N ""` locally and append
   `letsmoe-deploy.pub` to `/home/deploy/.ssh/authorized_keys` on the server.
5. Make `/etc/caddy/Caddyfile` contain only `import sites/*.caddy`, copy `deploy/Caddyfile` to
   `/etc/caddy/sites/letsmoe.com.caddy` and run `sudo systemctl reload caddy`.
6. Upload the journey photos from your machine: `make upload-journey`.

## GitHub secrets

Under Settings, then Secrets and variables, then Actions:

| Secret               | Value                                                       |
| -------------------- | ----------------------------------------------------------- |
| `DEPLOY_HOST`        | The server's hostname or IP                                 |
| `DEPLOY_USER`        | `deploy`                                                    |
| `DEPLOY_PORT`        | The SSH port; leave it unset for 22                         |
| `DEPLOY_SSH_KEY`     | The contents of the private key `letsmoe-deploy`            |
| `DEPLOY_KNOWN_HOSTS` | The output of `ssh-keyscan -p <port> <host>`                |

The old `SERVER_HOST`, `SERVER_USER` and `SERVER_PASSWORD` secrets are no longer used.
