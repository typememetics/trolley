import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Trolley Problem",
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
