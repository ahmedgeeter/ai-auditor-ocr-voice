import React from 'react';

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={`bg-[var(--color-border)] animate-pulse rounded-sm ${className}`} />
);

export default Skeleton;
