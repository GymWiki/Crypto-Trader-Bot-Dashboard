"use client";

import { useRouter } from "next/navigation";

import { authClient, setStoredBearerToken } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const handleSignOut = async () => {
    setStoredBearerToken(null);
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Trading platform dashboard</CardTitle>
          <CardDescription>
            Phase 2 of PLAN.md — auth only. Signed in as{" "}
            <strong>{session?.user.email}</strong>. Tenant resolution and the{" "}
            <code>/setup</code> status page land in Phase 3.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild variant="outline">
            <a
              href="https://github.com/GymWiki/Crypto-Trader-Bot-Dashboard/blob/main/ARCHITECTURE.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read ARCHITECTURE.md
            </a>
          </Button>
          <Button onClick={handleSignOut} variant="secondary">
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
