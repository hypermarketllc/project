#!/bin/bash
# Deployment script for CRM application

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SERVER_USER="root"
SERVER_IP="66.63.187.50"
SERVER_DIR="/tmp/crm-deploy"

echo -e "${GREEN}Starting deployment to $SERVER_USER@$SERVER_IP:$SERVER_DIR${NC}"

# 1. Create directory on server if it doesn't exist
echo -e "${YELLOW}Creating directory on server...${NC}"
ssh $SERVER_USER@$SERVER_IP "mkdir -p $SERVER_DIR"

# 2. Copy build files to server
echo -e "${YELLOW}Copying build files to server...${NC}"
rsync -avz --delete dist/ $SERVER_USER@$SERVER_IP:$SERVER_DIR/dist/

# 3. Copy server files
echo -e "${YELLOW}Copying server files...${NC}"
rsync -avz simple-server.js server-package.json $SERVER_USER@$SERVER_IP:$SERVER_DIR/
ssh $SERVER_USER@$SERVER_IP "mv $SERVER_DIR/server-package.json $SERVER_DIR/package.json"

# 4. Copy configuration files
echo -e "${YELLOW}Copying configuration files...${NC}"
rsync -avz crm.conf setup-db-permissions.sql server-setup.sh $SERVER_USER@$SERVER_IP:$SERVER_DIR/

# 5. Make scripts executable
echo -e "${YELLOW}Making scripts executable...${NC}"
ssh $SERVER_USER@$SERVER_IP "chmod +x $SERVER_DIR/server-setup.sh"

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "Now SSH into your server and run the setup script:"
echo -e "${YELLOW}ssh $SERVER_USER@$SERVER_IP${NC}"
echo -e "${YELLOW}cd $SERVER_DIR${NC}"
echo -e "${YELLOW}./server-setup.sh${NC}"