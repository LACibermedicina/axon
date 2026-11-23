FROM node:20-alpine
WORKDIR /srv
COPY package.json .
RUN npm install --omit=dev && npm cache clean --force
COPY server.js .
USER node
EXPOSE 8090
CMD ["node", "server.js"]
