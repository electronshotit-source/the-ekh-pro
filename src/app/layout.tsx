import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter, Instrument_Serif } from "next/font/google"
import { NuqsAdapter } from "nuqs/adapters/next/app"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

// Display accent only — used for the italic word in headlines.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "the EKH pro — social media engine for wedding photographers",
    template: "%s · the EKH pro",
  },
  description:
    "Upload a wedding gallery. the EKH pro picks the strongest frames and writes the campaign: carousel, Reel, TikTok, blog, pins, newsletter and more. Runs in your browser.",
  applicationName: "the EKH pro",
}

export const viewport: Viewport = {
  themeColor: "#121110",
  colorScheme: "dark",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable} ${geistMono.variable} dark h-full`}>
      <body className="min-h-full">
        <NuqsAdapter>
          <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
        </NuqsAdapter>
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
