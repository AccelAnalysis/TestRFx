"use client";

// Compatibility export for integrations that still import the original chassis map primitive.
// New shell work should import PersistentMap directly.
export { PersistentMap as MapCanvas } from "./persistent-map";
