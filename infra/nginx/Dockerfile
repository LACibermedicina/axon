# Stage 1: build do frontend (Vite + TypeScript)
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: nginx servindo estáticos + proxy
FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY --from=web /web/dist /usr/share/nginx/html
