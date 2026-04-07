"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  School,
  Trophy,
} from "lucide-react";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/elections", label: "Elections", icon: ClipboardList },
  { href: "/admin/students", label: "Students", icon: School },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/results", label: "Results", icon: Trophy },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] flex-shrink-0 flex flex-col pt-5 pb-4 shadow-sm">
      <div className="px-6 mb-5 hidden">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Admin Panel
        </p>
      </div>
      <nav className="flex-1 px-4 space-y-1 bg-white">
        {LINKS.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                active
                  ? "bg-brand-maroon/10 text-brand-maroon border border-brand-maroon/20"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon
                className={`flex-shrink-0 -ml-1 mr-3 h-5 w-5 ${
                  active ? "text-brand-maroon" : "text-gray-400 group-hover:text-gray-500"
                }`}
              />
              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

