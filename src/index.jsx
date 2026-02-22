import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './arrow-grid';

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

const encoded = getParameterByName('data');
let parsedGrid = {};

if (encoded) {
    const decoded = window.atob(encoded);
    parsedGrid = JSON.parse(decoded);
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
    <App noteLength={parsedGrid.noteLength} grid={parsedGrid.grid} />
);
