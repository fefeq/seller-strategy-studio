import { Page, ScreenState } from "@/components/page";

/** Shown by the Leads route while its loader prepares the data, so the screen is never blank (NK-0093). */
export function LeadsPending() {
  return (
    <Page eyebrow="Leads" title="Leads">
      <ScreenState isPending error={null} refetch={() => undefined} skeleton="cards">
        {null}
      </ScreenState>
    </Page>
  );
}
