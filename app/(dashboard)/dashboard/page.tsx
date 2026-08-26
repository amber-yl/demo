"use client";

import dynamic from "next/dynamic";

// DashboardPage 已迁移到 components/DashboardPage.tsx，内部自带 useRouter
const DashboardPageView = dynamic(
  () => import("../../components/DashboardPage"),
  { ssr: false },
);

export default function DashboardRoutePage() {
  return <DashboardPageView />;
}
