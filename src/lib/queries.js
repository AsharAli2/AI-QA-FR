import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { api } from './api';

// ============================================================================
// Central data layer (TanStack Query).
//
// READS go straight to Supabase — RLS (`owns_project`) scopes every row to the
// signed-in owner, so the Express hop adds nothing but latency. Two exceptions:
//   - profiles stay behind the API: RLS is row-level, not column-level, and the
//     table carries the encrypted password (`secret_enc`) — the API strips it.
//   - anything with server logic (runs/SSE, signing, discovery) is not a read.
//
// Caching: queries never go stale on their own (staleTime: Infinity in main.jsx)
// — tab/page changes render instantly from cache. WRITES must invalidate the
// keys they touch; use `keys` below so components and mutations agree.
// ============================================================================

/** Unwrap a supabase-js response, throwing its error like fetch-based api() does. */
async function sb(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
}

export const keys = {
  projects: ['projects'],
  project: (id) => ['project', id],
  flows: (projectId) => ['flows', projectId],
  runs: (projectId) => ['runs', projectId],
  run: (runId) => ['run', runId],
  profiles: (projectId) => ['profiles', projectId],
};

export function useProjects() {
  return useQuery({
    queryKey: keys.projects,
    queryFn: () =>
      sb(supabase.from('projects').select('id, name, base_url, created_at').order('created_at', { ascending: false })),
  });
}

export function useProject(id) {
  return useQuery({
    queryKey: keys.project(id),
    queryFn: () =>
      sb(supabase.from('projects').select('id, name, base_url, settings, created_at').eq('id', id).single()),
    enabled: !!id,
  });
}

export function useFlows(projectId) {
  return useQuery({
    queryKey: keys.flows(projectId),
    queryFn: () =>
      sb(supabase.from('flows').select('*').eq('project_id', projectId).order('created_at', { ascending: false })),
    enabled: !!projectId,
  });
}

/** Every run in the project, newest first, joined with its flow's name.
 *  `result` is deliberately excluded — it can be large; the run detail loads it. */
export function useRuns(projectId) {
  return useQuery({
    queryKey: keys.runs(projectId),
    queryFn: () =>
      sb(
        supabase
          .from('flow_runs')
          .select('id, flow_id, status, passed, summary, llm_calls, started_at, finished_at, flows(name, flow_content, profile_id)')
          .eq('project_id', projectId)
          .order('started_at', { ascending: false })
          .limit(200),
      ),
    enabled: !!projectId,
  });
}

/** One run with its full report (`result`). */
export function useRun(runId, { enabled = true } = {}) {
  return useQuery({
    queryKey: keys.run(runId),
    queryFn: () =>
      sb(supabase.from('flow_runs').select('*, flows(name, flow_content, profile_id)').eq('id', runId).single()),
    enabled: enabled && !!runId,
  });
}

/** Login profiles — via the API (never client-side; see header comment). */
export function useProfiles(projectId) {
  return useQuery({
    queryKey: keys.profiles(projectId),
    queryFn: () => api(`/projects/${projectId}/profiles`).then((r) => r.profiles ?? []),
    enabled: !!projectId,
  });
}
