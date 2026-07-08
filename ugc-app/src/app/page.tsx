export default function Home() {
  return (
    <main className="landing-page" aria-label="Nexeire landing page">
      <div className="landing-sky" aria-hidden="true" />
      <section className="landing-hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Nexeire</h1>
        <p className="landing-one-liner">Run UGC marketing on autopilot</p>
        <div className="landing-actions" aria-label="Primary actions">
          <a className="landing-button landing-button-primary" href="/login">
            Sign in
          </a>
        </div>
      </section>
    </main>
  );
}
