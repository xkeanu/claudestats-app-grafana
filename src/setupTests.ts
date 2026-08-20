import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// jsdom ships no TextEncoder/TextDecoder, but react-dom/server — pulled in
// transitively by @grafana/ui via @grafana/runtime via @grafana/scenes —
// touches them at import time. Without these, any suite that imports
// @grafana/scenes for real (rather than mocking it) fails to load at all.
Object.assign(globalThis, {
  TextEncoder: globalThis.TextEncoder ?? TextEncoder,
  TextDecoder: globalThis.TextDecoder ?? TextDecoder,
});

// @grafana/scenes' LazyLoader constructs an IntersectionObserver at module
// scope; jsdom has none. Nothing under test observes anything, so a no-op
// stub is enough to get the module loaded.
if (!globalThis.IntersectionObserver) {
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    writable: true,
    value: class {
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
      takeRecords = jest.fn(() => []);
      root = null;
      rootMargin = '';
      thresholds = [];
    },
  });
}

// Same reason: uplot, bundled into @grafana/ui, calls matchMedia while
// computing its pixel ratio at import time, and jsdom does not implement it.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  });
}
