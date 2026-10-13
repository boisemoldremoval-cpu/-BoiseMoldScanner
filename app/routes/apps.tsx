import type { MetaFunction } from 'react-router';
import { ClientOnly } from 'remix-utils/client-only';
import { AppsDashboard } from '~/components/apps/AppsDashboard.client';
import { Header } from '~/components/header/Header';
import { BRAND } from '~/config/brand';

export const meta: MetaFunction = () => {
  return [{ title: `My Apps · ${BRAND.name}` }, { name: 'description', content: BRAND.tagline }];
};

export const loader = () => Response.json({});

export default function Apps() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <Header />
      <ClientOnly fallback={<div className="flex-1" />}>{() => <AppsDashboard />}</ClientOnly>
    </div>
  );
}
