/**
 * ZK Voice Hub - Comprehensive Security Module
 * 
 * Enforces:
 * 1. Owner authorization checks (zkdubbingstudio@gmail.com)
 * 2. Authenticated Firebase ID token header injection for server API calls
 * 3. Input sanitization against XSS & Injection
 * 4. File upload validation & size enforcement
 * 5. Structured HTTP 401 & 403 Security Errors
 */

import { auth } from './firebase';

export const OWNER_EMAIL = 'zkdubbingstudio@gmail.com';

// ------------------------------------------------------------------------------
// 1. Authorization & Authenticated API Helpers
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

export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
}

export function assertAuthenticated(): void {
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new SecurityError('Authentication required. Please sign in.', 401, 'UNAUTHORIZED');
  }
}

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

/**
 * Retrieves headers with the active Firebase ID Token for validated server requests
 */
export async function getAuthHeaders(extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {}
  }
  return headers;
}

/**
 * Authenticated fetch wrapper against server API routes
 */
export async function secureApiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders((options.headers as Record<string, string>) || {});
  const resp = await fetch(url, { ...options, headers });
  let data: any = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }

  if (!resp.ok) {
    const errMsg = data?.error || data?.message || `Server error (${resp.status})`;
    throw new SecurityError(errMsg, resp.status, data?.code || 'API_ERROR');
  }

  return data as T;
}

// ------------------------------------------------------------------------------
// 2. Input Sanitization & XSS Prevention
// ------------------------------------------------------------------------------

export function sanitizeString(input: unknown, maxLength = 2000): string {
  if (input === null || input === undefined) return '';
  const str = String(input);

  const sanitized = str
    .replace(/<[^>]*>?/gm, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();

  return sanitized.slice(0, maxLength);
}

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

  if (
    lower.startsWith('data:image/jpeg;base64,') ||
    lower.startsWith('data:image/png;base64,') ||
    lower.startsWith('data:image/webp;base64,')
  ) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.href;
  } catch {
    if (trimmed.startsWith('/')) {
      return sanitizeString(trimmed, 500);
    }
    return '';
  }
}

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
// 3. Upload Validation & Size Limits
// ------------------------------------------------------------------------------

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/x-matroska', 'video/mkv'];
export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mkv'];
export const MAX_VIDEO_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageUpload(file: File): ValidationResult {
  try {
    assertOwner('upload posters and banners');
  } catch (err: any) {
    return { valid: false, error: err.message };
  }

  if (!file) {
    return { valid: false, error: 'No file provided for upload.' };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid image type "${file.type}". Only JPG, PNG, and WebP are allowed.`,
    };
  }

  const fileName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_IMAGE_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  if (!hasValidExt) {
    return {
      valid: false,
      error: 'Invalid file extension. Please upload a .jpg, .jpeg, .png, or .webp file.',
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image exceeds maximum allowed size of 10MB (file size: ${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  return { valid: true };
}

export function validateVideoUpload(file: File): ValidationResult {
  try {
    assertOwner('upload videos');
  } catch (err: any) {
    return { valid: false, error: err.message };
  }

  if (!file) {
    return { valid: false, error: 'No file provided for upload.' };
  }

  const fileName = file.name.toLowerCase();
  const hasValidType = ALLOWED_VIDEO_TYPES.includes(file.type.toLowerCase()) || fileName.endsWith('.mkv');
  if (!hasValidType) {
    return {
      valid: false,
      error: 'Invalid video format. Allowed formats: MP4, WebM, MKV.',
    };
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return {
      valid: false,
      error: `Video exceeds maximum limit of 5GB (file size: ${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB).`,
    };
  }

  return { valid: true };
}

// ------------------------------------------------------------------------------
// 4. Premium Route & Video Access Protection
// ------------------------------------------------------------------------------

export interface AccessCheckResult {
  allowed: boolean;
  reason?: 'premium_required' | 'early_access' | 'banned' | 'unauthorized';
  message?: string;
}

export function checkEpisodeAccess(
  episode: { isEarlyAccess?: boolean; isPremiumOnly?: boolean; is_premium?: boolean; title?: string } | null,
  user: { email?: string | null; isPremium?: boolean; premiumTier?: string; isBanned?: boolean } | null
): AccessCheckResult {
  if (!episode) return { allowed: true };

  if (user?.isBanned) {
    return {
      allowed: false,
      reason: 'banned',
      message: 'Your account has been suspended. Please contact support.',
    };
  }

  if (isOwnerEmail(user?.email)) {
    return { allowed: true };
  }

  const isPremiumRequired = Boolean(episode.isPremiumOnly || episode.is_premium);
  const isEarlyAccess = Boolean(episode.isEarlyAccess);

  if (isPremiumRequired || isEarlyAccess) {
    const hasPremiumSub = Boolean(
      user?.isPremium || user?.premiumTier === 'pro' || user?.premiumTier === 'vip'
    );

    if (!hasPremiumSub) {
      return {
        allowed: false,
        reason: isEarlyAccess ? 'early_access' : 'premium_required',
        message: isEarlyAccess
          ? 'This episode is currently in Early Access for ZK VIP members. Free release coming soon!'
          : 'This episode is exclusively available for ZK Premium members.',
      };
    }
  }

  return { allowed: true };
}

export function getSecuredStreamUrl(rawUrl: unknown): string {
  if (!rawUrl) return '';
  const sanitized = sanitizeUrl(rawUrl);
  if (!sanitized) return '';

  try {
    const parsed = new URL(sanitized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.href;
  } catch {
    return '';
  }
}

export function escapeHtml(unsafe: string): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
