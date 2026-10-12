# CLI User Management Guide

## Overview

The chat application includes a powerful command-line interface (CLI) for managing users, database migrations, and viewing statistics.

## Available Commands

### Migration Commands

```bash
# Run all pending migrations
npm run migrate run

# Check migration status
npm run migrate status

# Rollback last batch of migrations
npm run migrate rollback

# Create a new migration file
npm run migrate create <migration_name>
```

### User Management Commands

**Note:** When using `npm run cli`, you must use `--` before the command arguments.

```bash
# Create a new user
npm run cli -- user:create -u <username> -e <email> -p <password>
npm run cli -- user:create -u john -e john@example.com -p password123

# Create user with specific role
npm run cli -- user:create -u admin -e admin@example.com -p admin123 -r admin

# Create user with display name
npm run cli -- user:create -u jane -e jane@example.com -p pass123 -d "Jane Doe"

# List all users
npm run cli -- user:list

# List users by role
npm run cli -- user:list -r admin
npm run cli -- user:list -r moderator

# List only active users
npm run cli -- user:list -a

# Delete a user (with confirmation)
npm run cli -- user:delete <username>

# Delete a user (force, skip confirmation)
npm run cli -- user:delete <username> -f

# Reset user password
npm run cli -- user:password <username> -p <new_password>
npm run cli -- user:password john -p newpass456

# Update user role
npm run cli -- user:role <username> <role>
npm run cli -- user:role john admin
npm run cli -- user:role jane moderator

# Activate/deactivate user
npm run cli -- user:toggle <username>

# View application statistics
npm run cli -- stats
```

## Detailed Examples

### 1. Setting Up Your First Admin User

```bash
# Step 1: Run migrations to set up database
cd server
npm run migrate run

# Step 2: Create an admin account
npm run cli -- user:create -u admin -e admin@yourcompany.com -p YourSecurePassword123! -r admin -d "System Administrator"
```

### 2. Creating Regular Users

```bash
# Create a regular user
npm run cli -- user:create -u alice -e alice@company.com -p alice123 -d "Alice Johnson"

# Create another user
npm run cli -- user:create -u bob -e bob@company.com -p bob123 -d "Bob Smith"
```

### 3. Managing User Roles

```bash
# List all users to see current roles
npm run cli -- user:list

# Promote user to moderator
npm run cli -- user:role alice moderator

# Promote user to admin
npm run cli -- user:role bob admin

# Demote user back to regular user
npm run cli -- user:role alice user
```

### 4. Password Management

```bash
# Reset a forgotten password
npm run cli -- user:password alice -p NewSecurePass456

# Reset admin password
npm run cli -- user:password admin -p SuperSecure789!
```

### 5. User Deactivation

```bash
# Deactivate a user account (they can't log in)
npm run cli -- user:toggle alice

# Reactivate the account
npm run cli -- user:toggle alice
```

### 6. Monitoring System Usage

```bash
# View statistics
npm run cli -- stats
```

Output example:
```
=== Application Statistics ===

Total Users: 15
Active Users: 12
Group Messages: 1,234
Private Messages: 567
Voice Recordings: 89
Total Calls: 45
```

## Migration System

### Creating a New Migration

```bash
# Create migration for adding a new feature
npm run migrate create add_user_profiles

# This creates: server/db/migrations/20251111_102345_add_user_profiles.sql
```

Edit the generated SQL file:
```sql
-- Migration: 20251111_102345_add_user_profiles
-- Created: 2025-11-11T10:23:45.000Z

CREATE TABLE user_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(500),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
```

### Running Migrations

```bash
# Check what migrations are pending
npm run migrate status

# Run all pending migrations
npm run migrate run
```

### Rolling Back Migrations

```bash
# Rollback the last batch of migrations
npm run migrate rollback
```

## User Roles

### Available Roles

1. **user** (default)
   - Can send messages
   - Can make calls
   - Can record voice messages
   - Access to group and private chats

2. **moderator**
   - All user permissions
   - Can moderate chat content
   - Future: Can mute/warn users

3. **admin**
   - All moderator permissions
   - Full system access
   - Can manage users
   - Can view all statistics

## Best Practices

### Security

1. **Strong Passwords**
   ```bash
   # Use strong passwords for admin accounts
   npm run cli -- user:password admin -p "C0mpl3x!P@ssw0rd#2025"
   ```

2. **Regular Password Changes**
   ```bash
   # Change admin password monthly
   npm run cli -- user:password admin -p "NewMonthlyPass2025"
   ```

3. **Deactivate Unused Accounts**
   ```bash
   # List inactive users
   npm run cli -- user:list

   # Deactivate accounts of users who left
   npm run cli -- user:toggle former_employee
   ```

### User Management

1. **Use Display Names**
   ```bash
   # Always provide display names for better UX
   npm run cli -- user:create -u j.smith -e john.smith@company.com -p pass123 -d "John Smith"
   ```

2. **Consistent Naming**
   ```bash
   # Use consistent username format (e.g., firstname.lastname)
   npm run cli -- user:create -u john.doe -e john.doe@company.com -p pass123
   npm run cli -- user:create -u jane.smith -e jane.smith@company.com -p pass123
   ```

3. **Role Assignment**
   ```bash
   # Start users as regular users
   npm run cli -- user:create -u newuser -e new@company.com -p pass123

   # Promote only when needed
   npm run cli -- user:role newuser moderator
   ```

### Database Maintenance

1. **Backup Before Major Changes**
   ```bash
   # Backup database before running migrations
   mysqldump -u root -p chat_app > backup_$(date +%Y%m%d).sql

   # Then run migrations
   npm run migrate run
   ```

2. **Test Migrations**
   ```bash
   # Test on development database first
   npm run migrate run

   # If issues occur, rollback
   npm run migrate rollback
   ```

## Troubleshooting

### "User already exists" Error

```bash
# Check if user exists
npm run cli -- user:list

# If duplicate, either use different username or delete old account
npm run cli -- user:delete olduser -f
```

### "Cannot connect to database" Error

1. Check if MySQL is running
2. Verify `.env` configuration
3. Test database connection:
   ```bash
   mysql -u root -p -e "USE chat_app; SHOW TABLES;"
   ```

### Migration Errors

```bash
# Check migration status
npm run migrate status

# If migrations are stuck, check database
mysql -u root -p chat_app -e "SELECT * FROM migrations;"

# If needed, manually remove failed migration record
mysql -u root -p chat_app -e "DELETE FROM migrations WHERE name = 'failed_migration_name';"
```

## Automation Scripts

### Bulk User Creation

Create a script `create-users.bat`:
```batch
@echo off
npm run cli -- user:create -u alice -e alice@company.com -p pass123 -d "Alice Johnson"
npm run cli -- user:create -u bob -e bob@company.com -p pass123 -d "Bob Smith"
npm run cli -- user:create -u charlie -e charlie@company.com -p pass123 -d "Charlie Brown"
echo All users created!
```

### Daily Statistics Report

Create `daily-report.bat`:
```batch
@echo off
echo Daily Report - %date%
npm run cli -- stats
npm run cli -- user:list -a
```

## Advanced Usage

### Creating Custom Migrations

```bash
# Add new feature
npm run migrate create add_message_reactions

# Add index for performance
npm run migrate create add_index_to_messages

# Modify table structure
npm run migrate create alter_users_table
```

### Query Database After Migration

```bash
# Check tables
mysql -u root -p chat_app -e "SHOW TABLES;"

# Check table structure
mysql -u root -p chat_app -e "DESCRIBE users;"

# Check data
mysql -u root -p chat_app -e "SELECT * FROM users;"
```

## Support

For issues with CLI commands:
1. Check that you're in the `/server` directory
2. Verify dependencies are installed: `npm install`
3. Check database connectivity in `.env`
4. Review logs for error details

---

**Remember:** Always backup your database before running migrations or deleting users!
