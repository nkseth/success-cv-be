# Pagination and Filtering Documentation

## Overview

All GET APIs that return lists now support pagination, filtering, searching, and sorting capabilities. This provides a consistent and powerful way to query data across the entire application.

## Query Parameters Format

### Basic Pagination
```
GET /api/endpoint?page=1&limit=10
```
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

### Search
```
GET /api/endpoint?q=search_term
```
- `q`: Search query string (searches across configured fields)

### Single Value Filters
```
GET /api/endpoint?status=completed
```
- Filter by exact value

### Multiple Value Filters (OR condition)
```
GET /api/endpoint?status=completed,pending
GET /api/endpoint?role=admin,member
GET /api/endpoint?isVerified=true,false
```
- Comma-separated values create OR conditions
- Example: `status=completed,pending` returns items with status "completed" OR "pending"

### Date Range Filters
```
GET /api/endpoint?createdAt=2025-01-01,2025-12-31
GET /api/endpoint?joinedAt=2025-10-06T18:30:00.000Z,2025-10-23T18:30:00.000Z
```
- Format: `field=start_date,end_date`
- Supports both date strings and ISO 8601 timestamps
- Filters items where field is between start and end dates (inclusive)

### Sorting
```
GET /api/endpoint?sortBy=createdAt&sortOrder=desc
```
- `sortBy`: Field name to sort by
- `sortOrder`: Either `asc` or `desc` (default: desc)

### Combined Example
```
GET /api/v1/organisations/123/members?page=2&limit=20&q=john&role=admin,member&userIsVerified=true&joinedAt=2025-01-01,2025-12-31&sortBy=joinedAt&sortOrder=desc
```

## Response Format

All paginated endpoints return data in this format:

```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": {
    "data": [...], // Array of items
    "pagination": {
      "currentPage": 1,
      "pageSize": 10,
      "totalCount": 45,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false,
      "nextPage": 2,
      "prevPage": null
    },
    "filters": { // Only included if filters were applied
      "role": ["admin", "member"],
      "userIsVerified": true
    }
  }
}
```

## Endpoint-Specific Filters

### Resume Analysis - `/api/v1/resume-analysis`

**Available Filters:**
- `status`: Array - Filter by analysis status
  - Values: `completed`, `pending`, `failed`
  - Example: `?status=completed,pending`
- `createdAt`: Date range
  - Example: `?createdAt=2025-01-01,2025-12-31`
- `completedAt`: Date range
  - Example: `?completedAt=2025-01-01,2025-12-31`
- `atsScore`: Number - ATS score (extracted from meta)

**Search:** Searches in document title

**Sortable Fields:** `createdAt`, `updatedAt`, `completedAt`, `atsScore`

**Note:** Sorting by `atsScore` is done in-memory since it's stored in a JSON field. For large datasets, prefer sorting by other fields for better performance.

**Example:**
```
GET /api/v1/resume-analysis?page=1&limit=20&status=completed&createdAt=2025-01-01,2025-12-31&sortBy=completedAt&sortOrder=desc
```

### Organisation Members - `/api/v1/organisations/:id/members`

**Available Filters:**
- `role`: Array - Filter by member role
  - Values: `admin`, `member`
  - Example: `?role=admin,member`
- `userIsVerified`: Boolean (supports multiple)
  - Example: `?userIsVerified=true` or `?userIsVerified=true,false`
- `joinedAt`: Date range
  - Example: `?joinedAt=2025-01-01,2025-12-31`

**Search:** Searches in user name and email

**Sortable Fields:** `joinedAt`, `userName`, `userEmail`, `role`, `userIsVerified`

**Example:**
```
GET /api/v1/organisations/123/members?page=1&q=john&role=admin&userIsVerified=true&joinedAt=2025-01-01,2025-12-31&sortBy=joinedAt&sortOrder=desc
```

### Organisation Invites - `/api/v1/organisations/:id/invites`

**Available Filters:**
- `type`: Array - Filter by invite type
  - Values: `admin`, `member`
  - Example: `?type=admin,member`
- `isAccepted`: Boolean (supports multiple)
  - Example: `?isAccepted=false` or `?isAccepted=true,false`
- `createdAt`: Date range
- `expiresAt`: Date range

**Search:** Searches in email

**Sortable Fields:** `createdAt`, `expiresAt`, `email`, `type`, `isAccepted`

**Example:**
```
GET /api/v1/organisations/123/invites?page=1&isAccepted=false&createdAt=2025-01-01,2025-12-31&sortBy=createdAt&sortOrder=desc
```

### Resumes - `/api/v1/resumes`

**Available Filters:**
- `createdAt`: Date range
- `updatedAt`: Date range
- `isDraft`: Boolean (supports multiple)

**Search:** Searches in resume content

**Sortable Fields:** `createdAt`, `updatedAt`, `version`

**Example:**
```
GET /api/v1/resumes?page=1&limit=10&createdAt=2025-01-01,2025-12-31&sortBy=updatedAt&sortOrder=desc
```

### Resume Rewrites - `/api/v1/resumes/:id/rewrites`

**Available Filters:**
- `status`: Array - Filter by rewrite status
  - Values: `pending`, `processing`, `completed`, `failed`
  - Example: `?status=completed,processing`
- `isActive`: Boolean
- `createdAt`: Date range
- `completedAt`: Date range

**Sortable Fields:** `createdAt`, `updatedAt`, `completedAt`, `versionNumber`

**Example:**
```
GET /api/v1/resumes/456/rewrites?page=1&status=completed&isActive=true&sortBy=versionNumber&sortOrder=desc
```

### Themes - `/api/v1/themes`

**Available Filters:**
- `category`: String - Filter by theme category
  - Values: `professional`, `creative`, `minimal`, `ats-optimized`, `academic`
  - Example: `?category=professional`
- `isATSOptimized`: Boolean
- `isPublic`: Boolean

**Search:** Searches in theme name or description

**Sortable Fields:** `usageCount`, `createdAt`, `name`

**Example:**
```
GET /api/v1/themes?page=1&limit=20&category=professional&isATSOptimized=true&q=modern&sortBy=usageCount&sortOrder=desc
```

## Implementation Details

### Architecture

The pagination and filtering system is built with three layers:

1. **Utility Layer** (`utils/pagination-filter.js`)
   - `parseQueryParams()`: Parses request query parameters
   - `buildWhereConditions()`: Builds Drizzle ORM where conditions
   - `buildSearchCondition()`: Builds search conditions
   - `buildOrderBy()`: Builds order by clauses
   - `getPaginationMeta()`: Calculates pagination metadata
   - `formatPaginatedResponse()`: Formats the final response

2. **Model Layer** (e.g., `models/resume.model.js`)
   - Updated to accept options object with pagination, filters, search, sort
   - Returns object with data array and totalCount
   - Uses utility functions to build queries

3. **Controller Layer** (e.g., `controllers/resume.controller.js`)
   - Parses query parameters using `parseQueryParams()`
   - Passes options to model/service layer
   - Formats response using pagination utilities

### Adding Pagination to New Endpoints

To add pagination to a new GET endpoint:

1. **Update Controller:**
```javascript
import { 
    parseQueryParams, 
    getPaginationMeta, 
    formatPaginatedResponse 
} from "../utils/pagination-filter.js";

export const getItemsController = asyncHandler(async (req, res, next) => {
    // Parse query parameters
    const { pagination, search, filters, sort } = parseQueryParams(req.query, {
        defaultPageSize: 10,
        maxPageSize: 100,
        filterableFields: {
            status: 'array',
            isActive: 'boolean',
            createdAt: 'dateRange',
        },
        sortableFields: ['createdAt', 'updatedAt'],
        defaultSort: { field: 'createdAt', order: 'desc' }
    });

    // Get data from model/service
    const { items, totalCount } = await itemModel.getAll({
        pagination,
        filters,
        search,
        sort
    });

    // Format response
    const paginationMeta = getPaginationMeta(totalCount, pagination);
    const response = formatPaginatedResponse(items, paginationMeta, filters);

    sendSuccess(res, response, "Items retrieved successfully", 200);
});
```

2. **Update Model:**
```javascript
import { 
    buildWhereConditions, 
    buildSearchCondition, 
    buildOrderBy 
} from "../utils/pagination-filter.js";
import { eq, and, desc, asc, inArray, gte, lte, or, ilike, count } from "drizzle-orm";

export const getAll = async (options = {}) => {
    const {
        pagination = { limit: 10, offset: 0 },
        filters = {},
        search = { query: '', fields: [] },
        sort = { field: 'createdAt', order: 'desc' }
    } = options;

    // Build where conditions
    const whereConditions = [];
    
    // Add filter conditions
    const filterConditions = buildWhereConditions(
        filters,
        tableColumns,
        { eq, inArray, gte, lte, or, and }
    );
    whereConditions.push(...filterConditions);

    // Add search condition
    const searchCondition = buildSearchCondition(
        search.query,
        [table.name, table.description],
        { or, ilike }
    );
    if (searchCondition) {
        whereConditions.push(searchCondition);
    }

    // Get total count
    const [{ totalCount }] = await db
        .select({ totalCount: count() })
        .from(table)
        .where(and(...whereConditions));

    // Build order by
    const orderByClause = buildOrderBy(sort, table, { asc, desc });

    // Fetch paginated data
    const items = await db
        .select()
        .from(table)
        .where(and(...whereConditions))
        .orderBy(...orderByClause)
        .limit(pagination.limit)
        .offset(pagination.offset);

    return { items, totalCount };
};
```

## Testing

Test all query parameter combinations:

1. **Basic pagination:**
   ```
   GET /api/endpoint?page=1
   GET /api/endpoint?page=2&limit=20
   ```

2. **Filtering:**
   ```
   GET /api/endpoint?status=completed
   GET /api/endpoint?status=completed,pending
   ```

3. **Date ranges:**
   ```
   GET /api/endpoint?createdAt=2025-01-01,2025-12-31
   ```

4. **Search:**
   ```
   GET /api/endpoint?q=search_term
   ```

5. **Sorting:**
   ```
   GET /api/endpoint?sortBy=createdAt&sortOrder=asc
   ```

6. **Combined:**
   ```
   GET /api/endpoint?page=2&limit=20&status=completed&createdAt=2025-01-01,2025-12-31&q=test&sortBy=createdAt&sortOrder=desc
   ```

## Notes

- All date filters support both simple dates (`2025-01-01`) and ISO 8601 timestamps (`2025-10-06T18:30:00.000Z`)
- Boolean filters can accept multiple values to allow OR conditions (e.g., `?isVerified=true,false` returns both verified and unverified)
- Array filters (like `status`, `role`) automatically use OR conditions
- Default page size is 10, maximum is 100
- Search is case-insensitive
- All endpoints maintain backward compatibility - they work without any query parameters
