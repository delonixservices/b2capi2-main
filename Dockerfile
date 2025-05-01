# Use Node.js 20 base image (Debian-based)
FROM node:20

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire project to the container
COPY . .

# Expose the application port (for Node.js app)
EXPOSE 3334

# Expose MongoDB port (default: 27017)
EXPOSE 27017

# Expose Redis port (default: 6379)
EXPOSE 6379

# Start your Node.js application
CMD ["npm", "start"]
