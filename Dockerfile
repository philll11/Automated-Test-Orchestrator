# Use an official Node.js runtime as a parent image
FROM node:24-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of the application's source code from the host to the image's filesystem.
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

# The port that your app will run on
EXPOSE 3000

# The command to run your app
CMD [ "npm", "start" ]
