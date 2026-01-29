import React from 'react';
import {SymmetryIcon} from './icons';

const symmetryLabels = {
    'backward-diag': 'Diagonal Symmetry (↘)',
    'forward-diag': 'Diagonal Symmetry (↗)',
    'horizontal': 'Horizontal Symmetry (↔)',
    '': 'Vertical Symmetry (↕)'
};

export const SymmetryButton = ({onClick, isActive, className}) => (
    <button 
        className={"EditButton isEnabled" + (isActive ? " ActiveControl":"")}
        onClick={onClick}
        title={symmetryLabels[className] || 'Symmetry'}
    >
        <SymmetryIcon className={className}></SymmetryIcon>
        {isActive && <span className="symmetry-active-indicator">✓</span>}
    </button>
)