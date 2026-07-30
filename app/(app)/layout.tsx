"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth/client";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Client-side guard, not `middleware.ts` — the session lives in `localStorage` (bearer-token
 * pattern, see lib/auth/client.ts), which edge middleware cannot read. This means there's an
 * unavoidable one-frame "pending" flash before a signed-out user gets redirected, unlike a
 * cookie-based setup where middleware can redirect before any client JS runs. Accepted trade-off
 * of the cross-origin Neon Auth client — see ARCHITECTURE.md's "Auth provider" section.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [isPending, session, router]);

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full max-w-md" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
