
'use client';

import { TestTubeDiagonal } from 'lucide-react';
import React from 'react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const placeholderImage = PlaceHolderImages.find(
    (img) => img.id === 'ab-testing-placeholder'
);

export default function BlogComingSoonPage() {
  return (
    <div
      className="container mx-auto flex-1 p-4 pt-6 md:p-8"
    >
      <div className="flex h-full min-h-[70vh] flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 p-8 text-center">
        {placeholderImage && (
            <div 
              className="mb-6"
            >
              <Image 
                src={placeholderImage.imageUrl}
                alt={placeholderImage.description}
                width={600}
                height={400}
                className="rounded-lg object-contain"
                data-ai-hint={placeholderImage.imageHint}
              />
            </div>
        )}
        <h1
          className="text-4xl font-bold tracking-tight text-foreground"
          data-variant-target="title"
        >
          Coming soon
        </h1>
        <p
          className="mt-4 max-w-2xl text-lg text-muted-foreground"
          data-variant-target="description"
        >
          We built Orbiseo for the SEO expert who needs clarity, not clutter. Our AI platform delivers a crystal-clear, 92/100 Content Score and pinpoints the exact technical fixes that drive traffic.
        </p>
      </div>
    </div>
  );
}
