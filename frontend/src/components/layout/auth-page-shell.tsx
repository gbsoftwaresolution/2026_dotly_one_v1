import type { PropsWithChildren, ReactNode } from "react";

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
    <section className="mx-auto flex w-full max-w-[460px] flex-col gap-5 py-6 sm:py-10">
      <div className="space-y-2 px-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.15rem]">
          {title}
        </h1>
        <p className="text-sm leading-6 text-muted sm:text-[15px]">
          {description}
        </p>
      </div>

      {aside}

      {children}
    </section>
  );
}