export type Vec3 = { x: number; y: number; z?: number };
export type PhysicsState =
  | "ASSEMBLED"
  | "FLOATING"
  | "WIND"
  | "EXPLODING"
  | "FREE"
  | "GATHERING"
  | "CRUMPLED"
  | "BALL"
  | "BOUNCING"
  | "ASSEMBLING";
export type PhysicsAction =
  | "gather"
  | "crumple"
  | "throw"
  | "release"
  | "assemble"
  | "reset"
  | "bounce"
  | "gust";
export interface PhysicsConfig {
  mode: "off" | "memory" | "physics";
  windMode: "2d" | "physics";
  quality: "auto" | "high" | "medium" | "low";
  timing: "immediate" | "beat" | "bar";
  duration: number;
  seconds: number;
  memory: {
    depth: number;
    spread: number;
    density: number;
    floatSpeed: number;
    cameraSpeed: number;
    cameraDepth: number;
    perspective: number;
    cameraAuto: boolean;
    depthMode: "random" | "time";
  };
  wind: {
    enabled: boolean;
    direction: number;
    strength: number;
    turbulence: number;
    drag: number;
    lift: number;
    depthDrift: number;
    rotation: number;
  };
  gather: { target: "center" | "pointer"; strength: number; radius: number };
  crumple: { amount: number; speed: number };
  ball: {
    size: number;
    gravity: number;
    drag: number;
    bounce: boolean;
    restitution: number;
    friction: number;
    mass: number;
    angle: number;
    power: number;
    spin: number;
    releaseFraction: number;
  };
}
export const defaultPhysics = (): PhysicsConfig => ({
  mode: "off",
  windMode: "2d",
  quality: "auto",
  timing: "immediate",
  duration: 0,
  seconds: 1.2,
  memory: {
    depth: 800,
    spread: 1.2,
    density: 1,
    floatSpeed: 0.3,
    cameraSpeed: 0.2,
    cameraDepth: 0,
    perspective: 900,
    cameraAuto: false,
    depthMode: "random",
  },
  wind: {
    enabled: false,
    direction: 0,
    strength: 0.5,
    turbulence: 0.4,
    drag: 1.5,
    lift: 0.2,
    depthDrift: 0.5,
    rotation: 0.5,
  },
  gather: { target: "center", strength: 6, radius: 100 },
  crumple: { amount: 1, speed: 1 },
  ball: {
    size: 75,
    gravity: 400,
    drag: 0.12,
    bounce: true,
    restitution: 0.8,
    friction: 0.08,
    mass: 12,
    angle: -35,
    power: 650,
    spin: 2,
    releaseFraction: 1,
  },
});
/** EXIF has no timezone; use a consistent neutral timeline, never the host timezone. */
export function photoTimestamp(value: string | null): number | null {
  if (!value) return null;
  const n = Date.parse(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : value + "Z");
  return Number.isFinite(n) ? n : null;
}
export function timestampToDepth(
  timestamp: number | null,
  oldest: number,
  newest: number,
  depth: number,
  fallback: number,
) {
  return timestamp === null || newest <= oldest
    ? fallback * depth
    : (1 - Math.max(0, Math.min(1, (timestamp - oldest) / (newest - oldest)))) *
        depth;
}
export const random01 = (id: number, salt = 0) => {
  const n = Math.sin((id + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
};
