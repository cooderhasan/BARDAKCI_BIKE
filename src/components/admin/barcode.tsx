"use client";

import React from 'react';

/**
 * Code 128 Barcode Generator (SVG)
 * Standart kargo terminallerinin okuyabileceği formatta barkod üretir.
 * Harici kütüphane gerektirmez.
 */

interface BarcodeProps {
  value: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  className?: string;
}

export const Barcode: React.FC<BarcodeProps> = ({ 
  value, 
  width = 2, 
  height = 80, 
  displayValue = true,
  className = "" 
}) => {
  if (!value) return null;

  // Code 128B implementation (Standard for alpha-numeric)
  const code128B: Record<string, string> = {
    ' ': '11011001100', '!': '11001101100', '"': '11001100110', '#': '10010011000',
    '$': '10010001100', '%': '10001001100', '&': '10011001000', "'": '10011000100',
    '(': '10001100100', ')': '11001001000', '*': '11001000100', '+': '11000100100',
    ',': '10110011100', '-': '10011011100', '.': '10011001110', '/': '10111001100',
    '0': '10011101100', '1': '10011100110', '2': '11001110100', '3': '11001110010',
    '4': '11011100100', '5': '11011100010', '6': '11011101000', '7': '11011101100',
    '8': '11101101100', '9': '11101001100', ':': '11101000110', ';': '11100010110',
    '<': '11100011010', '=': '11101101110', '>': '11101110110', '?': '11101110110',
    '@': '11101101110', 'A': '10110111100', 'B': '10110011110', 'C': '10011011110',
    'D': '10111101100', 'E': '10111100110', 'F': '10011110110', 'G': '11110110100',
    'H': '11110110010', 'I': '11110011010', 'J': '10111001110', 'K': '10111100111',
    'L': '11101011110', 'M': '11110101110', 'N': '11110111010', 'O': '111101110110',
    'P': '11011111010', 'Q': '111011111010', 'R': '10110111110', 'S': '10111110110',
    'T': '11101111101', 'U': '11101111101', 'V': '11110110110', 'W': '11110111011',
    'X': '11011011110', 'Y': '11011110110', 'Z': '11011110111', '[': '11101101110',
    '\\': '11101111011', ']': '11111011011', '^': '10101111000', '_': '10100011110',
    '`': '10001011110', 'a': '10111101000', 'b': '10111100010', 'c': '11110110100',
    'd': '11110110010', 'e': '11110011010', 'f': '10111011110', 'g': '10111110110',
    'h': '11101111010', 'i': '11111010110', 'j': '11111011010', 'k': '11101101111',
    'l': '11101111011', 'm': '11111011011', 'n': '11011111011', 'o': '11101111101',
    'p': '11111011101', 'q': '11111101101', 'r': '11111110110', 's': '11111110101',
    't': '11111011101', 'u': '11111101101', 'v': '11111110110', 'w': '11111110101',
    'x': '10110111111', 'y': '10111110111', 'z': '11101011111', '{': '11111010111',
    '|': '11111101011', '}': '11111110101', '~': '11111110111',
  };

  // Simplified Start/Stop symbols for 128B
  const START_B = '11010010000';
  const STOP = '1100011101011';

  let binString = START_B;
  let checksum = 104; // START_B value

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    const code = code128B[char] || code128B[' '];
    const val = Object.keys(code128B).indexOf(char);
    binString += code;
    checksum += (val >= 0 ? val : 0) * (i + 1);
  }

  const checkCode = Object.values(code128B)[checksum % 103];
  binString += checkCode + STOP;

  const svgWidth = binString.length * width;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg
        style={{ width: '100%', maxWidth: `${svgWidth}px` }}
        height={height}
        viewBox={`0 0 ${svgWidth} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        className="block mx-auto overflow-visible"
      >
        {binString.split('').map((bit, index) => (
          bit === '1' && (
            <rect
              key={index}
              x={index * width}
              y="0"
              width={width}
              height={height}
              fill="black"
            />
          )
        ))}
      </svg>
      {displayValue && (
        <span className="mt-1 text-[10px] font-mono tracking-[0.2em] font-bold text-black text-center w-full">
          {value}
        </span>
      )}
    </div>
  );
};
