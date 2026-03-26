"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function FloatingAppBar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-4 inset-x-4 md:inset-x-0 md:top-6 z-50 flex justify-center pointer-events-none"
    >
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-2">
        <div className="pointer-events-auto flex items-center justify-between p-2 pl-4 rounded-[2rem] border border-black/5 dark:border-white/10 bg-white/70 dark:bg-[#111111]/70 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.24)] transition-all w-full">
          {/* Left: Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 no-select outline-none shrink-0"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-foreground to-foreground/80 shadow-md transition-transform group-active:scale-95">
              <span className="font-mono text-[14px] font-bold text-background pb-px">
                D
              </span>
            </div>
            <span className="font-sans text-[18px] font-bold tracking-tight text-foreground">
              Dotly
            </span>
          </Link>

          {/* Center: Desktop Nav (Hidden on Mobile) */}
          <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {["Features", "Use Cases", "Pricing"].map((item) => (
              <Link
                key={item}
                href={
                  item === "Features"
                    ? "/#features"
                    : item === "Use Cases"
                      ? "/#use-cases"
                      : "/#pricing"
                }
                className="px-4 py-2 rounded-full text-[14px] font-semibold text-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                {item}
              </Link>
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:flex px-4 py-2 text-[14px] font-semibold text-muted hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-[14px] font-semibold text-background shadow-[0_4px_14px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_14px_rgba(255,255,255,0.1)] transition-all hover:scale-[0.98] active:scale-95 hover:bg-foreground/90"
            >
              Get started
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 md:hidden active:scale-95 transition-transform ml-1"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5 text-foreground" strokeWidth={2} />
              ) : (
                <Menu className="h-5 w-5 text-foreground" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Panel */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-auto md:hidden rounded-[1.5rem] p-4 border border-black/5 dark:border-white/10 bg-white/70 dark:bg-[#111111]/70 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.24)] origin-top"
            >
              <nav className="flex flex-col gap-2">
                {["Features", "Use Cases", "Pricing"].map((item) => (
                  <Link
                    key={item}
                    href={
                      item === "Features"
                        ? "/#features"
                        : item === "Use Cases"
                          ? "/#use-cases"
                          : "/#pricing"
                    }
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-xl text-[15px] font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors tap-feedback"
                  >
                    {item}
                  </Link>
                ))}

                <div className="h-px w-full bg-black/5 dark:bg-white/10 my-2 sm:hidden" />

                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="sm:hidden px-4 py-3 rounded-xl text-[15px] font-semibold text-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors tap-feedback"
                >
                  Log in
                </Link>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
