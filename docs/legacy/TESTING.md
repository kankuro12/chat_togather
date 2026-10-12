# Testing Checklist

## ✅ Pre-Launch Testing Checklist

### 1. Database Setup
- [ ] MySQL server is running
- [ ] Database `chat_app` exists
- [ ] All 5 tables created successfully
- [ ] Tables have correct schema
- [ ] Foreign keys are properly set up
- [ ] Can connect to database with credentials in .env

### 2. Server Startup
- [ ] Server dependencies installed (`npm install` in server/)
- [ ] Server starts without errors
- [ ] Server running on port 3001
- [ ] Console shows "Server running on port 3001"
- [ ] No database connection errors
- [ ] uploads/ directories created automatically

### 3. Client Startup
- [ ] Client dependencies installed (`npm install` in client/)
- [ ] Client starts without errors
- [ ] Client running on port 3000
- [ ] Browser opens automatically
- [ ] No console errors in browser

### 4. Basic Functionality

#### Username Selection
- [ ] Username input appears
- [ ] Can type username
- [ ] "Join Chat" button works
- [ ] Transitions to chat interface
- [ ] Username displays in header

#### Message Sending
- [ ] Can type in message input
- [ ] "Send" button is clickable
- [ ] Message appears in chat
- [ ] Message shows correct username
- [ ] Timestamp is displayed
- [ ] Message persists in database

#### Real-time Communication
- [ ] Open two browser windows
- [ ] Enter different usernames in each
- [ ] Send message from window 1
- [ ] Message appears in window 2 instantly
- [ ] Send message from window 2
- [ ] Message appears in window 1 instantly

#### Typing Indicator
- [ ] Start typing in window 1
- [ ] "User is typing..." appears in window 2
- [ ] Stop typing
- [ ] Indicator disappears after 1 second

#### Active Users
- [ ] User appears in sidebar after joining
- [ ] Online indicator (green dot) shows
- [ ] Multiple users shown simultaneously
- [ ] User count updates correctly
- [ ] User removed from list on disconnect

### 5. Voice Recording

#### Permission and Recording
- [ ] Microphone permission requested
- [ ] Permission granted successfully
- [ ] "Record" button changes to "Stop"
- [ ] Button shows red color when recording
- [ ] Pulse animation visible during recording
- [ ] Can stop recording

#### Playback and Storage
- [ ] Recording appears in chat
- [ ] Audio player is visible
- [ ] Can play recording
- [ ] Recording appears for all users
- [ ] File saved in server/uploads/voice/
- [ ] Database entry created in voice_recordings

### 6. Message History
- [ ] Close and reopen browser
- [ ] Join with same username
- [ ] Previous messages load
- [ ] Last 50 messages displayed
- [ ] Messages in correct order
- [ ] Timestamps correct

### 7. Multiple Users
- [ ] 3+ users can join simultaneously
- [ ] All users see all messages
- [ ] Each user sees their own messages differently styled
- [ ] Typing indicators work for all users
- [ ] Voice recordings visible to all
- [ ] Active users list updates for all

### 8. Data Persistence

#### Messages Table
```sql
SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;
```
- [ ] Messages appear in database
- [ ] Correct user_id
- [ ] Correct username
- [ ] Message text stored
- [ ] Timestamps accurate

#### Users Table
```sql
SELECT * FROM users;
```
- [ ] Users created automatically
- [ ] Unique usernames enforced
- [ ] created_at timestamp set
- [ ] last_seen updates

#### Voice Recordings Table
```sql
SELECT * FROM voice_recordings;
```
- [ ] Recordings logged
- [ ] Correct file path
- [ ] User information stored
- [ ] Timestamps recorded

### 9. API Endpoints

Test with browser or curl:

- [ ] GET http://localhost:3001/api/messages
  - Returns JSON array
  - Contains all messages
  - Proper structure

- [ ] GET http://localhost:3001/api/voice-recordings
  - Returns JSON array
  - Contains recordings
  - File paths correct

- [ ] GET http://localhost:3001/api/call-logs
  - Returns JSON array
  - Empty initially
  - Proper structure

### 10. UI/UX Testing

#### Visual Appearance
- [ ] Gradient background displays correctly
- [ ] Chat container centered
- [ ] Rounded corners visible
- [ ] Shadows display properly
- [ ] Text readable
- [ ] Colors match design

#### Message Display
- [ ] Own messages on right side
- [ ] Own messages have purple gradient
- [ ] Other messages on left side
- [ ] Other messages have white background
- [ ] Usernames bold and visible
- [ ] Timestamps visible and formatted

#### Responsiveness
- [ ] Works on full screen
- [ ] Sidebar visible on desktop
- [ ] Messages scroll properly
- [ ] Input area always visible
- [ ] Voice button accessible

#### Animations
- [ ] Messages fade in smoothly
- [ ] Recording button pulses
- [ ] Hover effects work on buttons
- [ ] Scrolling smooth

### 11. Error Handling

#### Network Errors
- [ ] Stop server
- [ ] Try sending message
- [ ] Frontend handles gracefully
- [ ] Restart server
- [ ] Reconnects automatically

#### Database Errors
- [ ] Stop MySQL
- [ ] Server logs error
- [ ] Frontend still loads
- [ ] Restart MySQL
- [ ] Functionality resumes

#### File Upload Errors
- [ ] Try uploading > 10MB file (if possible)
- [ ] Error handled gracefully
- [ ] User notified
- [ ] No server crash

### 12. Browser Compatibility
- [ ] Chrome - Full functionality
- [ ] Firefox - Full functionality
- [ ] Edge - Full functionality
- [ ] Safari - Full functionality (if available)

### 13. Security Testing

#### Input Validation
- [ ] Try SQL injection in username
- [ ] Try XSS in messages
- [ ] Try special characters
- [ ] System handles safely

#### File Upload Security
- [ ] Only audio files accepted
- [ ] File size limit enforced
- [ ] Files stored securely
- [ ] Path traversal prevented

### 14. Performance Testing

#### Load Testing
- [ ] 5+ messages sent rapidly
- [ ] All messages appear
- [ ] No lag or delay
- [ ] Database keeps up

#### Memory Testing
- [ ] Server memory stable
- [ ] No memory leaks
- [ ] Client memory stable
- [ ] Long sessions work

### 15. Edge Cases

#### Empty Inputs
- [ ] Cannot join without username
- [ ] Cannot send empty message
- [ ] Validation works

#### Special Characters
- [ ] Emojis in username work
- [ ] Emojis in messages work
- [ ] Special chars handled

#### Long Content
- [ ] Long username (50+ chars)
- [ ] Long message (1000+ chars)
- [ ] Display handles properly

#### Rapid Actions
- [ ] Rapidly click send
- [ ] Multiple recordings
- [ ] System stable

### 16. Disconnect/Reconnect

#### Normal Disconnect
- [ ] Close browser tab
- [ ] User removed from active list
- [ ] No errors in server
- [ ] Other users notified

#### Network Disconnect
- [ ] Disable network
- [ ] Socket disconnects
- [ ] Enable network
- [ ] Reconnects automatically

### 17. Data Verification

#### Check All Tables
```sql
-- Verify users
SELECT COUNT(*) FROM users;

-- Verify messages
SELECT COUNT(*) FROM messages;

-- Verify voice recordings
SELECT COUNT(*) FROM voice_recordings;

-- Check relationships
SELECT u.username, COUNT(m.id) as message_count
FROM users u
LEFT JOIN messages m ON u.id = m.user_id
GROUP BY u.id;
```

### 18. File System Verification
- [ ] Check server/uploads/voice/ exists
- [ ] Voice files are created
- [ ] File names are unique
- [ ] Files can be played
- [ ] Proper permissions

### 19. Console Logs

#### Server Console
- [ ] No error messages
- [ ] Connection logs appear
- [ ] Message logs appear
- [ ] Clean output

#### Browser Console
- [ ] No errors
- [ ] No warnings
- [ ] Socket connected message
- [ ] Clean logs

### 20. Production Readiness

#### Configuration
- [ ] .env file configured
- [ ] Correct database credentials
- [ ] Ports not conflicting
- [ ] Environment variables set

#### Documentation
- [ ] README.md complete
- [ ] QUICKSTART.md clear
- [ ] Setup instructions work
- [ ] API documented

#### Deployment Prep
- [ ] .gitignore correct
- [ ] No sensitive data in repo
- [ ] Dependencies listed
- [ ] Scripts work

## 🎯 Quick Test Scenario

Run this complete scenario to test all features:

1. ✅ Start MySQL
2. ✅ Start server (npm start in server/)
3. ✅ Start client (npm start in client/)
4. ✅ Open browser window 1
5. ✅ Join as "Alice"
6. ✅ Open browser window 2
7. ✅ Join as "Bob"
8. ✅ Send message from Alice: "Hello!"
9. ✅ Verify Bob sees it
10. ✅ Start typing as Bob
11. ✅ Verify Alice sees typing indicator
12. ✅ Send message from Bob: "Hi Alice!"
13. ✅ Record voice message as Alice
14. ✅ Verify Bob sees and can play recording
15. ✅ Check database for all data
16. ✅ Refresh browser
17. ✅ Join again and verify history loads
18. ✅ Close one browser
19. ✅ Verify user removed from active list

## 📊 Success Criteria

All checkboxes should be ✅ before deploying to production.

**Minimum Requirements:**
- All basic functionality works
- No console errors
- Data persists correctly
- Multiple users can communicate
- Voice recording works

**Production Ready:**
- All tests pass
- Performance acceptable
- Security measures in place
- Documentation complete
- Error handling robust

---

**Testing Status:** [ ] Not Started | [ ] In Progress | [ ] Complete

**Tested By:** _______________

**Date:** _______________

**Notes:** _______________________________________________
