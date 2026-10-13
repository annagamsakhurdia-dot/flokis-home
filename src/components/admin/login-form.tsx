"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  const [email, setEmail] = useState(defaultEmail);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="email">ელფოსტა</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 bg-cream" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">პაროლი</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11 bg-cream" />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-[#fdf0ee] px-3 py-2 text-xs font-semibold text-[#922b21]">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-11 w-full rounded-xl bg-terracotta text-sm font-bold text-white hover:bg-[#b85a38]">
        {pending && <Loader2 className="animate-spin" />}
        შესვლა
      </Button>
    </form>
  );
}
