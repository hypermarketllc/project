#!/bin/bash
# Server setup script for CRM application

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up CRM application...${NC}"

# 1. Install required packages
echo -e "${YELLOW}Installing required packages...${NC}"
apt-get update
apt-get install -y nodejs npm nginx

# 2. Install PM2 globally
echo -e "${YELLOW}Installing PM2...${NC}"
npm install -g pm2

# 3. Create application directory
echo -e "${YELLOW}Creating application directory...${NC}"
mkdir -p /opt/apps/crm/dist

# 4. Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd /opt/apps/crm
npm install express pg

# 5. Set up Nginx
echo -e "${YELLOW}Setting up Nginx...${NC}"
cp /tmp/crm.conf /etc/nginx/sites-available/
ln -sf /etc/nginx/sites-available/crm.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 6. Set up database permissions
echo -e "${YELLOW}Setting up database permissions...${NC}"
sudo -u postgres psql < /tmp/setup-db-permissions.sql

# 7. Start the application
echo -e "${YELLOW}Starting the application...${NC}"
cd /opt/apps/crm
pm2 start simple-server.js --name "crm"
pm2 save
pm2 startup

echo -e "${GREEN}Setup completed successfully!${NC}"
echo -e "Your CRM application is now available at: ${GREEN}https://coveredamerican.com/crm${NC}"