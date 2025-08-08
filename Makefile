.PHONY: dev prod deploy-nginx

prod:
	bun install --prod
	bun run build
	~ pm2 delete letsmoe.com
	NODE_ENV="production" pm2 start --name "letsmoe.com" --update-env --log ~/logs/`date '+%d-%m-%Y_%H:%M:%S'`.log --time  bun -- run ./server.ts
	pm2 save
	$(MAKE) deploy-nginx

dev:
	bun run dev

deploy-nginx:
	sudo cp config.nginx /etc/nginx/sites-available/letsmoe.com
	sudo ln -sf /etc/nginx/sites-available/letsmoe.com /etc/nginx/sites-enabled/letsmoe.com
	sudo nginx -t
	sudo systemctl reload nginx