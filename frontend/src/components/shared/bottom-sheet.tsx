"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[190] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 200,
              mass: 0.8,
            }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.05}
            onDragEnd={(e, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
            className={cn(
              "fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center",
              "w-full max-w-[600px] mx-auto overflow-hidden rounded-t-[32px]",
              "bg-white/60 backdrop-blur-3xl dark:bg-zinc-900/60 ring-1 ring-black/5 dark:ring-white/10",
              "shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)]",
            )}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

            <div className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-black/15 dark:bg-white/20" />
            </div>

            {title && (
              <div className="w-full px-6 pt-2 pb-4 text-center border-b border-black/5 dark:border-white/5">
                <h3 className="text-[17px] font-semibold tracking-[-0.43px] text-foreground">
                  {title}
                </h3>
              </div>
            )}

            <div className="w-full px-6 py-6 overflow-y-auto max-h-[75vh] safe-pb">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
