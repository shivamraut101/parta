import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async function getCurrentUserImpl() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
});
