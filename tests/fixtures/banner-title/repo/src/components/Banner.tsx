import { banner } from "@app/content/site";

export function Banner() {
  return (
    <section className="banner">
      <h1>{banner.title}</h1>
      <p>{banner.subtitle}</p>
    </section>
  );
}
