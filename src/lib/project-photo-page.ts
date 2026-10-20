import type { Attachment } from '@/lib/types';
import { PROJECT_PHOTO_PAGE_SIZE } from './project-photo-policy';

export type ProjectPhotoFilter = 'all' | 'standard' | 'thermal';
export interface PhotoCursor { createdAt: string; id: string }
export interface ProjectPhotoPage { data: Attachment[]; nextCursor: PhotoCursor | null }
export interface ProjectPhotoPageOptions { category: ProjectPhotoFilter; cursor: PhotoCursor | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Keep Postgres microseconds intact; converting to a JS Date can skip tied rows.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export function isPhotoCursor(value: unknown): value is PhotoCursor {
  if (!value || typeof value !== 'object') return false;
  const cursor = value as PhotoCursor;
  return typeof cursor.id === 'string' && UUID.test(cursor.id) &&
    typeof cursor.createdAt === 'string' && TIMESTAMP.test(cursor.createdAt) &&
    Number.isFinite(Date.parse(cursor.createdAt));
}

export function parsePhotoPageOptions(params: URLSearchParams): ProjectPhotoPageOptions {
  const category = params.get('category') ?? 'all';
  if (params.get('page') !== 'cursor' || !['all', 'standard', 'thermal'].includes(category)) {
    throw new Error('Invalid photo page.');
  }
  let cursor: PhotoCursor | null = null;
  const encoded = params.get('cursor');
  if (encoded !== null) {
    if (encoded.length > 256) throw new Error('Invalid photo cursor.');
    const value: unknown = JSON.parse(encoded);
    if (!isPhotoCursor(value)) throw new Error('Invalid photo cursor.');
    cursor = value;
  }
  return { category: category as ProjectPhotoFilter, cursor };
}

/** Demo data follows the same page boundary as the authenticated read. */
export function pageDemoPhotos(photos: Attachment[], options: ProjectPhotoPageOptions): ProjectPhotoPage {
  const rows = photos.filter((photo) =>
    (photo.file_type.startsWith('image/') || photo.photo_category === 'thermal') &&
    (options.category === 'all' || photo.photo_category === options.category)
  ).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id));
  const { cursor } = options;
  const remaining = cursor ? rows.filter((photo) =>
    Date.parse(photo.created_at) < Date.parse(cursor.createdAt) ||
    (Date.parse(photo.created_at) === Date.parse(cursor.createdAt) && photo.id < cursor.id)
  ) : rows;
  const data = remaining.slice(0, PROJECT_PHOTO_PAGE_SIZE);
  const last = data.at(-1);
  return { data, nextCursor: remaining.length > data.length && last ? { createdAt: last.created_at, id: last.id } : null };
}
