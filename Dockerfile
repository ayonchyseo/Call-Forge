# CallForge — single container running the whole app (frontend + AI-call backend).
# Works on Fly.io, Railway, a VPS, or any Docker host.
#
#   docker build -t callforge .
#   docker run -p 8787:8787 -e PUBLIC_URL=https://your-public-url callforge
#
# PUBLIC_URL must be the container's public https URL (Twilio streams audio to it).
FROM node:22-slim

WORKDIR /app

# Install deps (incl. dev) and build the frontend.
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

ENV PORT=8787
EXPOSE 8787

CMD ["node", "server/index.js"]
