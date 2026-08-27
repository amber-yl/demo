import { AppProvider } from "@/context";

// Login 页不用 antd 组件（只用懒加载的 antd.message，它不依赖 ConfigProvider），
// 所以不需要 AntdRegistry，避免把 antd ConfigProvider 拉进编译
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppProvider>{children}</AppProvider>;
}
