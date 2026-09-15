"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [{ href: "/", label: "Dashboard Map" }];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-1000 border-b border-slate-700 bg-[#061829]/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
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

        <nav className="flex items-center gap-2 rounded-full border border-slate-700 bg-[#0b1d2d] p-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-cyan-400 text-slate-900"
                    : "text-slate-200 hover:bg-slate-700/70"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
