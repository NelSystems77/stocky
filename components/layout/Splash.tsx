export function Splash() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg" aria-label="Cargando Stocky">
      <div className="flex animate-pulse flex-col items-center gap-2">
        <span className="text-xs tracking-[0.3em] text-text-muted uppercase">NelSystems</span>
        <h1 className="bg-gradient-to-r from-accent to-info bg-clip-text text-5xl font-bold text-transparent">
          Stocky
        </h1>
      </div>
    </main>
  );
}
