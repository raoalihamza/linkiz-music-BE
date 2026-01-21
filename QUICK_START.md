# ⚡ Quick Start - Cookie Automation

## 🚀 On Your Production Server (Ubuntu 24.04)

### 1. One-Time Setup (10 minutes)

```bash
# Install Chromium
sudo apt update
sudo apt install -y chromium-browser

# Upload your code
cd /var/www/linkiz-backend

# Install dependencies
npm install

# Configure accounts
cp config/accounts.json.example config/accounts.json
nano config/accounts.json  # Add your Google credentials

# Secure files
chmod 600 config/accounts.json
chmod +x scripts/*.sh

# Test it works
node scripts/refresh-cookies.js
node scripts/test-cookies.js
```

### 2. Setup Auto-Refresh (2 minutes)

```bash
# Add cron job (runs daily at 3 AM)
crontab -e

# Add this line:
0 3 * * * /var/www/linkiz-backend/scripts/refresh-cookies.sh >> /var/www/linkiz-backend/logs/cron.log 2>&1

# Save and exit
```

### 3. Verify It's Working

```bash
# Check cron is active
crontab -l

# Force run once to test
./scripts/refresh-cookies.sh

# Check the result
tail -20 logs/cookie-refresh.log
```

**Done! ✅ Your cookies will refresh automatically every day at 3 AM.**

---

## 📊 How It Works

```
Every Day at 3:00 AM
    ↓
Cron triggers refresh-cookies.sh
    ↓
Script logs into Google/YouTube
    ↓
Exports fresh cookies
    ↓
Saves to cookies.json (with backup)
    ↓
Your API uses these cookies
```

**For YouTube:** Downloads work WITHOUT cookies (better success rate)
**Fallback:** If age-restricted video → Automatically retries WITH cookies

---

## 🔍 Monitoring

```bash
# Quick health check
tail -20 logs/cookie-refresh.log

# Test cookies
node scripts/test-cookies.js

# Check last refresh time
ls -lh cookies.json

# View cron log
tail -20 logs/cron.log
```

---

## 🎯 Resource Usage

- **Runs:** Daily at 3 AM
- **Duration:** ~30-60 seconds
- **CPU:** Light (only during refresh)
- **RAM:** ~200-500 MB (temporary, during refresh)
- **Disk:** <5 MB per month
- **Network:** ~5-10 MB per day

**Impact: MINIMAL** - Runs when traffic is lowest (3 AM)

---

## 🛠️ Common Commands

```bash
# Manual refresh
node scripts/refresh-cookies.js

# Test cookies
node scripts/test-cookies.js

# View logs
tail -50 logs/cookie-refresh.log
tail -50 logs/cron.log

# Check cron jobs
crontab -l

# Restart backend
pm2 restart linkiz-backend
```

---

## ⚠️ Quick Troubleshooting

**Issue:** Cron not running
```bash
sudo systemctl status cron
sudo systemctl start cron
```

**Issue:** Login fails
- Check credentials in `config/accounts.json`
- Disable 2FA on Google account
- Check `screenshots/` folder for visual debug

**Issue:** Permission denied
```bash
chmod 600 config/accounts.json
chmod +x scripts/*.sh
```

**Issue:** Out of disk space
```bash
find temp/ -mtime +7 -delete
```

---

## ✅ Success Checklist

- [ ] Chromium installed
- [ ] Dependencies installed (`npm install`)
- [ ] `config/accounts.json` created with real credentials
- [ ] Scripts are executable (`chmod +x`)
- [ ] Manual refresh works (`node scripts/refresh-cookies.js`)
- [ ] Cron job added (`crontab -l` shows the job)
- [ ] Test passed (`node scripts/test-cookies.js`)
- [ ] Backend restarted

---

**For detailed setup:** See `SERVER_SETUP_GUIDE.md`
**For troubleshooting:** See `COOKIE_AUTOMATION_SETUP.md`
