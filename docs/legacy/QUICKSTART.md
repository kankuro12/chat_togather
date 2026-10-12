# Quick Start Guide

## 🚀 Fast Setup (5 minutes)

### Step 1: Database Setup
1. Make sure MySQL is installed and running
2. Open MySQL command line or MySQL Workbench
3. Run this command:
   ```sql
   source E:/laravel pojects/ai/chat/server/db/schema.sql
   ```
   Or manually copy and paste the SQL from `server/db/schema.sql`

### Step 2: Configure Database
1. Open `server/.env` file
2. Update with your MySQL credentials:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=YOUR_PASSWORD
   DB_NAME=chat_app
   ```

### Step 3: Install Dependencies

**Option A - Use Setup Script:**
```bash
setup.bat
```

**Option B - Manual Installation:**
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Step 4: Run the Application

**Option A - Use Start Script:**
```bash
start.bat
```

**Option B - Manual Start:**

Open TWO terminal windows:

Terminal 1 (Server):
```bash
cd server
npm start
```

Terminal 2 (Client):
```bash
cd client
npm start
```

### Step 5: Use the App
1. Open browser to `http://localhost:3000`
2. Enter your username
3. Start chatting!

## 📝 Quick Test

1. Open `http://localhost:3000` in two different browser windows
2. Enter different usernames in each
3. Send messages between them
4. Try the voice recording feature (click 🎤 Record button)
5. Watch typing indicators appear
6. Check the Active Users sidebar

## 🔧 Troubleshooting

### "Cannot connect to database"
- Make sure MySQL is running
- Check credentials in `server/.env`
- Verify database `chat_app` exists

### "Port 3000 already in use"
- Stop the client: Press Ctrl+C in client terminal
- Or kill the process using port 3000

### "Port 3001 already in use"
- Stop the server: Press Ctrl+C in server terminal
- Or kill the process using port 3001

### Voice Recording Not Working
- Allow microphone permissions in browser
- Use a modern browser (Chrome, Firefox, Edge)

## 📊 Viewing Stored Data

All data is saved in MySQL. To view:

```sql
USE chat_app;

-- View all messages
SELECT * FROM messages ORDER BY created_at DESC;

-- View all users
SELECT * FROM users;

-- View voice recordings
SELECT * FROM voice_recordings;

-- View call logs
SELECT * FROM call_logs;
```

## 🎯 Features to Try

- [x] Real-time messaging
- [x] Typing indicators
- [x] Voice recording
- [x] Active users list
- [x] Message history
- [x] Timestamps

## 📱 Testing Voice Recording

1. Click the "🎤 Record" button
2. Speak your message
3. Click "⏹️ Stop" to finish
4. Recording will appear in chat for all users
5. Click play to listen

## 🔍 API Testing

You can test the REST API with curl or Postman:

```bash
# Get all messages
curl http://localhost:3001/api/messages

# Get voice recordings
curl http://localhost:3001/api/voice-recordings

# Get call logs
curl http://localhost:3001/api/call-logs
```

## 💡 Tips

- All messages are saved automatically to the database
- Voice recordings are stored in `server/uploads/voice/`
- Each user gets a unique ID in the database
- Messages persist even after browser refresh
- Multiple users can be online simultaneously

## 🎉 You're Ready!

Start chatting and explore all the features. All data is being saved to your MySQL database for office record-keeping purposes.
