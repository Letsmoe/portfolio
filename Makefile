.PHONY: dev prod

prod:
	bun install --prod
	bun run build
	NODE_ENV="production" pm2 start --name "letsmoe.com" --update-env --log ~/logs/`date '+%d-%m-%Y_%H:%M:%S'`.log --time  bun -- run ./server.ts

dev:
	bun run dev