import type { PropsWithChildren, ReactNode } from "react";
import { motion } from "framer-motion";

interface AuthPageShellProps extends PropsWithChildren {
  title: string;
  description: string;
  aside?: ReactNode;
}

export function AuthPageShell({
  title,
  description,
  aside,
  children,
}: AuthPageShellProps) {
  return (
    <section className="mx-auto flex w-full max-w-[480px] flex-col justify-center min-h-screen pt-20 pb-12 sm:pt-32 relative z-10 px-4 sm:px-0">
      <div className="space-y-4 px-2 text-center mb-10 animate-fade-up">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-[1.05]" style={{ letterSpacing: "-0.03em" }}>
          {title}
        </h1>
        <p className="text-[17px] sm:text-[18px] leading-relaxed text-muted font-medium max-w-[34ch] mx-auto">
          {description}
        </p>
      </div>

      {aside}

      <div className="animate-scale-in w-full" style={{ animationDelay: '100ms' }}>
        {children}
      </div>
    </section>
  );
}
