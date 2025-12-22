// Type declarations for Bun's `with { type: "file" }` imports from .vite-build/
// These files only exist after a production build, so we declare them here.
// The actual type at runtime is a string (file path that works with Bun.file()).

declare module "../../.vite-build/*.html" {
  const path: string;
  export default path;
}

declare module "../../.vite-build/*.js" {
  const path: string;
  export default path;
}

declare module "../../.vite-build/*.css" {
  const path: string;
  export default path;
}

declare module "../../.vite-build/assets/*.js" {
  const path: string;
  export default path;
}

declare module "../../.vite-build/assets/*.css" {
  const path: string;
  export default path;
}
