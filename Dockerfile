FROM node:24-alpine AS base
WORKDIR /app

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV VERSO_CONTAINER=true

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/build ./build
COPY --from=build /app/server ./server
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/react-router.config.ts ./react-router.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json

EXPOSE 4173

CMD ["sh", "-c", "npm run db:migrate && npm start"]

