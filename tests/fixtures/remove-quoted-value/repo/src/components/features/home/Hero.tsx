import { sections } from '@/config/content';
import { Display, Body } from '@/components/ui/Typography';

const Hero = () => (
  <section id="home" aria-labelledby="hero-title">
    <header>
      <p className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-xs uppercase">
        <span className="h-2 w-2 rounded-full bg-primary-400" aria-hidden="true" />
        <span className="sr-only">Availability: </span>
        {sections.hero.availability}
      </p>
      <Display id="hero-title">{sections.hero.title}</Display>
      <Body>{sections.hero.description}</Body>
    </header>
  </section>
);

export default Hero;
