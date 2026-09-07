/**
 * Small CSS-3D orbital mark for the brand rail: a solar core with two
 * inclined rings orbiting in perspective. Pure CSS transforms — no
 * three.js, no canvas, no bundle cost. Rings stop rotating under
 * prefers-reduced-motion (handled by the global reduced-motion rule,
 * which kills the keyframe animation and leaves a static tilted mark).
 */
export default function OrbitMark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="sk-orbit"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="sk-orbit-core" />
      <span className="sk-orbit-ring sk-orbit-ring-a" />
      <span className="sk-orbit-ring sk-orbit-ring-b" />
    </span>
  );
}
