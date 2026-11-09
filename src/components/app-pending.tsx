import { ScreenState } from "@/components/page";

/** Shown while the signed-in area checks the session on a first load or reload, so the page is never blank (NK-0093). */
export function AppPending() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-5 md:px-10 md:py-10">
      <ScreenState isPending error={null} refetch={() => undefined} skeleton="cards">
        {null}
      </ScreenState>
    </div>
  );
}
