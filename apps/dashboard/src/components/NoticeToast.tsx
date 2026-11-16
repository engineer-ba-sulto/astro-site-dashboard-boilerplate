import { useEffect } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export function NoticeToast({ message }: { message?: string }) {
  useEffect(() => {
    if (message) toast(message);
  }, [message]);
  return <Toaster />;
}
