import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Faris Habib",
  description: "A bit about Faris Habib.",
};

export default function AboutPage() {
  return (
    <article className="about-page">
      <header className="article-header"></header>
      <div className="prose about-copy">
        <p>
          A place for everything I&apos;m curious about. I find that the most
          interesting things in life tend to come from the cross-pollination of
          different ideas.
        </p>
      </div>
      <figure className="about-photo">
        <Image
          src="/images/scotland.webp"
          alt="Black-and-white photo of hills across the water in Scotland"
          width={2400}
          height={1800}
          preload
          unoptimized
        />
      </figure>
    </article>
  );
}
