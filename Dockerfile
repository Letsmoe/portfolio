FROM node:latest

EXPOSE 80
EXPOSE 443

RUN npm i -g pnpm
WORKDIR /portfolio
COPY ./package.json ./
COPY . .


CMD ["pnpm", "run", "build:production"]