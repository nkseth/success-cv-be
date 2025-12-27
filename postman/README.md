# Success-CV API Postman Collection

This directory contains the Postman collection and environment files for testing the Success-CV API.

## Files

- `Success-CV-API.postman_collection.json` - Complete API collection with all endpoints
- `Success-CV-Local.postman_environment.json` - Local development environment (localhost:8000)
- `Success-CV-Production.postman_environment.json` - Production environment

## Getting Started

### 1. Import Collection and Environment

1. Open Postman
2. Click **Import** button
3. Select all three JSON files from this directory
4. The collection and environments will be imported

### 2. Select Environment

- Click the environment dropdown in the top right corner
- Select **Success-CV Local** for local development
- Select **Success-CV Production** for production testing

## Environment Variables

### Automatic Variables (Set by API responses)

These variables are automatically set when you successfully login or register:

- `AUTH_TOKEN` - JWT authentication token (automatically set on login/register)
- `USER_ID` - Current user's ID (automatically set on login/register)
- `CANDIDATE_TOKEN` - Candidate JWT token (automatically set on candidate login)
- `ORG_ID` - Organisation ID (manually set or extracted from responses)

### Configuration Variables

- `BASE_URL` - API base URL
  - Local: `localhost:8000`
  - Production: `https://api.success-cv.com`

## Usage

### Authentication Flow

1. **Register a new user**:
   - Go to `Auth > Register`
   - Click **Send**
   - The `AUTH_TOKEN` and `USER_ID` will be automatically saved to your environment

2. **Login with existing credentials**:
   - Go to `Auth > Login`
   - Update the email/password in the request body
   - Click **Send**
   - The `AUTH_TOKEN` and `USER_ID` will be automatically saved to your environment

3. **Use authenticated endpoints**:
   - All subsequent requests will automatically use the `AUTH_TOKEN`
   - The collection is configured with global authentication using Bearer token

### Candidate Authentication

For candidate-specific endpoints:

1. Use `Candidate Auth > Candidate Login`
2. The `CANDIDATE_TOKEN` will be automatically saved and also copied to `AUTH_TOKEN`

## Collection Structure

### Root & Health
- Server health checks
- Redis, Queue, and Cache status endpoints

### Auth
- User registration and login
- Email verification
- Password reset flow
- Token refresh

### Candidate Auth
- Candidate-specific authentication
- Bulk candidate registration
- Candidate login and verification

### User
- User profile management
- Organisation management
- Resume creation

### Organisation
- Create and manage organisations
- Invite members
- Manage member roles
- View candidates

### Invites
- Accept organisation invites
- Resend invites

### Upload
- Generate presigned URLs for file uploads
- Get access URLs for uploaded files

### Resume Analysis
- Get all resume analyses
- Get specific resume analysis
- Update resume analysis data

### SSE (Server-Sent Events)
- Real-time job monitoring
- SSE statistics

## Tips

1. **Auto-saved tokens**: Login/Register requests automatically save the auth token, so you don't need to copy-paste it manually.

2. **Collection-level auth**: The collection uses Bearer token authentication by default, which applies to all requests unless overridden.

3. **Path variables**: Some endpoints use path variables (e.g., `:id`, `:analysisId`). Update these in the request URL or use environment variables.

4. **Request bodies**: Sample request bodies are provided. Update them according to your needs.

5. **Console logs**: Check the Postman console (View > Show Postman Console) to see when tokens and IDs are saved.

## Testing Workflow

### Complete User Flow Example

1. **Register** (`Auth > Register`)
2. **Create Organisation** (`User > Create User Organisation`)
3. **Invite Member** (`Organisation > Send Organisation Invite`)
4. **Generate Upload URL** (`Upload > Generate Presigned URL`)
5. **Get Resume Analyses** (`Resume Analysis > Get All Resume Analyses`)

### Health Check Flow

1. **Check Server** (`Root & Health > Health Check`)
2. **Check Redis** (`Root & Health > Redis Health`)
3. **Check Queue** (`Root & Health > Queue Stats`)
4. **Full Health** (`Root & Health > Full Health Check`)

## Troubleshooting

### Token Not Saved
- Ensure you're using the correct environment
- Check the Postman console for script execution logs
- Verify the API response contains `data.token` field

### 401 Unauthorized
- Make sure you've logged in first
- Check that `AUTH_TOKEN` is set in your environment
- Verify the token hasn't expired

### Base URL Issues
- Confirm the correct environment is selected
- For local development, ensure the server is running on port 8000
- Check that `BASE_URL` doesn't have trailing slashes

## Support

For issues or questions about the API, please refer to the Swagger documentation at:
- Local: `http://localhost:8000/api-docs`
- Production: `https://api.success-cv.com/api-docs`
