import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0, 0.28, 0.6];
  private callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) { this.callback = callback; }
  disconnect() {}
  takeRecords() { return []; }
  unobserve() {}
  observe(target: Element) {
    const rect = target.getBoundingClientRect();
    this.callback([{ boundingClientRect: rect, intersectionRatio: 1, intersectionRect: rect, isIntersecting: true, rootBounds: null, target, time: performance.now() }], this);
  }
}

Object.defineProperty(globalThis, "IntersectionObserver", { value: TestIntersectionObserver, writable: true });
Object.defineProperty(Element.prototype, "scrollIntoView", { value: vi.fn(), writable: true });
Object.defineProperty(window, "requestAnimationFrame", { value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0), writable: true });
Object.defineProperty(window, "cancelAnimationFrame", { value: (id: number) => window.clearTimeout(id), writable: true });
Object.defineProperty(HTMLMediaElement.prototype, "play", { value: vi.fn(() => Promise.resolve()), writable: true });
Object.defineProperty(HTMLMediaElement.prototype, "pause", { value: vi.fn(), writable: true });
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
