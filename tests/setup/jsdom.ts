// jsdom lacks a few browser APIs the Base UI primitives listen to; the component tests only need the DOM.
if (typeof window !== "undefined") {
  // Base UI opens its menus on a pointer event whose `pointerType` jsdom's own PointerEvent does not fill in.
  window.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
  Element.prototype.scrollIntoView = () => undefined;
}
