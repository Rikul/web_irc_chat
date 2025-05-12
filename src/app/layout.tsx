
"use client"; // Required for useEffect

import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import React, { useEffect } from "react"; // Import useEffect

// export const metadata: Metadata = { // metadata export removed as this is now a client component
//   title: 'ViteChat - Modern IRC Client',
//   description: 'A clean and modern IRC client app built with Next.js.',
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    // Apply theme from localStorage on initial load
    const storedTheme = localStorage.getItem('vitechat-theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (document.documentElement) { // Ensure documentElement exists
        if (storedTheme === 'dark' || (!storedTheme && systemPrefersDark)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
         {/* It's generally better to set title and meta tags in page.tsx or specific layouts if they vary */}
        <title>ViteChat - Modern IRC Client</title>
        <meta name="description" content="A clean and modern IRC client app built with Next.js." />
      </head>
      <body className={`${GeistSans.variable} font-sans antialiased`} suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

