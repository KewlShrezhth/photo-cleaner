FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY *.js ./
# Download the grouping model at build time, so the first request isn't slow.
RUN node -e "import('./analyze.js').then(m => m.warmUp())"
ENV PORT=8787
EXPOSE 8787
CMD ["node", "index.js"]
