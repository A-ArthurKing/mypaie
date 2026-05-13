import React from 'react';
import Select from 'react-select';

export default function CustomSelect({ 
    id, 
    name, 
    value, 
    onChange, 
    options, 
    placeholder, 
    isDisabled,
    isClearable,
    className 
}) {
    // Adapter le style react-select pour matcher nos variables root.css
    const customStyles = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: isDisabled ? 'var(--color-bg-app)' : 'var(--color-bg-nav)',
            borderColor: state.isFocused ? 'var(--color-accent)' : 'var(--color-border)',
            borderWidth: '1px',
            borderRadius: 'var(--radius-sm)',
            boxShadow: state.isFocused ? '0 0 0 3px var(--color-accent-soft)' : 'none',
            minHeight: '2.75rem',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            transition: 'all var(--transition-fast)',
            '&:hover': {
                borderColor: !isDisabled && !state.isFocused ? 'var(--color-border-strong)' : provided['&:hover']?.borderColor
            }
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: 'var(--color-bg-nav)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--color-border-subtle)',
            zIndex: 'var(--z-modal)',
            overflow: 'hidden'
        }),
        menuList: (provided) => ({
            ...provided,
            padding: 0
        }),
        option: (provided, state) => ({
            ...provided,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            padding: '0.625rem 1rem',
            backgroundColor: state.isSelected 
                ? 'var(--color-accent)' 
                : state.isFocused 
                    ? 'var(--color-surface-2)' 
                    : 'transparent',
            color: state.isSelected 
                ? 'var(--color-text-on-accent)' 
                : 'var(--color-text-primary)',
            '&:active': {
                backgroundColor: state.isSelected ? 'var(--color-accent)' : 'var(--color-surface-hover)'
            }
        }),
        singleValue: (provided, state) => ({
            ...provided,
            color: isDisabled ? 'var(--color-text-disabled)' : 'var(--color-text-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
        }),
        placeholder: (provided) => ({
            ...provided,
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
        }),
        indicatorSeparator: () => ({
            display: 'none'
        })
    };

    // Trouver l'option rÃ©elle qui correspond Ã  la (ou les) value(s) string/numbers d'entrÃ©e
    const valObj = options ? options.find(o => String(o.value) === String(value)) || null : null;

    // Masquage transparent de l'Ã©vÃ©nement onChange pour nos anciens hooks (qui utilisent e.target.value)
    const handleChange = (selectedOption) => {
        if (onChange) {
            const eventMock = {
                target: {
                    id: id || name,
                    name: name,
                    value: selectedOption ? selectedOption.value : ''
                }
            };
            onChange(eventMock);
        }
    };

    return (
        <div className={`custom-select-wrapper ${className || ''}`}>
            <Select 
                id={id}
                name={name}
                styles={customStyles}
                options={options}
                value={valObj}
                onChange={handleChange}
                placeholder={placeholder || "-- SÃ©lectionner --"}
                isDisabled={isDisabled}
                isClearable={isClearable}
                noOptionsMessage={() => "Aucune option trouvÃ©e"}
            />
        </div>
    );
}