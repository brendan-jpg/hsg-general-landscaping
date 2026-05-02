"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database, Tables } from "@/lib/types/database";

/* -----------------------------------------------------------------------------
   Types
----------------------------------------------------------------------------- */

type TableName = keyof Database["public"]["Tables"];
type ViewName = keyof Database["public"]["Views"];

type ListOptions = {
  column?: string;
  value?: string;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
};

/* -----------------------------------------------------------------------------
   Current authenticated user profile
----------------------------------------------------------------------------- */

export function useProfile() {
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(data);
      setLoading(false);
    }

    fetchProfile();
  }, []);

  return { profile, loading };
}

/* -----------------------------------------------------------------------------
   Generic hook for fetching a list from any TABLE
----------------------------------------------------------------------------- */

export function useSupabaseTableList<TName extends TableName>(
  table: TName,
  options?: ListOptions
) {
  const [data, setData] = useState<Tables<TName>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetch() {
      setLoading(true);
      setError(null);

      let query = supabase.from(table).select("*");

      if (options?.column && options?.value != null) {
        query = query.eq(options.column as any, options.value as any);
      }
      if (options?.orderBy) {
        query = query.order(options.orderBy as any, {
          ascending: options.ascending ?? false,
        });
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        setError(error.message);
        setData([]);
      } else {
        setData((data ?? []) as Tables<TName>[]);
      }

      setLoading(false);
    }

    fetch();
     
  }, [
    table,
    options?.column,
    options?.value,
    options?.orderBy,
    options?.ascending,
    options?.limit,
  ]);

  return { data, loading, error };
}

/* -----------------------------------------------------------------------------
   Generic hook for fetching a list from any VIEW
----------------------------------------------------------------------------- */

export function useSupabaseViewList<TName extends ViewName>(
  view: TName,
  options?: ListOptions
) {
  const [data, setData] = useState<Tables<TName>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetch() {
      setLoading(true);
      setError(null);

      let query = supabase.from(view).select("*");

      if (options?.column && options?.value != null) {
        query = query.eq(options.column as any, options.value as any);
      }
      if (options?.orderBy) {
        query = query.order(options.orderBy as any, {
          ascending: options.ascending ?? false,
        });
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        setError(error.message);
        setData([]);
      } else {
        setData((data ?? []) as Tables<TName>[]);
      }

      setLoading(false);
    }

    fetch();
     
  }, [
    view,
    options?.column,
    options?.value,
    options?.orderBy,
    options?.ascending,
    options?.limit,
  ]);

  return { data, loading, error };
}
