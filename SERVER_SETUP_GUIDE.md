# 🚀 Production Server Setup Guide

Complete guide for deploying the YouTube cookie automation system on your Ubuntu server.

---

## 📋 Prerequisites

- **Ubuntu 24.04 LTS** (or compatible)
- **Node.js 22.x** installed
- **Root or sudo access**
- **Chromium browser** for headless automation
- **SSH access** to your server

---

## 🔧 Part 1: Initial Server Setup

### 1. Install Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22.x (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v22.x.x
npm --version

# Install Chromium for headless browser automation
sudo apt install -y chromium-browser

# Verify Chromium installation
chromium-browser --version
```

### 2. Install Additional Dependencies

```bash
# Install dependencies for Puppeteer
sudo apt install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  wget \
  xdg-utils
```

---

## 📦 Part 2: Deploy Your Application

### 1. Upload Your Code

```bash
# On your local machine
cd /path/to/linkiz-music
rsync -avz --exclude 'node_modules' --exclude '.git' backend/ user@your-server:/var/www/linkiz-backend/

# OR using SCP
scp -r backend/ user@your-server:/var/www/linkiz-backend/
```

### 2. Install Dependencies on Server

```bash
# SSH into your server
ssh user@your-server

# Navigate to project directory
cd /var/www/linkiz-backend

# Install npm packages
npm install

# This will install:
# - puppeteer (headless Chrome automation)
# - puppeteer-extra & stealth plugin
# - All existing dependencies
```

### 3. Configure Accounts

```bash
# Create accounts.json from template
cp config/accounts.json.example config/accounts.json

# Edit with your Google credentials
nano config/accounts.json
```

**Important:** Use **dedicated throwaway Google accounts**, not your personal accounts!

```json
{
  "accounts": [
    {
      "email": "linkiz-bot-1@gmail.com",
      "password": "YourSecurePassword123",
      "enabled": true
    },
    {
      "email": "linkiz-bot-2@gmail.com",
      "password": "BackupPassword456",
      "enabled": true
    }
  ],
  "rotation": {
    "strategy": "sequential",
    "failover": true,
    "maxRetries": 3
  }
}
```

### 4. Secure File Permissions

```bash
# Restrict access to sensitive files
chmod 600 config/accounts.json
chmod 600 .env

# Make scripts executable
chmod +x scripts/refresh-cookies.sh
chmod +x scripts/refresh-cookies.js
chmod +x scripts/test-cookies.js
```

---

## ⏰ Part 3: Setup Automated Cookie Refresh

### 1. Test Manual Execution First

```bash
# Test cookie refresh manually
node scripts/refresh-cookies.js

# Expected output:
# ✅ Login successful for linkiz-bot-1@gmail.com
# ✅ Cookies saved to: cookies.json
# ✅ Cookie refresh completed successfully!

# Verify cookies work
node scripts/test-cookies.js
```

### 2. Setup Cron Job for Daily Refresh

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 3:00 AM server time)
0 3 * * * /var/www/linkiz-backend/scripts/refresh-cookies.sh >> /var/www/linkiz-backend/logs/cron.log 2>&1
```

**Cron Schedule Options:**

```bash
# Every 6 hours
0 */6 * * * /path/to/refresh-cookies.sh

# Daily at 3 AM
0 3 * * * /path/to/refresh-cookies.sh

# Twice daily (3 AM and 3 PM)
0 3,15 * * * /path/to/refresh-cookies.sh

# Every Sunday at midnight
0 0 * * 0 /path/to/refresh-cookies.sh
```

### 3. Verify Cron Job is Active

```bash
# List all cron jobs
crontab -l

# Check cron service status
sudo systemctl status cron

# Manually trigger cron job for testing
/var/www/linkiz-backend/scripts/refresh-cookies.sh
```

---

## 📊 Part 4: Monitoring & Maintenance

### 1. Check Logs

```bash
# View cookie refresh logs
tail -50 /var/www/linkiz-backend/logs/cookie-refresh.log

# Follow logs in real-time
tail -f /var/www/linkiz-backend/logs/cookie-refresh.log

# View cron job logs
tail -50 /var/www/linkiz-backend/logs/cron.log

# Check for errors
grep ERROR /var/www/linkiz-backend/logs/*.log
```

### 2. Monitor Cookie Status

```bash
# Check when cookies were last refreshed
ls -lh /var/www/linkiz-backend/cookies.json

# Validate current cookies
node /var/www/linkiz-backend/scripts/test-cookies.js

# Check cookie expiration dates
grep -A 2 "expirationDate" /var/www/linkiz-backend/cookies.json | head -20
```

### 3. Check Disk Space

```bash
# Check temp folder size
du -sh /var/www/linkiz-backend/temp

# Clean old cached files (older than 7 days)
find /var/www/linkiz-backend/temp -name "*.mp4" -mtime +7 -delete
find /var/www/linkiz-backend/temp -name "*.m4a" -mtime +7 -delete

# Check log file sizes
du -sh /var/www/linkiz-backend/logs/*.log

# Rotate old logs (keep last 10MB)
tail -c 10M /var/www/linkiz-backend/logs/cookie-refresh.log > temp.log && mv temp.log /var/www/linkiz-backend/logs/cookie-refresh.log
```

---

## 🔄 How The Cookie System Works

### Automated Flow

```
┌─────────────────────────────────────────┐
│  3:00 AM Daily (Cron Trigger)          │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  refresh-cookies.sh (Bash wrapper)     │
│  - Navigates to project directory       │
│  - Logs execution time                  │
│  - Calls Node.js script                 │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  refresh-cookies.js (Main script)      │
│  1. Reads config/accounts.json          │
│  2. Launches headless Chrome            │
│  3. Navigates to YouTube                │
│  4. Auto-logs in with Google account    │
│  5. Extracts cookies from browser       │
│  6. Saves to cookies.json               │
│  7. Creates backup of old cookies       │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  cookies.json (Updated daily)           │
│  - Contains fresh session cookies       │
│  - Valid for ~400 days                  │
│  - Used by yt-dlp for downloads         │
└─────────────────────────────────────────┘
```

### Request Flow (When User Downloads)

```
User Request → Backend API
                    │
                    ▼
            Download WITHOUT cookies (1st attempt)
                    │
                    ├─→ Success? → Return file ✅
                    │
                    ▼
            Fail (age-restricted)?
                    │
                    ▼
            Retry WITH cookies (2nd attempt)
                    │
                    ├─→ Success? → Return file ✅
                    │
                    ▼
            Fail → Return error ❌
```

---

## 🔢 Frequency & Resource Usage

### Cookie Refresh Schedule

| Frequency | Recommended For | Command |
|-----------|----------------|---------|
| **Daily (3 AM)** | ✅ **Recommended** - Optimal balance | `0 3 * * *` |
| Every 6 hours | High-traffic production | `0 */6 * * *` |
| Twice daily | Medium traffic | `0 3,15 * * *` |
| Weekly | Low-traffic / backup | `0 3 * * 0` |

**Our Recommendation: Daily at 3 AM**
- Cookies stay fresh
- Low server load time
- Plenty of time before peak hours

### Resource Usage

**Per Cookie Refresh:**
- **CPU**: 10-30 seconds of moderate usage
- **RAM**: ~200-500 MB (Chromium browser)
- **Network**: ~5-10 MB (page loads)
- **Disk**: ~100 KB (cookies.json)
- **Duration**: 30-60 seconds total

**Estimated Monthly:**
- **Storage**: <5 MB (cookies + logs)
- **Bandwidth**: <500 MB (daily refreshes)
- **CPU time**: <30 minutes total

**Impact on Server: MINIMAL** ✅

---

## 🛡️ Security Best Practices

### 1. File Permissions

```bash
# Sensitive files should be readable only by owner
chmod 600 config/accounts.json
chmod 600 cookies.json
chmod 600 .env

# Scripts should be executable
chmod 700 scripts/*.sh
chmod 700 scripts/*.js

# Logs directory
chmod 755 logs/
chmod 644 logs/*.log
```

### 2. Firewall Configuration

```bash
# Only allow necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3000/tcp  # Your backend port
sudo ufw enable
```

### 3. Environment Variables

```bash
# Store sensitive data in .env
# Never commit this file to git!

# Example .env
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://linkiz.app
```

### 4. Regular Updates

```bash
# Update system packages monthly
sudo apt update && sudo apt upgrade -y

# Update npm packages quarterly
cd /var/www/linkiz-backend
npm update

# Check for security vulnerabilities
npm audit
npm audit fix
```

---

## 🚨 Troubleshooting

### Issue 1: Cron Job Not Running

```bash
# Check if cron service is running
sudo systemctl status cron

# Start cron if stopped
sudo systemctl start cron

# Check cron logs
grep CRON /var/log/syslog
```

### Issue 2: CAPTCHA or Login Failures

**Symptoms:**
- Screenshot shows CAPTCHA
- "Account verification required" in logs

**Solutions:**
1. Manually log into the Google account from the server's IP
2. Wait 24-48 hours for IP to be "trusted"
3. Use a different Google account
4. Disable 2FA on the account

### Issue 3: Puppeteer/Chrome Not Found

```bash
# Install Chromium if missing
sudo apt install -y chromium-browser

# Set environment variable if needed
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### Issue 4: Permission Denied

```bash
# Fix ownership
sudo chown -R www-data:www-data /var/www/linkiz-backend

# Fix permissions
chmod +x scripts/*.sh
chmod 600 config/accounts.json
```

### Issue 5: Out of Disk Space

```bash
# Check disk usage
df -h

# Clean temp files
cd /var/www/linkiz-backend
find temp/ -type f -mtime +7 -delete

# Clean old logs
find logs/ -name "*.log" -size +50M -delete

# Clean old cookie backups
find . -name "cookies.backup_*" -mtime +30 -delete
```

---

## 📝 Maintenance Checklist

### Daily (Automated)
- ✅ Cookie refresh runs via cron at 3 AM
- ✅ Logs are written to logs/cookie-refresh.log

### Weekly (Manual - 5 minutes)
```bash
# Check logs for errors
grep ERROR logs/cookie-refresh.log

# Verify cookies are valid
node scripts/test-cookies.js

# Check disk space
df -h | grep var
```

### Monthly (Manual - 15 minutes)
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update npm packages
npm update

# Clean old files
find temp/ -mtime +30 -delete
find screenshots/ -mtime +60 -delete

# Rotate large logs
ls -lh logs/*.log
```

### Quarterly (Manual - 30 minutes)
```bash
# Review and update Google account passwords
# Check for npm security vulnerabilities
npm audit

# Update Node.js if needed
node --version  # Check current version

# Review cron job timing
crontab -l
```

---

## 🎯 Quick Commands Reference

```bash
# Manual cookie refresh
node scripts/refresh-cookies.js

# Test cookies
node scripts/test-cookies.js

# Check logs
tail -50 logs/cookie-refresh.log

# View cron jobs
crontab -l

# Edit cron jobs
crontab -e

# Test bash wrapper
./scripts/refresh-cookies.sh

# Check when cookies were last updated
ls -lh cookies.json

# Monitor real-time logs
tail -f logs/cookie-refresh.log

# Restart your backend service (example with pm2)
pm2 restart linkiz-backend
```

---

## 💡 Pro Tips

1. **Use PM2 for process management:**
```bash
npm install -g pm2
pm2 start src/server.js --name linkiz-backend
pm2 save
pm2 startup
```

2. **Set up log rotation:**
```bash
sudo apt install logrotate
# Create config for your logs
```

3. **Monitor with email alerts:**
```bash
# Add to crontab
MAILTO=your-email@example.com
0 3 * * * /path/to/refresh-cookies.sh
```

4. **Use systemd for more control:**
Create `/etc/systemd/system/cookie-refresh.service`

---

## ✅ Success Indicators

Your system is working correctly if:

1. ✅ Cron job runs daily (check `logs/cron.log`)
2. ✅ `cookies.json` is updated daily
3. ✅ No errors in `logs/cookie-refresh.log`
4. ✅ YouTube downloads work in your API
5. ✅ `node scripts/test-cookies.js` passes all tests
6. ✅ Disk space stays under control

---

## 📞 Need Help?

Check logs first:
```bash
tail -100 logs/cookie-refresh.log
tail -100 logs/cron.log
grep ERROR logs/*.log
```

Common issues are usually:
- CAPTCHA (wait 24-48 hours)
- 2FA enabled (disable or use app password)
- Wrong credentials (check accounts.json)
- Permissions (chmod 600 sensitive files)

---

**Last Updated:** January 2026
**Version:** 1.0
**System:** Ubuntu 24.04 LTS + Node.js 22.x
