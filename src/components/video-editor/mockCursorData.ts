import { CursorDataPoint } from "./types";

// A mock recording of a mouse cursor moving across the screen and clicking
export const MOCK_CURSOR_DATA: CursorDataPoint[] = [];

// Generate 10 seconds of mock cursor data (at 60fps)
let currentX = 0.5;
let currentY = 0.5;

for (let i = 0; i <= 600; i++) {
  const timestampMs = i * (1000 / 60);
  
  // Move right and down
  if (i < 120) {
    currentX += 0.002;
    currentY += 0.001;
  } 
  // Move left quickly
  else if (i < 200) {
    currentX -= 0.005;
  }
  // Hover and click
  else if (i < 240) {
    // stationary
  }
  else if (i < 400) {
    currentY -= 0.003;
    currentX += 0.001;
  }
  else {
    currentX -= 0.001;
    currentY += 0.002;
  }

  // Add some clicks
  const isClick = (i === 120 || i === 230 || i === 450);

  MOCK_CURSOR_DATA.push({
    timestamp: timestampMs,
    x: Math.max(0, Math.min(1, currentX)),
    y: Math.max(0, Math.min(1, currentY)),
    cx: Math.max(0, Math.min(1, currentX)),
    cy: Math.max(0, Math.min(1, currentY)),
    isClick
  });
}
