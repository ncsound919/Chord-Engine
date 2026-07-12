import React, { memo } from 'react';

interface StepButtonProps {
  drum: string;
  index: number;
  isActive: boolean;
  isCurrent: boolean;
  isBeat: boolean;
  onClick: () => void;
}

export const StepButton = memo(({
  drum,
  index,
  isActive,
  isCurrent,
  isBeat,
  onClick
}: StepButtonProps) => {
  return (
    <button
      type="button"
      role="gridcell"
      aria-pressed={isActive}
      aria-label={`${drum} at step ${index + 1}${isActive ? ', active' : ''}`}
      onClick={onClick}
      className={`w-8 h-8 rounded-lg transition-all border outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-black ${
        isActive
           ? (isCurrent ? 'bg-gradient-to-br from-yellow-300 to-orange-400 border-white shadow-[0_0_15px_rgba(253,224,71,0.6)] scale-110 z-10' : 'bg-gradient-to-br from-orange-400 to-orange-600 border-orange-300 shadow-[0_0_8px_rgba(249,115,22,0.3)]')
           : isBeat
             ? (isCurrent ? 'bg-white/30 border-white/40 shadow-[0_0_10px_rgba(255,255,255,0.4)]' : 'bg-white/15 border-white/20 hover:bg-white/30')
             : (isCurrent ? 'bg-white/20 border-white/30 shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/15')
      }`}
    />
  );
});

StepButton.displayName = 'StepButton';
