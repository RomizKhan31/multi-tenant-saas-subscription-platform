import { Loader2 } from 'lucide-react';

export default function PlatformAdminLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <Loader2 className="size-10 animate-spin text-indigo-600" />
      <p className="text-sm font-medium text-slate-500">Loading platform console...</p>
    </div>
  );
}
