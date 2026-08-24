import { App as NativeApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export interface MobileLifecycle {
  remove(): Promise<void>;
}

function setKeyboardState(open: boolean, height = 0): void {
  document.documentElement.toggleAttribute('data-keyboard-open', open);
  document.documentElement.style.setProperty('--keyboard-height', `${Math.max(height, 0)}px`);
}

export async function initializeMobileChrome(): Promise<MobileLifecycle> {
  const handles: PluginListenerHandle[] = [];
  if (Capacitor.isNativePlatform()) {
    await Promise.allSettled([
      Keyboard.setResizeMode({ mode: KeyboardResize.Native }),
      Keyboard.setAccessoryBarVisible({ isVisible: true }),
      StatusBar.setStyle({ style: Style.Dark }),
    ]);
    handles.push(await Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => {
      setKeyboardState(true, keyboardHeight);
    }));
    handles.push(await Keyboard.addListener('keyboardWillHide', () => setKeyboardState(false)));
    await SplashScreen.hide().catch(() => undefined);
  } else if (window.visualViewport) {
    const initialHeight = window.visualViewport.height;
    const resize = () => {
      const keyboardHeight = Math.max(0, initialHeight - window.visualViewport!.height);
      setKeyboardState(keyboardHeight > 120, keyboardHeight);
    };
    window.visualViewport.addEventListener('resize', resize);
    return {
      remove: async () => {
        window.visualViewport?.removeEventListener('resize', resize);
        setKeyboardState(false);
      },
    };
  }
  return {
    remove: async () => {
      await Promise.all(handles.map((handle) => handle.remove()));
      setKeyboardState(false);
    },
  };
}

export async function registerForegroundLifecycle(
  onForeground: () => void | Promise<void>,
): Promise<MobileLifecycle> {
  if (!Capacitor.isNativePlatform()) {
    const visibility = () => {
      if (document.visibilityState === 'visible') void onForeground();
    };
    document.addEventListener('visibilitychange', visibility);
    if (document.visibilityState === 'visible') void onForeground();
    return { remove: async () => document.removeEventListener('visibilitychange', visibility) };
  }

  const state = await NativeApp.getState();
  if (state.isActive) void onForeground();
  const handle = await NativeApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void onForeground();
  });
  return { remove: () => handle.remove() };
}
