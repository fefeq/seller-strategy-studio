// NK-0098: the one session validator of the app (per auth client, shared with the route guard).
import { supabase } from "@/integrations/supabase/client";
import {
  createLastValidatedUserId,
  createOtherUserSubscription,
  createSessionState,
  createSessionUser,
} from "@/lib/session-check";

export const validatedUser = createSessionUser(supabase.auth);
export const isSignedIn = async () => (await validatedUser()) !== null;
export const checkSession = createSessionState(supabase.auth);
export const lastValidatedUserId = createLastValidatedUserId(supabase.auth);
export const onOtherUserValidated = createOtherUserSubscription(supabase.auth);
