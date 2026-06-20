// ============================================================================
// 09-cursor.js — Custom Cursor Animations
// ============================================================================

// Setup premium custom cursor animations and hover state management
function initCustomCursor() {
    const cursor = document.querySelector('.custom-cursor');
    if (!cursor) return;

    let mouseX = -100;
    let mouseY = -100;
    let cursorX = -100;
    let cursorY = -100;
    let currentScale = 1.0;
    let targetScale = 1.0;
    let cursorVisible = false;

    // Track mouse coordinates
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (!cursorVisible) {
            cursor.style.opacity = 1;
            cursorVisible = true;
        }

        // Dynamically toggle ruler crosshair class on custom cursor
        if (rulerState && rulerState.active && e.target && (e.target.id === 'trendChart' || e.target.closest('#trendChart'))) {
            cursor.classList.add('ruler-mode');
        } else {
            cursor.classList.remove('ruler-mode');
        }

        // Detect if hovering over any active chart's bottom X-axis region
        let isScalingXArea = false;
        const activeChartsList = [relativeChart, trendChart, volumeChart, ihsgTrendChart];
        for (let i = 0; i < activeChartsList.length; i++) {
            const c = activeChartsList[i];
            if (c && c.canvas && c.canvas === e.target && c.chartArea) {
                const rect = c.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                if (y > c.chartArea.bottom && x >= c.chartArea.left && x <= c.chartArea.right) {
                    isScalingXArea = true;
                    break;
                }
            }
        }

        if (isScalingXArea) {
            cursor.classList.add('scaling-x-mode');
        } else {
            cursor.classList.remove('scaling-x-mode');
        }
    });

    // Handle mouse leaving and entering browser window
    document.addEventListener('mouseleave', () => {
        cursor.style.opacity = 0;
    });

    document.addEventListener('mouseenter', () => {
        if (cursorVisible) {
            cursor.style.opacity = 1;
        }
    });

    // Smooth position and scale interpolation (lerping)
    function animateCursor() {
        const easing = 0.15;
        cursorX += (mouseX - cursorX) * easing;
        cursorY += (mouseY - cursorY) * easing;
        currentScale += (targetScale - currentScale) * 0.2;

        // Offset translation to center the 16px wide circle on cursor hotspot
        cursor.style.transform = `translate3d(${cursorX - 8}px, ${cursorY - 8}px, 0) scale(${currentScale})`;

        requestAnimationFrame(animateCursor);
    }

    // Start animation loop
    requestAnimationFrame(animateCursor);

    // Hover state detection for interactive elements (using event delegation)
    document.addEventListener('mouseover', (e) => {
        const target = e.target;
        if (!target) return;

        const isInteractive =
            target.tagName === 'A' ||
            target.tagName === 'BUTTON' ||
            target.tagName === 'SELECT' ||
            target.classList.contains('tf-btn') ||
            target.classList.contains('styled-select') ||
            target.closest('a') ||
            target.closest('button') ||
            target.closest('.styled-select') ||
            target.closest('.tf-btn');

        if (isInteractive) {
            targetScale = 1.8;
            cursor.classList.add('hovered');
        }
    });

    document.addEventListener('mouseout', (e) => {
        const target = e.target;
        if (!target) return;

        const isInteractive =
            target.tagName === 'A' ||
            target.tagName === 'BUTTON' ||
            target.tagName === 'SELECT' ||
            target.classList.contains('tf-btn') ||
            target.classList.contains('styled-select') ||
            target.closest('a') ||
            target.closest('button') ||
            target.closest('.styled-select') ||
            target.closest('.tf-btn');

        if (isInteractive) {
            targetScale = 1.0;
            cursor.classList.remove('hovered');
        }
    });
}

// Initialize the custom cursor
if (matchMedia('(pointer: fine)').matches) {
    initCustomCursor();
}
