# Multi-stage build for Tractor Junction AI Chat System

# Stage 1: Build React client
FROM node:16-alpine AS client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm ci --only=production

# Copy client source code
COPY client/ ./

# Build React app
RUN npm run build

# Stage 2: Build Node.js server
FROM node:16-alpine AS server-builder

WORKDIR /app

# Copy server package files
COPY package*.json ./

# Install server dependencies
RUN npm ci --only=production

# Copy server source code
COPY server/ ./server/

# Copy built client files
COPY --from=client-builder /app/client/build ./client/build

# Stage 3: Production image
FROM node:16-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=server-builder /app ./

# Create necessary directories
RUN mkdir -p logs cache chroma_data && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "server/index.js"]
