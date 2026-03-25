"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  Home,
  QrCode,
  Users,
  MessageSquareMore,
  Clock3,
  Calendar,
  Bell,
  BarChart2,
  Settings2,
  LifeBuoy,
  UserCircle,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { appSectionItems } from "@/lib/constants/navigation";
import { routes } from "@/lib/constants/routes";

// Define icons mapping
const sectionIcons: Record<string, any> = {
  Home: Home,
  Share: QrCode,
  Dotlys: UserCircle,
  Requests: MessageSquareMore,
  Connections: Users,
  "Follow-ups": Clock3,
  Events: Calendar,
  Alerts: Bell,
  Insights: BarChart2,
  Settings: Settings2,
  Support: LifeBuoy,
};

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const pathname = usePathname();

  // Prevent scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-[110] bg-black/20 dark:bg-black/40 backdrop-blur-sm sm:hidden"
            onClick={onClose}
          />

          {/* Menu Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "fixed inset-y-0 left-0 z-[120] w-[85vw] max-w-[340px] sm:hidden flex flex-col",
              "bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-[40px] saturate-[200%]",
              "border-r shadow-[0.5px_0_0_rgba(0,0,0,0.15)] border-transparent dark:shadow-[0.5px_0_0_rgba(255,255,255,0.15)]",
              "safe-pt safe-pb",
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 min-h-[44px] border-b border-black/[0.08] dark:border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="h-[32px] w-[32px] rounded-full bg-gradient-to-b from-black/80 to-black dark:from-white/90 dark:to-white/70 flex items-center justify-center shadow-sm">
                  <span className="text-white dark:text-black font-bold text-[15px] tracking-tight leading-none pt-[1px]">
                    D
                  </span>
                </div>
                <span className="text-[17px] font-bold tracking-tight text-foreground">
                  Dotly
                </span>
              </div>
              <button
                onClick={onClose}
                className="flex items-center justify-center h-8 w-8 rounded-full bg-black/5 dark:bg-white/10 text-foreground hover:bg-black/10 transition-colors"
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Links */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {appSectionItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== routes.app.home &&
                    pathname.startsWith(`${item.href}/`));
                const Icon = sectionIcons[item.label] || Home;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 active:scale-[0.98]",
                      isActive
                        ? "bg-black/[0.06] dark:bg-white/[0.1] text-foreground"
                        : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-muted-foreground/90 hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[22px] w-[22px]",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground/70",
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span
                      className={cn(
                        "text-[17px] tracking-tight leading-none pt-px",
                        isActive
                          ? "font-semibold text-foreground"
                          : "font-medium",
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
