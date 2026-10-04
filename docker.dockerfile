# Build stage
FROM --platform=$BUILDPLATFORM node:18-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Build the React app
RUN npm run build

# Serve stage
FROM nginx:alpine

# nginx-Konfiguration fürs Image (statische Dateien + /api an den Backend-Container).
# nginx.conf im Repo-Root ist die alte TLS-Proxy-Konfiguration und wird hier nicht benutzt.
COPY nginx/spa.conf /etc/nginx/nginx.conf

# Copy the built React app from the build stage
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
