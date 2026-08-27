FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p uploads

EXPOSE 43127

ENV NODE_ENV=development
ENV PORT=43127

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npx", "next", "dev", "--port", "43127", "--hostname", "0.0.0.0"]
