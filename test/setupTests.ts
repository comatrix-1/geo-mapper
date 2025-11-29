import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Leaflet because JSDOM doesn't support Canvas/Rendering contexts well
vi.mock('leaflet', async () => {
  return {
    default: {
      ...await vi.importActual('leaflet'),
      divIcon: vi.fn(),
      map: vi.fn(),
    },
  };
});

// Mock ResizeObserver
window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};