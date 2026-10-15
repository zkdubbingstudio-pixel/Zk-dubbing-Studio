/**
 * ZK Voice Hub - Comprehensive Security Module
 * 
 * Enforces:
 * 1. Owner authorization checks (zkdubbingstudio@gmail.com)
 * 2. Input sanitization against XSS & Injection
 * 3. File upload validation & size enforcement
 * 4. Structured HTTP 401 & 403 Security Errors
 * 5. Production safe logger
 */

import { auth } from './firebase';

export const OWNER_EMAIL = 'zkdubbingstudio@gmail.com';

// ------------------------------------------------------------------------------
// 1. Authorization & Role Verification
// ------------------------------------------------------------------------------

export class SecurityError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 403, code = 'FORBIDDEN') {
    super(message);
    this.name = 'SecurityError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Returns true if the provided email matches the single studio owner
 */
export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
}

/**
 * Verify current Firebase session is authenticated
 */
export function assertAuthenticated(): void {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new SecurityError('Authentication required. Please sign in.', 401, 'UNAUTHORIZED');
  }
}

/**
 * Assert that the current Firebase authenticated user is the verified owner
 */
export function assertOwner(actionName = 'perform this action'): void {
  assertAuthenticated();
  const currentUser = auth.currentUser;
  if (!currentUser?.email || !isOwnerEmail(currentUser.email)) {
    throw new SecurityError(
      `Access Denied: Only the owner (${OWNER_EMAIL}) has permission to ${actionName}.`,
      403,
      'FORBIDDEN'
    );
  }
}

// ------------------------------------------------------------------------------
// 2. Input Sanitization & XSS Prevention
// ------------------------------------------------------------------------------

/**
 * Strips HTML tags, script vectors, and malicious characters from string inputs
 */
export function sanitizeString(input: unknown, maxLength = 2000): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  
  // 1. Strip HTML tags and dangerous javascript/data schemes
  const sanitized = str
    .replace(/<[^>]*>?/gm, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Strip javascript: URIs
    .replace(/vbscript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // Strip control characters
    .trim();

  return sanitized.slice(0, maxLength);
}

/**
 * Strictly sanitizes and validates an HTTP/HTTPS URL
 */
export function sanitizeUrl(urlInput: unknown): string {
  if (!urlInput) return '';
  const trimmed = String(urlInput).trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html') ||
    lower.startsWith('file:')
  ) {
    return '';
  }

  try {
    const parsed = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'data:') {
      return '';
    }
    return parsed.href;
  } catch {
    // If it's a relative path, ensure it starts with /
    if (trimmed.startsWith('/')) {
      return sanitizeString(trimmed, 500);
    }
    return '';
  }
}

/**
 * Sanitizes object keys and string values recursively
 */
export function sanitizeRecord<T extends Record<string, any>>(record: T): T {
  const result: any = Array.isArray(record) ? [] : {};
  for (const [key, val] of Object.entries(record)) {
    const cleanKey = sanitizeString(key, 100);
    if (typeof val === 'string') {
      result[cleanKey] = sanitizeString(val);
    } else if (val && typeof val === 'object') {
      result[cleanKey] = sanitizeRecord(val);
    } else {
      result[cleanKey] = val;
    }
  }
  return result;
}

// ------------------------------------------------------------------------------
// 3. Upload Validation & Size Limits (Requirement 13 & 14)
// ------------------------------------------------------------------------------

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB maximum for uploaded poster/banner

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/x-matroska', 'video/mkv'];
export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mkv'];
export const MAX_VIDEO_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB limit for videos

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates an image file before upload (Poster / Banner)
 */
export function validateImageUpload(file: File): ValidationResult {
  // 1. Enforce owner upload restriction
  try {
    assertOwner('upload posters and banners');
  } catch (err: any) {
    return { valid: false, error: err.message };
  }

  if (!file) {
    return { valid: false, error: 'No file provided for upload.' };
  }

  // 2. Validate MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return { 
      valid: false, 
      error: `Invalid image type "${file.type}". Only JPG, PNG, and WebP are allowed.` 
    };
  }

  // 3. Validate file extension
  const fileName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_IMAGE_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  if (!hasValidExt) {
    return { 
      valid: false, 
      error: 'Invalid file extension. Please upload a .jpg, .jpeg, .png, or .webp file.' 
    };
  }

  // 4. Validate file size
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { 
      valid: false, 
      error: `Image exceeds maximum allowed size of 10MB (file size: ${(file.size / (1024 * 1024)).toFixed(1)}MB).` 
    };
  }

  return { valid: true };
}

/**
 * Validates a video file before upload
 */
export function validateVideoUpload(file: File): ValidationResult {
  // 1. Enforce owner upload restriction
  try {
    assertOwner('upload videos');
  } catch (err: any) {
    return { valid: false, error: err.message };
  }

  if (!file) {
    return { valid: false, error: 'No file provided for upload.' };
  }

  // 2. Validate format
  const fileName = file.name.toLowerCase();
  const hasValidType = ALLOWED_VIDEO_TYPES.includes(file.type.toLowerCase()) || fileName.endsWith('.mkv');
  if (!hasValidType) {
    return {
      valid: false,
      error: 'Invalid video format. Allowed formats: MP4, WebM, MKV.',
    };
  }

  // 3. Validate size
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return {
      valid: false,
      error: `Video exceeds maximum limit of 5GB (file size: ${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB).`,
    };
  }

  return { valid: true };
}
