FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PASTA_DADOS=/dados \
    PORTA=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public
COPY scripts ./scripts

VOLUME /dados
EXPOSE 3000
CMD ["npm", "start"]
