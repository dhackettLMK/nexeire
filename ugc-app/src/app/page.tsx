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

      <div className="landing-shell">
        <Link href="/" className="landing-brand" aria-label="Nexeire home">
          <Image
            src="/nexeire-mark.png"
            alt=""
            width={36}
            height={36}
            priority
            className="landing-brand-mark"
          />
          <span className="landing-brand-name">nexeire</span>
        </Link>

        <div className="landing-visual" aria-hidden="true">
          <div className="landing-glow" />
          <div className="landing-globe">
            <div className="landing-globe-sprite" />
          </div>
          <div className="landing-phone">
            <div className="landing-phone-notch" />
            <div className="landing-phone-status">
              <span>9:41</span>
              <span className="landing-phone-brand">nexeire</span>
            </div>
            <div className="landing-phone-screen">
              <div className="landing-phone-head">
                <p className="landing-phone-title">New batch</p>
                <span className="landing-phone-spinner" />
              </div>
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

        <nav className="landing-cta" aria-label="Account">
          <Link href="/login" className="landing-btn landing-btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="landing-btn landing-btn-primary">
            Sign up
          </Link>
        </nav>
      </div>
    </main>
  );
}
