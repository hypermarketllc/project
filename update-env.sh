#!/bin/bash
# Script to update the .env file with the correct values

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
ENV_FILE=".env.production"

echo -e "${GREEN}Updating .env file...${NC}"

# Check if .env.production exists
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}Creating $ENV_FILE file...${NC}"
  touch "$ENV_FILE"
fi

# Prompt for database credentials
read -p "Enter PostgreSQL host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Enter PostgreSQL port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Enter PostgreSQL database name (default: crm_db): " DB_NAME
DB_NAME=${DB_NAME:-crm_db}

read -p "Enter PostgreSQL username (default: crm_user): " DB_USER
DB_USER=${DB_USER:-crm_user}

read -sp "Enter PostgreSQL password: " DB_PASSWORD
echo

read -p "Enter JWT secret key (default: your-secret-key-here): " JWT_SECRET
JWT_SECRET=${JWT_SECRET:-your-secret-key-here}

read -p "Enter server port (default: 3000): " PORT
PORT=${PORT:-3000}

# Update .env.production file
echo -e "${YELLOW}Updating $ENV_FILE file...${NC}"

cat > "$ENV_FILE" << EOF
# Production environment variables
NODE_ENV=production
BASE_URL=https://coveredamerican.com/crm

# Database connection
POSTGRES_HOST=$DB_HOST
POSTGRES_PORT=$DB_PORT
POSTGRES_DB=$DB_NAME
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASSWORD

# Authentication
JWT_SECRET=$JWT_SECRET

# Server settings
PORT=$PORT
EOF

echo -e "${GREEN}$ENV_FILE file updated successfully!${NC}"