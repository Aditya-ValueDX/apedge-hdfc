// utils/fileUtils.js
export const formatFileName = (filePath) => {
  if (!filePath) return ''; // Return empty string instead of 'N/A'

  const fileNameWithExtension = filePath.split(/[/\\]/).pop();
  if (!fileNameWithExtension) return ''; // Return empty string instead of 'N/A'

  const lastDotIndex = fileNameWithExtension.lastIndexOf('.');
  const baseName = lastDotIndex > 0
    ? fileNameWithExtension.substring(0, lastDotIndex)
    : fileNameWithExtension;
  const extension = lastDotIndex > 0
    ? fileNameWithExtension.substring(lastDotIndex)
    : '';

  // Strip the ID/UUID suffix appended after the last underscore.
  // e.g. "Invoice_Bill 2_71aa8b6c-d81f-4b2d-92d1-ba56f5d09448" → "Invoice_Bill 2"
  // e.g. "report_abc123"                                        → "report"
  // Only strips if the text after the last underscore looks like a UUID or random ID.
  let fileNameToShow = baseName;
  const lastUnderscoreIndex = baseName.lastIndexOf('_');
  if (lastUnderscoreIndex > 0) {
    const suffix = baseName.substring(lastUnderscoreIndex + 1);
    const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const genericIdPattern = /^[A-Za-z0-9]{6,}$/;
    if (uuidPattern.test(suffix) || genericIdPattern.test(suffix)) {
      fileNameToShow = baseName.substring(0, lastUnderscoreIndex);
    }
  }

  return fileNameToShow + extension;
};


export const isValidFileNameSearch = (value) => {
    if (!value) return false;
    
    const trimmed = value.trim();
    
    // Must have at least 1 character for a partial search
    return trimmed.length >= 1;
};

/**
 * Normalizes a file name search query so it can match raw file paths in the DB.
 *
 * Handles common user input quirks:
 *  - Removes accidental spaces before a file extension dot  ("Invoice 2 .jpeg" → "Invoice 2.jpeg")
 *  - Collapses multiple spaces into one
 *  - Trims surrounding whitespace
 *
 * Example:
 *   "Invoice_Bill 2 .jpeg"  →  "Invoice_Bill 2.jpeg"
 *   "  report  .pdf "       →  "report.pdf"
 */
export const normalizeFileSearch = (value) => {
    if (!value) return '';

    return value
        .trim()                               // strip leading/trailing spaces
        .replace(/\s+/g, ' ')                 // collapse multiple spaces into one
        .replace(/\s+\./g, '.');              // remove spaces immediately before a dot (extension)
};

/**
 * Returns the searchable form of a raw file path string — the formatted display
 * name — so client-side comparisons align with what the user sees in the table.
 *
 * Useful when you need to do a local (in-memory) match against the displayed name
 * rather than the raw DB path.
 */
export const getSearchableFileName = (filePath) => {
    return formatFileName(filePath).toLowerCase();
};

export const truncateFilename = (filename, maxLength = 15) => {
  if (!filename || filename.length <= maxLength) return filename;
  
  // Get file extension
  const lastDotIndex = filename.lastIndexOf('.');
  const extension = lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
  const nameWithoutExt = lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;
  
  // Show first 5 chars + "..." + extension
  if (nameWithoutExt.length > 5) {
    return `${nameWithoutExt.substring(0, 5)}...${extension}`;
  }
  
  return filename;
};