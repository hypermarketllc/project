#!/bin/bash
# Script to check the migration status

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

echo -e "${GREEN}Checking migration status...${NC}"

# 1. Check if the server is reachable
echo -e "${YELLOW}Checking server connectivity...${NC}"
if ssh -q $SERVER_USER@$SERVER_IP exit; then
  echo -e "${GREEN}Server is reachable.${NC}"
else
  echo -e "${RED}Server is not reachable. Please check your connection.${NC}"
  exit 1
fi

# 2. Check if PostgreSQL is running
echo -e "${YELLOW}Checking PostgreSQL status...${NC}"
ssh $SERVER_USER@$SERVER_IP "sudo systemctl status postgresql | grep 'active (running)'" || {
  echo -e "${RED}PostgreSQL is not running. Please start it with: sudo systemctl start postgresql${NC}"
  exit 1
}
echo -e "${GREEN}PostgreSQL is running.${NC}"

# 3. Check if the database exists
echo -e "${YELLOW}Checking if the database exists...${NC}"
ssh $SERVER_USER@$SERVER_IP "sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw crm_db" || {
  echo -e "${RED}Database 'crm_db' does not exist. Please create it.${NC}"
  exit 1
}
echo -e "${GREEN}Database 'crm_db' exists.${NC}"

# 4. Check if the application directory exists
echo -e "${YELLOW}Checking if the application directory exists...${NC}"
ssh $SERVER_USER@$SERVER_IP "[ -d $SERVER_DIR ]" || {
  echo -e "${RED}Application directory '$SERVER_DIR' does not exist. Please create it.${NC}"
  exit 1
}
echo -e "${GREEN}Application directory '$SERVER_DIR' exists.${NC}"

# 5. Check if the application is running
echo -e "${YELLOW}Checking if the application is running...${NC}"
ssh $SERVER_USER@$SERVER_IP "pm2 list | grep -q crm" || {
  echo -e "${RED}Application is not running. Please start it with: pm2 start npm --name \"crm\" -- start${NC}"
  exit 1
}
echo -e "${GREEN}Application is running.${NC}"

# 6. Check if Nginx is running
echo -e "${YELLOW}Checking Nginx status...${NC}"
ssh $SERVER_USER@$SERVER_IP "sudo systemctl status nginx | grep 'active (running)'" || {
  echo -e "${RED}Nginx is not running. Please start it with: sudo systemctl start nginx${NC}"
  exit 1
}
echo -e "${GREEN}Nginx is running.${NC}"

# 7. Check if the Nginx configuration is valid
echo -e "${YELLOW}Checking Nginx configuration...${NC}"
ssh $SERVER_USER@$SERVER_IP "sudo nginx -t" || {
  echo -e "${RED}Nginx configuration is invalid. Please check the configuration.${NC}"
  exit 1
}
echo -e "${GREEN}Nginx configuration is valid.${NC}"

# 8. Check if the application is accessible
echo -e "${YELLOW}Checking if the application is accessible...${NC}"
curl -s -o /dev/null -w "%{http_code}" https://coveredamerican.com/crm | grep -q "200" || {
  echo -e "${RED}Application is not accessible. Please check the Nginx configuration and the application logs.${NC}"
  exit 1
}
echo -e "${GREEN}Application is accessible.${NC}"

# 9. Check application logs
echo -e "${YELLOW}Checking application logs...${NC}"
ssh $SERVER_USER@$SERVER_IP "pm2 logs crm --lines 10" || {
  echo -e "${RED}Failed to retrieve application logs.${NC}"
  exit 1
}

# 10. Check Nginx logs
echo -e "${YELLOW}Checking Nginx logs...${NC}"
ssh $SERVER_USER@$SERVER_IP "sudo tail -n 10 /var/log/nginx/crm-error.log" || {
  echo -e "${RED}Failed to retrieve Nginx error logs.${NC}"
  exit 1
}

echo -e "${GREEN}Migration status check completed successfully!${NC}"
echo -e "Your CRM application is available at: ${GREEN}https://coveredamerican.com/crm${NC}"