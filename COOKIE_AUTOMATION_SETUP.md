# YouTube Cookie Automation Setup Guide

This document explains how to set up and use the automated YouTube cookie refresh system for the Linkiz backend.

## Overview

The cookie automation system automatically:
- Logs into Google/YouTube using headless Chrome
- Exports fresh cookies every 24 hours (via cron job)
- Supports multiple Google accounts with automatic rotation
- Validates cookies before saving
- Creates debug screenshots on failures

## Prerequisites

- **Node.js 18+** (recommended: 22.x)
- **Ubuntu 24.04** (or compatible Linux)
- **Chromium browser** installed on the server

### Install Chromium on Ubuntu

```bash
sudo apt update
sudo apt install -y chromium-browser

# Verify installation
chromium-browser --version
```

## Installation

### 1. Install Dependencies

From the `backend/` directory:

```bash
npm install
```

This will install the required packages:
- `puppeteer` - Headless Chrome automation
- `puppeteer-extra` - Puppeteer with plugins support
- `puppeteer-extra-plugin-stealth` - Stealth mode to avoid bot detection

### 2. Configure Google Accounts

```bash
# Copy the example config
cp config/accounts.json.example config/accounts.json

# Edit with your credentials
nano config/accounts.json
```

**Example configuration:**

```json
{
  "accounts": [
    {
      "email": "your-dedicated-account@gmail.com",
      "password": "your-password",
      "enabled": true
    },
    {
      "email": "backup-account@gmail.com",
      "password": "backup-password",
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

### 3. Prepare Google Accounts

**IMPORTANT: Use dedicated Google accounts, NOT your personal account!**

For each account:

1. **Create a new Google account** (recommended) or use a throwaway account
2. **Disable 2-Step Verification** in Google Account settings
   - Go to: https://myaccount.google.com/security
   - Turn off 2-Step Verification
3. **Enable "Less secure app access"** (if required)
   - This may be needed for some accounts
4. **Accept YouTube Terms of Service**
   - Manually sign into YouTube once and accept any terms

### 4. Make Scripts Executable

```bash
chmod +x scripts/refresh-cookies.sh
chmod +x scripts/refresh-cookies.js
chmod +x scripts/test-cookies.js
```

## Usage

### Manual Cookie Refresh

```bash
# Run the cookie refresh script
node scripts/refresh-cookies.js

# Test if cookies are valid
node scripts/test-cookies.js
```

### Automated Cron Job

Set up a cron job to run the cookie refresh daily:

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 3 AM)
0 3 * * * /path/to/linkiz-music/backend/scripts/refresh-cookies.sh >> /path/to/linkiz-music/backend/logs/cron.log 2>&1
```

**Example with absolute path:**

```bash
0 3 * * * /root/linkiz-music-BE/scripts/refresh-cookies.sh >> /root/linkiz-music-BE/logs/cron.log 2>&1
```

### Verify Cron Job

```bash
# List current cron jobs
crontab -l

# Check cron service status
systemctl status cron
```

## File Structure

```
backend/
├── scripts/
│   ├── refresh-cookies.js    # Main automation script
│   ├── refresh-cookies.sh    # Bash wrapper for cron
│   └── test-cookies.js       # Cookie validation script
├── config/
│   ├── accounts.json         # Your credentials (gitignored)
│   └── accounts.json.example # Template file
├── logs/
│   ├── cookie-refresh.log    # Refresh operation logs
│   └── cron.log              # Cron job logs
├── screenshots/              # Debug screenshots on failures
├── cookies.json              # Output: cookies for yt-dlp
└── cookies.txt               # Generated: Netscape format
```

## Monitoring

### Check Logs

```bash
# View recent cookie refresh logs
tail -50 logs/cookie-refresh.log

# View cron job logs
tail -50 logs/cron.log

# Follow logs in real-time
tail -f logs/cookie-refresh.log
```

### Check Cookie Validity

```bash
# Run the validation test
node scripts/test-cookies.js
```

**Expected output for valid cookies:**

```
[2026-01-20 03:00:25] ============================================================
[2026-01-20 03:00:25] YouTube Cookie Validation Test
[2026-01-20 03:00:25] ============================================================

[2026-01-20 03:00:25] Checking cookies.json file...
[2026-01-20 03:00:25] Found 45 cookies in file
[2026-01-20 03:00:25] TEST PASSED: cookies.json file exists and is valid JSON

[2026-01-20 03:00:25] Checking for essential YouTube cookies...
[2026-01-20 03:00:25] Essential cookies found: 6/6
[2026-01-20 03:00:25] TEST PASSED: Essential cookies present

[2026-01-20 03:00:25] TEST PASSED: Cookies not expired
[2026-01-20 03:00:25] TEST PASSED: cookies.txt generated
[2026-01-20 03:00:30] TEST PASSED: yt-dlp live test

[2026-01-20 03:00:30] ALL TESTS PASSED - Cookies are valid!
```

## Troubleshooting

### Login Fails Immediately

**Symptom:** Script exits quickly with "Login failed"

**Solutions:**
1. Check screenshots in `screenshots/` folder for visual debugging
2. Verify credentials in `config/accounts.json`
3. Manually log into the account via browser to check for:
   - Account lockouts
   - Security prompts
   - Terms of service updates

### CAPTCHA Detected

**Symptom:** Screenshot shows CAPTCHA challenge

**Solutions:**
1. Manually log into the Google account from your IP address
2. Wait 24-48 hours for Google to "trust" the IP
3. Try a different Google account
4. Consider using a residential IP or VPN

### 2FA Required

**Symptom:** Screenshot shows 2-Step Verification prompt

**Solutions:**
1. Disable 2FA on the Google account:
   - https://myaccount.google.com/security
2. Use an App Password instead:
   - https://myaccount.google.com/apppasswords
   - Generate a password for "Mail" or "Other"
   - Use this app password in accounts.json

### "Wrong Password" Error

**Symptom:** Log shows "Wrong password for account@gmail.com"

**Solutions:**
1. Verify the password is correct
2. Check for special characters that may need escaping in JSON
3. Try logging in manually to verify credentials

### Bot Detection / Rate Limiting

**Symptom:** "YouTube bot detection triggered" errors

**Solutions:**
1. Wait a few hours before trying again
2. Rotate to a different account
3. Reduce frequency of cookie refreshes (once per day is sufficient)
4. Ensure the stealth plugin is working (check puppeteer-extra installation)

### Cookies Expire Quickly

**Symptom:** Cookies become invalid within hours

**Solutions:**
1. Check that `expirationDate` values are being set correctly
2. Verify the account isn't being logged out by Google
3. Check for multiple sessions issue (Google may log out other sessions)

## Security Best Practices

1. **Never commit credentials** - `accounts.json` is gitignored
2. **Use dedicated accounts** - Don't use personal Google accounts
3. **Secure file permissions**:
   ```bash
   chmod 600 config/accounts.json
   chmod 600 cookies.json
   ```
4. **Rotate accounts** - Enable multiple accounts for failover
5. **Monitor logs** - Check for unauthorized access attempts

## Account Rotation

The system supports multiple accounts with automatic failover:

```json
{
  "accounts": [
    { "email": "primary@gmail.com", "password": "...", "enabled": true },
    { "email": "backup1@gmail.com", "password": "...", "enabled": true },
    { "email": "backup2@gmail.com", "password": "...", "enabled": true }
  ],
  "rotation": {
    "strategy": "sequential",
    "failover": true,
    "maxRetries": 3
  }
}
```

**How it works:**
1. Script tries the first enabled account
2. If login fails after 3 retries, moves to next account
3. Continues until successful login or all accounts exhausted

## Testing the System

### Quick Test

```bash
# 1. Manually run the refresh
node scripts/refresh-cookies.js

# 2. Validate the cookies
node scripts/test-cookies.js

# 3. Test with yt-dlp directly
yt-dlp --cookies cookies.txt --dump-single-json "https://www.youtube.com/watch?v=jNQXAC9IVRw"
```

### Full Integration Test

```bash
# Test the full cron workflow
./scripts/refresh-cookies.sh

# Check the logs
cat logs/cron.log
```

## Support

If you encounter issues:

1. Check the logs in `logs/` directory
2. Review screenshots in `screenshots/` directory
3. Verify account settings in Google Account dashboard
4. Ensure Chromium is properly installed

For persistent issues, the system will continue to work with existing cookies until they expire, giving you time to troubleshoot.
