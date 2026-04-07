import { differenceInDays, isPast, isValid } from "date-fns";
import { AlertTriangle, AlertOctagon, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpiryAlertProps {
  expiryDate: string | Date;
  size?: 'sm' | 'lg';
  className?: string;
}

export function ExpiryAlert({ expiryDate, size = 'sm', className }: ExpiryAlertProps) {
  const date = new Date(expiryDate);
  if (!isValid(date)) return null;
  const daysLeft = differenceInDays(date, new Date());
  const isExpired = isPast(date) && daysLeft < 0;
  const isExpiringSoon = daysLeft <= 1 && !isExpired; // 1-day warning

  if (isExpired) {
    return (
      <div className={cn(
        "flex items-center gap-2 text-destructive font-medium rounded-full bg-destructive/10 px-3 py-1",
        size === 'lg' ? "text-lg px-4 py-2" : "text-xs",
        className
      )}>
        <AlertOctagon className={size === 'lg' ? "h-6 w-6" : "h-4 w-4"} />
        <span>Expired {Math.abs(daysLeft)} days ago</span>
      </div>
    );
  }

  if (isExpiringSoon) {
    return (
      <div className={cn(
        "flex items-center gap-2 text-yellow-600 font-medium rounded-full bg-yellow-100 px-3 py-1",
        size === 'lg' ? "text-lg px-4 py-2" : "text-xs",
        className
      )}>
        <AlertTriangle className={size === 'lg' ? "h-6 w-6" : "h-4 w-4"} />
        <span>Expires in {daysLeft} days</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2 text-primary font-medium rounded-full bg-primary/10 px-3 py-1",
      size === 'lg' ? "text-lg px-4 py-2" : "text-xs",
      className
    )}>
      <CheckCircle2 className={size === 'lg' ? "h-6 w-6" : "h-4 w-4"} />
      <span>Fresh ({daysLeft} days left)</span>
    </div>
  );
}
