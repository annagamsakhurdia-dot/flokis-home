import type { Metadata, Viewport } from "next";
import { Fraunces, Noto_Sans, Noto_Sans_Georgian } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const georgian = Noto_Sans_Georgian({
  variable: "--font-georgian",
  subsets: ["georgian", "latin"],
  weight: ["300", "400", "600", "700", "800"],
});

const noto = Noto_Sans({
  variable: "--font-noto",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700", "800"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "ფლოკის სახლი — ძაღლების სასტუმრო",
  description: "ფლოკის სახლი (Floki's Home), Tbilisi: overnight boarding and daycare garden.",
};

export const viewport: Viewport = {
  themeColor: "#3B2418",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ka" className={`${georgian.variable} ${noto.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
