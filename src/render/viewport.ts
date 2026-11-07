import { CAMERA_HEIGHT, CAMERA_WIDTH } from '../engine/constants';

/** Screen y (logical units from the top) of the ground line. */
export const FLOOR_Y = 640;

export interface Viewport { cssWidth: number; cssHeight: number; pixelWidth: number; pixelHeight: number; unitScale: number }

/** Largest 16:9 area inside the window; unitScale = device pixels per world unit. */
export function computeViewport(winW: number, winH: number, dpr: number): Viewport {
  const aspect = CAMERA_WIDTH / CAMERA_HEIGHT;
  let cssWidth = winW, cssHeight = winW / aspect;
  if (cssHeight > winH) { cssHeight = winH; cssWidth = winH * aspect; }
  cssWidth = Math.floor(cssWidth);
  cssHeight = Math.floor(cssHeight);
  const pixelWidth = Math.round(cssWidth * dpr), pixelHeight = Math.round(cssHeight * dpr);
  return { cssWidth, cssHeight, pixelWidth, pixelHeight, unitScale: pixelWidth / CAMERA_WIDTH };
}
