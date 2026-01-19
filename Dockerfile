FROM node:22
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
# The command is overridden in compose.yaml for each service