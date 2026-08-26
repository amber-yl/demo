"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context";

export default function HomePage() {
  const { token, user } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (token && user) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [token, user, router]);

  return null;
}
