"use client";

import { useEffect, useState } from "react";

// Mobile "order now" bar, shown only while the order form is off-screen.
export function StickyOrderButton({ label }: { label: string }) {
  const [formVisible, setFormVisible] = useState(true);
  useEffect(() => {
    const form = document.getElementById("order");
    if (!form) return;
    const observer = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting));
    observer.observe(form);
    return () => observer.disconnect();
  }, []);
  if (formVisible) return null;
  return (
    <a href="#order" className="btn fixed inset-x-4 bottom-4 z-20 py-3 text-base shadow-xl md:hidden">
      {label}
    </a>
  );
}
