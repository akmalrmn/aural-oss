"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/lib/supabase/types";

type AuthContextType = {
  user: User | null;
  profile: Tables<"profiles"> | null;
  skilioIdentity: Tables<"skilio_identity_links"> | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  skilioIdentity: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [skilioIdentity, setSkilioIdentity] =
    useState<Tables<"skilio_identity_links"> | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  const fetchAccountContext = useCallback(
    async (userId: string) => {
      const [profileResult, identityResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("skilio_identity_links")
          .select("*")
          .eq("userId", userId)
          .maybeSingle(),
      ]);

      setProfile(
        profileResult.error
          ? null
          : (profileResult.data as Tables<"profiles"> | null),
      );
      setSkilioIdentity(
        identityResult.error
          ? null
          : (identityResult.data as Tables<"skilio_identity_links"> | null),
      );
    },
    [supabase],
  );

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data: { user: u } }) => {
        setUser(u);
        if (u) {
          fetchAccountContext(u.id).finally(() => setLoading(false));
        } else {
          setProfile(null);
          setSkilioIdentity(null);
          setLoading(false);
        }
      })
      .catch(() => {
        // Suppress AbortError from navigator.locks on public pages
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchAccountContext(currentUser.id);
      } else {
        setProfile(null);
        setSkilioIdentity(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchAccountContext]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchAccountContext(user.id);
  }, [user, fetchAccountContext]);

  const value = useMemo(
    () => ({ user, profile, skilioIdentity, loading, refreshProfile }),
    [user, profile, skilioIdentity, loading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
