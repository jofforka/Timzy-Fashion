FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY *.cjs ./
USER node
EXPOSE 8080
CMD ["node","payment-start.cjs"]
