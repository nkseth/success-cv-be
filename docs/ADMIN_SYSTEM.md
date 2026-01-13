# Admin System Documentation

## Overview

The Admin System provides administrative capabilities for managing the Success-CV platform. It includes:

- **Admin User Management**: Create and manage admin accounts with role-based access control
- **System Settings**: Configure application-wide settings dynamically
- **Resume Themes**: Create and manage resume themes for users
- **User Blocking**: Block/unblock users and candidates
- **Activity Logging**: Track all admin actions for audit purposes

## Getting Started

### 1. Run Database Migration

Apply the admin system migration to create the necessary tables:

```bash
# Using drizzle-kit
npx drizzle-kit push

# Or run the SQL directly
psql -d your_database -f drizzle/0007_admin_system.sql
```

### 2. Seed Initial Admin User

Create the first super admin user:

```bash
node drizzle/seeds/admin-seed.js
```

Default credentials (change immediately after first login):
- **Email**: `admin@success-cv.com` (or set `ADMIN_EMAIL` env var)
- **Password**: `Admin@123456` (or set `ADMIN_PASSWORD` env var)

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/admin/login` | Admin login |
| GET | `/api/v1/admin/profile` | Get current admin profile |

### Admin Management (Super Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/admins` | List all admins |
| POST | `/api/v1/admin/admins` | Create new admin |

### System Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/settings` | Get all settings |
| GET | `/api/v1/admin/settings/:key` | Get specific setting |
| GET | `/api/v1/admin/settings/category/:category` | Get settings by category |
| PUT | `/api/v1/admin/settings` | Create/update setting |
| DELETE | `/api/v1/admin/settings/:key` | Delete setting (Super Admin) |

### Resume Themes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/themes` | List all themes |
| GET | `/api/v1/admin/themes/:id` | Get theme by ID |
| POST | `/api/v1/admin/themes/upload-url` | Get presigned upload URL for assets |
| POST | `/api/v1/admin/themes` | Create theme |
| PUT | `/api/v1/admin/themes/:id` | Update theme |
| DELETE | `/api/v1/admin/themes/:id` | Delete theme |

### User Blocking

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/blocked-users` | List blocked users |
| GET | `/api/v1/admin/blocked-users/check` | Check if user is blocked |
| POST | `/api/v1/admin/blocked-users` | Block a user |
| DELETE | `/api/v1/admin/blocked-users/:id` | Unblock a user |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/users` | List all users |
| GET | `/api/v1/admin/candidates` | List all candidates |

### Activity Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/activity-logs` | Get admin activity logs |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/dashboard` | Get dashboard statistics |

## Admin Roles

### super_admin
- Full access to all admin functions
- Can create/manage other admin accounts
- Can delete system settings

### admin
- Access to most admin functions
- Cannot manage other admin accounts
- Cannot delete system settings

### moderator
- Limited access
- Can view users and activity logs
- Can block/unblock users

## System Settings

### Categories

| Category | Description |
|----------|-------------|
| `general` | General application settings |
| `email` | Email configuration |
| `security` | Security-related settings |
| `features` | Feature flags |
| `limits` | System limits and quotas |

### Setting Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text value | `"support@example.com"` |
| `number` | Numeric value | `10` |
| `boolean` | True/false | `true` |
| `json` | JSON object | `{"key": "value"}` |

### Default Settings (Seeded)

| Key | Type | Category | Description |
|-----|------|----------|-------------|
| `max_upload_size_mb` | number | limits | Maximum file upload size |
| `max_resumes_per_user` | number | limits | Maximum resumes per user |
| `allow_user_registration` | boolean | features | Enable/disable registration |
| `maintenance_mode` | boolean | general | Enable maintenance mode |
| `support_email` | string | general | Support email address |

## Resume Templates

### Template Upload Flow

1. **Request upload URL**:
   ```json
   POST /api/v1/admin/templates/upload-url
   {
     "fileName": "modern-template.pdf"
   }
   ```

2. **Upload file** to the returned presigned URL

3. **Create template record**:
   ```json
   POST /api/v1/admin/templates
   {
     "name": "Modern Professional",
     "description": "A clean, modern resume template",
     "thumbnailUrl": "https://...",
     "templateFileUrl": "https://...",
     "templateType": "pdf",
     "category": "general",
     "isPremium": false
   }
   ```

### Template Categories

- `general` - General purpose templates
- `tech` - Technology industry templates
- `creative` - Creative/design templates
- `executive` - Executive/leadership templates
- `academic` - Academic/research templates

## User Blocking

### Block a User

```json
POST /api/v1/admin/blocked-users
{
  "userId": 123,
  "userType": "user",
  "reason": "Violation of terms of service"
}
```

### Block a Candidate

```json
POST /api/v1/admin/blocked-users
{
  "candidateId": 456,
  "userType": "candidate",
  "reason": "Spam activity detected"
}
```

### Integration with User Authentication

Add the `checkUserNotBlocked` middleware to user authentication routes to prevent blocked users from accessing the platform:

```javascript
import { checkUserNotBlocked } from "./middleware/admin-auth.js";

// In your authentication flow
router.use(authenticateUser, checkUserNotBlocked);
```

## Activity Logging

All admin actions are automatically logged with:

- Admin ID
- Action type
- Resource type and ID
- Additional details
- IP address
- User agent
- Timestamp

### Tracked Actions

| Action | Description |
|--------|-------------|
| `login` | Admin login |
| `logout` | Admin logout |
| `update_settings` | Setting created/updated |
| `block_user` | User blocked |
| `unblock_user` | User unblocked |
| `upload_template` | Template created |
| `update_template` | Template updated |
| `delete_template` | Template deleted |
| `create_admin` | New admin created |

## Security Considerations

1. **Change default credentials** immediately after initial setup
2. **Use strong passwords** for all admin accounts
3. **Review activity logs** regularly for suspicious activity
4. **Limit super_admin accounts** to essential personnel only
5. **Use HTTPS** for all admin API calls
6. **Store JWT secrets** securely in environment variables

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_EMAIL` | Initial admin email | `admin@success-cv.com` |
| `ADMIN_PASSWORD` | Initial admin password | `Admin@123456` |
| `JWT_SECRET_ACCESS_KEY` | JWT signing secret | Required |
| `JWT_SECRET_REFRESH_KEY` | Refresh token secret | Uses access key |
