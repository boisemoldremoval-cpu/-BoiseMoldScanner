import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { AccountMenu } from './AccountMenu.client';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { BRAND } from '~/config/brand';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';

export function Header() {
  const chat = useStore(chatStore);

  return (
    <header
      className={classNames('flex items-center px-4 border-b h-[var(--header-height)]', {
        'border-transparent': !chat.started,
        'border-bolt-elements-borderColor': chat.started,
      })}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        <div className="i-ph:sidebar-simple-duotone text-xl" />
        <a href="/" className="text-2xl font-semibold text-accent flex items-center">
          <img src={BRAND.markUrl} alt="" className="w-7 h-7 mr-2 inline-block" />
          <span className="text-xl font-bold tracking-tight text-bolt-elements-textPrimary">{BRAND.name}</span>
        </a>
        <a
          href="/apps"
          className="ml-3 flex items-center gap-1 px-2.5 py-1 text-sm rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2"
        >
          <span className="i-ph:squares-four" />
          My Apps
        </a>
      </div>
      {!chat.started && <div className="flex-1" />}
      {chat.started && ( // Display ChatDescription and HeaderActionButtons only when the chat has started.
        <>
          <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
          <ClientOnly>
            {() => (
              <div className="">
                <HeaderActionButtons chatStarted={chat.started} />
              </div>
            )}
          </ClientOnly>
        </>
      )}
      <div className="ml-3">
        <ClientOnly>{() => <AccountMenu />}</ClientOnly>
      </div>
    </header>
  );
}
