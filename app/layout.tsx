import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "./globals.css";
import { AppProvider } from "@/context";

export const metadata: Metadata = {
  title: "Nebula Sim Lab · 智能仿真管理平台",
  description: "面向算力、终端、能源与基础设施的智能仿真管理平台。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <AntdRegistry>
          <AppProvider>{children}</AppProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
