import { cn } from "@/lib/utils";

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--ember)] to-[var(--primary)] shadow-[0_4px_14px_-4px_rgba(219,74,11,0.7)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="size-5 text-white"
        >
          <path
            d="M12 3.2c.4 0 .7.2.9.6l6.4 12.5c.5.9-.2 2-1.2 2H5.9c-1 0-1.7-1.1-1.2-2L11.1 3.8c.2-.4.5-.6.9-.6Z"
            fill="currentColor"
            opacity="0.22"
          />
          <path
            d="M12 3.2c.4 0 .7.2.9.6l6.4 12.5c.5.9-.2 2-1.2 2H5.9c-1 0-1.7-1.1-1.2-2L11.1 3.8c.2-.4.5-.6.9-.6Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="14" r="2.1" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-extrabold tracking-tight">
            RAIN OF PHYSICS
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Live Classroom
          </span>
        </span>
      )}
    </span>
  );
}
