# Linkiz Backend - Node.js Media Converter

Node.js backend for the Linkiz platform, providing YouTube to MP3/MP4 conversion with Supabase integration.

## Features

- ✅ YouTube video to MP3 320kbps conversion
- ✅ YouTube video to MP4 HD (1080p) conversion
- ✅ YouTube video to MP4 SD (720p) conversion
- ✅ Supabase Storage integration for file hosting
- ✅ JWT authentication with Supabase Auth
- ✅ Download quota management
- ✅ Rate limiting to prevent abuse
- ✅ Automatic file cleanup

## Prerequisites

- Node.js 20.x or higher
- FFmpeg installed and added to PATH
- Supabase project with storage buckets configured

## Installation

1. Install dependencies:
```bash
cd backend
npm install
```

2. Install FFmpeg:
   - **Windows**: Download from https://www.gyan.dev/ffmpeg/builds/ and add to PATH
   - **macOS**: `brew install ffmpeg`
   - **Linux**: `sudo apt-get install ffmpeg`

3. Create `.env` file (copy from `.env.example`):
```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

4. Ensure storage buckets exist in Supabase:
   - `conversions` - For converted files (500MB limit)
   - `user-files` - For user uploads (100MB limit)

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will start on port 3000 (or PORT from .env).

## API Endpoints

### POST /api/convert
Convert YouTube video to specified format.

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=...",
  "format": "mp3-320" | "mp4-hd" | "mp4-sd",
  "userId": "optional-user-id"
}
```

**Headers:**
```
Authorization: Bearer <supabase-jwt-token>  (optional)
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "downloadUrl": "https://...signed-url",
  "filename": "Video_Title_320kbps.mp3",
  "fileSize": "5.24 MB",
  "duration": "3:24",
  "videoInfo": {
    "title": "Video Title",
    "author": "Channel Name",
    "thumbnail": "https://..."
  }
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-10T12:00:00Z",
  "uptime": 12345
}
```

## Project Structure

```
backend/
├── src/
│   ├── routes/
│   │   └── converter.js       # Main conversion endpoint
│   ├── services/
│   │   ├── youtubeService.js  # YouTube download logic
│   │   ├── ffmpegService.js   # FFmpeg conversion
│   │   └── storageService.js  # Supabase Storage
│   ├── middleware/
│   │   ├── auth.js            # JWT verification
│   │   └── quota.js           # Quota checking
│   ├── utils/
│   │   └── supabase.js        # Supabase client
│   └── server.js              # Express server
├── temp/                      # Temporary conversion files
├── .env                       # Environment variables (gitignored)
├── .env.example               # Example env file
└── package.json
```

## Conversion Flow

1. **Receive Request** → Validate URL and format
2. **Download Video** → Use ytdl-core to download from YouTube
3. **Convert Format** → Use FFmpeg for MP3/MP4 conversion
4. **Upload to Storage** → Store in Supabase Storage
5. **Generate URL** → Create signed URL (24h expiry)
6. **Cleanup** → Delete temporary local files
7. **Update Quota** → Increment user download counter (if authenticated)
8. **Return Response** → Send download URL to frontend

## Error Handling

The API returns standardized error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

**Error Codes:**
- `MISSING_PARAMETERS` - Missing required fields
- `INVALID_URL` - Invalid or unsupported URL
- `INVALID_FORMAT` - Invalid format parameter
- `QUOTA_EXCEEDED` - User has no remaining downloads
- `CONVERSION_FAILED` - Conversion process failed
- `SERVER_ERROR` - Internal server error

## Rate Limiting

- **10 requests per 15 minutes** per IP address
- Applied to all `/api/*` routes
- Returns 429 status when exceeded

## Security

- CORS configured to allow only frontend origin
- JWT token verification for authenticated requests
- Signed URLs with 24-hour expiry
- File size limits (500MB for conversions)
- Input sanitization and validation
- Service role authentication for storage operations

## Deployment

### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Render
1. Create new Web Service
2. Connect GitHub repository
3. Set build command: `cd backend && npm install`
4. Set start command: `cd backend && npm start`
5. Add environment variables

### VPS (Ubuntu)
```bash
# Install Node.js and FFmpeg
sudo apt update
sudo apt install nodejs npm ffmpeg

# Clone and setup
git clone <repo>
cd backend
npm install

# Use PM2 for process management
npm install -g pm2
pm2 start src/server.js --name linkiz-backend
pm2 startup
pm2 save
```

## Testing

Test the API with curl:

```bash
# Health check
curl http://localhost:4004/health

# Convert video
curl -X POST http://localhost:4004/api/convert \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "format": "mp3-320"
  }'
```

## Troubleshooting

**FFmpeg not found:**
- Verify installation: `ffmpeg -version`
- Check PATH includes FFmpeg bin directory
- Restart terminal after adding to PATH

**Storage upload fails:**
- Check Supabase service role key is correct
- Verify storage buckets exist
- Check bucket permissions (RLS policies)

**Download fails:**
- Check internet connection
- Verify YouTube URL is accessible
- Some videos may be region-restricted

**High memory usage:**
- Ensure temp files are being cleaned up
- Check `temp/` directory is empty after conversions
- Reduce concurrent conversion requests

## License

ISC
