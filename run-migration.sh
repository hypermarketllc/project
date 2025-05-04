#!/bin/bash
# Comprehensive migration script for Supabase to PostgreSQL

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SERVER_USER="root"
SERVER_IP="66-63-187-50"
SERVER_DIR="/opt/apps/crm"
LOCAL_BUILD_DIR="./dist"
NGINX_CONF_FILE="nginx-crm.conf"
ENV_FILE=".env.production"

echo -e "${GREEN}Starting migration from Supabase to PostgreSQL...${NC}"

# 1. Install required dependencies
echo -e "${YELLOW}Installing required dependencies...${NC}"
npm install pg @types/pg bcrypt jsonwebtoken express cors dotenv

# 2. Update base path
echo -e "${YELLOW}Updating base path...${NC}"
node update-base-path.js

# 3. Export data from Supabase
echo -e "${YELLOW}Exporting data from Supabase...${NC}"
node export-supabase-data.js

# 4. Set up PostgreSQL on the server
echo -e "${YELLOW}Setting up PostgreSQL on the server...${NC}"
ssh $SERVER_USER@$SERVER_IP << 'EOF'
  # Install PostgreSQL if not already installed
  if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL..."
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
  fi

  # Start and enable PostgreSQL service
  sudo systemctl start postgresql
  sudo systemctl enable postgresql

  # Create database and user
  sudo -u postgres psql << 'PSQL'
    CREATE DATABASE crm_db;
    CREATE USER crm_user WITH ENCRYPTED PASSWORD 'your_strong_password_here';
    GRANT ALL PRIVILEGES ON DATABASE crm_db TO crm_user;
PSQL

  echo "PostgreSQL setup completed."
EOF

# 5. Build the application
echo -e "${YELLOW}Building the application...${NC}"
npm run build

# 6. Create directory on server
echo -e "${YELLOW}Creating directory on server...${NC}"
ssh $SERVER_USER@$SERVER_IP "mkdir -p $SERVER_DIR"

# 7. Copy export files to server
echo -e "${YELLOW}Copying export files to server...${NC}"
rsync -avz supabase-export/ $SERVER_USER@$SERVER_IP:/tmp/supabase-export/

# 8. Import data to PostgreSQL
echo -e "${YELLOW}Importing data to PostgreSQL...${NC}"
ssh $SERVER_USER@$SERVER_IP << 'EOF'
  cd /tmp
  node import-to-postgres.js
EOF

# 9. Deploy the application
echo -e "${YELLOW}Deploying the application...${NC}"

# Copy build files to server
echo -e "${YELLOW}Copying build files to server...${NC}"
rsync -avz --delete $LOCAL_BUILD_DIR/ $SERVER_USER@$SERVER_IP:$SERVER_DIR/dist/

# Copy package.json and package-lock.json
echo -e "${YELLOW}Copying package files...${NC}"
rsync -avz package.json package-lock.json $SERVER_USER@$SERVER_IP:$SERVER_DIR/

# Copy server files
echo -e "${YELLOW}Copying server files...${NC}"
rsync -avz server.js package.json.server $SERVER_USER@$SERVER_IP:$SERVER_DIR/

# Copy environment file
echo -e "${YELLOW}Copying environment file...${NC}"
rsync -avz $ENV_FILE $SERVER_USER@$SERVER_IP:$SERVER_DIR/.env

# Copy database scripts
echo -e "${YELLOW}Copying database scripts...${NC}"
rsync -avz src/lib/postgres.ts src/lib/auth.ts src/middleware/auth.ts src/routes/auth.js $SERVER_USER@$SERVER_IP:$SERVER_DIR/src/

# Copy Nginx configuration
echo -e "${YELLOW}Copying Nginx configuration...${NC}"
rsync -avz $NGINX_CONF_FILE $SERVER_USER@$SERVER_IP:/tmp/

# 10. Set up the application on the server
echo -e "${YELLOW}Setting up the application on the server...${NC}"
ssh $SERVER_USER@$SERVER_IP << 'EOF'
  # Navigate to app directory
  cd /opt/apps/crm

  # Rename package.json.server to package.json
  mv package.json.server package.json

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

echo -e "${GREEN}Migration completed successfully!${NC}"
echo -e "Your CRM application is now available at: ${GREEN}https://coveredamerican.com/crm${NC}"