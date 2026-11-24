import type { CSSProperties } from 'react';

export type IconName =
  | 'sword'
  | 'backpack'
  | 'anvil'
  | 'book'
  | 'shop'
  | 'settings'
  | 'trophy'
  | 'calendar'
  | 'about'
  | 'share'
  | 'star'
  | 'volume'
  | 'volumeOff'
  | 'sun'
  | 'moon'
  | 'flame'
  | 'play'
  | 'pause'
  | 'refresh'
  | 'coin'
  | 'ore'
  | 'gem'
  | 'shield'
  | 'heart'
  | 'speed'
  | 'close'
  | 'download'
  | 'upload'
  | 'check'
  | 'lock'
  | 'gift'
  | 'ad'
  | 'restore'
  | 'trash'
  | 'menu'
  | 'arrowRight'
  | 'hand'
  | 'sparkle'
  | 'chevron'
  | 'home'
  | 'smelt';

const ART_ICONS = new Set<IconName>([
  'sword',
  'backpack',
  'anvil',
  'book',
  'shop',
  'coin',
  'ore',
  'gem',
  'heart',
  'shield',
  'trophy',
  'calendar',
  'settings',
  'about',
  'gift',
  'sparkle',
  'play',
  'pause',
  'refresh',
  'star',
  'share',
  'sun',
  'moon',
  'flame',
  'volume',
  'volumeOff',
  'hand',
  'ad',
  'check',
  'restore',
  'menu',
  'smelt',
]);

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 22, className, style }: IconProps) {
  if (ART_ICONS.has(name)) {
    return (
      <img
        aria-hidden="true"
        src={`/art/ui/${name}.webp`}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className={`ui-art-icon ${className ?? ''}`.trim()}
        style={{ width: size, height: size, ...style }}
      />
    );
  }

  const paths: Record<string, React.ReactNode> = {
    speed: <><path d="m4 5 6 7-6 7M12 5l6 7-6 7" /></>,
    close: <path d="m5 5 14 14M19 5 5 19" />,
    download: <><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></>,
    arrowRight: <path d="M4 12h16m-6-6 6 6-6 6" />,
    chevron: <path d="m8 5 7 7-7 7" />,
    home: <><path d="m3 11 9-8 9 8M5 10v11h14V10" /><path d="M9 21v-7h6v7" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
