# System Architecture & Data Flow

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CHAT APPLICATION                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │   Browser 1  │         │   Browser 2  │                  │
│  │   (User A)   │         │   (User B)   │                  │
│  └──────┬───────┘         └──────┬───────┘                  │
│         │                        │                           │
│         │   React Frontend       │                           │
│         │   (Port 3000)          │                           │
│         └────────┬───────────────┘                           │
│                  │                                            │
│                  │ Socket.io + HTTP                          │
│                  │                                            │
│         ┌────────▼────────┐                                  │
│         │                 │                                  │
│         │  Node.js Server │                                  │
│         │  (Port 3001)    │                                  │
│         │                 │                                  │
│         │  - Express      │                                  │
│         │  - Socket.io    │                                  │
│         │  - Multer       │                                  │
│         └────────┬────────┘                                  │
│                  │                                            │
│                  │ MySQL2                                     │
│                  │                                            │
│         ┌────────▼────────┐         ┌──────────────┐         │
│         │                 │         │              │         │
│         │  MySQL Database │         │  File System │         │
│         │  (chat_app)     │         │  (uploads/)  │         │
│         │                 │         │              │         │
│         │  - users        │         │  - voice/    │         │
│         │  - messages     │         │  - calls/    │         │
│         │  - voice_rec... │         │              │         │
│         │  - call_logs    │         │              │         │
│         │  - typing_st... │         │              │         │
│         └─────────────────┘         └──────────────┘         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Data Flow Diagrams

### 1. User Joins Chat
```
User enters username
       ↓
Frontend sends 'join' event via Socket.io
       ↓
Server receives join event
       ↓
Check if user exists in DB
       ↓
   ┌────┴────┐
   │         │
  YES       NO → Create new user in DB
   │         │
   └────┬────┘
       ↓
Store user in activeUsers Map
       ↓
Emit 'active_users' to all clients
       ↓
Send 'message_history' to joining user
       ↓
User sees chat interface
```

### 2. Send Message
```
User types message and clicks Send
       ↓
Frontend emits 'send_message' event
       ↓
Server receives message
       ↓
Save to messages table in MySQL
       ↓
Broadcast 'receive_message' to ALL connected clients
       ↓
All users see the new message instantly
```

### 3. Typing Indicator
```
User starts typing
       ↓
Frontend emits 'typing' event (true)
       ↓
Server broadcasts 'user_typing' to other users
       ↓
Other users see "User is typing..."
       ↓
After 1 second of no typing
       ↓
Frontend emits 'typing' event (false)
       ↓
Typing indicator disappears
```

### 4. Voice Recording
```
User clicks Record button
       ↓
Browser requests microphone permission
       ↓
MediaRecorder starts capturing audio
       ↓
User clicks Stop
       ↓
Audio blob created (WebM format)
       ↓
Upload via HTTP POST to /api/upload-voice
       ↓
Server saves file to uploads/voice/
       ↓
Server saves metadata to voice_recordings table
       ↓
Server emits 'voice_recording' event to all clients
       ↓
All users see audio player in chat
```

## 🔄 Socket.io Event Flow

### Connection Lifecycle
```
Client connects to server
       ↓
Server assigns socket ID
       ↓
Server logs connection
       ↓
User joins with username
       ↓
Socket receives userId and username properties
       ↓
User added to activeUsers Map
       ↓
   [User is active]
       ↓
User closes browser or disconnects
       ↓
Server detects disconnect
       ↓
User removed from activeUsers Map
       ↓
Server emits updated active_users list
```

## 💾 Database Operations

### Message Creation
```sql
Frontend → Server: { message: "Hello!" }
       ↓
Server → MySQL:
INSERT INTO messages (user_id, username, message)
VALUES (1, 'John', 'Hello!')
       ↓
MySQL returns: insertId (message ID)
       ↓
Server → All Clients:
{
  id: 123,
  userId: 1,
  username: 'John',
  message: 'Hello!',
  created_at: '2025-11-11 10:30:00'
}
```

### Voice Recording Storage
```
Audio File + Metadata
       ↓
File → uploads/voice/1699702800-123456789.webm
       ↓
Metadata → MySQL:
INSERT INTO voice_recordings
(user_id, username, filename, file_path, duration)
VALUES (1, 'John', '1699702800-123456789.webm', 'uploads/voice/...', 30)
       ↓
Response → Client:
{
  id: 45,
  url: '/uploads/voice/1699702800-123456789.webm',
  duration: 30
}
```

## 🎯 Real-time Synchronization

### Multi-User Message Sync
```
┌─────────┐    ┌─────────┐    ┌─────────┐
│ User A  │    │ Server  │    │ User B  │
└────┬────┘    └────┬────┘    └────┬────┘
     │              │              │
     │  send_msg    │              │
     ├──────────────>              │
     │              │ save to DB   │
     │              ├──────┐       │
     │              │      │       │
     │              <──────┘       │
     │              │              │
     │  receive_msg │  receive_msg │
     <──────────────┼──────────────>
     │              │              │
     │   Message appears in both   │
     │   browsers simultaneously   │
     │              │              │
```

## 🔐 Data Persistence Strategy

### What Gets Saved and Where

1. **Messages**
   - Location: MySQL `messages` table
   - Contains: user_id, username, message text, timestamp
   - Retrieved: On user join (last 50 messages)

2. **Voice Recordings**
   - File: `server/uploads/voice/[timestamp]-[random].webm`
   - Metadata: MySQL `voice_recordings` table
   - Contains: user info, filename, file path, duration

3. **Call Logs**
   - Location: MySQL `call_logs` table
   - Contains: caller, receiver, call type, duration, timestamps
   - Optional: recording file path

4. **User Information**
   - Location: MySQL `users` table
   - Contains: username, created_at, last_seen
   - Auto-updated: last_seen on activity

5. **Active Sessions**
   - Location: Server memory (Map object)
   - Contains: socket ID, user ID, username
   - Cleared: On disconnect

## 📈 Performance Considerations

### Optimizations Implemented

1. **Connection Pooling**
   - MySQL connection pool (10 connections)
   - Reuses connections for efficiency

2. **Limited Message History**
   - Only sends last 50 messages on join
   - Prevents large data transfers

3. **Efficient Broadcasting**
   - Socket.io rooms for targeted messages
   - io.emit for all users
   - socket.broadcast.emit for others

4. **File Size Limits**
   - 10MB maximum file upload
   - Prevents server overload

5. **Async Operations**
   - All database operations use async/await
   - Non-blocking I/O

## 🔍 Monitoring Points

### What to Monitor in Production

1. **Active Connections**
   - Track activeUsers.size
   - Monitor socket connections

2. **Database Queries**
   - Monitor query performance
   - Check connection pool usage

3. **File Storage**
   - Monitor uploads/ directory size
   - Implement cleanup strategy

4. **Error Rates**
   - Track failed uploads
   - Monitor database errors
   - Log socket disconnects

5. **Message Volume**
   - Messages per minute
   - Peak usage times
   - User engagement metrics

---

This architecture ensures:
- ✅ Real-time communication
- ✅ Data persistence
- ✅ Scalability
- ✅ Reliability
- ✅ Performance
