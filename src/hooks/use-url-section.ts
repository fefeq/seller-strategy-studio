import { useEffect, useState } from "react";

/**
 * The section shown by a screen whose URL carries ?seccion=. Local state, so a click or an opened document shows at once;
 * it follows the URL whenever the URL's section changes (a link, the back button), and the screen writes the URL itself.
 */
export function useUrlSection(fromUrl: string) {
  const [section, setSection] = useState(fromUrl);
  useEffect(() => setSection(fromUrl), [fromUrl]);
  return [section, setSection] as const;
}
