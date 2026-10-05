import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';

interface Logo3DProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

export default function Logo3D({ size = 'md', showSubtitle = true, className = '' }: Logo3DProps) {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = -((y - centerY) / centerY) * 16;
    const rotY = ((x - centerX) / centerX) * 16;
    setRotation({ x: rotX, y: rotY });
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
    setIsHovered(false);
  };

  const logoDims = {
    sm: 'w-9 h-9',
    md: 'w-11 h-11 sm:w-12 sm:h-12',
    lg: 'w-14 h-14 sm:w-16 sm:h-16',
  }[size];

  const titleSizes = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-xl sm:text-2xl',
  }[size];

  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-3.5 group perspective-1000 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* 3D Animated Logo Badge */}
      <div
        ref={containerRef}
        className="relative preserve-3d transition-transform duration-200 ease-out"
        style={{
          transform: `perspective(600px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(${isHovered ? 1.08 : 1}, ${isHovered ? 1.08 : 1}, 1)`,
        }}
      >
        {/* Holographic Glowing Aura */}
        <div
          className={`absolute -inset-2 rounded-2xl bg-gradient-to-r from-[#00e5ff] via-[#cbd5e1] to-[#00b4d8] opacity-40 blur-md transition-all duration-500 ${
            isHovered ? 'opacity-85 scale-110 blur-lg' : 'animate-pulse'
          }`}
        />

        {/* 3D Glass Emblem Container */}
        <div className="relative rounded-xl p-1 bg-gradient-to-b from-[#152033] via-[#0b101c] to-[#05070b] border border-[#00e5ff]/40 shadow-[0_8px_20px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.4)]">
          <img
            src="https://i.ibb.co/2Yp3CDq9/file-000000006f2c8211b20c6bedc9f9ac12.png"
            alt="ZK Logo"
            className={`${logoDims} object-contain rounded-lg filter drop-shadow-[0_0_12px_rgba(0,229,255,0.7)] transition-transform duration-300 group-hover:scale-105`}
          />

          {/* 3D Specular Sheen */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-transparent via-white/15 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Typography with Electric Blue and Silver Styling */}
      <div className="flex flex-col justify-center select-none">
        <div className="flex items-center gap-2">
          <span
            className={`${titleSizes} font-black tracking-tight text-white leading-none group-hover:text-brand transition-colors duration-300 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]`}
          >
            ZK Voice Hub
          </span>
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wider rounded bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/30 shadow-[0_0_8px_rgba(0,229,255,0.3)]">
            3D
          </span>
        </div>
        {showSubtitle && (
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-silver-dark group-hover:text-silver transition-colors duration-300 leading-tight mt-1">
            PRESENTING BY: <span className="text-white/80">ZK DUBBING STUDIO</span>
          </span>
        )}
      </div>
    </Link>
  );
}
