# Create Resume from Scratch - API Documentation

## Overview
The "Create from Scratch" feature allows users to manually build resumes without uploading a file. This endpoint creates a blank resume with empty sections that users can then fill using the existing section update endpoints.

---

## Endpoint

### Create Blank Resume
Creates a new blank resume with empty sections for manual editing.

**Endpoint:** `POST /api/v1/resumes/blank`

**Authentication:** Required

**Request Body:**
```json
{
  "name": "My Resume"  // Optional, defaults to "Untitled Resume"
}
```

**Success Response (201 Created):**
```json
{
  "status": "success",
  "message": "Blank resume created successfully",
  "data": {
    "id": 123,
    "userID": 456,
    "analysisID": 789,
    "documentID": 101,
    "themeID": 1,
    "name": "My Resume",
    "description": null,
    "customConfig": null,
    "isLocked": false,
    "isDraft": true,
    "publishedAt": null,
    "createdAt": "2026-01-26T10:00:00Z",
    "updatedAt": "2026-01-26T10:00:00Z",
    "deletedAt": null,
    "sections": [
      {
        "sectionName": "personal_info",
        "content": {},
        "isVisible": true,
        "displayOrder": 1
      },
      {
        "sectionName": "summary",
        "content": {},
        "isVisible": true,
        "displayOrder": 2
      },
      {
        "sectionName": "experience",
        "content": [],
        "isVisible": true,
        "displayOrder": 3
      },
      {
        "sectionName": "education",
        "content": [],
        "isVisible": true,
        "displayOrder": 4
      },
      {
        "sectionName": "skills",
        "content": {},
        "isVisible": true,
        "displayOrder": 5
      }
    ]
  }
}
```

**Error Responses:**

**401 Unauthorized:**
```json
{
  "status": "error",
  "message": "Authentication required",
  "statusCode": 401
}
```

**400 Bad Request:**
```json
{
  "status": "error",
  "message": "Resume name: Must be a valid string",
  "statusCode": 400
}
```

**500 Internal Server Error:**
```json
{
  "status": "error",
  "message": "Failed to create blank resume: [error details]",
  "statusCode": 500
}
```

---

## Flow Integration

### 1. User Creates Blank Resume
```bash
POST /api/v1/resumes/blank
{
  "name": "Software Engineer Resume"
}
```

Response includes `id` (resume content ID) which is used for all subsequent operations.

### 2. User Fills Sections
Use existing section update endpoints with the resume `id`:

#### Update Single Section
```bash
PATCH /api/v1/resumes/{id}/sections/personal_info
{
  "data": {
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "location": "San Francisco, CA"
  }
}
```

#### Update Multiple Sections
```bash
PATCH /api/v1/resumes/{id}/sections
{
  "sections": {
    "personal_info": {
      "fullName": "John Doe",
      "email": "john@example.com"
    },
    "summary": {
      "summary": "Experienced software engineer..."
    },
    "experience": [
      {
        "company": "Tech Corp",
        "position": "Senior Engineer",
        "startDate": "2020-01",
        "current": true,
        "achievements": ["Led team of 5 engineers"]
      }
    ]
  }
}
```

### 3. All Existing Features Work
Once created, blank resumes work exactly like uploaded resumes:

- ✅ **Editor**: Edit sections using existing PATCH endpoints
- ✅ **Themes**: Apply themes using `/resumes/:id/theme`
- ✅ **AI Rewrite**: Request rewrites using `/resumes/:id/rewrite`
- ✅ **Download**: Download using `/resumes/:id/download`
- ✅ **Publish**: Publish using `/resumes/:id/publish`

---

## Implementation Details

### Database Flow
1. **Document Created**: Empty document record with `meta: { source: 'blank' }`
2. **Analysis Created**: Completed status (no analysis needed)
3. **Content Created**: Resume content with empty sections
4. **Theme Applied**: Default theme automatically applied

### Section Schemas

#### Personal Info (Object)
```json
{
  "fullName": "string",
  "email": "string",
  "phone": "string",
  "location": "string",
  "linkedin": "string",
  "website": "string",
  "github": "string"
}
```

#### Summary (Object)
```json
{
  "summary": "string",
  "keywords": ["string"]
}
```

#### Experience (Array)
```json
[
  {
    "id": "string",
    "company": "string",
    "position": "string",
    "location": "string",
    "startDate": "YYYY-MM",
    "endDate": "YYYY-MM",
    "current": boolean,
    "description": "string",
    "achievements": ["string"],
    "keywords": ["string"]
  }
]
```

#### Education (Array)
```json
[
  {
    "id": "string",
    "institution": "string",
    "degree": "string",
    "field": "string",
    "location": "string",
    "startDate": "YYYY-MM",
    "endDate": "YYYY-MM",
    "gpa": "string",
    "honors": ["string"],
    "achievements": ["string"]
  }
]
```

#### Skills (Object)
```json
{
  "technical": ["string"],
  "soft": ["string"],
  "languages": ["string"],
  "tools": ["string"],
  "certifications": ["string"]
}
```

---

## Testing

### cURL Example
```bash
curl -X POST http://localhost:3000/api/v1/resumes/blank \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "My Professional Resume"
  }'
```

### Postman Example
1. Method: `POST`
2. URL: `{{baseUrl}}/api/v1/resumes/blank`
3. Headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer {{token}}`
4. Body (raw JSON):
   ```json
   {
     "name": "My Resume"
   }
   ```

---

## Frontend Integration Guide

### 1. Create Blank Resume
```typescript
async function createBlankResume(name?: string) {
  const response = await fetch('/api/v1/resumes/blank', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name: name || 'Untitled Resume' })
  });

  if (!response.ok) throw new Error('Failed to create resume');
  
  const { data } = await response.json();
  return data;
}
```

### 2. Redirect to Editor
```typescript
const resume = await createBlankResume('My Resume');
// Redirect to editor with resume ID
router.push(`/app/dashboard/resumes/${resume.id}`);
```

### 3. Update Sections
```typescript
async function updateSection(resumeId: number, section: string, data: any) {
  const response = await fetch(
    `/api/v1/resumes/${resumeId}/sections/${section}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ data })
    }
  );

  if (!response.ok) throw new Error('Failed to update section');
  return response.json();
}
```

---

## Differences from Upload Flow

| Aspect | Upload Flow | Create from Scratch |
|--------|-------------|---------------------|
| Document | PDF/DOCX uploaded | No file (empty fileURL) |
| Analysis | AI processes uploaded file | Completed immediately (no AI) |
| Initial Content | Extracted from file | Empty sections |
| Analysis Issues | May have ATS issues | No issues |
| Resume Score | Calculated from content | Zero/empty initially |

---

## Notes

1. **Default Theme**: System automatically applies the default theme (usually ID 1)
2. **Draft Status**: All blank resumes start as drafts (`isDraft: true`)
3. **Name Validation**: Optional, max 255 characters
4. **User Type Support**: Works for both regular users and candidates (B2B)
5. **Backward Compatible**: Existing endpoints work identically for blank vs uploaded resumes

---

## Related Endpoints

- `GET /api/v1/resumes` - List all resumes (includes blank resumes)
- `GET /api/v1/resumes/:id` - Get resume details
- `PATCH /api/v1/resumes/:id/sections/:sectionName` - Update single section
- `PATCH /api/v1/resumes/:id/sections` - Update multiple sections
- `POST /api/v1/resumes/:id/publish` - Publish resume
- `GET /api/v1/resumes/:id/download` - Download resume

---

## Support & Troubleshooting

### Common Issues

**Q: Can I convert an uploaded resume to blank?**
A: No, resumes are either created from upload or blank. You can copy content manually.

**Q: Can I upload a file to a blank resume later?**
A: No, blank resumes don't support file uploads. Create a new uploaded resume instead.

**Q: Do blank resumes support AI rewrite?**
A: Yes! Once you fill content, you can request AI rewrites just like uploaded resumes.

**Q: Why is the analysis status "completed" for blank resumes?**
A: Blank resumes don't need AI analysis since there's no file to process.

---

## Code References

- **Controller**: `controllers/resume.controller.js` - `createBlankResumeController`
- **Service**: `services/resume.service.js` - `createBlankResume`
- **Model**: `models/resume.model.js` - `createBlankDocument`, `createBlankAnalysis`
- **Route**: `routes/v1/resume.route.js` - `POST /blank`
