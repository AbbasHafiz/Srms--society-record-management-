FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates postgresql-client zip unzip \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate

# Production image: docker compose -f docker-compose.prod.yml build
ARG BUILD_PRODUCTION=0
RUN if [ "$BUILD_PRODUCTION" = "1" ]; then npm run build; fi

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p uploads

EXPOSE 43127

ENV NODE_ENV=development
ENV PORT=43127

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npx", "next", "dev", "--port", "43127", "--hostname", "0.0.0.0"]
