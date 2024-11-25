import React, { useState, useEffect, useCallback } from 'react';
import { Textarea } from '@/src/components/ui/textarea';

const PromptEditor = ({ value, onChange, placeholder }) => {
    // Local state to handle the input value
    const [localValue, setLocalValue] = useState(value || '');

    // Update local state when prop value changes
    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    // Debounced onChange handler
    const debouncedOnChange = useCallback(
        (() => {
            let timeoutId;
            return (newValue) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    onChange(newValue);
                }, 300);
            };
        })(),
        [onChange]
    );

    // Handle input changes
    const handleChange = (e) => {
        const newValue = e.target.value;
        setLocalValue(newValue);
        debouncedOnChange(newValue);
    };

    return (
        <Textarea
            value={localValue}
            onChange={handleChange}
            placeholder={placeholder}
            className="min-h-[200px] font-mono text-sm"
        />
    );
};

export default PromptEditor;
