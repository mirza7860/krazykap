import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const instrument = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Rain of Physics — Live Classroom",
    template: "%s · Rain of Physics",
  },
  description:
    "Turn any physics lesson into a live multiplayer game. Create a room, project the QR, and every phone becomes a response device.",
  keywords: ["physics", "classroom", "live quiz", "gamified learning", "teacher"],
};

export const viewport: Viewport = {
  themeColor: "#db4a0b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // Browser extensions (content scripts, password managers, "foxified"-style
      // injectors) add attributes to <html> before React hydrates. React cannot
      // diff those away, so opt these two host elements out. This suppresses
      // only this element's own attributes — one level deep, not the subtree —
      // so genuine child mismatches still warn.
      suppressHydrationWarning
      className={`${bricolage.variable} ${instrument.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <TooltipProvider delay={200}>{children}</TooltipProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
