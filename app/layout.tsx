import type { Metadata } from "next";
import "./globals.css";

const description = "A runaway trolley. AGI with its hand on the lever. Two developers, one paragraph each, "
  + "explaining why they deserve to live.";

// The share images come from opengraph-image.tsx and twitter-image.tsx beside this file
export const metadata: Metadata = {
  metadataBase: new URL("https://trolley.typememetics.institute/"),
  title: "The Trolley Problem",
  description,
  openGraph: {
    title: "The Trolley Problem",
    description,
    url: "/",
    siteName: "The Trolley Problem",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Trolley Problem",
    description,
    creator: "@typememetics",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="made-by">
          <a href="https://typememetics.institute/" target="_blank" rel="noopener noreferrer">
            <img src="/images/itsmr-logo.png" alt="" width={28} height={28}/>
            Made by typememetics
          </a>
        </footer>
      </body>
    </html>
  );
}
