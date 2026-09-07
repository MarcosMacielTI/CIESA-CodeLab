import { Link, Route, Routes } from 'react-router-dom';

function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-slate-50">
      <div className="max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-10 shadow-2xl shadow-slate-950/40">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-cyan-400">
          CIESA CodeLab
        </p>
        <h1 className="text-4xl font-bold tracking-tight">Fundação do projeto pronta</h1>
        <p className="mt-4 text-lg text-slate-300">
          Este é o ponto de partida da plataforma educacional. A estrutura do monorepo, infraestrutura base,
          tooling e configuração inicial já estão em funcionamento.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400"
            to="/"
          >
            Início
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  );
}
