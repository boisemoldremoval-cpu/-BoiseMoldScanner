import { useEffect, useState } from 'react';

export function useRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  const [segments, setSegments] = useState(read);

  useEffect(() => {
    const onChange = () => setSegments(read());
    window.addEventListener('hashchange', onChange);

    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return segments;
}

export function navigate(path: string) {
  window.location.hash = path;
}
