// src/lib/actions/documents.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ProjectDocument, DocumentCategory, DocumentStatus } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';

// ---------------------------------------------------------------------------
// getProjectDocuments -- all documents for a project
// ---------------------------------------------------------------------------
export async function getProjectDocuments(
  projectId: string
): Promise<ActionResult<ProjectDocument[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('project_documents')
      .select(`
        *,
        uploaded_by_profile:profiles!project_documents_uploaded_by_fkey(id, full_name),
        reviewed_by_profile:profiles!project_documents_reviewed_by_fkey(id, full_name)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: (data as ProjectDocument[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch project documents' };
  }
}

// ---------------------------------------------------------------------------
// getProjectDocumentById -- single document with profile joins
// ---------------------------------------------------------------------------
export async function getProjectDocumentById(
  documentId: string,
  projectId: string
): Promise<ActionResult<ProjectDocument>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('project_documents')
      .select(`
        *,
        uploaded_by_profile:profiles!project_documents_uploaded_by_fkey(id, full_name),
        reviewed_by_profile:profiles!project_documents_reviewed_by_fkey(id, full_name)
      `)
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single();

    if (error) return { error: error.message };
    if (!data) return { error: 'Document not found' };

    return { success: true, data: data as ProjectDocument };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch document' };
  }
}

// ---------------------------------------------------------------------------
// createProjectDocument -- creates a new document
// Auto-generates human-readable number (DOC-001, DOC-002, ...)
// ---------------------------------------------------------------------------
export async function createProjectDocument(
  projectId: string,
  data: {
    title: string;
    category: DocumentCategory;
    description?: string;
    revision?: string;
    revision_date?: string;
    file_name?: string;
    file_url?: string;
    file_size?: number;
    linked_milestone_id?: string | null;
  }
): Promise<ActionResult<ProjectDocument>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    // Generate the next human-readable number for this project
    const { count, error: countError } = await supabase
      .from('project_documents')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (countError) return { error: countError.message };

    const nextNum = (count ?? 0) + 1;
    const number = `DOC-${String(nextNum).padStart(3, '0')}`;

    const { data: doc, error } = await supabase
      .from('project_documents')
      .insert({
        project_id: projectId,
        number,
        title: data.title,
        description: data.description ?? '',
        category: data.category,
        status: 'draft' as DocumentStatus,
        revision: data.revision ?? 'Rev 0',
        revision_date: data.revision_date ?? new Date().toISOString().split('T')[0],
        file_name: data.file_name ?? '',
        file_url: data.file_url ?? '',
        file_size: data.file_size ?? 0,
        uploaded_by: user.id,
        reviewed_by: null,
        review_date: null,
        linked_milestone_id: data.linked_milestone_id ?? null,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'project' as Parameters<typeof logActivity>[2],
      doc.id,
      'created',
      `uploaded ${number}: ${data.title}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/documents`);

    return { success: true, data: doc as ProjectDocument };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create document' };
  }
}

// ---------------------------------------------------------------------------
// updateProjectDocument -- update fields on an existing document
// If status='approved', auto-set reviewed_by and review_date
// ---------------------------------------------------------------------------
export async function updateProjectDocument(
  projectId: string,
  documentId: string,
  data: {
    title?: string;
    description?: string;
    category?: DocumentCategory;
    status?: DocumentStatus;
    revision?: string;
    revision_date?: string;
    file_name?: string;
    file_url?: string;
    file_size?: number;
    linked_milestone_id?: string | null;
  }
): Promise<ActionResult<ProjectDocument>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    // If approving, auto-set reviewed_by and review_date
    const updateData: Record<string, unknown> = { ...data };
    if (data.status === 'approved') {
      updateData.reviewed_by = user.id;
      updateData.review_date = new Date().toISOString().split('T')[0];
    }

    const { data: doc, error } = await supabase
      .from('project_documents')
      .update(updateData)
      .eq('id', documentId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) return { error: error.message };

    const actionType = data.status ? 'status_changed' : 'updated';
    const description = data.status
      ? `changed ${doc.number} status to ${data.status}`
      : `updated ${doc.number}: ${doc.title}`;

    await logActivity(
      supabase,
      projectId,
      'project' as Parameters<typeof logActivity>[2],
      documentId,
      actionType,
      description,
      user.id
    );

    revalidatePath(`/projects/${projectId}/documents`);
    revalidatePath(`/projects/${projectId}/documents/${documentId}`);

    return { success: true, data: doc as ProjectDocument };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update document' };
  }
}

// ---------------------------------------------------------------------------
// deleteProjectDocument -- remove a document record
// ---------------------------------------------------------------------------
export async function deleteProjectDocument(
  projectId: string,
  documentId: string
): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    // Fetch existing doc for activity log
    const { data: existing, error: fetchError } = await supabase
      .from('project_documents')
      .select('number, title')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single();

    if (fetchError || !existing) return { error: 'Document not found' };

    const { error } = await supabase
      .from('project_documents')
      .delete()
      .eq('id', documentId)
      .eq('project_id', projectId);

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'project' as Parameters<typeof logActivity>[2],
      documentId,
      'deleted',
      `deleted document ${existing.number}: ${existing.title}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/documents`);

    return { success: true, data: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete document' };
  }
}
