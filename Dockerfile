FROM node:15.8.0-buster

WORKDIR /bloomo

COPY src src
COPY package.json package-lock.json do git-state .sequelizerc .

RUN apt update && apt install -y vim ripgrep && npm ci

EXPOSE 8004

ENTRYPOINT ./do -r
