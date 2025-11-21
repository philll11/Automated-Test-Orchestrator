# --- Stage 1: Build Environment ---
# Use the full Node image to get all build tools
FROM node:24-alpine AS builder

# Set the working directory
WORKDIR /usr/src/app

# Copy the package.json and lock file from the root of the repository
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies needed for the build)
RUN npm install

# Copy the rest of the source code (src, tsconfig.json, etc.)
COPY . .

# Run the build command to compile TypeScript to JavaScript
RUN npm run build


# --- Stage 2: Production Environment ---
# Start from a clean, lightweight alpine image
FROM node:24-alpine

# Set the NODE_ENV to production for performance and security
ENV NODE_ENV=production

WORKDIR /usr/src/app

# Copy the package.json and lock file from the builder stage
COPY --from=builder /usr/src/app/package.json .
COPY --from=builder /usr/src/app/package-lock.json .

# Install ONLY production dependencies to keep the image small
RUN npm install --omit=dev

# Copy the compiled application code from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Copy any other necessary assets, like certificates
# The path is now relative to the root of the repository
COPY certs/DigiCertGlobalRootG2.crt.pem ./certs/DigiCertGlobalRootG2.crt.pem

# The port that your app will run on
EXPOSE 3001

# The command to run your app
CMD [ "node", "dist/index.js" ]