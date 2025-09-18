# --- Stage 1: Build Environment ---
# Use the full Node image to get all build tools
FROM node:24-alpine AS builder

# Set the working directory
WORKDIR /usr/src/app

# Copy the root package.json and workspace configuration
COPY package.json package-lock.json* ./

# Copy the package.json files for each package in the workspace
# This allows us to install dependencies for the whole monorepo
COPY packages/api-service/package.json ./packages/api-service/
COPY packages/cli/package.json ./packages/cli/

# Install ALL dependencies for the entire workspace
# This is necessary to have devDependencies for the build step
RUN npm install

# Copy the rest of the source code for the api-service
# We don't need the CLI source to build the API service
COPY packages/api-service ./packages/api-service

# Run the build command specifically for the api-service workspace
RUN npm run build -w api-service


# --- Stage 2: Production Environment ---
# Start from a clean, lightweight alpine image
FROM node:24-alpine

# Set the NODE_ENV to production
ENV NODE_ENV production

WORKDIR /usr/src/app

# Copy only the api-service's package.json and lock file
COPY --from=builder /usr/src/app/packages/api-service/package.json .
COPY --from=builder /usr/src/app/package-lock.json .

# Install ONLY production dependencies
RUN npm install --omit=dev

# Copy the compiled application code from the builder stage
COPY --from=builder /usr/src/app/packages/api-service/dist ./dist

# The port that your app will run on
EXPOSE 3000

# The command to run your app
CMD [ "node", "dist/index.js" ]