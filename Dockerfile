# ---- Base image ----
FROM node:8.9.4
ARG NPM_TOKEN
ARG EDDI_API_URL="http://localhost:7070"
ENV EDDI_API_URL=$EDDI_API_URL
ARG PORT=7071
ENV PORT=$PORT

ARG AUTH_METHOD="none"
ENV AUTH_METHOD=$AUTH_METHOD
ARG AUTH_URL="https://auth.labs.ai/auth"
ENV AUTH_URL=$AUTH_URL
ARG AUTH_REALM="EDDI"
ENV AUTH_REALM=$AUTH_REALM
ARG AUTH_CLIENT_ID="eddi-config-ui"
ENV AUTH_CLIENT_ID=$AUTH_CLIENT_ID
ARG READ_ONLY_DOMAIN="https://app.labs.ai"
ENV READ_ONLY_DOMAIN=$READ_ONLY_DOMAIN

RUN JOBS=MAX npm set progress=false && npm config set depth 0
WORKDIR /workdir
COPY /package*.json ./
RUN npm install

COPY . .
RUN npm run build
EXPOSE $PORT
ENTRYPOINT node server.js --path ./dist --port $PORT --env "{\"EDDI_API_URL\":\"$EDDI_API_URL\", \"AUTH_METHOD\":\"$AUTH_METHOD\", \"AUTH_URL\":\"$AUTH_URL\", \"AUTH_REALM\":\"$AUTH_REALM\", \"AUTH_CLIENT_ID\":\"$AUTH_CLIENT_ID\", \"READ_ONLY_DOMAIN\":\"$READ_ONLY_DOMAIN\"}"
