# Build stage
FROM node:22-alpine AS builder

WORKDIR /app


# Install dependencies for Prisma and native modules
RUN apk add --no-cache openssl libc6-compat

# Copy package files AND prisma schema first (needed for postinstall)
COPY package*.json ./
COPY prisma ./prisma

# Install dependencies (this runs postinstall which needs prisma schema)
RUN npm ci

# Copy rest of source files
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

# Install dependencies for Prisma and native modules
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/scripts ./scripts


# Create farmework specific directories
RUN mkdir -p /app/public/uploads /app/public/img && chmod -R 777 /app/public/uploads /app/public/img

# Set permissions
RUN chown -R nextjs:nodejs /app

# USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
