import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Trading platform dashboard</CardTitle>
          <CardDescription>
            Phase 1 of PLAN.md — repo skeleton only. Auth, tenant resolution,
            and the <code>/setup</code> status page land in the next phases.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a
              href="https://github.com/GymWiki/Crypto-Trader-Bot-Dashboard/blob/main/ARCHITECTURE.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read ARCHITECTURE.md
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
