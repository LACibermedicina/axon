# axon · frontend estático + reverse proxy interno para /api e /ws (nginx sem privilégios, porta 8080)
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/ /usr/share/nginx/html/
COPY docs/ /usr/share/nginx/html/docs/
COPY site/ /usr/share/nginx/html/site/
EXPOSE 8080
