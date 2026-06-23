import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.09] bg-[rgba(5,15,30,0.45)] px-7 py-5 backdrop-blur-[40px] backdrop-saturate-[180%] shadow-[inset_0_-1px_0_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.07)]",
        className
      )}
    >
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.025em] text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-500">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2.5">{children}</div>}
    </header>
  );
}
