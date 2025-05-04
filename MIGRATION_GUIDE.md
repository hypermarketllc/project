# Migration Guide: Supabase to Self-Hosted PostgreSQL

This guide provides step-by-step instructions for migrating your CRM application from Supabase to a self-hosted PostgreSQL database on your Linux server.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Setup](#local-setup)
3. [Database Migration](#database-migration)
4. [Application Configuration](#application-configuration)
5. [Server Setup](#server-setup)
6. [Deployment](#deployment)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting the migration, ensure you have the following:

- Access to your Supabase project
- SSH access to your Linux server (66-63-187-50)
- Node.js and npm installed on your local machine
- PostgreSQL installed on your server

## Local Setup

1. Install required dependencies:

```bash
npm install pg @types/pg
```

2. Update the base path for your application:

```bash
node update-base-path.js
```

This script will:
- Update the Vite configuration to use `/crm` as the base path
- Update the router configuration
- Create a `.env.production` file with the necessary environment variables

3. Build your application:

```bash
npm run build
```

## Database Migration

### 1. Export Data from Supabase

Run the export script to extract data from your Supabase project:

```bash
node export-supabase-data.js
```

This will create a `supabase-export` directory containing:
- JSON files with data from each table
- SQL scripts for creating tables and inserting data

### 2. Set Up PostgreSQL on Your Server

SSH into your server and set up PostgreSQL:

```bash
# Connect to your server
ssh root@66-63-187-50

# Install PostgreSQL if not already installed
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start and enable PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create a database and user for your application
sudo -u postgres psql
```

In the PostgreSQL prompt:
```sql
CREATE DATABASE crm_db;
CREATE USER crm_user WITH ENCRYPTED PASSWORD 'your_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE crm_db TO crm_user;
\q
```

### 3. Import Data to PostgreSQL

Copy the export files to your server and import them:

```bash
# Copy the export files to your server
scp -r supabase-export root@66-63-187-50:/tmp/

# SSH into your server
ssh root@66-63-187-50

# Import the data
cd /tmp
node import-to-postgres.js
```

## Application Configuration

### 1. Update Database Connection

Replace the Supabase client with direct PostgreSQL connection:

1. The `src/lib/postgres.ts` file has been created to replace Supabase
2. Update your application to use this new database connection

### 2. Update Authentication

Since you'll lose Supabase's auth system, you'll need to implement your own:

1. Create a JWT-based authentication system
2. Update login and registration components
3. Update protected routes

## Server Setup

### 1. Set Up Application Directory

```bash
# Create application directory
sudo mkdir -p /opt/apps/crm
sudo chown -R $USER:$USER /opt/apps/crm
```

### 2. Configure Nginx

Add the CRM location to your Nginx configuration:

1. Copy the `nginx-crm.conf` file to your server
2. Include it in your main Nginx configuration

```bash
# Copy the configuration file
scp nginx-crm.conf root@66-63-187-50:/etc/nginx/sites-available/

# Create a symlink
ssh root@66-63-187-50 "ln -s /etc/nginx/sites-available/nginx-crm.conf /etc/nginx/sites-enabled/"

# Test and reload Nginx
ssh root@66-63-187-50 "nginx -t && systemctl reload nginx"
```

## Deployment

Use the deployment script to deploy your application:

```bash
# Make the script executable
chmod +x deploy-to-server.sh

# Run the deployment script
./deploy-to-server.sh
```

This script will:
1. Build your application if needed
2. Copy the build files to your server
3. Set up the application on your server
4. Configure Nginx
5. Start the application with PM2

## Verification

After deployment, verify that your application is working correctly:

1. Visit https://coveredamerican.com/crm in your browser
2. Test login functionality
3. Test database operations
4. Check that all features are working as expected

## Troubleshooting

### Database Connection Issues

If you encounter database connection issues:

1. Check the PostgreSQL logs:
```bash
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

2. Verify that PostgreSQL is running:
```bash
sudo systemctl status postgresql
```

3. Check that the database user has the correct permissions:
```bash
sudo -u postgres psql -c "\du"
```

### Application Errors

If the application is not working correctly:

1. Check the PM2 logs:
```bash
pm2 logs crm
```

2. Check the Nginx error logs:
```bash
sudo tail -f /var/log/nginx/crm-error.log
```

3. Verify that the application is running:
```bash
pm2 status
```

### Nginx Configuration Issues

If you encounter Nginx configuration issues:

1. Check the Nginx configuration:
```bash
sudo nginx -t
```

2. Check the Nginx error logs:
```bash
sudo tail -f /var/log/nginx/error.log
```

3. Verify that the Nginx service is running:
```bash
sudo systemctl status nginx
```

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)