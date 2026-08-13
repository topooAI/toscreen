import { useCallback, useEffect, useState } from 'react';
import { History, LogOut, RotateCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ShareHistoryDialog } from './ShareHistoryDialog';

type Session = { state: 'loading' | 'signed-out' | 'signed-in' | 'expired' | 'offline'; user?: { displayName?: string; email?: string; avatarUrl?: string }; message?: string };
export function TopooUserPill({ onMenuOpenChange }: { onMenuOpenChange?: (open: boolean) => void } = {}) {
  const [session, setSession] = useState<Session>({ state: 'loading' });
  const [history, setHistory] = useState(false);

  const refresh = useCallback(async () => setSession(await window.electronAPI.topooSession()), []);
  useEffect(() => { void refresh(); return window.electronAPI.onTopooSessionChanged(refresh); }, [refresh]);

  const name = session.user?.displayName ?? session.user?.email ?? 'Topoo user';
  const initials = name.split(/\s+/).map(value=>value[0]).join('').slice(0,2).toUpperCase();
  if (session.state === 'loading') return null;
  if (session.state !== 'signed-in') return <button type="button" title={session.state === 'offline' ? 'Topoo is offline. Local editing and export remain available.' : session.state} onClick={async()=>{setSession({state:'loading'});try{const next=await window.electronAPI.topooSignIn();setSession(next);}catch(error){setSession({state:'offline',message:String(error)});}}} className="h-[26px] rounded-[8px] border-0 bg-transparent px-[9px] text-[12.8694px] leading-[18px] font-medium text-[#5a5a59] shadow-none transition-colors duration-100 hover:bg-[var(--ui-control-hover)] focus-visible:outline-none">{session.state === 'offline' ? 'Topoo offline' : session.state === 'expired' ? 'Session expired' : 'Sign in'}</button>;
  return (
    <div className="relative">
      <DropdownMenu onOpenChange={onMenuOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-[26px] items-center gap-2 rounded-[8px] border-0 bg-transparent px-[9px] py-[3px] text-left transition-colors duration-100 hover:bg-[var(--ui-control-hover)] focus-visible:outline-none"
          >
            {session.user?.avatarUrl ? (
              <img src={session.user.avatarUrl} alt="" className="size-[13px] rounded-full" />
            ) : (
              <svg viewBox="0 0 13 13" aria-hidden="true" className="size-[13px] shrink-0">
                <circle cx="6.5" cy="6.5" r="6.5" fill="black" />
                <text x="6.5" y="6.5" dy="0.06em" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="8" fontWeight="500">
                  {initials}
                </text>
              </svg>
            )}
            <span className="max-w-24 min-w-0 truncate text-[12.8694px] leading-[13px] font-medium text-[#5a5a59]">
              {name}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="toscreen-dropdown-menu z-[220] min-w-[160px] rounded-[8px] border-0 p-[3px] shadow-xl">
          <DropdownMenuItem onSelect={() => setHistory(true)} className="h-[26px] rounded-[5px] pl-2 pr-2 text-[12px] font-medium">
            <History size={13} strokeWidth={1.5} className="mr-[5.5px] text-neutral-500 shrink-0" />
            Share history
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void refresh()} className="h-[26px] rounded-[5px] pl-2 pr-2 text-[12px] font-medium">
            <RotateCw size={13} strokeWidth={1.5} className="mr-[5.5px] text-neutral-500 shrink-0" />
            Refresh account
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={async () => { await window.electronAPI.topooSignOut(); await refresh(); }} className="h-[26px] rounded-[5px] pl-2 pr-2 text-[12px] font-medium text-red-500 focus:text-red-500">
            <LogOut size={13} strokeWidth={1.5} className="mr-[5.5px] text-red-500 shrink-0" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {history && <ShareHistoryDialog onClose={() => setHistory(false)} />}
    </div>
  );
}
