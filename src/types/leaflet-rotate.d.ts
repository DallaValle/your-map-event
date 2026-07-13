// Minimal typings for the leaflet-rotate plugin (no bundled types).
declare module "leaflet-rotate";

import "leaflet";

declare module "leaflet" {
  interface Map {
    setBearing(degrees: number): void;
    getBearing(): number;
  }
  interface MapOptions {
    /** Enable map rotation (leaflet-rotate plugin). */
    rotate?: boolean;
    /** Two-finger rotation on touch devices. */
    touchRotate?: boolean;
    /** Shift + drag rotation with a mouse. */
    shiftKeyRotate?: boolean;
    /** The plugin's built-in control; we render our own compass instead. */
    rotateControl?: boolean;
    bearing?: number;
  }
}
