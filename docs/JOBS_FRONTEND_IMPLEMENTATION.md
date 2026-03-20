# Jobs Feature — Complete Frontend Implementation Guide

> **Stack**: Next.js App Router, shadcn/ui, Tailwind CSS, TanStack Table, nuqs, server actions  
> **Target**: Desktop-first  
> **Date**: March 2026

---

## Table of Contents

1. [Current Issues & Root Causes](#1-current-issues--root-causes)
2. [Architecture Overview](#2-architecture-overview)
3. [File Structure](#3-file-structure)
4. [Bug Fixes — Pagination & Filters](#4-bug-fixes--pagination--filters)
5. [Browse Jobs Page — Complete Rework](#5-browse-jobs-page--complete-rework)
6. [Job Preferences Page — Fixes & Enhancements](#6-job-preferences-page--fixes--enhancements)
7. [Job Matches Page — Full Implementation](#7-job-matches-page--full-implementation)
8. [Job Match Detail Page — Enhancements](#8-job-match-detail-page--enhancements)
9. [Sidebar Navigation Update](#9-sidebar-navigation-update)
10. [UX Flow & Interaction Design](#10-ux-flow--interaction-design)
11. [API ↔ Frontend Field Mapping Reference](#11-api--frontend-field-mapping-reference)

---

## 1. Current Issues & Root Causes

### 🐛 Pagination shows "Page 1 of 0"

**Root Cause**: Backend returns `totalCount` but the frontend type (`JobsResponse`) expects `totalItems`. The `fetchJobs` action normalizes the response but doesn't map `totalCount` → `totalItems`.

**File**: `src/lib/actions/shared/jobs/jobs.ts` — the `fetchJobs` function  
**Fix**: Map the backend response fields in the `fetchJobs` action:

```typescript
// In fetchJobs(), when processing the API response, normalize pagination fields:
const normalizedPagination = {
  page: rawPagination.currentPage ?? rawPagination.page ?? 1,
  limit: rawPagination.pageSize ?? rawPagination.limit ?? 20,
  totalItems: rawPagination.totalCount ?? rawPagination.totalItems ?? 0,
  totalPages: rawPagination.totalPages ?? 0,
  hasNextPage: rawPagination.hasNextPage ?? false,
  hasPrevPage: rawPagination.hasPreviousPage ?? rawPagination.hasPrevPage ?? false,
};
```

**Backend response shape** (actual):
```json
{
  "success": true,
  "message": "...",
  "data": {
    "jobs": [...],
    "pagination": {
      "currentPage": 1,
      "pageSize": 20,
      "totalCount": 150,    // ← NOT totalItems
      "totalPages": 8,
      "hasNextPage": true,
      "hasPreviousPage": false,  // ← NOT hasPrevPage
      "nextPage": 2,
      "previousPage": null
    },
    "appliedPreferences": false
  }
}
```

### 🐛 Table filters don't reach the API

**Root Cause**: The `JobTable` component uses `useDataTable` with `manualFiltering: true`, which means TanStack Table defers filtering to the server. However, the `JobListing` server component only reads URL `searchParams` and passes them to `fetchJobs`. The table's column filter state changes update URL params via `nuqs`, BUT `JobListing` doesn't pass **all** the filter params through — it only reads `page`, `perPage`, `q`, `remoteType`, `employmentType`, `experienceLevel`. It's **missing**: `location`, `minSalary`, `maxSalary`, `skills`, `postedAfter`, `sortBy`, `sortOrder`.

**Fix**: The `JobListing` component must read ALL searchParams and forward them:

```typescript
// src/features/app/jobs/components/job-listing.tsx
interface JobListingProps {
  searchParams: {
    page?: string;
    perPage?: string;
    q?: string;
    location?: string;
    remoteType?: string;
    employmentType?: string;
    experienceLevel?: string;
    minSalary?: string;
    maxSalary?: string;
    skills?: string;
    postedAfter?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}
```

And pass all of them to `fetchJobs()`.

### 🐛 Preferences not shown as auto-applied

**Root Cause**: The `JobListing` server component doesn't check or pass back `appliedPreferences` to the `JobTable`. The `JobBrowser` (the alternative client-side component) does handle it, but it's **not being used** — the page uses `JobListing` + `JobTable` (server component + TanStack Table) instead.

**Decision needed**: Use one approach consistently:
- **Option A (Recommended)**: Keep `JobListing` as server component with `JobTable`, but add a client wrapper to show the preferences banner.
- **Option B**: Switch to `JobBrowser` (fully client-side) — simpler but loses SSR.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Jobs Feature Architecture                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Pages (App Router)                                                 │
│  ├── /dashboard/jobs              → Browse Jobs (server + client)   │
│  ├── /dashboard/jobs/preferences  → Job Preferences (client)        │
│  ├── /dashboard/jobs/matches      → Job Matches (client)            │
│  └── /dashboard/jobs/matches/[id] → Match Detail (server)           │
│                                                                     │
│  Feature Components (src/features/app/jobs/components/)             │
│  ├── job-listing.tsx          → Server component fetching jobs      │
│  ├── job-tables/              → TanStack Table + columns            │
│  │   ├── index.tsx            → JobTable wrapper                    │
│  │   └── columns.tsx          → Column definitions                  │
│  ├── job-preferences-banner.tsx → NEW: Shows when prefs applied     │
│  ├── job-preferences-form.tsx → Preferences form                    │
│  ├── job-matches-dashboard.tsx → Matches list with filters          │
│  ├── job-match-card.tsx       → Individual match card                │
│  ├── job-matching-trigger.tsx → Generate matches CTA                │
│  ├── job-rewrite-trigger.tsx  → Resume rewrite dialog               │
│  └── job-detail-sheet.tsx     → NEW: Side panel for job details     │
│                                                                     │
│  Server Actions (src/lib/actions/shared/jobs/)                      │
│  ├── index.ts                 → Re-exports                          │
│  └── jobs.ts                  → All API calls                       │
│                                                                     │
│  Types (src/types/jobs.ts)    → All TypeScript interfaces           │
│                                                                     │
│  Shared UI (src/components/ui/table/)                               │
│  ├── data-table.tsx           → Reusable DataTable                  │
│  ├── data-table-toolbar.tsx   → Toolbar with filters                │
│  ├── data-table-pagination.tsx → Pagination controls                │
│  └── data-table-faceted-filter.tsx → Multi-select filters           │
│                                                                     │
│  Hooks                                                              │
│  └── use-data-table.ts        → URL-synced table state (nuqs)       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. File Structure

```
src/
├── app/app/dashboard/jobs/
│   ├── page.tsx                    # Browse Jobs (MODIFY)
│   ├── preferences/page.tsx        # Job Preferences (MINOR TWEAKS)
│   ├── matches/
│   │   ├── page.tsx                # Matches Dashboard (MODIFY)
│   │   └── [id]/page.tsx           # Match Detail (MODIFY)
│
├── features/app/jobs/
│   ├── index.ts                    # Re-exports
│   └── components/
│       ├── index.ts                # Component exports (MODIFY)
│       ├── job-listing.tsx         # Server component (FIX)
│       ├── job-tables/
│       │   ├── index.tsx           # Table wrapper (FIX)
│       │   └── columns.tsx         # Column defs (ENHANCE)
│       ├── job-preferences-banner.tsx  # NEW
│       ├── job-preferences-form.tsx    # (MINOR FIX)
│       ├── job-detail-sheet.tsx        # NEW
│       ├── job-matches-dashboard.tsx   # (FIX PAGINATION)
│       ├── job-match-card.tsx          # (ENHANCE)
│       ├── job-matching-trigger.tsx    # (OK as-is)
│       └── job-rewrite-trigger.tsx     # (OK as-is)
│
├── lib/actions/shared/jobs/
│   ├── index.ts
│   └── jobs.ts                     # Server actions (FIX RESPONSE MAPPING)
│
├── types/
│   └── jobs.ts                     # Types (UPDATE)
│
└── constants/
    └── data.ts                     # Sidebar nav (UPDATE)
```

---

## 4. Bug Fixes — Pagination & Filters

### Fix 1: Normalize Backend Response in `jobs.ts`

**File**: `src/lib/actions/shared/jobs/jobs.ts`

In `fetchJobs()`, after getting the response, normalize the pagination object:

```typescript
// Helper function to normalize pagination from backend
function normalizePagination(raw: any) {
  return {
    page: raw?.currentPage ?? raw?.page ?? 1,
    limit: raw?.pageSize ?? raw?.limit ?? 20,
    totalItems: raw?.totalCount ?? raw?.totalItems ?? 0,
    totalPages: raw?.totalPages ?? 0,
    hasNextPage: raw?.hasNextPage ?? false,
    hasPrevPage: raw?.hasPreviousPage ?? raw?.hasPrevPage ?? false,
  };
}
```

Apply this normalization wherever pagination is received (both `fetchJobs` and `fetchJobMatches`).

### Fix 2: Forward All Search Params in `job-listing.tsx`

**File**: `src/features/app/jobs/components/job-listing.tsx`

```typescript
interface JobListingProps {
  searchParams: {
    page?: string;
    perPage?: string;
    q?: string;
    location?: string;
    remoteType?: string;
    employmentType?: string;
    experienceLevel?: string;
    minSalary?: string;
    maxSalary?: string;
    skills?: string;
    postedAfter?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}

export async function JobListing({ searchParams }: JobListingProps) {
  const page = parseInt(searchParams.page || '1');
  const perPage = parseInt(searchParams.perPage || '20');

  const result = await fetchJobs({
    page,
    limit: perPage,
    q: searchParams.q || undefined,
    location: searchParams.location || undefined,
    remoteType: searchParams.remoteType || undefined,
    employmentType: searchParams.employmentType || undefined,
    experienceLevel: searchParams.experienceLevel || undefined,
    minSalary: searchParams.minSalary ? parseInt(searchParams.minSalary) : undefined,
    maxSalary: searchParams.maxSalary ? parseInt(searchParams.maxSalary) : undefined,
    skills: searchParams.skills || undefined,
    postedAfter: searchParams.postedAfter || undefined,
    sortBy: (searchParams.sortBy as any) || undefined,
    sortOrder: (searchParams.sortOrder as any) || undefined,
  });

  // Remove the console.log
  if (!result.success) {
    return <div>Error loading jobs: {result.message || 'Unknown error'}</div>;
  }

  return (
    <>
      {result.data?.appliedPreferences && (
        <JobPreferencesBanner />
      )}
      <JobTable<Job, unknown>
        data={result.data?.jobs || []}
        totalItems={result.data?.pagination?.totalItems || 0}
        columns={jobColumns}
      />
    </>
  );
}
```

### Fix 3: Ensure `pageCount` Is Correct in `JobTable`

**File**: `src/features/app/jobs/components/job-tables/index.tsx`

The `pageCount` calculation looks correct (`Math.ceil(totalItems / pageSize)`), but if `totalItems` is `0` because of the mapping bug, it'll always be `0`. Fixing Fix 1 should resolve this.

Additionally, ensure the `useDataTable` hook is receiving the correct `pageCount`:

```typescript
export function JobTable<TData, TValue>({
  data,
  totalItems,
  columns,
}: JobTableProps<TData, TValue>) {
  const [pageSize] = useQueryState('perPage', parseAsInteger.withDefault(20));
  const pageCount = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0;

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    shallow: false,
    debounceMs: 500,
    enableGlobalSearch: true,
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar
        table={table}
        enableGlobalSearch={true}
        enableAdvancedFilters={false}
        globalSearchPlaceholder='Search jobs...'
      />
    </DataTable>
  );
}
```

---

## 5. Browse Jobs Page — Complete Rework

### 5.1 Page Layout (`/dashboard/jobs`)

**File**: `src/app/app/dashboard/jobs/page.tsx`

The page should pass ALL `searchParams` through, including the new ones:

```typescript
import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { JobListing } from '@/features/app/jobs/components/job-listing';
import { Suspense } from 'react';

export const metadata = {
  title: 'Browse Jobs',
  description: 'Find your next career opportunity',
};

interface JobsPageProps {
  searchParams: Promise<{
    page?: string;
    perPage?: string;
    q?: string;
    location?: string;
    remoteType?: string;
    employmentType?: string;
    experienceLevel?: string;
    minSalary?: string;
    maxSalary?: string;
    skills?: string;
    postedAfter?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const resolvedParams = await searchParams;
  
  return (
    <PageContainer scrollable={false}>
      <div className='flex w-full flex-1 flex-col space-y-4'>
        <Heading
          title='Browse Jobs'
          description='Discover and apply to job opportunities'
        />
        <Separator />
        <Suspense
          fallback={
            <DataTableSkeleton
              columnCount={8}
              rowCount={10}
              filterCount={3}
            />
          }
        >
          <JobListing searchParams={resolvedParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
```

> **Note**: In Next.js 15+, `searchParams` is a `Promise`. Make sure you're `await`ing it.

### 5.2 Enhanced Column Definitions

**File**: `src/features/app/jobs/components/job-tables/columns.tsx`

The existing columns are good. Add these improvements:

#### A) Make the Location column filterable with a text input

Add a `location` filter column using the `meta.variant: 'text'` pattern, or add it as a separate Input above the table. Since your toolbar doesn't have a `text` variant (it was removed), the best approach is to rely on the global search (`q`) for text searching and keep the faceted filters for the enum columns.

#### B) Add a "Posted Date" relative time display

```typescript
// In the postedDate column cell:
cell: ({ row }) => {
  const date = row.original.postedDate;
  if (!date) return <span className="text-muted-foreground">-</span>;
  
  const posted = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));
  
  let relativeText: string;
  if (diffDays === 0) relativeText = 'Today';
  else if (diffDays === 1) relativeText = 'Yesterday';
  else if (diffDays < 7) relativeText = `${diffDays}d ago`;
  else if (diffDays < 30) relativeText = `${Math.floor(diffDays / 7)}w ago`;
  else relativeText = format(posted, 'MMM d, yyyy');
  
  return (
    <span className="text-sm text-muted-foreground" title={format(posted, 'PPP')}>
      {relativeText}
    </span>
  );
},
```

#### C) Add a "View" action to open the side Sheet

```typescript
// In the actions column:
{
  id: 'actions',
  cell: ({ row }) => {
    const job = row.original;
    const applicationUrl = job.applicationUrl || job.applyUrl;
    
    return (
      <div className="flex items-center gap-2">
        <JobDetailSheet job={job} />
        <Button variant="outline" size="sm" asChild>
          <a href={applicationUrl} target="_blank" rel="noopener noreferrer">
            Apply <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </Button>
      </div>
    );
  },
},
```

### 5.3 NEW: Preferences Banner Component

**File**: `src/features/app/jobs/components/job-preferences-banner.tsx`

```typescript
'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function JobPreferencesBanner() {
  const router = useRouter();

  const clearPreferences = () => {
    // Navigate with an explicit empty filter to bypass preference auto-apply
    // Adding any param tells the backend "user chose explicit filters"
    router.push('/app/dashboard/jobs?page=1&perPage=20');
  };

  return (
    <Alert className="border-primary/20 bg-primary/5">
      <Settings className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Smart Filter</Badge>
          <span className="text-sm">
            Results filtered by your saved preferences.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/dashboard/jobs/preferences">
              Edit Preferences
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={clearPreferences}>
            <X className="h-3 w-3 mr-1" />
            Show All
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
```

### 5.4 NEW: Job Detail Side Sheet

**File**: `src/features/app/jobs/components/job-detail-sheet.tsx`

Create a `Sheet` that slides in from the right when clicking "View" on a job row. This keeps the user in context of the browse table while seeing full details.

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Building2,
  MapPin,
  DollarSign,
  Calendar,
  ExternalLink,
  GraduationCap,
  Briefcase,
  Eye,
} from 'lucide-react';
import type { Job } from '@/types/jobs';

interface JobDetailSheetProps {
  job: Job;
}

export function JobDetailSheet({ job }: JobDetailSheetProps) {
  const [open, setOpen] = useState(false);

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Not disclosed';
    const fmt = (n: number) => `$${(n / 1000).toFixed(0)}k`;
    if (min && max) return `${fmt(min)} – ${fmt(max)}/yr`;
    if (min) return `From ${fmt(min)}/yr`;
    if (max) return `Up to ${fmt(max)}/yr`;
    return 'Not disclosed';
  };

  const relativeDate = (dateStr: string) => {
    const days = Math.floor(
      (Date.now() - new Date(dateStr).getTime()) / 86400000
    );
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="h-3.5 w-3.5 mr-1" />
          View
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[540px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader className="space-y-4 pb-4">
          <SheetTitle className="text-xl">{job.title}</SheetTitle>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="font-medium text-foreground">{job.company}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {job.location}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Posted {relativeDate(job.postedDate)}
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                job.remoteType === 'remote'
                  ? 'default'
                  : job.remoteType === 'hybrid'
                    ? 'secondary'
                    : 'outline'
              }
              className="capitalize"
            >
              {job.remoteType}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {job.employmentType?.replace('-', ' ')}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {job.experienceLevel}
            </Badge>
          </div>

          {/* Salary */}
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {formatSalary(job.salaryMin, job.salaryMax)}
            </span>
          </div>

          {/* Apply Button */}
          <Button className="w-full" asChild>
            <a
              href={job.applicationUrl || job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Apply on Company Site
              <ExternalLink className="h-4 w-4 ml-2" />
            </a>
          </Button>
        </SheetHeader>

        <Separator />

        {/* Description */}
        <div className="space-y-4 py-4">
          {job.description && (
            <div>
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {job.description}
              </p>
            </div>
          )}

          {/* Requirements */}
          {job.requirements && job.requirements.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Requirements</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {job.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills */}
          {(job.skillsRequired?.primary || job.skills) && (
            <div>
              <h4 className="font-semibold mb-2">Required Skills</h4>
              <div className="flex flex-wrap gap-1.5">
                {(job.skillsRequired?.primary || job.skills || []).map(
                  (skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  )
                )}
              </div>
              {job.skillsRequired?.secondary &&
                job.skillsRequired.secondary.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1">Nice to have:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {job.skillsRequired.secondary.map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Benefits */}
          {job.benefits && job.benefits.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Benefits</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {job.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Education & Experience */}
          <div className="grid grid-cols-2 gap-4">
            {job.educationLevel && (
              <div className="flex items-start gap-2 text-sm">
                <GraduationCap className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium">Education</div>
                  <div className="text-muted-foreground">{job.educationLevel}</div>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2 text-sm">
              <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">Type</div>
                <div className="text-muted-foreground capitalize">
                  {job.employmentType?.replace('-', ' ')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

---

## 6. Job Preferences Page — Fixes & Enhancements

The existing `JobPreferencesForm` is already well-built. Only minor fixes needed:

### Fix 1: Replace deprecated `onKeyPress` with `onKeyDown`

In every tag input that uses `onKeyPress`, replace with:

```typescript
onKeyDown={(e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addItem('preferredTitles', newTitle, setNewTitle);
  }
}}
```

### Fix 2: Add success feedback after save

The `handleSave` already has `toast.success`. Just make sure it also does a visual indication on the button:

```typescript
<Button onClick={handleSave} disabled={saving} size="lg">
  {saving ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Saving...
    </>
  ) : (
    'Save Preferences'
  )}
</Button>
```

### Enhancement: Add a "Preview" link

After saving, add a button to go browse jobs with these preferences:

```typescript
toast.success('Preferences saved!', {
  action: {
    label: 'Browse Jobs →',
    onClick: () => router.push('/app/dashboard/jobs'),
  },
});
```

### Enhancement: Add currency selector

The salary section currently shows "USD" only. Add a currency `Select`:

```typescript
<div className="grid grid-cols-3 gap-4">
  <div className="space-y-2">
    <Label>Min Salary</Label>
    <Input type="number" ... />
  </div>
  <div className="space-y-2">
    <Label>Max Salary</Label>
    <Input type="number" ... />
  </div>
  <div className="space-y-2">
    <Label>Currency</Label>
    <Select value={preferences.currency || 'USD'} onValueChange={...}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="USD">USD</SelectItem>
        <SelectItem value="EUR">EUR</SelectItem>
        <SelectItem value="GBP">GBP</SelectItem>
        <SelectItem value="INR">INR</SelectItem>
      </SelectContent>
    </Select>
  </div>
</div>
```

---

## 7. Job Matches Page — Full Implementation

### 7.1 Uncomment Sidebar Nav Item

**File**: `src/constants/data.ts`

```typescript
// Change from commented out:
// {
//   title: 'Job Matches',
//   url: '/dashboard/jobs/matches',
//   icon: 'target',
//   shortcut: ['j', 'm']
// },

// To active:
{
  title: 'Job Matches',
  url: '/dashboard/jobs/matches',
  icon: 'target',
  shortcut: ['j', 'm']
},
```

### 7.2 Matches Page Wrapper

**File**: `src/app/app/dashboard/jobs/matches/page.tsx`

Add proper page container and metadata:

```typescript
import PageContainer from '@/components/layout/page-container';
import { JobMatchesDashboard } from '@/features/app/jobs';

export const metadata = {
  title: 'Job Matches',
  description: 'AI-matched jobs based on your resume analysis',
};

export default function JobMatchesPage() {
  return (
    <PageContainer scrollable>
      <JobMatchesDashboard />
    </PageContainer>
  );
}
```

### 7.3 Fix Matches Dashboard

**File**: `src/features/app/jobs/components/job-matches-dashboard.tsx`

#### Issues to fix:
1. **No pagination** — the dashboard loads matches but doesn't paginate
2. **Regenerate requires `analysisId` prop** — but the page doesn't pass one. Need to auto-detect or let user pick.
3. **No empty state for first-time users** who haven't generated matches yet

#### Complete rework:

```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Briefcase,
  Filter,
  RefreshCw,
  Sparkles,
  Target,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import type { JobMatch, JobMatchesQueryParams } from '@/types/jobs';
import {
  fetchJobMatches,
  generateJobMatches,
  regenerateJobMatches,
} from '@/lib/actions/shared/jobs';
import { JobMatchCard } from './job-match-card';

export function JobMatchesDashboard() {
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  // Holds the cleanup function for any active polling interval so it can be
  // cleared on component unmount.
  const cleanupRef = useRef<(() => void) | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [filters, setFilters] = useState<JobMatchesQueryParams>({
    minScore: 50,
    status: undefined,
    saved: undefined,
    sortBy: 'matchScore',
    sortOrder: 'desc',
    limit: 20,
    page: 1,
  });

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchJobMatches(filters);
      const matchesData = response?.data?.matches || [];
      setMatches(matchesData);

      // Normalize pagination
      const rawPag = response?.data?.pagination;
      setPagination({
        page: rawPag?.page ?? rawPag?.currentPage ?? 1,
        totalItems: rawPag?.totalItems ?? rawPag?.totalCount ?? 0,
        totalPages: rawPag?.totalPages ?? 0,
        hasNextPage: rawPag?.hasNextPage ?? false,
        hasPrevPage: rawPag?.hasPrevPage ?? rawPag?.hasPreviousPage ?? false,
      });
    } catch (error) {
      console.error('Failed to load matches:', error);
      toast.error('Failed to load job matches');
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  // Clear any active polling interval when the component unmounts.
  useEffect(() => () => { cleanupRef.current?.(); }, []);

  const handleGenerate = async () => {
    setRegenerating(true);
    try {
      // Generate with defaults - backend will find latest analysis
      await generateJobMatches({
        analysisId: 0, // Backend falls back to latest
        minScore: 50,
        maxResults: 50,
      });
      toast.success('Job matching started! Results will appear in 30–60 seconds.');

      // Poll for results
      const poll = setInterval(async () => {
        const res = await fetchJobMatches({ page: 1, limit: 1 });
        if ((res?.data?.matches?.length ?? 0) > 0) {
          clearInterval(poll);
          cleanupRef.current = null;
          loadMatches();
        }
      }, 5000);

      // Stop polling after 2 minutes
      const timeout = setTimeout(() => {
        clearInterval(poll);
        cleanupRef.current = null;
      }, 120000);

      // Store cleanup so unmount can cancel both the interval and the timeout
      cleanupRef.current = () => {
        clearInterval(poll);
        clearTimeout(timeout);
      };
    } catch (error: any) {
      console.error('Failed to generate matches:', error);
      toast.error(error.message || 'Failed to generate matches. Make sure you have a completed resume analysis.');
    } finally {
      setRegenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      // Use the analysis from the first match, or let backend find latest
      const analysisId = matches[0]?.analysisId || 0;
      await regenerateJobMatches(analysisId);
      toast.success('Regenerating matches...');
      setTimeout(loadMatches, 5000);
    } catch (error) {
      toast.error('Failed to regenerate matches');
    } finally {
      setRegenerating(false);
    }
  };

  const updateFilter = (key: keyof JobMatchesQueryParams, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const goToPage = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  // Stats for header
  const excellent = matches.filter((m) => m.matchScore >= 80).length;
  const good = matches.filter((m) => m.matchScore >= 60 && m.matchScore < 80).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Job Matches</h2>
          <p className="text-muted-foreground">
            {pagination.totalItems > 0
              ? `${pagination.totalItems} jobs matched to your resume`
              : 'AI-powered job matching based on your resume analysis'}
          </p>
        </div>
        <div className="flex gap-2">
          {matches.length > 0 && (
            <Button
              onClick={handleRegenerate}
              disabled={regenerating}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats (only when matches exist) */}
      {matches.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{pagination.totalItems}</div>
              <p className="text-xs text-muted-foreground">Total Matches</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{excellent}</div>
              <p className="text-xs text-muted-foreground">Excellent (80%+)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{good}</div>
              <p className="text-xs text-muted-foreground">Good (60-79%)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-600">
                {matches.filter((m) => m.saved || m.isSaved).length}
              </div>
              <p className="text-xs text-muted-foreground">Saved</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters (only when matches exist) */}
      {matches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Min Score: {filters.minScore}%</Label>
                <Slider
                  value={[filters.minScore || 0]}
                  onValueChange={([v]) => updateFilter('minScore', v)}
                  max={100}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={(v) =>
                    updateFilter('status', v === 'all' ? undefined : v)
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="viewed">Viewed</SelectItem>
                    <SelectItem value="saved">Saved</SelectItem>
                    <SelectItem value="applied">Applied</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Saved</Label>
                <Select
                  value={
                    filters.saved === true
                      ? 'saved'
                      : filters.saved === false
                        ? 'not-saved'
                        : 'all'
                  }
                  onValueChange={(v) =>
                    updateFilter(
                      'saved',
                      v === 'all' ? undefined : v === 'saved'
                    )
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="saved">Saved Only</SelectItem>
                    <SelectItem value="not-saved">Not Saved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sort By</Label>
                <Select
                  value={filters.sortBy || 'matchScore'}
                  onValueChange={(v) => updateFilter('sortBy', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matchScore">Best Match</SelectItem>
                    <SelectItem value="createdAt">Date Added</SelectItem>
                    <SelectItem value="jobPostedDate">Job Posted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : matches.length === 0 ? (
        /* Empty State — First time or no results */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Target className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {pagination.totalItems === 0 && !filters.minScore && !filters.status
                ? 'Find Your Perfect Job Match'
                : 'No Matches Found'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              {pagination.totalItems === 0 && !filters.minScore && !filters.status
                ? 'Let AI analyze your resume and find jobs that match your skills, experience, and preferences.'
                : 'Try lowering the minimum score or changing your filters.'}
            </p>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={regenerating} size="lg">
                {regenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Finding Matches...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Matches
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Requires a completed resume analysis. Takes about 30-60 seconds.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Match Cards */}
          <div className="grid gap-6">
            {matches.map((match) => (
              <JobMatchCard key={match.id} match={match} onUpdate={loadMatches} />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.totalItems} matches
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={!pagination.hasPrevPage}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={!pagination.hasNextPage}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

### 7.4 Enhance Match Card

The existing `JobMatchCard` is good. Add these improvements:

#### A) Show sub-scores (skills, experience, education, location)

The backend returns `skillMatchScore`, `experienceMatchScore`, `educationMatchScore`, `locationMatch` on each match. Display them as small progress indicators:

```typescript
// Add to the match card, below the main match score:
<div className="grid grid-cols-4 gap-2 mt-3">
  {[
    { label: 'Skills', score: match.skillMatchScore, color: 'bg-blue-500' },
    { label: 'Experience', score: match.experienceMatchScore, color: 'bg-green-500' },
    { label: 'Education', score: match.educationMatchScore, color: 'bg-purple-500' },
    { label: 'Location', score: match.locationMatch ? 100 : 30, color: 'bg-amber-500' },
  ].map(({ label, score, color }) => (
    <div key={label} className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score ?? 0}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${score ?? 0}%` }}
        />
      </div>
    </div>
  ))}
</div>
```

#### B) Add "Reject" action to footer

```typescript
<Button
  variant="ghost"
  size="sm"
  onClick={() => rejectJob(match.id).then(onUpdate)}
  className="text-destructive hover:text-destructive"
>
  Reject
</Button>
```

#### C) Update types to include sub-scores

In `src/types/jobs.ts`, add to the `JobMatch` interface:

```typescript
export interface JobMatch {
  // ... existing fields ...
  skillMatchScore?: number;       // 0-100
  experienceMatchScore?: number;  // 0-100
  educationMatchScore?: number;   // 0-100
  // locationMatch already exists as boolean
  matchReasons?: {
    matchedSkills?: string[];
    strengthAreas?: string[];
    fitReason?: string;
    [key: string]: any;
  };
  mismatchReasons?: {
    missingSkills?: string[];
    improvementAreas?: string[];
    [key: string]: any;
  };
}
```

---

## 8. Job Match Detail Page — Enhancements

The existing `matches/[id]/page.tsx` is well-structured. Minor improvements:

### A) Use the new sub-scores

Replace the single match score display with a breakdown:

```typescript
// After the main score circle, add:
<div className="grid grid-cols-2 gap-4 mt-4">
  {[
    { label: 'Skills Match', score: matchData.skillMatchScore, icon: Sparkles },
    { label: 'Experience Match', score: matchData.experienceMatchScore, icon: Briefcase },
    { label: 'Education Match', score: matchData.educationMatchScore, icon: GraduationCap },
    { label: 'Location Match', score: matchData.locationMatch ? 100 : 30, icon: MapPin },
  ].map(({ label, score, icon: Icon }) => (
    <div key={label} className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          <span className="font-medium">{score ?? 0}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full mt-1 overflow-hidden">
          <div
            className={`h-full rounded-full ${
              (score ?? 0) >= 80
                ? 'bg-green-500'
                : (score ?? 0) >= 60
                  ? 'bg-blue-500'
                  : 'bg-amber-500'
            }`}
            style={{ width: `${score ?? 0}%` }}
          />
        </div>
      </div>
    </div>
  ))}
</div>
```

### B) Use `matchReasons` / `mismatchReasons` properly

The backend returns structured match/mismatch reasons:

```typescript
// Replace the flat matchReason display with:
{matchData.matchReasons?.fitReason && (
  <div className="space-y-2">
    <h4 className="font-semibold">Why This Matches</h4>
    <p className="text-sm text-muted-foreground">{matchData.matchReasons.fitReason}</p>
  </div>
)}

{matchData.matchReasons?.strengthAreas && matchData.matchReasons.strengthAreas.length > 0 && (
  <div className="space-y-2">
    <h4 className="font-semibold flex items-center gap-2">
      <TrendingUp className="h-4 w-4 text-green-600" />
      Your Strengths for This Role
    </h4>
    <ul className="text-sm space-y-1 text-muted-foreground">
      {matchData.matchReasons.strengthAreas.map((area, i) => (
        <li key={i}>✓ {area}</li>
      ))}
    </ul>
  </div>
)}

{matchData.mismatchReasons?.improvementAreas && matchData.mismatchReasons.improvementAreas.length > 0 && (
  <div className="space-y-2">
    <h4 className="font-semibold flex items-center gap-2">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      Areas to Improve
    </h4>
    <ul className="text-sm space-y-1 text-muted-foreground">
      {matchData.mismatchReasons.improvementAreas.map((area, i) => (
        <li key={i}>→ {area}</li>
      ))}
    </ul>
  </div>
)}
```

---

## 9. Sidebar Navigation Update

**File**: `src/constants/data.ts`

Uncomment the Job Matches nav item:

```typescript
{
  title: 'Jobs',
  url: '#',
  icon: 'briefcase',
  shortcut: ['j', 'j'],
  isActive: false,
  items: [
    {
      title: 'Browse Jobs',
      url: '/dashboard/jobs',
      icon: 'search',
      shortcut: ['j', 'b']
    },
    {
      title: 'Job Matches',
      url: '/dashboard/jobs/matches',
      icon: 'target',
      shortcut: ['j', 'm']
    },
    {
      title: 'Preferences',
      url: '/dashboard/jobs/preferences',
      icon: 'settings',
      shortcut: ['j', 'p']
    }
  ]
},
```

---

## 10. UX Flow & Interaction Design

### 10.1 User Journey Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FIRST-TIME USER FLOW                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. User uploads resume → Gets analysis                                │
│     ↓                                                                  │
│  2. Analysis page shows "Find Matching Jobs" CTA                       │
│     (JobMatchingTrigger component — already exists)                     │
│     ↓                                                                  │
│  3. User clicks → Background matching starts (30-60 sec)               │
│     ↓                                                                  │
│  4. Redirect to /jobs/matches → Shows results                          │
│                                                                        │
│  PARALLEL PATH:                                                        │
│  1. User goes to Browse Jobs → Sees all jobs                           │
│     ↓                                                                  │
│  2. Nudge: "Set preferences for smarter results →"                     │
│     ↓                                                                  │
│  3. User sets preferences → Saves                                      │
│     ↓                                                                  │
│  4. Goes back to Browse Jobs → Preferences auto-applied                │
│     Banner: "Filtered by your preferences [Edit] [Show All]"           │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Interaction Patterns

| Action | Trigger | Feedback | Duration |
|--------|---------|----------|----------|
| Filter change | Select/Input change | Table refetches (debounced 500ms) | ~200ms |
| Search typing | Input onChange | Debounced 500ms, then refetch | ~700ms total |
| Page change | Pagination button | Instant URL update + refetch | ~200ms |
| Save preference | Button click | Toast "Preferences saved!" + link | Instant |
| Generate matches | Button click | Loading spinner → polling → results | 30-60s |
| Save job | Bookmark icon | Optimistic toggle + toast | Instant |
| Apply to job | "Apply" button | Opens external link + marks as applied | Instant |
| View job detail | "View" in table | Side Sheet opens | Instant |
| Reject match | "Reject" button | Confirm dialog → remove from list | Instant |
| Rewrite resume | "Optimize" button | Dialog → loading → toast | ~30s |

### 10.3 Empty States

| Page | Condition | Message | CTA |
|------|-----------|---------|-----|
| Browse Jobs | No jobs found with filters | "No jobs match your current filters." | "Clear Filters" button |
| Browse Jobs | No jobs at all | "No jobs available yet. Check back soon!" | Link to preferences |
| Job Matches | Never generated | "Find Your Perfect Job Match" + explanation | "Generate Matches" |
| Job Matches | Generated but 0 results | "No matches above your score threshold." | "Lower score" / "Update resume" |
| Preferences | No prefs saved | Form shows defaults (empty arrays) | Just fill & save |

### 10.4 Loading States

| Component | Loading Pattern | Implementation |
|-----------|----------------|----------------|
| Browse Jobs table | `DataTableSkeleton` (8 cols × 10 rows) | Already uses `Suspense` |
| Job Matches list | 3× Card skeletons | Already implemented |
| Match detail page | Full page skeleton with 2-col layout | Add `loading.tsx` |
| Preferences form | Centered `Loader2` spinner | Already implemented |
| Filter changes | No spinner, just refetch | Keep current behavior |

---

## 11. API ↔ Frontend Field Mapping Reference

### Browse Jobs: `GET /api/v1/jobs`

| Frontend (URL param) | Backend (query param) | Frontend Type | Notes |
|----------------------|----------------------|---------------|-------|
| `page` | `page` | number | 1-indexed |
| `perPage` | `limit` | number | Default: 20 |
| `q` | `q` | string | Full-text search (title, company, description) |
| `location` | `location` | string | Fuzzy match via ILIKE |
| `remoteType` | `remoteType` | CSV string | `remote,hybrid,onsite` |
| `employmentType` | `employmentType` | CSV string | `full-time,part-time,contract,internship` |
| `experienceLevel` | `experienceLevel` | CSV string | `entry,mid,senior,lead` |
| `minSalary` | `minSalary` | number | - |
| `maxSalary` | `maxSalary` | number | - |
| `skills` | `skills` | CSV string | JSONB contains check |
| `postedAfter` | `postedAfter` | ISO date | - |
| `sortBy` | `sortBy` | string | `postedDate`, `company`, `title`, any column |
| `sortOrder` | `sortOrder` | string | `asc` or `desc` (default: `desc`) |

### Backend Pagination Response → Frontend Type

| Backend Field | Frontend Field | Notes |
|---------------|----------------|-------|
| `currentPage` | `page` | Normalize in `fetchJobs` |
| `pageSize` | `limit` | Normalize in `fetchJobs` |
| `totalCount` | `totalItems` | **THE BUG** — map this |
| `totalPages` | `totalPages` | Same |
| `hasNextPage` | `hasNextPage` | Same |
| `hasPreviousPage` | `hasPrevPage` | Rename in normalization |
| `nextPage` | — | Not used in frontend |
| `previousPage` | — | Not used in frontend |

### Job Matches: `GET /api/v1/job-matches`

| Frontend (URL param) | Backend (query param) | Frontend Type | Notes |
|----------------------|----------------------|---------------|-------|
| `page` | `page` | number | 1-indexed |
| `perPage` / `limit` | `limit` | number | Default: 20 |
| `minScore` | `minScore` | number | 0-100 |
| `status` | `status` | CSV string | `new,viewed,saved,applied,rejected,archived` |
| `saved` / `isSaved` | `isSaved` | `"true"/"false"` | Boolean as string |
| `applied` / `isApplied` | `isApplied` | `"true"/"false"` | Boolean as string |
| `analysisId` | `analysisId` | number | - |
| `sortBy` | `sortBy` | string | `matchScore`, `createdAt` |
| `sortOrder` | `sortOrder` | string | `asc` or `desc` |

### Job Match Object: Backend → Frontend

| Backend Field | Frontend Field | Notes |
|---------------|----------------|-------|
| `match_score` | `matchScore` | Drizzle camelCase |
| `skill_match_score` | `skillMatchScore` | **Add to type** |
| `experience_match_score` | `experienceMatchScore` | **Add to type** |
| `education_match_score` | `educationMatchScore` | **Add to type** |
| `location_match` | `locationMatch` | boolean |
| `match_reasons` | `matchReasons` | `{ matchedSkills, strengthAreas, fitReason }` |
| `mismatch_reasons` | `mismatchReasons` | `{ missingSkills, improvementAreas }` |
| `is_saved` | `saved` / `isSaved` | Support both |
| `is_applied` | `applied` / `isApplied` | Support both |

### Preferences: `PUT /api/v1/job-preferences`

| Frontend Field | Backend Field | Type | Notes |
|----------------|---------------|------|-------|
| `preferredTitles` | `preferredTitles` | `string[]` | - |
| `preferredLocations` | `preferredLocations` | `string[]` | - |
| `remotePreference` | `remotePreference` | enum | `remote_only`, `hybrid`, `onsite`, `no_preference` |
| `employmentTypes` | `employmentTypes` | `string[]` | - |
| `experienceLevels` | `experienceLevels` | `string[]` | - |
| `minSalary` | `minSalary` | number | - |
| `maxSalary` | `maxSalary` | number | - |
| `mustHaveSkills` | `mustHaveSkills` | `string[]` | - |
| `excludedCompanies` | `excludedCompanies` | `string[]` | - |
| `notificationEnabled` | `notificationEnabled` | boolean | - |
| `notificationFrequency` | `notificationFrequency` | enum | `realtime`, `daily`, `weekly`, `never` |
| `minMatchScoreNotification` | `minMatchScoreNotification` | number | 0-100 |

---

## Summary of Changes by Priority

### 🔴 Critical (Fix broken features)

1. **Fix pagination field mapping** in `fetchJobs()` — `totalCount` → `totalItems`, `hasPreviousPage` → `hasPrevPage`
2. **Forward ALL search params** in `job-listing.tsx` — add `location`, `minSalary`, `maxSalary`, `skills`, `postedAfter`, `sortBy`, `sortOrder`
3. **Remove `console.log`** in `job-listing.tsx`
4. **Fix `searchParams` Promise** — in Next.js 15+, `searchParams` is async in server components

### 🟡 Important (Missing features)

5. **Uncomment Job Matches in sidebar nav** — `src/constants/data.ts`
6. **Add `JobPreferencesBanner`** — show when preferences are auto-applied
7. **Add pagination to Matches Dashboard** — currently missing
8. **Update `JobMatch` type** — add `skillMatchScore`, `experienceMatchScore`, `educationMatchScore`, `mismatchReasons`
9. **Fix Matches Dashboard `analysisId` dependency** — allow generating without explicit ID

### 🟢 Nice-to-have (UX polish)

10. **Add `JobDetailSheet`** — side panel for quick job preview from table
11. **Add sub-score breakdown** to match cards and detail page
12. **Add relative dates** to posted date column ("2d ago")
13. **Add currency selector** to preferences
14. **Replace `onKeyPress`** with `onKeyDown` in preferences form
15. **Add toast action links** (e.g., "Browse Jobs →" after saving preferences)
