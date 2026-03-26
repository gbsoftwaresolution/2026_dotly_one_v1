"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export function PublicFooter() {
  return (
    <motion.footer
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 border-t border-black/5 dark:border-white/10 pt-12 pb-8 flex flex-col md:flex-row items-center justify-between gap-6"
    >
      <div className="flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-b from-foreground to-foreground/80 shadow-md">
          <span className="font-mono text-[10px] font-bold text-background pb-px">
            D
          </span>
        </div>
        <span className="text-[14px] font-semibold tracking-tight text-foreground">
          Dotly
        </span>
      </div>

      <div className="flex items-center gap-6 text-[13px] font-medium text-muted">
        <Link
          href="/privacy"
          className="hover:text-foreground transition-colors"
        >
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-foreground transition-colors">
          Terms
        </Link>
        <Link
          href="/support"
          className="hover:text-foreground transition-colors"
        >
          Support
        </Link>
      </div>

      <p className="text-[13px] font-medium text-muted/60">
        &copy; {new Date().getFullYear()} Dotly Inc. All rights reserved.
      </p>
    </motion.footer>
  );
}
