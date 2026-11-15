FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG APP_NAME
RUN test -n "$APP_NAME" && npx nest build "$APP_NAME"
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

ARG APP_NAME
ENV APP_NAME=${APP_NAME}

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main.js"]
