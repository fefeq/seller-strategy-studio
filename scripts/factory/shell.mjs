// Quotes one argument for the shell commands the factory scripts build (spawnSync with shell: true).
// Single quotes keep every character literal, so a route file such as `accounts.$id.tsx` reaches the tool intact;
// double quotes (JSON.stringify) let the shell expand `$id` and the tool then looks for `accounts..tsx`.
export const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
