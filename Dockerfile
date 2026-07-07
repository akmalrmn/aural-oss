FROM node:20-bookworm-slim AS deps

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG BUILD_SUPABASE_URL
ARG BUILD_SUPABASE_PUBLIC_TOKEN
ARG BUILD_SUPABASE_ADMIN_PLACEHOLDER=dummy-service-role-token
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_VOICE_RELAY_URL
ARG NEXT_PUBLIC_OPENAI_VOICE_RELAY_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_VOICE_RELAY_URL=$NEXT_PUBLIC_VOICE_RELAY_URL
ENV NEXT_PUBLIC_OPENAI_VOICE_RELAY_URL=$NEXT_PUBLIC_OPENAI_VOICE_RELAY_URL

RUN SUPABASE_URL=$BUILD_SUPABASE_URL \
    SUPABASE_ANON_KEY=$BUILD_SUPABASE_PUBLIC_TOKEN \
    SUPABASE_SERVICE_ROLE_KEY=$BUILD_SUPABASE_ADMIN_PLACEHOLDER \
    npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.mjs ./next.config.mjs

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
