const onSlideChange = (onChange) => (event) => {
    onChange(event.target.value);
};

export const setSliderOnChange = (targetIdsAndCallbacks) => {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initSliders(targetIdsAndCallbacks));
    } else {
        initSliders(targetIdsAndCallbacks);
    }
};

const initSliders = (targetIdsAndCallbacks) => {
    targetIdsAndCallbacks.forEach(({ id, onChange }) => {
        const element = document.querySelector(id);
        if (element) {
            element.addEventListener('input', onSlideChange(onChange));
            element.addEventListener('change', onSlideChange(onChange));
        }
    });
};
