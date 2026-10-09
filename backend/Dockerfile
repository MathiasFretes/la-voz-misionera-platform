FROM node:22.23.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY backend ./backend
COPY src/contracts ./src/contracts
COPY src/domain ./src/domain
COPY tsconfig.backend.json ./
COPY scripts/build-backend-runtime.mjs ./scripts/build-backend-runtime.mjs
RUN npm run build:backend:runtime

FROM node:22.23.0-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4318
CMD ["node", "dist/backend/server.js"]
