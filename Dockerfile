# Simple single-stage Dockerfile that mirrors local flow
FROM node:22-alpine
WORKDIR /app

# Install all dependencies, build, and run (matches local: npm run build -> npm start)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit --progress=false

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","start"]
