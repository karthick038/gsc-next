import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function normalizeWebsite(url) {
  if (!url) return "";
  return url.toLowerCase().trim().replace(/\/$/, "");
}

export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}
