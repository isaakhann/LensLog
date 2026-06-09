FROM node:20-alpine

WORKDIR /workspace

# Copy dependencies manifest
COPY package*.json ./

# Install packages
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run Vite in host mode so it maps to the docker container ports
CMD ["npm", "run", "dev", "--", "--host"]
