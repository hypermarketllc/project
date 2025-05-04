# CRM Deployment Instructions

This guide provides step-by-step instructions for deploying the CRM application on your Linux server.

## Files Included

1. **dist/** - Built application files
2. **simple-server.js** - Simple Express server to serve the application
3. **crm.conf** - Nginx configuration file
4. **setup-db-permissions.sql** - SQL script to set up database permissions
5. **server-setup.sh** - Script to automate server setup

## Deployment Steps

### 1. Copy Files to Server

```bash
# Create a directory for the files
ssh root@66.63.187.50 "mkdir -p /tmp/crm-deploy"

# Copy files to the server
scp -r dist simple-server.js crm.conf setup-db-permissions.sql server-setup.sh root@66.63.187.50:/tmp/crm-deploy/
```

### 2. Set Up the Server

SSH into your server and run the setup script:

```bash
ssh root@66.63.187.50

# Navigate to the deployment directory
cd /tmp/crm-deploy

# Make the setup script executable
chmod +x server-setup.sh

# Run the setup script
./server-setup.sh
```

### 3. Verify the Deployment

After the setup script completes, your CRM application should be available at:
https://coveredamerican.com/crm

You can check the status of the application with:

```bash
pm2 status
```

And view the logs with:

```bash
pm2 logs crm
```

## Manual Setup (If Automated Setup Fails)

If the automated setup script fails, you can follow these manual steps:

### 1. Install Required Packages

```bash
apt-get update
apt-get install -y nodejs npm nginx
npm install -g pm2
```

### 2. Set Up the Application

```bash
# Create application directory
mkdir -p /opt/apps/crm/dist

# Copy files
cp -r /tmp/crm-deploy/dist/* /opt/apps/crm/dist/
cp /tmp/crm-deploy/simple-server.js /opt/apps/crm/

# Install dependencies
cd /opt/apps/crm
npm install express pg
```

### 3. Set Up Nginx

```bash
# Copy Nginx configuration
cp /tmp/crm-deploy/crm.conf /etc/nginx/sites-available/

# Create a symlink
ln -sf /etc/nginx/sites-available/crm.conf /etc/nginx/sites-enabled/

# Test and reload Nginx
nginx -t && systemctl reload nginx
```

### 4. Set Up Database Permissions

```bash
# Apply database permissions
sudo -u postgres psql < /tmp/crm-deploy/setup-db-permissions.sql
```

### 5. Start the Application

```bash
# Start the application with PM2
cd /opt/apps/crm
pm2 start simple-server.js --name "crm"
pm2 save
pm2 startup
```

## Troubleshooting

If you encounter issues:

1. **Check Application Logs**:
   ```bash
   pm2 logs crm
   ```

2. **Check Database Connection**:
   ```bash
   cd /opt/apps/crm
   node -e "const { Pool } = require('pg'); const pool = new Pool({host: 'localhost', port: 5432, database: 'crm_db', user: 'crm_user', password: 'your_password_here'}); pool.query('SELECT NOW()', (err, res) => { console.log(err, res); pool.end(); });"
   ```

3. **Check Nginx Logs**:
   ```bash
   tail -f /var/log/nginx/error.log
   ```

4. **Verify Nginx Configuration**:
   ```bash
   nginx -t
   ```

5. **Restart the Application**:
   ```bash
   pm2 restart crm
   ```

## Additional Notes

- The application is configured to use PostgreSQL with the following default settings:
  - Host: localhost
  - Port: 5432
  - Database: crm_db
  - User: crm_user
  - Password: your_strong_password_here (update this in the .env file)

- A test user has been created with the following credentials:
  - Email: admin@example.com
  - Password: admin123