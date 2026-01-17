import type { Metadata } from "next";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veritas - AI-Powered Misinformation Detection",
  description: "Detect misinformation, political bias, and factual errors in web articles using advanced machine learning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Auth0Provider>
          {children}
        </Auth0Provider>
      </body>
    </html>
  );
}
