// Explicit new-environment provisioning with the generated server client; never put credentials in this script.
import { provisionOnboardingStorage } from "../src/lib/onboarding-storage.server";

async function main() {
  const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
  const result = await provisionOnboardingStorage(supabaseAdmin);
  console.log(
    result.created ? "Onboarding storage created." : "Onboarding storage already exists.",
  );
}
main().catch(() => {
  console.error(
    "Storage provisioning failed; inspect the environment configuration without logging credentials.",
  );
  process.exitCode = 1;
});
