"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const REFRESH_COUNTDOWN_SECONDS = 80;

type TriggerStatus = "idle" | "loading" | "success" | "error";

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function TopNav() {
  const [status, setStatus] = useState<TriggerStatus>("idle");
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (countdown === null) return;

    if (countdown <= 0) {
      window.location.reload();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((value) => (value ?? 0) - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const handleTrigger = async () => {
    if (status === "loading") return;

    const confirmed = window.confirm(
      "Trigger ulang seluruh pipeline Airflow (ingest, preprocessing, clustering, classification)?\n\nProses ini menarik data baru dari USGS dan melatih ulang model, bisa memakan waktu cukup lama."
    );
    if (!confirmed) return;

    try {
      setStatus("loading");
      setMessage("");
      setCountdown(null);

      const response = await fetch(`${API_BASE_URL}/pipeline/trigger`, {
        method: "POST",
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.detail ?? "Gagal memicu DAG Airflow.");
      }

      setStatus("success");
      setCountdown(REFRESH_COUNTDOWN_SECONDS);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Gagal memicu DAG Airflow.");
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-9999 border-b border-slate-700 bg-[#061829]/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.svg"
            alt="SeismoSphere logo"
            width={36}
            height={36}
            priority
            className="h-9 w-9 rounded-full bg-[#f8eee6] p-1"
          />
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">
            SeismoSphere
          </div>
        </div>

        <div className="flex items-center gap-3">
          {status === "success" && countdown !== null ? (
            <span className="hidden text-xs text-emerald-300 sm:inline">
              Re-Training Finish In {formatCountdown(countdown)}
            </span>
          ) : (
            message && (
              <span
                className={`hidden max-w-70 truncate text-xs sm:inline ${
                  status === "error" ? "text-rose-300" : "text-emerald-300"
                }`}
              >
                {message}
              </span>
            )
          )}

          <button
            type="button"
            onClick={handleTrigger}
            disabled={status === "loading"}
            className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "loading" ? "Triggering…" : "Trigger DAG"}
          </button>
        </div>
      </div>
    </header>
  );
}
