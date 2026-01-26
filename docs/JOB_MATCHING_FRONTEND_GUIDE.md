# Job Matching System - Frontend Integration Guide

## Overview
The job matching system analyzes user resumes and finds relevant job opportunities with match scores (0-100). This guide shows how to integrate the job system into your frontend application.

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [Job Browsing](#job-browsing)
3. [Job Matching Flow](#job-matching-flow)
4. [Job Match Management](#job-match-management)
5. [Job-Aware Resume Rewrite](#job-aware-resume-rewrite)
6. [User Preferences](#user-preferences)
7. [React Components Examples](#react-components-examples)
8. [State Management](#state-management)

---

## Quick Start

### Base URL
```typescript
const API_BASE_URL = 'https://api.yourapp.com/api/v1';
```

### Authentication
All endpoints require authentication. Include the token in headers:

```typescript
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${userToken}`
};
```

---

## Job Browsing

### 1. Browse All Jobs

**Endpoint:** `GET /api/v1/jobs`

**Query Parameters:**
```typescript
interface JobsQueryParams {
  page?: number;              // Default: 1
  limit?: number;             // Default: 20
  search?: string;            // Search in title, company, description
  location?: string;          // Filter by location
  remoteType?: 'remote' | 'hybrid' | 'onsite';
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'internship';
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
  minSalary?: number;
  maxSalary?: number;
  skills?: string[];          // Array of skills or comma-separated
  educationLevel?: string;
  postedAfter?: string;       // ISO date string
  sortBy?: 'postedDate' | 'salary' | 'title';
  sortOrder?: 'asc' | 'desc'; // Default: 'desc'
}
```

**Example Request:**
```typescript
async function fetchJobs(filters: JobsQueryParams) {
  const params = new URLSearchParams();
  
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.search) params.append('search', filters.search);
  if (filters.location) params.append('location', filters.location);
  if (filters.remoteType) params.append('remoteType', filters.remoteType);
  if (filters.employmentType) params.append('employmentType', filters.employmentType);
  if (filters.skills) params.append('skills', filters.skills.join(','));
  
  const response = await fetch(
    `${API_BASE_URL}/jobs?${params.toString()}`,
    { headers }
  );
  
  if (!response.ok) throw new Error('Failed to fetch jobs');
  return response.json();
}
```

**Response:**
```typescript
interface JobsResponse {
  success: boolean;
  message: string;
  data: Job[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  remoteType: 'remote' | 'hybrid' | 'onsite';
  employmentType: string;
  experienceLevel: string;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  requirements: string[];
  skills: string[];
  benefits: string[];
  applyUrl: string;
  companyWebsite: string | null;
  postedDate: string;
  expiryDate: string | null;
  isActive: boolean;
  educationLevel: string | null;
}
```

### 2. Get Single Job Details

**Endpoint:** `GET /api/v1/jobs/:id`

```typescript
async function getJobDetails(jobId: number) {
  const response = await fetch(
    `${API_BASE_URL}/jobs/${jobId}`,
    { headers }
  );
  
  if (!response.ok) throw new Error('Job not found');
  
  const result = await response.json();
  return result.data; // Returns Job object
}
```

---

## Job Matching Flow

### Overview
1. User uploads resume → Analysis completes
2. Frontend triggers job matching
3. Backend finds matching jobs and scores them
4. User views their matches
5. User can save/apply/reject matches

### 1. Trigger Initial Job Matching

**Endpoint:** `POST /api/v1/job-matches/generate`

**Request Body:**
```typescript
interface GenerateMatchesRequest {
  analysisId: number;  // The analysis ID from resume upload
  preferences?: {
    location?: string;
    remoteType?: string;
    employmentType?: string;
    minSalary?: number;
  };
}
```

**Example:**
```typescript
async function generateJobMatches(analysisId: number, preferences = {}) {
  const response = await fetch(
    `${API_BASE_URL}/job-matches/generate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ analysisId, preferences })
    }
  );
  
  if (!response.ok) throw new Error('Failed to generate matches');
  
  const result = await response.json();
  return result.data; // Returns job ID for tracking
}
```

**Response:**
```typescript
{
  success: true,
  message: "Job matching started",
  data: {
    jobId: "job-matching-123456", // BullMQ job ID
    status: "queued",
    estimatedTime: "30-60 seconds"
  }
}
```

### 2. Re-generate Job Matches

Use this when user wants to refresh their matches (after updating resume or preferences).

**Endpoint:** `POST /api/v1/job-matches/regenerate`

```typescript
async function regenerateMatches(analysisId: number) {
  const response = await fetch(
    `${API_BASE_URL}/job-matches/regenerate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ analysisId })
    }
  );
  
  return response.json();
}
```

### 3. Get User's Job Matches

**Endpoint:** `GET /api/v1/job-matches`

**Query Parameters:**
```typescript
interface JobMatchesQueryParams {
  page?: number;
  limit?: number;
  minScore?: number;           // Filter by minimum match score (0-100)
  status?: 'new' | 'viewed' | 'saved' | 'applied' | 'rejected';
  saved?: boolean;             // Filter saved jobs
  applied?: boolean;           // Filter applied jobs
  analysisId?: number;         // Filter by specific analysis
  sortBy?: 'matchScore' | 'createdAt' | 'jobPostedDate';
  sortOrder?: 'asc' | 'desc';
}
```

**Example:**
```typescript
async function getJobMatches(params: JobMatchesQueryParams = {}) {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.minScore) queryParams.append('minScore', params.minScore.toString());
  if (params.status) queryParams.append('status', params.status);
  if (params.saved !== undefined) queryParams.append('saved', params.saved.toString());
  
  const response = await fetch(
    `${API_BASE_URL}/job-matches?${queryParams.toString()}`,
    { headers }
  );
  
  return response.json();
}
```

**Response:**
```typescript
interface JobMatchesResponse {
  success: boolean;
  message: string;
  data: JobMatch[];
  pagination: PaginationInfo;
}

interface JobMatch {
  id: number;
  jobId: number;
  userId: number;
  analysisId: number;
  matchScore: number;          // 0-100
  matchReason: string;         // Why this job matches
  skillsMatch: string[];       // Matching skills
  missingSkills: string[];     // Skills user needs
  experienceMatch: boolean;
  educationMatch: boolean;
  locationMatch: boolean;
  status: 'new' | 'viewed' | 'saved' | 'applied' | 'rejected';
  isSaved: boolean;
  isApplied: boolean;
  savedAt: string | null;
  appliedAt: string | null;
  rejectedAt: string | null;
  viewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  
  // Populated job details
  job: Job;
}
```

### 4. Get Single Job Match Details

**Endpoint:** `GET /api/v1/job-matches/:id`

```typescript
async function getJobMatchDetails(matchId: number) {
  const response = await fetch(
    `${API_BASE_URL}/job-matches/${matchId}`,
    { headers }
  );
  
  const result = await response.json();
  return result.data; // Returns JobMatch object
}
```

---

## Job Match Management

### 1. Update Job Match Status

**Endpoint:** `PUT /api/v1/job-matches/:id`

**Use Cases:**
- Mark as viewed
- Save for later
- Mark as applied
- Reject job

**Request Body:**
```typescript
interface UpdateJobMatchRequest {
  status?: 'viewed' | 'saved' | 'applied' | 'rejected';
  isSaved?: boolean;
  isApplied?: boolean;
  notes?: string;              // Optional user notes
}
```

**Examples:**

```typescript
// Mark as saved
async function saveJob(matchId: number) {
  const response = await fetch(
    `${API_BASE_URL}/job-matches/${matchId}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        status: 'saved',
        isSaved: true
      })
    }
  );
  
  return response.json();
}

// Mark as applied
async function markAsApplied(matchId: number, notes?: string) {
  const response = await fetch(
    `${API_BASE_URL}/job-matches/${matchId}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        status: 'applied',
        isApplied: true,
        notes
      })
    }
  );
  
  return response.json();
}

// Reject job
async function rejectJob(matchId: number) {
  const response = await fetch(
    `${API_BASE_URL}/job-matches/${matchId}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        status: 'rejected'
      })
    }
  );
  
  return response.json();
}

// Unsave job
async function unsaveJob(matchId: number) {
  const response = await fetch(
    `${API_BASE_URL}/job-matches/${matchId}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        isSaved: false,
        status: 'viewed'
      })
    }
  );
  
  return response.json();
}
```

### 2. Delete Job Match

**Endpoint:** `DELETE /api/v1/job-matches/:id`

```typescript
async function deleteJobMatch(matchId: number) {
  const response = await fetch(
    `${API_BASE_URL}/job-matches/${matchId}`,
    {
      method: 'DELETE',
      headers
    }
  );
  
  return response.json();
}
```

---

## Job-Aware Resume Rewrite

### Overview
Create a tailored version of the resume optimized for a specific job match.

**Endpoint:** `POST /api/v1/job-matches/:jobMatchId/rewrite`

**Request Body:**
```typescript
interface JobRewriteRequest {
  optimizationPrompt?: string;  // Optional custom instructions
  focusAreas?: string[];        // e.g., ['skills', 'experience']
}
```

**Example:**
```typescript
async function rewriteResumeForJob(
  jobMatchId: number,
  customPrompt?: string
) {
  const response = await fetch(
    `${API_BASE_URL}/job-matches/${jobMatchId}/rewrite`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        optimizationPrompt: customPrompt || 
          'Optimize my resume to highlight relevant skills and experience for this specific job',
        focusAreas: ['skills', 'experience', 'summary']
      })
    }
  );
  
  if (!response.ok) throw new Error('Failed to start rewrite');
  
  const result = await response.json();
  return result.data; // Returns rewrite job details
}
```

**Response:**
```typescript
{
  success: true,
  message: "Job-specific resume rewrite started",
  data: {
    rewriteId: 123,
    jobMatchId: 456,
    status: "processing",
    estimatedTime: "2-3 minutes"
  }
}
```

---

## User Preferences

### 1. Get User Preferences

**Endpoint:** `GET /api/v1/job-preferences`

```typescript
async function getJobPreferences() {
  const response = await fetch(
    `${API_BASE_URL}/job-preferences`,
    { headers }
  );
  
  const result = await response.json();
  return result.data;
}
```

**Response:**
```typescript
interface JobPreferences {
  id: number;
  userId: number;
  preferredLocations: string[];
  preferredRemoteType: string[];
  preferredEmploymentTypes: string[];
  minSalary: number | null;
  maxSalary: number | null;
  willingToRelocate: boolean;
  preferredIndustries: string[];
  excludedCompanies: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 2. Update User Preferences

**Endpoint:** `PUT /api/v1/job-preferences`

```typescript
async function updateJobPreferences(preferences: Partial<JobPreferences>) {
  const response = await fetch(
    `${API_BASE_URL}/job-preferences`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(preferences)
    }
  );
  
  return response.json();
}
```

**Example:**
```typescript
await updateJobPreferences({
  preferredLocations: ['San Francisco, CA', 'Remote'],
  preferredRemoteType: ['remote', 'hybrid'],
  preferredEmploymentTypes: ['full-time'],
  minSalary: 120000,
  willingToRelocate: false
});
```

---

## React Components Examples

### 1. Job Matches Dashboard

```tsx
import React, { useState, useEffect } from 'react';

interface JobMatchesDashboardProps {
  analysisId: number;
}

export function JobMatchesDashboard({ analysisId }: JobMatchesDashboardProps) {
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    minScore: 70,
    status: undefined,
    saved: undefined
  });

  useEffect(() => {
    loadMatches();
  }, [analysisId, filters]);

  async function loadMatches() {
    setLoading(true);
    try {
      const response = await getJobMatches({
        analysisId,
        ...filters,
        limit: 20,
        sortBy: 'matchScore',
        sortOrder: 'desc'
      });
      setMatches(response.data);
    } catch (error) {
      console.error('Failed to load matches:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveJob(matchId: number) {
    await saveJob(matchId);
    loadMatches(); // Refresh
  }

  async function handleApplyJob(matchId: number) {
    await markAsApplied(matchId);
    loadMatches();
  }

  if (loading) return <div>Loading matches...</div>;

  return (
    <div className="job-matches-dashboard">
      <div className="filters">
        <label>
          Min Match Score:
          <input
            type="range"
            min="0"
            max="100"
            value={filters.minScore}
            onChange={(e) => setFilters({
              ...filters,
              minScore: parseInt(e.target.value)
            })}
          />
          {filters.minScore}%
        </label>
        
        <select
          value={filters.status || ''}
          onChange={(e) => setFilters({
            ...filters,
            status: e.target.value || undefined
          })}
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="viewed">Viewed</option>
          <option value="saved">Saved</option>
          <option value="applied">Applied</option>
        </select>
      </div>

      <div className="matches-grid">
        {matches.map((match) => (
          <JobMatchCard
            key={match.id}
            match={match}
            onSave={() => handleSaveJob(match.id)}
            onApply={() => handleApplyJob(match.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

### 2. Job Match Card Component

```tsx
interface JobMatchCardProps {
  match: JobMatch;
  onSave: () => void;
  onApply: () => void;
}

export function JobMatchCard({ match, onSave, onApply }: JobMatchCardProps) {
  const { job, matchScore, matchReason, skillsMatch, missingSkills } = match;

  return (
    <div className="job-match-card">
      <div className="match-score">
        <CircularProgress value={matchScore} />
        <span>{matchScore}% Match</span>
      </div>

      <div className="job-details">
        <h3>{job.title}</h3>
        <p className="company">{job.company}</p>
        <p className="location">
          {job.location} • {job.remoteType}
        </p>
        
        {job.salaryMin && job.salaryMax && (
          <p className="salary">
            ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}
          </p>
        )}
      </div>

      <div className="match-details">
        <p className="match-reason">{matchReason}</p>
        
        <div className="skills-match">
          <h4>Your Matching Skills:</h4>
          <div className="skills-tags">
            {skillsMatch.map((skill) => (
              <span key={skill} className="skill-tag match">
                {skill}
              </span>
            ))}
          </div>
        </div>

        {missingSkills.length > 0 && (
          <div className="missing-skills">
            <h4>Skills to Learn:</h4>
            <div className="skills-tags">
              {missingSkills.slice(0, 5).map((skill) => (
                <span key={skill} className="skill-tag missing">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="actions">
        <button
          onClick={onSave}
          className={match.isSaved ? 'saved' : ''}
        >
          {match.isSaved ? '★ Saved' : '☆ Save'}
        </button>
        
        <button onClick={onApply} className="primary">
          Apply Now
        </button>
        
        <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
          Apply on Company Site →
        </a>
      </div>
    </div>
  );
}
```

### 3. Job Matching Trigger Component

```tsx
export function TriggerJobMatching({ analysisId }: { analysisId: number }) {
  const [isMatching, setIsMatching] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  async function handleGenerateMatches() {
    setIsMatching(true);
    try {
      const result = await generateJobMatches(analysisId);
      setJobId(result.jobId);
      
      // Poll for completion or use SSE
      pollJobStatus(result.jobId);
    } catch (error) {
      console.error('Failed to generate matches:', error);
      setIsMatching(false);
    }
  }

  function pollJobStatus(jobId: string) {
    // Implement polling or use SSE endpoint
    const interval = setInterval(async () => {
      // Check job status
      // When complete, setIsMatching(false) and redirect to matches
    }, 3000);
  }

  return (
    <div className="matching-trigger">
      {!isMatching ? (
        <button onClick={handleGenerateMatches} className="generate-btn">
          🎯 Find Matching Jobs
        </button>
      ) : (
        <div className="matching-progress">
          <div className="spinner" />
          <p>Finding your perfect matches...</p>
          <p className="eta">This usually takes 30-60 seconds</p>
        </div>
      )}
    </div>
  );
}
```

### 4. Job-Specific Resume Rewrite

```tsx
export function JobRewriteButton({ jobMatchId }: { jobMatchId: number }) {
  const [isRewriting, setIsRewriting] = useState(false);

  async function handleRewrite() {
    setIsRewriting(true);
    try {
      const result = await rewriteResumeForJob(
        jobMatchId,
        'Tailor my resume to highlight the most relevant experience and skills for this position'
      );
      
      // Show success message
      alert('Resume rewrite started! Check your rewrites tab in a few minutes.');
      
    } catch (error) {
      console.error('Failed to start rewrite:', error);
    } finally {
      setIsRewriting(false);
    }
  }

  return (
    <button
      onClick={handleRewrite}
      disabled={isRewriting}
      className="rewrite-btn"
    >
      {isRewriting ? 'Creating...' : '✨ Tailor Resume for This Job'}
    </button>
  );
}
```

---

## State Management

### Redux Example

```typescript
// actions/jobMatches.ts
export const fetchJobMatches = createAsyncThunk(
  'jobMatches/fetch',
  async (params: JobMatchesQueryParams) => {
    const response = await getJobMatches(params);
    return response.data;
  }
);

// slice/jobMatchesSlice.ts
const jobMatchesSlice = createSlice({
  name: 'jobMatches',
  initialState: {
    matches: [] as JobMatch[],
    loading: false,
    error: null as string | null,
    filters: {
      minScore: 70,
      status: undefined,
      saved: undefined
    }
  },
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchJobMatches.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchJobMatches.fulfilled, (state, action) => {
        state.loading = false;
        state.matches = action.payload;
      })
      .addCase(fetchJobMatches.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch matches';
      });
  }
});
```

### React Query Example

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetch job matches
export function useJobMatches(params: JobMatchesQueryParams) {
  return useQuery({
    queryKey: ['jobMatches', params],
    queryFn: () => getJobMatches(params)
  });
}

// Save job mutation
export function useSaveJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (matchId: number) => saveJob(matchId),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['jobMatches'] });
    }
  });
}

// Usage in component
function JobMatchesList() {
  const { data, isLoading } = useJobMatches({ minScore: 70 });
  const saveJobMutation = useSaveJob();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {data?.data.map((match) => (
        <JobCard
          key={match.id}
          match={match}
          onSave={() => saveJobMutation.mutate(match.id)}
        />
      ))}
    </div>
  );
}
```

---

## Best Practices

### 1. **Error Handling**
```typescript
async function getJobMatchesSafely(params: JobMatchesQueryParams) {
  try {
    const response = await fetch(/* ... */);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching job matches:', error);
    // Show user-friendly error message
    throw error;
  }
}
```

### 2. **Loading States**
Always show loading indicators when:
- Generating job matches (30-60 seconds)
- Creating job-specific rewrites (2-3 minutes)
- Fetching matches

### 3. **Caching**
Cache job matches and invalidate when:
- User updates their resume
- User changes preferences
- User saves/applies to jobs

### 4. **Real-time Updates**
For job matching progress, consider using:
- Server-Sent Events (SSE) endpoint: `GET /api/v1/sse/job-matching/:jobId`
- Polling every 3-5 seconds during matching

### 5. **Match Score Display**
- **90-100%**: "Excellent Match" (Green)
- **70-89%**: "Good Match" (Blue)
- **50-69%**: "Fair Match" (Yellow)
- **Below 50%**: "Low Match" (Gray)

---

## Complete Integration Checklist

- [ ] Set up authentication headers
- [ ] Implement job browsing page with filters
- [ ] Create job match trigger after resume upload
- [ ] Build job matches dashboard
- [ ] Add save/apply/reject functionality
- [ ] Implement job-specific resume rewrite
- [ ] Add user preferences settings page
- [ ] Handle loading states (30-60s for matching)
- [ ] Implement error handling
- [ ] Add real-time progress updates (SSE or polling)
- [ ] Create match score visualizations
- [ ] Add skills comparison display
- [ ] Implement pagination for large result sets

---

## Support & Troubleshooting

### Common Issues

**Q: Job matching is taking too long**
A: Matching typically takes 30-60 seconds. If it takes longer, check the job status using SSE or contact support.

**Q: No matches found**
A: This can happen if:
- Resume lacks relevant keywords
- Job database is empty (needs scraping)
- User preferences are too restrictive

**Q: Match scores seem low**
A: Match scores are calculated based on:
- Skills overlap
- Experience level match
- Education requirements
- Location preferences
Encourage users to update their resume with more keywords and skills.

---

## API Reference Quick Links

- [Complete Resume API Docs](./CREATE_FROM_SCRATCH_API.md)
- [Job Matching Queue System](./QUEUE_SERVICE_USAGE.md)
- [SSE Documentation](./SSE_JOB_MONITORING.md)
- Swagger UI: `http://localhost:3000/api-docs`

---

**Last Updated:** January 26, 2026
**API Version:** v1
