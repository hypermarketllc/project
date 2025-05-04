#!/bin/bash
# Deployment script for CRM application

# Exit on error
set -e

# Configuration
SERVER_USER="root"
SERVER_IP="66-63-187-50"
SERVER_DIR="/opt/apps/crm"
LOCAL_BUILD_DIR="./dist"
NGINX_CONF_FILE="nginx-crm.conf"
ENV_FILE=".env.production"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Error: $ENV_FILE file not found.${NC}"
  echo "Please create a $ENV_FILE file with your production environment variables."
  exit 1
fi

# Check if build directory exists
if [ ! -d "$LOCAL_BUILD_DIR" ]; then
  echo -e "${YELLOW}Build directory not found. Running build...${NC}"
  npm run build
  
  if [ ! -d "$LOCAL_BUILD_DIR" ]; then
    echo -e "${RED}Error: Build failed. Build directory still not found.${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}Starting deployment to $SERVER_USER@$SERVER_IP:$SERVER_DIR${NC}"

# 1. Create directory on server if it doesn't exist
echo -e "${YELLOW}Creating directory on server...${NC}"
ssh $SERVER_USER@$SERVER_IP "mkdir -p $SERVER_DIR"

# 2. Copy build files to server
echo -e "${YELLOW}Copying build files to server...${NC}"
rsync -avz --delete $LOCAL_BUILD_DIR/ $SERVER_USER@$SERVER_IP:$SERVER_DIR/dist/

# 3. Copy package.json and package-lock.json
echo -e "${YELLOW}Copying package files...${NC}"
rsync -avz package.json package-lock.json $SERVER_USER@$SERVER_IP:$SERVER_DIR/

# 4. Copy environment file
echo -e "${YELLOW}Copying environment file...${NC}"
rsync -avz $ENV_FILE $SERVER_USER@$SERVER_IP:$SERVER_DIR/.env

# 5. Copy database scripts
echo -e "${YELLOW}Copying database scripts...${NC}"
rsync -avz export-supabase-data.js import-to-postgres.js $SERVER_USER@$SERVER_IP:$SERVER_DIR/
rsync -avz -r supabase/migrations/ $SERVER_USER@$SERVER_IP:$SERVER_DIR/supabase/migrations/

# 6. Copy Nginx configuration
echo -e "${YELLOW}Copying Nginx configuration...${NC}"
rsync -avz $NGINX_CONF_FILE $SERVER_USER@$SERVER_IP:/tmp/

# 7. Install dependencies and set up on server
echo -e "${YELLOW}Setting up application on server...${NC}"
ssh $SERVER_USER@$SERVER_IP << 'EOF'
  # Navigate to app directory
  cd /opt/apps/crm

  # Install dependencies
  echo "Installing dependencies..."
  npm install --production

  # Install PM2 if not already installed
  if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
  fi

  # Set up Nginx configuration
  echo "Setting up Nginx configuration..."
  sudo mv /tmp/nginx-crm.conf /etc/nginx/sites-available/
  sudo ln -sf /etc/nginx/sites-available/nginx-crm.conf /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx

  # Start or restart the application with PM2
  if pm2 list | grep -q "crm"; then
    echo "Restarting application with PM2..."
    pm2 restart crm
  else
    echo "Starting application with PM2..."
    pm2 start npm --name "crm" -- start
    pm2 save
  fi

  echo "Setting up PM2 to start on boot..."
  pm2 startup
  sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
  pm2 save
EOF

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "Your CRM application is now available at: ${GREEN}https://coveredamerican.com/crm${NC}"