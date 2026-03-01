"use client";

import { useUser } from "@clerk/nextjs";
import { Headphones, ThumbsUp } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const selfHostMode = process.env.NEXT_PUBLIC_SELFHOST_MODE === "true";

function HeaderActions() {
  return (
    <div className="lg:flex items-center gap-3 hidden">
      <Button variant="outline" size="sm" asChild>
        <Link href="mailto:business@codewithantonio.com">
          <ThumbsUp />
          <span className="hidden lg:block">Feedback</span>
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href="mailto:business@codewithantonio.com">
          <Headphones />
          <span className="hidden lg:block">Need help?</span>
        </Link>
      </Button>
    </div>
  );
}

function AuthDashboardHeader() {
  const { isLoaded, user } = useUser();

  return (
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Nice to see you</p>
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
          {isLoaded ? (user?.fullName ?? user?.firstName ?? "there") : "..."}
        </h1>
      </div>
      <HeaderActions />
    </div>
  );
}

function SelfHostDashboardHeader() {
  return (
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Self-host mode</p>
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">there</h1>
      </div>
      <HeaderActions />
    </div>
  );
}

export function DashboardHeader() {
  if (selfHostMode) {
    return <SelfHostDashboardHeader />;
  }

  return <AuthDashboardHeader />;
}
