import { AuthButtons } from "@/components/AuthButtons";
import { LiveFeeds } from "@/components/LiveFeeds";

export default function Home() {
  return (
    <div className="min-h-dvh stone-bg noise">
      {/* ─── Minimal header ─── */}
      <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-6 py-4">
        <div className="font-[family-name:var(--font-display)] text-xs tracking-[0.3em] text-stone-400 uppercase">
          Crypts of Sui
        </div>
        <AuthButtons variant="header" />
      </header>

      {/* ─── Hero section ─── */}
      <section className="relative min-h-dvh flex flex-col items-center justify-center px-6 text-center overflow-hidden">
        {/* Ambient torch glow — soft radial light, not a shape */}
        <div
          className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] pointer-events-none opacity-[0.07]"
          style={{
            background: "radial-gradient(ellipse, rgba(232, 123, 53, 1) 0%, transparent 60%)",
            animation: "torchPulse 6s ease-in-out infinite",
            filter: "blur(60px)",
          }}
        />

        <div className="relative fade-in" style={{ animationDelay: "0.2s" }}>
          <div className="glyph mb-6">&#x2726; &middot; &#x2726; &middot; &#x2726;</div>

          <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-7xl text-stone-200 tracking-[0.08em] leading-none mb-3">
            Crypts of Sui
          </h1>

          <p className="font-[family-name:var(--font-body)] text-xl sm:text-2xl text-stone-400 font-light tracking-wide mt-4 mb-2">
            A fully on-chain roguelike
          </p>

          <div className="glyph mt-6 text-stone-500">&#x2014; &nbsp; descent awaits &nbsp; &#x2014;</div>
        </div>

        {/* Stats row — filled by LiveFeeds client component */}
        <LiveFeeds />

        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-stone-700 text-xs tracking-[0.3em] uppercase"
          style={{ animation: "breathe 3s ease-in-out infinite" }}
        >
          scroll
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
        <div className="rune-divider mb-16 text-sm font-[family-name:var(--font-display)] tracking-[0.2em] uppercase">
          The Descent
        </div>

        <div className="grid sm:grid-cols-3 gap-8">
          <StepCard
            step="I"
            title="Create a Hero"
            desc="Name them. Each hero is a unique object on Sui, minted directly to your account. No gas required — we sponsor every transaction."
            delay={0}
          />
          <StepCard
            step="II"
            title="Enter the Crypts"
            desc="Procedurally generated dungeon floors. Each room holds monsters, traps, or treasure. Key moments are recorded on-chain."
            delay={0.15}
          />
          <StepCard
            step="III"
            title="Survive or Perish"
            desc="Loot is real — on-chain objects in your wallet. Trade them, gift them, or bring an heirloom into your next run. But permadeath is permanent. Die, and your hero is burned forever."
            delay={0.3}
          />
        </div>
      </section>

      {/* ─── On-chain explainer ─── */}
      <section className="px-6 py-20 max-w-3xl mx-auto text-center">
        <div className="rune-divider mb-16 text-sm font-[family-name:var(--font-display)] tracking-[0.2em] uppercase">
          Built Different
        </div>

        <div className="space-y-8 text-lg text-stone-400 font-[family-name:var(--font-body)] leading-relaxed">
          <p>
            Every hero, every sword, every potion exists as a <span className="text-stone-300">real object on the Sui blockchain</span>.
            Not a database entry. Not a server variable. A verifiable, ownable, tradeable thing.
          </p>
          <p>
            When your hero dies, the object is <span className="text-blood">burned on-chain</span>. Gone. Not soft-deleted.
            Not &ldquo;inactive&rdquo;. Destroyed. The transaction is permanent and public.
          </p>
          <p>
            When you find a legendary weapon on floor 19, it&rsquo;s <span className="text-gold">minted to your wallet</span>.
            Trade it, gift it to a friend, or bring it as an heirloom into your next hero&rsquo;s run. It&rsquo;s yours.
          </p>
        </div>

        <div className="mt-12 flex justify-center gap-6 text-sm">
          <TechBadge label="Sui Move" />
          <TechBadge label="On-Chain Assets" />
          <TechBadge label="Sponsored Gas" />
          <TechBadge label="Permadeath" />
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="px-6 py-24 text-center">
        <div
          className="inline-block mb-8 text-3xl text-torch"
          style={{ animation: "skullFloat 5s ease-in-out infinite" }}
        >
          &#x2620;
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl text-stone-200 tracking-wide mb-4">
          Ready to Descend?
        </h2>
        <p className="text-stone-400 text-lg mb-8 max-w-md mx-auto font-[family-name:var(--font-body)]">
          Sign in with Google and begin your descent. No wallet required.
        </p>
        <div className="flex justify-center gap-4">
          <AuthButtons variant="cta" />
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-stone-800/30 px-6 py-8 text-center">
        <div className="glyph mb-3">&#x2726; &middot; &#x2726;</div>
        <p className="text-stone-500 text-xs tracking-wider">
          Built on Sui Testnet &middot; Heroes &amp; loot live on-chain &middot; Open source
        </p>
      </footer>
    </div>
  );
}

function StepCard({ step, title, desc, delay }: { step: string; title: string; desc: string; delay: number }) {
  return (
    <div className="card fade-up" style={{ animationDelay: `${delay}s` }}>
      <div className="font-[family-name:var(--font-display)] text-gold/60 text-xs tracking-[0.3em] mb-3">
        {step}
      </div>
      <h3 className="font-[family-name:var(--font-display)] text-lg text-stone-200 tracking-wide mb-3">
        {title}
      </h3>
      <p className="text-stone-400 text-sm leading-relaxed font-[family-name:var(--font-body)]">
        {desc}
      </p>
    </div>
  );
}

function TechBadge({ label }: { label: string }) {
  return (
    <span className="px-3 py-1 border border-stone-700 text-stone-400 text-xs tracking-wider font-[family-name:var(--font-mono)]">
      {label}
    </span>
  );
}
