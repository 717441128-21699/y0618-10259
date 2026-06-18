'use client';

import { useState, useEffect } from 'react';
import { Eye } from 'lucide-react';
import { incrementView } from '@/lib/actions/view';

interface ViewCounterProps {
  articleId: string;
  initialViews: number;
}

export function ViewCounter({ articleId, initialViews }: ViewCounterProps) {
  const [views, setViews] = useState(initialViews);

  useEffect(() => {
    const tracked = sessionStorage.getItem(`viewed_${articleId}`);
    if (!tracked) {
      incrementView(articleId).then((result) => {
        if (result.isNew) {
          setViews(result.views);
          sessionStorage.setItem(`viewed_${articleId}`, 'true');
        }
      });
    }
  }, [articleId]);

  return (
    <span className="flex items-center gap-1">
      <Eye className="w-4 h-4" />
      {views}
    </span>
  );
}
