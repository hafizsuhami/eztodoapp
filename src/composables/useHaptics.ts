/**
 * Haptic feedback composable for tactile interactions
 * Provides consistent haptic patterns across the app
 */
export function useHaptics() {
  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const haptic = {
    /** Light tap - selection, navigation (10ms) */
    light: () => canVibrate && navigator.vibrate(10),

    /** Medium tap - action confirmation (20ms) */
    medium: () => canVibrate && navigator.vibrate(20),

    /** Heavy tap - important action, warning (30ms pulse) */
    heavy: () => canVibrate && navigator.vibrate([30, 30, 30]),

    /** Success pattern - task completion */
    success: () => canVibrate && navigator.vibrate([10, 50, 20]),

    /** Error pattern - validation failure */
    error: () => canVibrate && navigator.vibrate([50, 50, 50]),

    /** Selection change - subtle feedback (5ms) */
    selection: () => canVibrate && navigator.vibrate(5),

    /** Drag start/end feedback */
    drag: () => canVibrate && navigator.vibrate(15),

    /** Swipe threshold reached */
    swipeThreshold: () => canVibrate && navigator.vibrate([20, 20]),
  };

  return { haptic, canVibrate };
}
