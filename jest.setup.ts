import "@testing-library/jest-dom";

class ResizeObserverMock implements ResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

const gradientMock = {
  addColorStop: jest.fn(),
};

const canvasContextMock = {
  createLinearGradient: jest.fn(() => gradientMock),
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  setTransform: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  fillStyle: "#000000",
  globalAlpha: 1,
  imageSmoothingEnabled: false,
} as unknown as CanvasRenderingContext2D;

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  writable: true,
  value: ResizeObserverMock,
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    writable: true,
    value: {
      width: 1440,
      height: 900,
      scale: 1,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  });

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    writable: true,
    value: jest.fn(),
  });

  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: jest.fn(),
  });

  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value: jest.fn(() => canvasContextMock),
  });

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
      window.setTimeout(() => callback(performance.now()), 16);
  }

  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (handle: number) => {
      window.clearTimeout(handle);
    };
  }

  if (!window.PointerEvent) {
    class PointerEventMock extends MouseEvent {}

    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      writable: true,
      value: PointerEventMock,
    });
  }

  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    writable: true,
    value: jest.fn(() => false),
  });

  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    writable: true,
    value: jest.fn(),
  });

  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    writable: true,
    value: jest.fn(),
  });
}
