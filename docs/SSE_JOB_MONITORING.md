# SSE Job Monitoring Guide

## Overview

Real-time job monitoring using Server-Sent Events (SSE) for both Resume Analysis and Resume Rewrite operations.

**Optimized for simplicity**: Just one endpoint per job type, server handles everything!

## Quick Start

### Resume Analysis
```javascript
// Monitor analysis job
const eventSource = new EventSource(
  `/api/v1/sse/job/${jobId}?queueName=resume-analysis`
);

eventSource.addEventListener('job_update', (e) => {
  const { progress, message, status } = JSON.parse(e.data);
  console.log(`${progress}%: ${message}`);
  if (status === 'completed') eventSource.close();
});
```

### Resume Rewrite ⭐ NEW
```javascript
// Monitor rewrite job - dedicated endpoint!
const eventSource = new EventSource(
  `/api/v1/sse/rewrite/${jobId}`
);

eventSource.addEventListener('job_update', (e) => {
  const { progress, message, status, data } = JSON.parse(e.data);
  console.log(`${progress}%: ${message}`);
  
  if (status === 'completed') {
    console.log('Rewrite complete!', data);
    eventSource.close();
  }
});
```

---

## How It Works

### One-Step Connection ⭐

Connect and subscribe to a specific job in **one API call**. The server:
- ✅ Generates connection ID automatically
- ✅ Auto-subscribes to your job
- ✅ Sends real-time progress updates
- ✅ Cleans up when job completes

**Endpoints**:
```
# For analysis jobs
GET /api/v1/sse/job/:jobId?queueName=resume-analysis

# For rewrite jobs (auto-subscribes to resume-rewrite queue)
GET /api/v1/sse/rewrite/:jobId
```

**No manual connection ID needed** - server handles it all!

---

## API Endpoints

### Monitor Analysis Job

**URL**: `GET /api/v1/sse/job/:jobId`

**Query Parameters**:
- `queueName` (optional): Also receive queue statistics

**Example**:
```bash
curl 'http://localhost:8000/api/v1/sse/job/resume-123-1699267200000?queueName=resume-analysis'
```

### Monitor Rewrite Job ⭐

**URL**: `GET /api/v1/sse/rewrite/:jobId`

Auto-subscribes to the `resume-rewrite` queue for progress updates.

**Example**:
```bash
curl 'http://localhost:8000/api/v1/sse/rewrite/rewrite-456-1699267200000'
```

**Initial Response** (SSE):
```javascript
event: connected
data: {"connectionId":"550e8400-e29b-41d4-a716-446655440000","timestamp":1699267200000,"message":"SSE connection established"}
```

**Progress Updates** (Real-time):
```javascript
// Job started (0%)
event: job_update
data: {"type":"job_update","jobId":"resume-123-1699267200000","status":"started","progress":0,"stage":"initializing","message":"Starting resume analysis"}

// Processing (50%)
event: job_update
data: {"type":"job_update","jobId":"resume-123-1699267200000","status":"in_progress","progress":50,"stage":"parsing","message":"Parsing resume content"}

// Completed (100%)
event: job_update
data: {"type":"job_update","jobId":"resume-123-1699267200000","status":"completed","progress":100,"message":"Analysis completed","result":{"score":85}}
```

---

## Frontend Integration

### React - Complete Example

```jsx
import { useEffect, useState } from 'react';

function ResumeAnalysis({ jobId }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('connecting');
  const [message, setMessage] = useState('Connecting...');
  const [result, setResult] = useState(null);

  useEffect(() => {
    // One-step connection!
    const eventSource = new EventSource(
      `/api/v1/sse/job/${jobId}?queueName=resume-analysis`
    );

    eventSource.addEventListener('connected', (e) => {
      console.log('✅ Connected to job monitoring');
      setStatus('connected');
      setMessage('Waiting for job to start...');
    });

    eventSource.addEventListener('job_update', (e) => {
      const data = JSON.parse(e.data);
      
      setProgress(data.progress);
      setStatus(data.status);
      setMessage(data.message);

      if (data.status === 'completed') {
        setResult(data.result);
        eventSource.close();
      } else if (data.status === 'failed') {
        console.error('Job failed:', data.error);
        eventSource.close();
      }
    });

    eventSource.onerror = () => {
      setStatus('error');
      setMessage('Connection lost');
      eventSource.close();
    };

    return () => eventSource.close();
  }, [jobId]);

  return (
    <div className="resume-analysis">
      <div className="progress-container">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          >
            {progress}%
          </div>
        </div>
        <p className="status">{status}</p>
        <p className="message">{message}</p>
      </div>
      
      {result && (
        <div className="results">
          <h3>Analysis Complete!</h3>
          <p>Score: {result.score}/100</p>
        </div>
      )}
    </div>
  );
}

export default ResumeAnalysis;
```

### Vue - Simple Job Monitor

```vue
<template>
  <div class="job-monitor">
    <h3>{{ jobName }}</h3>
    <div class="progress-bar">
      <div class="fill" :style="{ width: progress + '%' }">
        {{ progress }}%
      </div>
    </div>
    <p class="message">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  jobId: String,
  jobName: String
});

const progress = ref(0);
const message = ref('Connecting...');
let eventSource = null;

onMounted(() => {
  eventSource = new EventSource(`/api/v1/sse/job/${props.jobId}`);
  
  eventSource.addEventListener('job_update', (e) => {
    const data = JSON.parse(e.data);
    progress.value = data.progress;
    message.value = data.message;
    
    if (data.status === 'completed' || data.status === 'failed') {
      eventSource.close();
    }
  });
});

onBeforeUnmount(() => {
  if (eventSource) eventSource.close();
});
</script>
```

### Vanilla JavaScript - Minimal

```javascript
function monitorJob(jobId, onUpdate, onComplete) {
  const eventSource = new EventSource(`/api/v1/sse/job/${jobId}`);

  eventSource.addEventListener('job_update', (e) => {
    const data = JSON.parse(e.data);
    onUpdate(data);

    if (data.status === 'completed') {
      onComplete(data.result);
      eventSource.close();
    } else if (data.status === 'failed') {
      onComplete(null, data.error);
      eventSource.close();
    }
  });

  return () => eventSource.close();
}

// Usage
const cleanup = monitorJob(
  'resume-123-1699267200000',
  (data) => {
    console.log(`Progress: ${data.progress}%`);
    document.getElementById('progress').value = data.progress;
  },
  (result, error) => {
    if (error) {
      console.error('Failed:', error);
    } else {
      console.log('Success:', result);
    }
  }
);
```

---

## Complete Workflow

### Resume Analysis Workflow

#### 1. Upload Resume
```javascript
// Get presigned URL
const { data } = await fetch('/api/v1/upload/presigned-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fileName: file.name })
}).then(r => r.json());

// Upload to Azure
await fetch(data.uploadUrl, {
  method: 'PUT',
  headers: { 'x-ms-blob-type': 'BlockBlob' },
  body: file
});
```

#### 2. Add to Queue
```javascript
const job = await fetch('/api/v1/queue/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    queueName: 'resume-analysis',
    jobName: 'analyze-resume',
    data: {
      resumeId: 'resume-123',
      fileName: data.fileName
    }
  })
}).then(r => r.json());

const jobId = job.data.jobId; // Use this for monitoring!
```

#### 3. Monitor Progress
```javascript
const eventSource = new EventSource(`/api/v1/sse/job/${jobId}`);

eventSource.addEventListener('job_update', (e) => {
  const { progress, message, status } = JSON.parse(e.data);
  updateUI(progress, message);
  
  if (status === 'completed') {
    showSuccess();
    eventSource.close();
  }
});
```

### Resume Rewrite Workflow ⭐

#### 1. Create Rewrite Job
```javascript
// Create rewrite from resume or analysis
const response = await fetch(`/api/v1/resumes/${resumeId}/rewrites`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    versionLabel: 'ATS Optimized v1',
    targetATSScore: 90,
    focusAreas: ['experience', 'skills'],
    optimizationLevel: 'comprehensive'
  })
}).then(r => r.json());

const { jobId, id: rewriteId } = response.data;
```

#### 2. Connect to SSE for Live Updates
```javascript
const eventSource = new EventSource(`/api/v1/sse/rewrite/${jobId}`);

eventSource.addEventListener('connected', () => {
  console.log('Connected to rewrite job monitoring');
});

eventSource.addEventListener('job_update', (e) => {
  const data = JSON.parse(e.data);
  
  // Update UI with progress
  updateProgressBar(data.progress);
  updateStatusMessage(data.message);
  
  // Handle stages
  switch(data.stage) {
    case 'PREPARING':
      showPreparingUI();
      break;
    case 'OPTIMIZING':
      showOptimizingUI();
      break;
    case 'APPLYING':
      showApplyingUI();
      break;
  }
  
  // Handle completion
  if (data.status === 'completed') {
    console.log('Rewrite completed!', data.data);
    // data.data contains: rewriteID, analysisID, scores, autoApplied
    showCompletedUI(data.data);
    eventSource.close();
  }
  
  // Handle failure
  if (data.status === 'failed') {
    console.error('Rewrite failed:', data.error);
    showErrorUI(data.error);
    eventSource.close();
  }
});

eventSource.onerror = () => {
  console.error('SSE connection error');
  eventSource.close();
};
```

#### 3. Rewrite Progress Stages

| Stage | Progress | Description |
|-------|----------|-------------|
| `INIT` | 0% | Initializing resume rewrite |
| `PREPARING` | 15% | Preparing current content for optimization |
| `OPTIMIZING` | 50% | AI is optimizing resume content |
| `SAVING` | 85% | Saving optimized content |
| `APPLYING` | 92% | Applying rewrite to resume |
| `COMPLETE` | 100% | Resume optimization completed |

#### 4. React Component Example

```jsx
import { useEffect, useState } from 'react';

function RewriteProgress({ jobId, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Connecting...');
  const [stage, setStage] = useState('INIT');
  const [error, setError] = useState(null);

  useEffect(() => {
    const eventSource = new EventSource(`/api/v1/sse/rewrite/${jobId}`);

    eventSource.addEventListener('job_update', (e) => {
      const data = JSON.parse(e.data);
      
      setProgress(data.progress);
      setMessage(data.message);
      setStage(data.stage);

      if (data.status === 'completed') {
        onComplete(data.data);
        eventSource.close();
      } else if (data.status === 'failed') {
        setError(data.error);
        eventSource.close();
      }
    });

    eventSource.onerror = () => {
      setError('Connection lost');
      eventSource.close();
    };

    return () => eventSource.close();
  }, [jobId, onComplete]);

  if (error) {
    return <div className="error">Rewrite failed: {error}</div>;
  }

  return (
    <div className="rewrite-progress">
      <div className="stage-indicator">{stage}</div>
      <div className="progress-bar">
        <div className="fill" style={{ width: `${progress}%` }} />
      </div>
      <p>{message}</p>
      <span>{progress}%</span>
    </div>
  );
}
```

---

## Statistics Endpoint

Get insights into active connections:

```javascript
const stats = await fetch('/api/v1/sse/stats').then(r => r.json());

console.log(stats);
// {
//   success: true,
//   data: {
//     totalConnections: 5,
//     totalJobSubscriptions: 10,
//     connections: [...]
//   }
// }
```

---

## Key Features

1. **✅ Two Endpoints**: `/api/v1/sse/job/:jobId` (analysis) and `/api/v1/sse/rewrite/:jobId` (rewrite)
2. **✅ Server-Side IDs**: No UUID library needed in frontend
3. **✅ Auto-Subscribe**: Connect and subscribe in one call
4. **✅ Auto-Cleanup**: Connection closes when job completes
5. **✅ Simple**: Minimal frontend code required
6. **✅ Real-time**: Instant progress updates for both analysis and rewrite jobs

---

## Error Handling

```javascript
const eventSource = new EventSource(`/api/v1/sse/job/${jobId}`);

eventSource.onerror = (error) => {
  if (eventSource.readyState === EventSource.CLOSED) {
    console.log('Connection closed by server');
  } else if (eventSource.readyState === EventSource.CONNECTING) {
    console.log('Reconnecting...');
  } else {
    console.error('Connection error:', error);
    eventSource.close();
  }
};

// Manual close
eventSource.close();
```

---

## Event Types

### `connected`
Initial connection established
```javascript
{
  connectionId: "uuid",
  timestamp: 1699267200000,
  message: "SSE connection established"
}
```

### `job_update`
Job progress update
```javascript
{
  type: "job_update",
  jobId: "resume-123-1699267200000",
  status: "in_progress", // started | in_progress | completed | failed
  progress: 50, // 0-100
  stage: "parsing", // initializing | fetching | parsing | analyzing | storing
  message: "Parsing resume content",
  result: {...}, // when completed
  error: "...", // when failed
}
```

### `heartbeat`
Keep-alive ping (every 30 seconds)
```javascript
{
  timestamp: 1699267200000
}
```

---

## Troubleshooting

### No events received
- ✅ Verify job ID is correct
- ✅ Check job was added to queue successfully
- ✅ Ensure worker is running

### Connection closes immediately
- ✅ Check backend logs for errors
- ✅ Verify job exists in queue
- ✅ Ensure Redis/PubSub is running

### High memory usage
- ✅ Always close EventSource on unmount
- ✅ Don't create multiple connections to same job
- ✅ Check for event listener leaks

---

## See Also

- [Queue Service Usage](./QUEUE_SERVICE_USAGE.md)
- [Redis Pub/Sub SSE](./REDIS_PUBSUB_SSE.md)
- [Azure Blob Upload](./AZURE_BLOB_UPLOAD.md)
