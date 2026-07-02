import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";

/**
 * Live triage notes for the Emergency Queue — shared and persisted across
 * responders. RLS lets responders read all and insert their own.
 * See migration 20260702140000_triage_notes.sql.
 */

export interface TriageNote {
  id: string;
  note: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
}

export const TRIAGE_NOTES_KEY = ["aegis", "triageNotes"] as const;

export async function fetchTriageNotes(limit = 30): Promise<TriageNote[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from("triage_notes")
    .select("id,note,author_id,author_name,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    note: row.note,
    authorId: row.author_id,
    authorName: row.author_name,
    createdAt: row.created_at,
  }));
}

export async function addTriageNote(input: {
  note: string;
  authorId: string;
  authorName?: string | null;
}): Promise<void> {
  const note = input.note.trim();
  if (!note) throw new Error("Triage note is empty");
  if (!input.authorId) throw new Error("Not signed in");
  const { error } = await supabase.from("triage_notes").insert({
    note,
    author_id: input.authorId,
    author_name: input.authorName ?? null,
  });
  if (error) throw error;
}

export const useTriageNotes = () =>
  useQuery({
    queryKey: TRIAGE_NOTES_KEY,
    queryFn: () => fetchTriageNotes(),
    enabled: hasSupabase,
    staleTime: 10000,
  });
