import { useTypewriter } from '../../hooks/useTypewriter';

interface TypewriterProps {
  text: string;
  speed?: number;
  className?: string;
  /** Show a blinking caret while typing (and briefly after). */
  caret?: boolean;
}

/**
 * Types `text` in on change. The caret is a hairline block in the accent
 * colour; it stops blinking once the line is complete. Reduced-motion is
 * handled by the underlying hook (full text, no caret animation).
 */
export default function Typewriter({ text, speed, className, caret = true }: TypewriterProps) {
  const { shown, done } = useTypewriter(text, speed);
  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">{shown}</span>
      {caret && (
        <span
          aria-hidden="true"
          className={`sk-caret ${done ? 'sk-caret-idle' : ''}`}
        />
      )}
    </span>
  );
}
