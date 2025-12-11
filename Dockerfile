# Hako Crawler Dockerfile
# Multi-stage build for smaller image size

FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN bun run build

# Production stage
FROM oven/bun:1-slim

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create data directories
RUN mkdir -p /app/data /app/input /app/output

# Set environment variables
ENV NODE_ENV=production

# Volume mounts for persistent data
VOLUME ["/app/data", "/app/input", "/app/output"]

# Default command - run the CLI
ENTRYPOINT ["bun", "run", "dist/bin/cli.js"]
