# Migration System Documentation

## Overview

The chat application uses a Laravel-style migration system with JavaScript files containing `up` and `down` arrays of SQL queries. This provides better version control, rollback capabilities, and maintainability.

## Migration File Format

Migrations are JavaScript files that export an object with two arrays:
- **`up`**: Array of SQL queries to execute when migrating forward
- **`down`**: Array of SQL queries to execute when rolling back

### Example Migration

```javascript
/**
 * Migration: 20251111_120000_create_posts_table
 * Description: Create posts table for blog functionality
 * Created: 2025-11-11T12:00:00.000Z
 */

module.exports = {
    // Forward migration
    up: [
        `CREATE TABLE posts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            status ENUM('draft', 'published') DEFAULT 'draft',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        `CREATE INDEX idx_posts_user_id ON posts(user_id)`,
        `CREATE INDEX idx_posts_status ON posts(status)`,
        `CREATE INDEX idx_posts_created_at ON posts(created_at)`
    ],

    // Rollback migration
    down: [
        `DROP TABLE IF EXISTS posts`
    ]
};
```

## Migration Commands

### Create New Migration

```bash
npm run migrate create <migration_name>

# Example
npm run migrate create add_user_profiles
npm run migrate create create_messages_table
npm run migrate create add_avatar_to_users
```

This creates a timestamped file: `20251111_120000_add_user_profiles.js`

### Run Migrations

```bash
# Run all pending migrations
npm run migrate run
```

Output:
```
Running migration: 001_initial_setup.js
✓ Migrated: 001_initial_setup.js
Running migration: 20251111_120000_add_user_profiles.js
✓ Migrated: 20251111_120000_add_user_profiles.js

✓ Migrated 2 file(s)
```

### Check Migration Status

```bash
npm run migrate status
```

Output:
```
=== Migration Status ===

Executed migrations:
  ✓ 001_initial_setup (batch 1)
  ✓ 20251111_120000_add_user_profiles (batch 2)

No pending migrations
```

### Rollback Migrations

```bash
# Rollback last batch
npm run migrate rollback

# Rollback last 2 batches
npm run migrate rollback --steps 2
```

### Reset All Migrations

```bash
# Rollback all migrations (requires --force)
npm run migrate reset --force
```

⚠️ **Warning:** This will rollback ALL migrations!

### Fresh Migration

```bash
# Drop all tables and re-run all migrations
npm run migrate fresh --force
```

⚠️ **Warning:** This will destroy all data!

## Migration Best Practices

### 1. Always Include Down Migrations

```javascript
module.exports = {
    up: [
        `CREATE TABLE example (...)`
    ],
    
    // GOOD: Proper down migration
    down: [
        `DROP TABLE IF EXISTS example`
    ]
};
```

### 2. Use Transactions for Complex Operations

```javascript
module.exports = {
    up: [
        `START TRANSACTION`,
        `CREATE TABLE temp_data (...)`,
        `INSERT INTO temp_data SELECT * FROM old_data`,
        `DROP TABLE old_data`,
        `RENAME TABLE temp_data TO old_data`,
        `COMMIT`
    ],
    
    down: [
        // Rollback logic
    ]
};
```

### 3. Add Indexes for Foreign Keys

```javascript
module.exports = {
    up: [
        `CREATE TABLE posts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        // GOOD: Index on foreign key
        `CREATE INDEX idx_posts_user_id ON posts(user_id)`
    ],
    
    down: [
        `DROP TABLE IF EXISTS posts`
    ]
};
```

### 4. Separate Concerns

Don't mix table creation with data insertion in the same migration:

```javascript
// BAD: Mixing schema and data
module.exports = {
    up: [
        `CREATE TABLE roles (...)`,
        `INSERT INTO roles VALUES (1, 'admin')` // Avoid this
    ]
};

// GOOD: Create a separate seeder or migration for data
```

### 5. Use Descriptive Names

```bash
# GOOD
npm run migrate create create_users_table
npm run migrate create add_email_to_users
npm run migrate create create_posts_and_comments_tables

# BAD
npm run migrate create update1
npm run migrate create fixes
npm run migrate create temp
```

### 6. Order Matters

Migrations run in alphabetical order. The timestamp prefix ensures correct ordering:

```
001_initial_setup.js                 // First
20251111_120000_add_feature.js      // Second
20251111_130000_another_feature.js  // Third
```

### 7. Test Rollbacks

Always test that your down migration works:

```bash
# Run migration
npm run migrate run

# Test rollback
npm run migrate rollback

# Re-run
npm run migrate run
```

## Common Migration Patterns

### Creating a Table

```javascript
module.exports = {
    up: [
        `CREATE TABLE products (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            stock INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX idx_products_name ON products(name)`
    ],
    
    down: [
        `DROP TABLE IF EXISTS products`
    ]
};
```

### Adding Columns

```javascript
module.exports = {
    up: [
        `ALTER TABLE users ADD COLUMN phone VARCHAR(20) AFTER email`,
        `ALTER TABLE users ADD COLUMN bio TEXT AFTER phone`
    ],
    
    down: [
        `ALTER TABLE users DROP COLUMN bio`,
        `ALTER TABLE users DROP COLUMN phone`
    ]
};
```

### Modifying Columns

```javascript
module.exports = {
    up: [
        `ALTER TABLE users MODIFY COLUMN email VARCHAR(320) NOT NULL`
    ],
    
    down: [
        `ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NOT NULL`
    ]
};
```

### Adding Foreign Keys

```javascript
module.exports = {
    up: [
        `ALTER TABLE posts 
         ADD CONSTRAINT fk_posts_user_id 
         FOREIGN KEY (user_id) REFERENCES users(id) 
         ON DELETE CASCADE`,
        `CREATE INDEX idx_posts_user_id ON posts(user_id)`
    ],
    
    down: [
        `ALTER TABLE posts DROP FOREIGN KEY fk_posts_user_id`,
        `ALTER TABLE posts DROP INDEX idx_posts_user_id`
    ]
};
```

### Creating Junction Tables

```javascript
module.exports = {
    up: [
        `CREATE TABLE user_roles (
            user_id INT NOT NULL,
            role_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, role_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
        )`,
        `CREATE INDEX idx_user_roles_user_id ON user_roles(user_id)`,
        `CREATE INDEX idx_user_roles_role_id ON user_roles(role_id)`
    ],
    
    down: [
        `DROP TABLE IF EXISTS user_roles`
    ]
};
```

## Troubleshooting

### Migration Failed

```bash
✗ Failed to migrate 001_initial_setup.js: Table 'users' already exists
```

**Solution:**
1. Check if table exists: `SHOW TABLES;`
2. Either drop the table or modify migration to use `CREATE TABLE IF NOT EXISTS`
3. Or rollback and re-run

### Rollback Failed

```bash
✗ Failed to rollback: Cannot drop table 'users' because it has foreign key constraints
```

**Solution:**
- Ensure down migrations drop tables in reverse order of creation
- Drop dependent tables first, then parent tables

### Module Not Found

```bash
Error: Cannot find module '../db/migrations/001_initial_setup.js'
```

**Solution:**
- Ensure migration file exists
- Check file extension is `.js` not `.sql`
- Verify file is in `server/db/migrations/` directory

### Syntax Error in Migration

```bash
Error in query 1/5:
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT
```

**Solution:**
- Check SQL syntax
- Ensure template literals are properly closed
- Test query in MySQL client first

## Migration Workflow

### Development Workflow

1. **Create Migration**
   ```bash
   npm run migrate create add_new_feature
   ```

2. **Edit Migration File**
   - Add your SQL queries to `up` array
   - Add rollback SQL to `down` array

3. **Run Migration**
   ```bash
   npm run migrate run
   ```

4. **Test Feature**
   - Test your application with new schema

5. **Test Rollback**
   ```bash
   npm run migrate rollback
   npm run migrate run
   ```

### Production Deployment

1. **Backup Database**
   ```bash
   mysqldump -u root -p chat_app > backup_$(date +%Y%m%d).sql
   ```

2. **Run Migrations**
   ```bash
   npm run migrate run
   ```

3. **Verify**
   ```bash
   npm run migrate status
   ```

4. **If Issues, Rollback**
   ```bash
   npm run migrate rollback
   ```

## Advanced Usage

### Checking What Will Be Migrated

```bash
# See pending migrations
npm run migrate status
```

### Multiple Step Rollback

```bash
# Rollback last 3 batches
npm run migrate rollback --steps 3
```

### Fresh Start (Development Only)

```bash
# Drop everything and start fresh
npm run migrate fresh --force
```

## Integration with Version Control

### Always Commit Migrations

```bash
git add server/db/migrations/*.js
git commit -m "Add migration for user profiles feature"
git push
```

### Team Workflow

1. Pull latest code
2. Run migrations: `npm run migrate run`
3. Develop feature
4. Create migration if needed
5. Commit migration with code
6. Push to repository

## File Structure

```
server/
├── db/
│   ├── migrations/
│   │   ├── 001_initial_setup.js
│   │   ├── 20251111_120000_add_feature.js
│   │   └── 20251111_130000_another_feature.js
│   ├── MigrationManager.js
│   └── database.js
└── cli/
    └── migrate.js
```

## Summary

| Command | Description |
|---------|-------------|
| `npm run migrate create <name>` | Create new migration |
| `npm run migrate run` | Run pending migrations |
| `npm run migrate rollback` | Rollback last batch |
| `npm run migrate rollback --steps N` | Rollback N batches |
| `npm run migrate reset --force` | Rollback all |
| `npm run migrate fresh --force` | Drop all & re-run |
| `npm run migrate status` | Show status |

---

**Remember:** Always test migrations in development before running in production!
