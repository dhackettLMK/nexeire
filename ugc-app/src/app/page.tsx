import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";

const checklist = [
  "Script generated",
  "Voiceover added",
  "Captions ready",
  "Hashtags packed",
];

export default function Home() {
  return (
    <main className="landing" aria-label="Nexeire">
      <div className="landing-bg" aria-hidden="true" />

      <header className="landing-nav">
        <Link href="/" className="landing-brand" aria-label="Nexeire home">
          <Image
            src="/nexeire-mark.png"
            alt=""
            width={34}
            height={34}
            priority
            className="landing-brand-mark"
          />
          <span className="landing-brand-name">nexeire</span>
        </Link>
        <nav className="landing-nav-actions" aria-label="Account">
          <Link href="/login" className="landing-navlink">
            Log in
          </Link>
          <Link href="/signup" className="landing-btn landing-btn-primary">
            Sign up
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <span className="landing-badge">
            <span className="landing-badge-dot" aria-hidden="true" />
            Early access · Join the beta
          </span>
          <h1 className="landing-title">
            Your content,
            <br />
            <em className="landing-title-accent">done overnight.</em>
            <br />
            by AI.
          </h1>
          <p className="landing-lede">
            Most businesses burn budget on UGC creators, videographers, and
            editors — and still wait weeks for content. Nexeire replaces your
            entire production team. Upload raw clips from your phone. Get
            finished, platform-ready videos back.
          </p>
          <div className="landing-cta">
            <Link
              href="/signup"
              className="landing-btn landing-btn-primary landing-btn-lg"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="landing-btn landing-btn-ghost landing-btn-lg"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="landing-visual" aria-hidden="true">
          <div className="landing-globe">
            <span className="landing-globe-meridian" />
            <span className="landing-globe-equator" />
          </div>
          <div className="landing-phone">
            <div className="landing-phone-notch" />
            <div className="landing-phone-status">
              <span>9:41</span>
              <span className="landing-phone-brand">nexeire</span>
            </div>
            <div className="landing-phone-screen">
              <p className="landing-phone-title">New batch</p>
              <p className="landing-phone-sub">Processing your clips…</p>
              <ul className="landing-checklist">
                {checklist.map((item, i) => (
                  <li key={item} style={{ "--i": i } as CSSProperties}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
