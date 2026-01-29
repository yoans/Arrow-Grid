import React from 'react';
import {PlusIcon} from './icons';
export const PlusButton = ({onClick, count}) => (
    <button 
        className={"PlusButton isEnabled"}
        onClick={onClick}
        title={`Arrows per click: ${count || 1} (click to change)`}
    >
        <PlusIcon></PlusIcon>
        {count && count > 1 && <span className="plus-count-badge">{count}</span>}
    </button>
)