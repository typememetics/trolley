"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Reading your commit history...",
  "Counting your force pushes...",
  "Weighing your soul against a feather...",
  "Checking whether you close your issues...",
  "Consulting the lever...",
  "Asking your rubber duck about you...",
  "Measuring your tabs against your spaces...",
  "Simulating 14 million futures...",
];

/**
 * What a rate-limited player sees instead of the matchup: a loading screen. For the short
 * limit (`waitMs`) the bar fills while the matchup retries behind it; for the daily one
 * (no `waitMs`) it never finishes.
 */
export function WorthinessCheck({ waitMs }: { waitMs?: number }) {
  const daily = waitMs === undefined;
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep(s => (s + 1) % STEPS.length), 1_600);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="worthiness" role="status" aria-live="polite">
      <div className="worthiness-spinner" aria-hidden="true"/>
      <h2>AGI is considering whether you are even worthy to play</h2>
      <div className="worthiness-bar" aria-hidden="true">{daily
        ? <span className="worthiness-stuck"/>
        : <span style={{ animationDuration: `${waitMs}ms` }}/>}</div>
      <p className="worthiness-step">{STEPS[step]}</p>
      <p className="worthiness-fineprint">
        {daily ? "Deliberations can take up to a day. Do not refresh. It won't help." : "Do not refresh. It won't help."}
      </p>
    </section>
  );
}
