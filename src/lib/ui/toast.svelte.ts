/* The little message above the tab bar ("Logged 540 kcal"). One at a time;
   a new one replaces the old. */

const TOAST_MS = 2600;

export const toastState = $state({ message: '', visible: false });

let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string): void {
  toastState.message = message;
  toastState.visible = true;
  clearTimeout(timer);
  timer = setTimeout(() => {
    toastState.visible = false;
  }, TOAST_MS);
}
