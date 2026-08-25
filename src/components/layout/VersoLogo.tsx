import React from 'react';

interface VersoLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export const VersoLogo: React.FC<VersoLogoProps> = ({
  size = 20,
  className = '',
  showText = false,
}) => {
  return (
    <div className={`inline-flex items-center space-x-2 select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Soft rounded container background */}
        <rect width="32" height="32" rx="7" className="fill-ink" />
        
        {/* Left page (Verso leaf) */}
        <path
          d="M7 8C7 6.89543 7.89543 6 9 6H15.2V26H9C7.89543 26 7 25.1046 7 24V8Z"
          className="fill-paper"
        />
        
        {/* Right page (Recto leaf) */}
        <path
          d="M16.8 6H23C24.1046 6 25 6.89543 25 8V24C25 25.1046 24.1046 26 23 26H16.8V6Z"
          className="fill-paper-sunken opacity-75"
        />
        
        {/* Typographic rule lines on the Verso page */}
        <line x1="9.5" y1="18.5" x2="13" y2="18.5" className="stroke-ink-faint" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="9.5" y1="21.5" x2="13.5" y2="21.5" className="stroke-ink-faint" strokeWidth="1.2" strokeLinecap="round" />
        
        {/* Cinnabar red pencil / bookmark ribbon */}
        <path
          d="M11 6V15L13.1 13.5L15.2 15V6H11Z"
          fill="var(--cinnabar, #b8452e)"
        />
        
        {/* Book spine line */}
        <line
          x1="16"
          y1="5"
          x2="16"
          y2="27"
          className="stroke-ink"
          strokeWidth="1.2"
        />
      </svg>
      {showText && (
        <span className="font-serif font-bold text-sm tracking-wider text-ink">
          Verso
        </span>
      )}
    </div>
  );
};
