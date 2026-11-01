"use client";

import { useEffect, useRef } from "react";

// A <dialog> opened with showModal(). Leaving the page closes it: Next keeps the previous page mounted but hidden, and
// an open modal would otherwise stay on top of the next page and block it.
export function useModal() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);
  return ref;
}
