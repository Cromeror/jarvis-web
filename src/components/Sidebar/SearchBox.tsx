import React from 'react';

interface SearchBoxProps {
  value: string;
  onSearch: (value: string) => void;
}

export function SearchBox({ value, onSearch }: SearchBoxProps): React.ReactElement {
  return (
    <div className="search-box">
      <input
        type="text"
        placeholder="Buscar archivo..."
        value={value}
        onChange={(e) => onSearch(e.target.value)}
        className="search-input"
        aria-label="Buscar archivo"
      />
    </div>
  );
}
