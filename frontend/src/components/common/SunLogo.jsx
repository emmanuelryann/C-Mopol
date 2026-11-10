import React from 'react';

/**
 * SunLogo - Matching the stylized radiant arched sunburst icon from the design screenshots.
 * Stylized arch with 12 radiating rays in warm radiant orange.
 */
export const SunLogo = ({ className = '', size = 'clamp(2.75rem, 5vw, 3.5rem)' }) => {
  return (
    <div
      className={`sun-logo-wrapper ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      aria-label="C-Mopol Sun Logo"
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        {/* Core semicircular arch tunnel */}
        <path
          d="M17 32C17 28.134 20.134 25 24 25C27.866 25 31 28.134 31 32"
          stroke="#E26D24"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M20.5 32C20.5 30.067 22.067 28.5 24 28.5C25.933 28.5 27.5 30.067 27.5 32"
          stroke="#E26D24"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Outer radial sunburst rays */}
        {/* 12 o'clock */}
        <path d="M24 6V13" stroke="#E26D24" strokeWidth="2.75" strokeLinecap="round" />
        {/* 1 o'clock */}
        <path d="M32.5 8.5L28.8 14.5" stroke="#E26D24" strokeWidth="2.75" strokeLinecap="round" />
        {/* 2 o'clock */}
        <path d="M39.5 15.5L33.5 19.2" stroke="#E26D24" strokeWidth="2.75" strokeLinecap="round" />
        {/* 3 o'clock */}
        <path d="M42 24H35" stroke="#E26D24" strokeWidth="2.75" strokeLinecap="round" />
        {/* 4 o'clock */}
        <path d="M39.5 32.5L33.5 28.8" stroke="#E26D24" strokeWidth="2.75" strokeLinecap="round" />
        {/* 5 o'clock */}
        <path d="M33.5 39.5L29 34" stroke="#E26D24" strokeWidth="2.75" strokeLinecap="round" />

        {/* 11 o'clock */}
        <path d="M15.5 8.5L19.2 14.5" stroke="#E26D24" strokeWidth="2.75" strokeLinecap="round" />
        {/* 10 o'clock */}
        <path d="M8.5 15.5L14.5 19.2" stroke="#E26D24" strokeWidth="2.75" strokeLinecap="round" />
        {/* 9 o'clock */}
        <path d="M6 24H13" stroke="#E26D24" strokeWidth="2.75" strokeLinecap="round" />
        {/* 8 o'clock */}
        <path d="M8.5 32.5L14.5 28.8" stroke="#E26D24" strokeWidth="2.75" strokeLinecap="round" />
        {/* 7 o'clock */}
        <path d="M14.5 39.5L19 34" stroke="#E26D24" strokeWidth="2.75" strokeLinecap="round" />

        {/* Subtle center ray */}
        <path d="M24 16V20" stroke="#E26D24" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
};

export default SunLogo;
