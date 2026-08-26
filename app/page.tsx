"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginPage from "./components/LoginPage";
import { useApp } from "./context";

export default function HomePage() {
  const { token, user } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (token && user) {
      router.replace("/dashboard");
    }
  }, [token, user, router]);

  if (token && user) {
    return null;
  }

  return <LoginPage />;
}
