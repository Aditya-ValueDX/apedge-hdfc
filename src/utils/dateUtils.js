import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export const DISPLAY_DATE_FORMAT = 'DD-MM-YYYY';
export const RAW_DATE_FORMAT = 'YYYY-MM-DD';

export const formatDate = (date) => {
    if (!date) return '';
    const parsed = dayjs(date);
    return parsed.isValid() ? parsed.format(DISPLAY_DATE_FORMAT) : '';
};

export const formatDateTime = (date) => {
    if (!date) return '';
    const parsed = dayjs(date);
    return parsed.isValid() ? parsed.format(`${DISPLAY_DATE_FORMAT} hh:mm A`) : '';
};

export const parseDisplayDateToRaw = (displayDate) => {
    if (!displayDate) return '';
    const parsed = dayjs(displayDate, DISPLAY_DATE_FORMAT, true);
    return parsed.isValid() ? parsed.format(RAW_DATE_FORMAT) : '';
};

// ─── Default Date Range Helpers ───────────────────────────────────────────────
// Uses local calendar date (NOT UTC) to avoid timezone-offset issues where
// toISOString() returns yesterday's date for users in UTC+ timezones (e.g. IST),
// causing records from the last ~5.5 hours to be silently excluded.

/**
 * Returns a YYYY-MM-DD string for the given Date object using LOCAL calendar date.
 */
export const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Returns a YYYY-MM-DD string for exactly 1 calendar month ago (local date).
 */
export const getOneMonthAgoDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return getLocalDateString(d);
};

/**
 * Returns today's date as a YYYY-MM-DD string (local date).
 */
export const getTodayDate = () => getLocalDateString(new Date());

/**
 * Validates that a string is a well-formed YYYY-MM-DD date.
 */
export const isValidDateFormat = (dateString) => {
    if (!dateString) return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
};

/**
 * Builds the `created_at` filter suffix for the default 1-month date range.
 * Returns a PostgREST query string fragment, e.g.:
 *   "&created_at=gte.2025-02-20T00:00:00.000Z&created_at=lte.2025-03-20T23:59:59.999Z"
 *
 * The times are expressed in UTC, but the DATE part is derived from the user's
 * local calendar so that "today" always means today in the user's timezone.
 */
export const getDefaultDateRangeFilter = () => {
    return (
        `&created_at=gte.${getOneMonthAgoDate()}T00:00:00.000Z` +
        `&created_at=lte.${getTodayDate()}T23:59:59.999Z`
    );
};