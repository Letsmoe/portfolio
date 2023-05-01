#!/bin/bash

# Define your environment variables here
APP_NAME="portfolio";

npm i -g pnpm;

git_pull_force() {
	git reset --hard HEAD
	git clean -f -d
	git pull origin main
}

# Zuerst müssen wir sowohl "portfolio" als auch "database" von GitHub pullen.
cd ~/apps/$APP_NAME
git_pull_force;

# Dann bauen wir das Docker Image unserer Application
cd ~/apps/$APP_NAME
pnpm install
docker stop $APP_NAME
docker rm $APP_NAME
docker build --no-cache -t $APP_NAME .

# Wir legen einen .env file für unsere letsencrypt keys an.
rm -f ~/apps/$APP_NAME/.env;
touch ~/apps/$APP_NAME/.env && echo "PRIVATE_KEY=$(cat /etc/letsencrypt/live/letsmoe.com/privkey.pem | base64 | tr -d '\n')" >> ~/apps/$APP_NAME/.env && echo "CERTIFICATE=$(cat /etc/letsencrypt/live/letsmoe.com/fullchain.pem | base64 | tr -d '\n')" >> ~/apps/$APP_NAME/.env
# Danach starten wir unsere App wieder.
docker run -d --name $APP_NAME --network $NETWORK -p "80:80" -p "443:443" --env-file ~/apps/$APP_NAME/.env $APP_NAME;