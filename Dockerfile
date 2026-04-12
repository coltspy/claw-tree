# claw-tree — multi-stage Docker build
# Stage 1: build the Rust CLI (claw)
# Stage 2: install Node deps
# Stage 3: minimal runtime image with both

# ---------- Stage 1: Rust build ----------
FROM rust:bookworm AS rust-builder

WORKDIR /build

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        pkg-config \
        libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY rust/ ./rust/
WORKDIR /build/rust
RUN cargo build -p rusty-claude-cli --release

# ---------- Stage 2: Node dependency install ----------
FROM node:24-slim AS web-builder

WORKDIR /build/apps/web

COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY apps/web/ ./

# ---------- Stage 3: Runtime ----------
FROM node:24-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=rust-builder /build/rust/target/release/claw /usr/local/bin/claw
COPY --from=web-builder /build/apps/web /app/apps/web

ENV CLAW_BIN=/usr/local/bin/claw
ENV HOST=0.0.0.0
ENV PORT=5173
ENV NODE_ENV=development

WORKDIR /app/apps/web
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
