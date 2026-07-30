# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Optimize memory for Next.js builds on constrained servers
ENV NODE_OPTIONS="--max-old-space-size=2048"


# Install dependencies for Prisma and native modules
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

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
FROM node:22-slim AS runner

WORKDIR /app

# Install dependencies for Prisma and native modules
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Create non-root user
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

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
