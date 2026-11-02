.PHONY: dev build preview upload-journey

# SSH destination for upload-journey, e.g. `make upload-journey DEPLOY=deploy@letsmoe.com`.
DEPLOY ?= deploy@letsmoe.com

dev:
	bun run dev

build:
	bun run build

# Serves build/ the way Caddy does in production.
preview: build
	bun run preview

# Journey photos and the GPS track are gitignored, so CI can't deploy them; run this after
# scripts/import-polarsteps.ts. Caddy serves them from this folder (deploy/Caddyfile).
upload-journey:
	rsync --archive --compress --delete --info=progress2 static/journey/ $(DEPLOY):/var/www/letsmoe.com-journey/journey/
