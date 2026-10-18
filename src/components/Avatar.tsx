// src/components/Avatar.tsx - image avatar with initials fallback (users, candidates, staff)
import React, { useEffect, useState } from 'react';
import { getInitials, resolveImageUrl } from '../utils/format';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: AvatarSize;
  /** Tailwind background class used for the initials fallback */
  colorClass?: string;
  className?: string;
  rounded?: 'full' | 'xl';
  title?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
  '2xl': 'w-32 h-32 text-4xl',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  colorClass = 'bg-blue-100 text-blue-700 border border-blue-200',
  className = '',
  rounded = 'full',
  title,
}) => {
  const resolved = resolveImageUrl(src);
  const [failed, setFailed] = useState(false);

  // A new source should get a fresh chance to load
  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const shape = rounded === 'full' ? 'rounded-full' : 'rounded-xl';
  const base = `${sizeClasses[size]} ${shape} shrink-0 overflow-hidden flex items-center justify-center font-bold select-none ${className}`;

  if (resolved && !failed) {
    return (
      <img
        src={resolved}
        alt={name ? `${name}'s profile picture` : 'Profile picture'}
        title={title}
        onError={() => setFailed(true)}
        className={`${base} object-cover bg-slate-100`}
        loading="lazy"
      />
    );
  }

  return (
    <div className={`${base} ${colorClass}`} title={title} aria-label={name || 'User'}>
      {getInitials(name)}
    </div>
  );
};

export default Avatar;
