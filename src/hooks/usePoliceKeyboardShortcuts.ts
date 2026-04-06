import { useEffect } from "react";

type PoliceKeyboardHandlers = {
  onSearch?: () => void;
  onRefresh?: () => void;
  onDispatch?: () => void;
  onAcknowledge?: () => void;
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || target.isContentEditable;
};

export const usePoliceKeyboardShortcuts = (handlers: PoliceKeyboardHandlers) => {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const isModifierPressed = event.ctrlKey || event.metaKey;
      if (!isModifierPressed) {
        return;
      }

      const key = event.key.toLowerCase();
      const allowGlobalSearchShortcut = key === "k";
      if (!allowGlobalSearchShortcut && isEditableTarget(event.target)) {
        return;
      }

      if (key === "k") {
        event.preventDefault();
        handlers.onSearch?.();
        return;
      }

      if (key === "r") {
        event.preventDefault();
        handlers.onRefresh?.();
        return;
      }

      if (key === "d") {
        event.preventDefault();
        handlers.onDispatch?.();
        return;
      }

      if (key === "a") {
        event.preventDefault();
        handlers.onAcknowledge?.();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handlers]);
};
