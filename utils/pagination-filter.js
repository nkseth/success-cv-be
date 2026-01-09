import { sql } from "drizzle-orm";

/**
 * Pagination and Filtering Utility for Drizzle ORM
 * 
 * Supports:
 * - Pagination: ?page=1 (default page size: 10)
 * - Search: ?q=searchTerm
 * - Single value filters: ?role=admin
 * - Multiple value filters (OR): ?status=completed,pending
 * - Date range filters: ?createdAt=2025-01-01,2025-12-31
 */

/**
 * Parse query parameters for pagination and filtering
 * @param {Object} query - Express request.query object
 * @param {Object} options - Configuration options
 * @returns {Object} Parsed pagination and filter data
 */
export function parseQueryParams(query, options = {}) {
    const {
        defaultPageSize = 10,
        maxPageSize = 100,
        searchFields = [], // Fields to search when ?q= is provided
        filterableFields = {}, // Map of field names to their types
        sortableFields = [], // Allowed fields for sorting
        defaultSort = { field: 'createdAt', order: 'desc' }
    } = options;

    // Parse pagination
    const page = Math.max(1, parseInt(query.page) || 1);
    // Support both 'limit' and 'perPage' parameter names
    const limit = Math.min(
        maxPageSize,
        Math.max(1, parseInt(query.limit || query.perPage) || defaultPageSize)
    );
    const offset = (page - 1) * limit;

    // Parse search query
    const searchQuery = query.q || '';

    // Parse filters
    const filters = {};
    Object.keys(filterableFields).forEach(field => {
        if (query[field] !== undefined && query[field] !== '') {
            const fieldType = filterableFields[field];
            filters[field] = parseFilterValue(query[field], fieldType);
        }
    });

    // Parse sorting
    let sort = defaultSort;
    if (query.sortBy && sortableFields.includes(query.sortBy)) {
        sort = {
            field: query.sortBy,
            order: query.sortOrder === 'asc' ? 'asc' : 'desc'
        };
    }

    return {
        pagination: { page, limit, offset },
        search: { query: searchQuery, fields: searchFields },
        filters,
        sort
    };
}

/**
 * Parse filter value based on field type
 * @param {string} value - Raw query parameter value
 * @param {string} type - Field type (string, number, boolean, date, dateRange)
 * @returns {*} Parsed value
 */
function parseFilterValue(value, type) {
    if (!value) return null;

    switch (type) {
        case 'string':
            return value;
        
        case 'number':
            return parseInt(value);
        
        case 'boolean':
            // Support multiple boolean values: ?isVerified=true,false
            if (value.includes(',')) {
                return value.split(',').map(v => v.trim().toLowerCase() === 'true');
            }
            return value.toLowerCase() === 'true';
        
        case 'array':
            // Multiple values separated by comma: ?role=admin,member
            return value.split(',').map(v => v.trim());
        
        case 'dateRange':
            // Date range: ?createdAt=2025-01-01,2025-12-31
            const dates = value.split(',').map(d => d.trim()).filter(d => d !== '');
            if (dates.length === 2) {
                const startDate = new Date(dates[0]);
                const endDate = new Date(dates[1]);
                // Validate that both dates are valid
                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    return {
                        start: startDate,
                        end: endDate
                    };
                }
            }
            return null;
        
        case 'date':
            return new Date(value);
        
        default:
            return value;
    }
}

/**
 * Build Drizzle ORM where conditions from filters
 * @param {Object} filters - Parsed filters object
 * @param {Object} tableColumns - Drizzle table columns object
 * @param {Object} drizzleOps - Drizzle operators (eq, inArray, like, between, etc.)
 * @returns {Array} Array of Drizzle where conditions
 */
export function buildWhereConditions(filters, tableColumns, drizzleOps) {
    const { eq, inArray, gte, lte, or, and, like, ilike } = drizzleOps;
    const conditions = [];

    Object.entries(filters).forEach(([field, value]) => {
        const column = tableColumns[field];
        if (!column) return;

        if (value === null || value === undefined) return;

        // Handle array values (multiple OR conditions)
        if (Array.isArray(value)) {
            if (typeof value[0] === 'boolean') {
                // For boolean arrays, create OR conditions
                const boolConditions = value.map(v => eq(column, v));
                conditions.push(or(...boolConditions));
            } else {
                conditions.push(inArray(column, value));
            }
        }
        // Handle date range
        else if (value && typeof value === 'object' && value.start && value.end) {
            conditions.push(and(
                gte(column, value.start),
                lte(column, value.end)
            ));
        }
        // Handle single value
        else {
            conditions.push(eq(column, value));
        }
    });

    return conditions;
}

/**
 * Build search conditions for text search
 * @param {string} searchQuery - Search query string
 * @param {Array} searchFields - Array of column objects to search
 * @param {Object} drizzleOps - Drizzle operators
 * @returns {Object|null} Drizzle OR condition or null
 */
export function buildSearchCondition(searchQuery, searchFields, drizzleOps) {
    const { or, ilike } = drizzleOps;
    
    if (!searchQuery || !searchFields || searchFields.length === 0) {
        return null;
    }

    const searchConditions = searchFields.map(field => 
        ilike(field, `%${searchQuery}%`)
    );

    return or(...searchConditions);
}

/**
 * Build order by clause
 * @param {Object} sort - Sort configuration { field, order }
 * @param {Object} tableColumns - Drizzle table columns
 * @param {Object} drizzleOps - Drizzle operators
 * @returns {Array} Array of order by clauses
 */
export function buildOrderBy(sort, tableColumns, drizzleOps) {
    const { asc, desc } = drizzleOps;
    
    if (!sort || !sort.field) return [];

    const column = tableColumns[sort.field];
    if (!column) return [];

    return sort.order === 'asc' ? [asc(column)] : [desc(column)];
}

/**
 * Calculate pagination metadata
 * @param {number} totalCount - Total number of records
 * @param {Object} pagination - Pagination params { page, limit, offset }
 * @returns {Object} Pagination metadata
 */
export function getPaginationMeta(totalCount, pagination) {
    const { page, limit } = pagination;
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
        currentPage: page,
        pageSize: limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
    };
}

/**
 * Helper to format successful paginated response
 * @param {Array} data - Array of records
 * @param {Object} paginationMeta - Pagination metadata
 * @param {Object} filters - Applied filters (optional)
 * @returns {Object} Formatted response object
 */
export function formatPaginatedResponse(data, paginationMeta, filters = {}) {
    return {
        data,
        pagination: paginationMeta,
        filters: Object.keys(filters).length > 0 ? filters : undefined
    };
}
