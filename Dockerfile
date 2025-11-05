# Use a lightweight Node.js image as base
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install a simple HTTP server
RUN npm install -g http-server

# Copy project files
COPY . .

# Expose port 8080
EXPOSE 8080

# Start the HTTP server
CMD ["http-server", ".", "-p", "8080"]