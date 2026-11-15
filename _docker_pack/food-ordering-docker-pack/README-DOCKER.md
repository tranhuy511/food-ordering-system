# Food Ordering System – Docker deployment pack

This pack adds Dockerfiles and a separate Compose definition without overwriting the current `docker-compose.yml` or `nginx/nginx.conf`.

## Files to copy

- `docker-compose.dockerized.yml` -> repository root
- `backend/Dockerfile` and `backend/.dockerignore` -> `backend/`
- `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/nginx.frontend.conf` -> `frontend/`
- `nginx/nginx.docker.conf` -> `nginx/`

The Compose file intentionally keeps the same named volumes (`mysql_data`, `redis_data`, `rabbitmq_data`) and current container names for infrastructure. Do not use `docker compose down -v`.

## Required root `.env` entries

Keep the existing MySQL, Redis and RabbitMQ variables. Also ensure root `.env` contains:

```dotenv
JWT_SECRET=<the same JWT_SECRET currently used by all backend services>
RABBITMQ_URL_DOCKER=<AMQP URI using the RabbitMQ credentials and hostname rabbitmq>
```

Example format only (do not copy a real password into chat):

```text
amqp://<URL-ENCODED-USERNAME>:<URL-ENCODED-PASSWORD>@rabbitmq:5672
```

Percent-encode reserved URI characters in the username/password, especially `@`, `:`, `/`, `?`, `#`, `%`.

## Start

1. Stop the locally running NestJS terminal processes (user, restaurant, both order instances, payment and notification) with Ctrl+C. Keep the Docker infrastructure running.
2. From the repository root, validate interpolation and service definitions:

   ```powershell
   docker compose -p food-ordering-system -f .\docker-compose.dockerized.yml config --services
   ```

3. Build and start the app:

   ```powershell
   docker compose -p food-ordering-system -f .\docker-compose.dockerized.yml up -d --build
   ```

4. Inspect status and logs:

   ```powershell
   docker compose -p food-ordering-system -f .\docker-compose.dockerized.yml ps
   docker compose -p food-ordering-system -f .\docker-compose.dockerized.yml logs -f user-service restaurant-service order-service-1 order-service-2 payment-service notification-service nginx frontend
   ```

## URLs

- Frontend: http://localhost:5173
- API Gateway: http://localhost:8081/health
- RabbitMQ Management: http://localhost:15672

All NestJS services communicate over the Compose bridge network. Frontend Nginx serves the built React app and forwards API routes to the API Gateway. Payment Service calls `http://nginx:80` for Order Service API requests, so it benefits from Order Service upstream failover.

## Important

- Backend environment variable names match the current service entrypoints: lowercase `port` for User Service; `RESTAURANT_PORT`, `PORT`, `PAYMENT_SERVICE_PORT`, and `NOTIFICATION_SERVICE_PORT` for the other apps.
- Database and RabbitMQ credentials are injected at container runtime; `.env` is excluded from Docker build contexts.
- No DB migration is run automatically by the containers. Your existing schema and outbox tables remain in the named MySQL volume.
- The menu catalogue remains frontend demo data until a Product/Menu API is implemented.
