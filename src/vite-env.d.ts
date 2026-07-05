/// <reference types="vite/client" />

// `vite/client` already declares `*?raw` for known asset types, but not for
// `.py` / `.html` specifically under bundler resolution. Declare them so the
// vendored codeviz assets type-check when imported as raw strings.
declare module '*.py?raw' {
  const src: string;
  export default src;
}

declare module '*.html?raw' {
  const src: string;
  export default src;
}
