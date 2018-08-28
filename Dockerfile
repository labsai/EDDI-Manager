# ---- Base image ----
FROM node:8.9.4
ARG NPM_TOKEN
ARG EDDI_API_URL="http://localhost:7070"
ENV EDDI_API_URL=$EDDI_API_URL
ARG PORT=3000
ENV PORT=$PORT
RUN JOBS=MAX npm set progress=false && npm config set depth 0
WORKDIR /workdir
COPY /package*.json ./
RUN npm install

COPY . .
RUN npm run build
EXPOSE $PORT
ENTRYPOINT node server.js --path ./dist --port $PORT --env "{\"EDDI_API_URL\":\"$EDDI_API_URL\"}"
