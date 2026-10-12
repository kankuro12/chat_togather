# Complete Setup Guide - Chat Application with Authentication

## New Features Added

✅ **User Authentication** - Secure JWT-based login system  
✅ **Private Messaging** - One-on-one chat between users  
✅ **CLI User Management** - Command-line tools for admin tasks  
✅ **Database Migrations** - Safe database schema management  
✅ **Role-Based Access** - User, Moderator, and Admin roles  
✅ **Protected Routes** - Secure API endpoints  

---

## Quick Setup (10 Minutes)

### Step 1: Database Setup with Migrations

```bash
cd server

# Run migrations to create all tables
npm run migrate run

# Check migration status
npm run migrate status
```

This will create:
- `users` table (with authentication fields)
- `group_messages` table
- `private_messages` table
- `voice_recordings` table
- `call_logs` table
- `refresh_tokens` table
- `conversations` table
- `migrations` table

### Step 2: Create Your First Admin User

```bash
# Create admin account via CLI
npm run cli user:create \
  -u admin \
  -e admin@company.com \
  -p Admin123! \
  -r admin \
  -d "System Administrator"
```

### Step 3: Create Test Users

```bash
# Create a few test users
npm run cli user:create -u alice -e alice@company.com -p alice123 -d "Alice Johnson"
npm run cli user:create -u bob -e bob@company.com -p bob123 -d "Bob Smith"
npm run cli user:create -u charlie -e charlie@company.com -p charlie123 -d "Charlie Brown"

# List all users to verify
npm run cli user:list
```

### Step 4: Configure Environment

Edit `server/.env`:
```env
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=chat_app

# IMPORTANT: Change these JWT secrets in production!
JWT_SECRET=your-random-secret-key-min-32-characters
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-characters
JWT_REFRESH_EXPIRES_IN=30d
```

### Step 5: Start the Application

**Terminal 1 - Server:**
```bash
cd server
npm start
```

**Terminal 2 - Client:**
```bash
cd client
npm start
```

### Step 6: Login and Test

1. Open `http://localhost:3000`
2. Login with:
   - Username: `admin`
   - Password: `Admin123!`
3. Try group chat
4. Try private messaging with other users

---

## Detailed Features Guide

### 1. Authentication System

#### API Endpoints

**Register New User:**
```bash
POST http://localhost:3001/api/auth/register
Content-Type: application/json

{
  "username": "newuser",
  "email": "newuser@company.com",
  "password": "password123",
  "displayName": "New User"
}
```

**Login:**
```bash
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "username": "alice",
  "password": "alice123"
}
```

**Get Current User:**
```bash
GET http://localhost:3001/api/auth/me
Authorization: Bearer <your_jwt_token>
```

**Refresh Token:**
```bash
POST http://localhost:3001/api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "<your_refresh_token>"
}
```

**Logout:**
```bash
POST http://localhost:3001/api/auth/logout
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
  "refreshToken": "<your_refresh_token>"
}
```

### 2. Private Messaging

#### API Endpoints

**Get Private Messages with User:**
```bash
GET http://localhost:3001/api/private-messages/5
Authorization: Bearer <your_jwt_token>
```

**Get All Conversations:**
```bash
GET http://localhost:3001/api/conversations
Authorization: Bearer <your_jwt_token>
```

**Get All Users:**
```bash
GET http://localhost:3001/api/users
Authorization: Bearer <your_jwt_token>
```

#### Socket.io Events

**Send Private Message:**
```javascript
socket.emit('send_private_message', {
  receiverId: 5,
  message: 'Hello!'
});
```

**Receive Private Message:**
```javascript
socket.on('receive_private_message', (data) => {
  console.log('New private message:', data);
});
```

**Typing Indicator (Private):**
```javascript
socket.emit('typing_private', {
  receiverId: 5,
  isTyping: true
});
```

### 3. Group Messaging

**Send Group Message:**
```javascript
socket.emit('send_group_message', {
  message: 'Hello everyone!'
});
```

**Receive Group Message:**
```javascript
socket.on('receive_group_message', (data) => {
  console.log('New group message:', data);
});
```

### 4. CLI Commands Reference

**User Management:**
```bash
# Create user
npm run cli user:create -u username -e email -p password [-r role] [-d "Display Name"]

# List users
npm run cli user:list [-r role] [-a]

# Delete user
npm run cli user:delete username [-f]

# Reset password
npm run cli user:password username -p newpassword

# Change role
npm run cli user:role username <user|admin|moderator>

# Toggle active status
npm run cli user:toggle username

# View statistics
npm run cli stats
```

**Migration Commands:**
```bash
# Run migrations
npm run migrate run

# Check status
npm run migrate status

# Rollback
npm run migrate rollback

# Create new migration
npm run migrate create migration_name
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    role ENUM('user', 'admin', 'moderator') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Private Messages Table
```sql
CREATE TABLE private_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
);
```

### Group Messages Table
```sql
CREATE TABLE group_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    username VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Security Features

### 1. Password Hashing
- All passwords are hashed using bcrypt (10 rounds)
- Never stored in plain text

### 2. JWT Tokens
- Access tokens expire in 7 days (configurable)
- Refresh tokens expire in 30 days (configurable)
- Tokens are signed with secure secrets

### 3. Protected Routes
- All chat endpoints require authentication
- Socket.io connections require valid JWT token
- Role-based access control for admin features

### 4. Input Validation
- Email format validation
- Password minimum length (6 characters)
- Username format validation (alphanumeric + underscore)

---

## Production Deployment Checklist

### 1. Environment Variables

```env
# Change these to strong random values!
JWT_SECRET=<use-a-crypto-random-64-char-string>
JWT_REFRESH_SECRET=<use-another-crypto-random-64-char-string>

# Use strong database password
DB_PASSWORD=<strong-db-password>

# Set appropriate token expiration
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
```

Generate secure secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Database Security

```sql
-- Create dedicated database user
CREATE USER 'chat_app_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON chat_app.* TO 'chat_app_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. HTTPS Setup
- Use HTTPS in production
- Update CORS settings
- Enable secure cookies

### 4. Rate Limiting
Add rate limiting middleware (future enhancement):
```javascript
const rateLimit = require('express-rate-limit');
```

### 5. Regular Backups
```bash
# Daily backup script
mysqldump -u chat_app_user -p chat_app > backup_$(date +%Y%m%d).sql
```

---

## Testing the System

### Test Authentication

```bash
# Register via API
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@test.com","password":"test123"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'

# Use the returned token for authenticated requests
TOKEN="<your_token_here>"

# Get current user
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Test Private Messaging

1. Login as two different users in separate browsers
2. Send private messages between them
3. Check database to verify messages are saved
4. Test typing indicators

### Test CLI

```bash
cd server

# Create users
npm run cli user:create -u test1 -e test1@test.com -p test123
npm run cli user:create -u test2 -e test2@test.com -p test123

# List users
npm run cli user:list

# View stats
npm run cli stats
```

---

## Troubleshooting

### Authentication Issues

**"Invalid or expired token"**
- Token may have expired (check JWT_EXPIRES_IN)
- Use refresh token to get new access token
- Re-login if refresh token expired

**"Cannot connect to database"**
- Check MySQL is running
- Verify .env credentials
- Check database exists

### Migration Issues

**"Migration failed"**
```bash
# Check status
npm run migrate status

# Check database
mysql -u root -p chat_app -e "SHOW TABLES;"

# If needed, manually fix and re-run
npm run migrate run
```

### Socket.io Connection Issues

**"Authentication required"**
- Ensure JWT token is passed in Socket.io auth
- Check token is not expired
- Verify token format: `Bearer <token>`

---

## What's Next?

### Frontend Integration (Coming Next)
- Login/Register UI
- Private chat interface
- User list with online status
- Conversation management
- JWT token storage and refresh

### Future Enhancements
- Message read receipts
- Message search
- File attachments
- Video calling
- User profiles with avatars
- Message reactions
- Push notifications

---

## Support

For detailed CLI usage, see: `CLI_GUIDE.md`
For architecture details, see: `ARCHITECTURE.md`
For quick start, see: `QUICKSTART.md`

---

**Status:** ✅ Backend Complete with Authentication & Private Messaging
**Next:** Frontend Implementation
