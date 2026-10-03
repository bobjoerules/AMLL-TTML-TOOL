import React from 'react';

interface LiquidPlayerIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  invert?: boolean;
}

export const LiquidPlayerIcon: React.FC<LiquidPlayerIconProps> = ({
  size = 16,
  className,
  style,
  invert = false,
}) => {
  return (
    <img
      src="/liquid-logo.png"
      alt="Liquid Player Logo"
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
    />
  );
};
