import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '../icons/Icons.tsx';

interface Option {
    value: string;
    label: string;
}

interface MultiSelectDropdownProps {
    options: Option[];
    selected: string[];
    onChange: (selected: string[]) => void;
    label: string;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ options, selected, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (value: string) => {
        const newSelected = selected.includes(value)
            ? selected.filter(item => item !== value)
            : [...selected, value];
        onChange(newSelected);
    };

    const handleSelectAll = () => {
        if (selected.length === options.length) {
            onChange([]);
        } else {
            onChange(options.map(opt => opt.value));
        }
    };

    const displayLabel = selected.length === 0 
        ? `Tüm ${label}ler`
        : selected.length === options.length
        ? `Tüm ${label}ler (${options.length})`
        : selected.length === 1
        ? options.find(opt => opt.value === selected[0])?.label
        : `${selected.length} ${label} Seçildi`;

    return (
        <div className="relative font-sans" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between bg-secondary dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-left text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
            >
                <span className="truncate">{displayLabel}</span>
                <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-20 top-full mt-1 w-full bg-primary dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                    <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                        <label className="flex items-center space-x-3 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer text-sm">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                                checked={selected.length === options.length}
                                onChange={handleSelectAll}
                                ref={el => {
                                    if (el) {
                                        el.indeterminate = selected.length > 0 && selected.length < options.length;
                                    }
                                }}
                            />
                            <span className="font-medium">Tümünü Seç</span>
                        </label>
                    </div>
                    <ul className="max-h-60 overflow-y-auto p-2">
                        {options.map(option => (
                            <li key={option.value}>
                                <label className="flex items-center space-x-3 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer text-sm">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                                        checked={selected.includes(option.value)}
                                        onChange={() => handleSelect(option.value)}
                                    />
                                    <span>{option.label}</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default MultiSelectDropdown;