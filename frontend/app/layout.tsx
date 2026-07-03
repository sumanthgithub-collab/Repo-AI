import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import Navbar from "@/components/Navbar";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RepoTalk — Chat with Any GitHub Repository",
  description:
    "An AI-powered developer tool that lets you have a natural language conversation with any GitHub repository. Get grounded answers with file:line citations.",
  keywords: ["GitHub", "RAG", "AI", "codebase", "developer tool", "code search"],
  authors: [{ name: "RepoTalk" }],
  openGraph: {
    title: "RepoTalk — Chat with Any GitHub Repository",
    description: "Ask questions about any codebase and get cited, grounded answers.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.variable} style={{ fontFamily: "var(--font-sans)" }} suppressHydrationWarning>
          <Navbar />
          <div
            style={{
              paddingTop: "var(--navbar-h)",
              minHeight: "100vh",
            }}
          >
            {children}
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
