"use client";

import { useEffect, useState } from "react";

/**
 * Profile card (§4.6). No display-name / default-city field exists in the
 * settings schema, so these live in localStorage; the greeting reads the
 * same `beetlebot.displayName` key.
 */
export function ProfileCard() {
  const [name, setName] = useState("Richardson");
  const [city, setCity] = useState("Toronto");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      setName(window.localStorage.getItem("beetlebot.displayName") || "Richardson");
      setCity(window.localStorage.getItem("beetlebot.defaultCity") || "Toronto");
    } catch {
      // Ignore storage access issues.
    }
  }, []);

  function save() {
    try {
      window.localStorage.setItem("beetlebot.displayName", name.trim() || "Richardson");
      window.localStorage.setItem("beetlebot.defaultCity", city.trim());
    } catch {
      // Ignore storage access issues.
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 4000);
  }

  return (
    <section className="rounded-2xl border border-[#E7E5E0] bg-white p-4">
      <h2 className="text-sm font-semibold text-[#1C1B19]">Profile</h2>
      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="profile-name" className="mb-1 block text-[13px] font-semibold text-[#1C1B19]">
            Display name
          </label>
          <input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-xl border border-[#D6D3CC] bg-white px-3 text-[15px] text-[#1C1B19] outline-none focus:border-[#C8811A]"
          />
          <p className="mt-1 text-xs text-[#6B6862]">Used by the chat greeting.</p>
        </div>
        <div>
          <label htmlFor="profile-city" className="mb-1 block text-[13px] font-semibold text-[#1C1B19]">
            Default city
          </label>
          <input
            id="profile-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="h-10 w-full rounded-xl border border-[#D6D3CC] bg-white px-3 text-[15px] text-[#1C1B19] outline-none focus:border-[#C8811A]"
          />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && (
          <span className="rounded-xl bg-[#1C1B19] px-3 py-2 text-sm font-medium text-white shadow-lg" role="status">
            Settings saved
          </span>
        )}
        <button
          type="button"
          onClick={save}
          className="rounded-[10px] bg-[#C8811A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#A96B12]"
        >
          Save
        </button>
      </div>
    </section>
  );
}
